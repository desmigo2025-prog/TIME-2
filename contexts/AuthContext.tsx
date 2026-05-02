import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, ActivityLog, PasskeyCredential } from '../types';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, specialWord: string) => Promise<void>;
  recoverAccount: (email: string) => Promise<void>;
  loginWithPasskey: (email: string, pin: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  setPasskey: (pin: string) => Promise<void>;
  removePasskey: () => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>, avatarFile?: File) => Promise<void>;
  activityLog: ActivityLog[];
  logActivity: (action: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Security Constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
// Fixed Regex: Allows any special character (non-word character)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
const DISPOSABLE_DOMAINS = ['tempmail.com', 'throwaway.com', 'mailinator.com', 'yopmail.com'];

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Session Management: Check for valid session on mount
  useEffect(() => {
    // Set Firebase persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // Firebase user is logged in
            const dbLocal = getStoredUsers();
            let targetUserKey = Object.keys(dbLocal).find(key => dbLocal[key].user.email === firebaseUser.email);
            
            let userData: User;

            try {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    const loadedUser = userDoc.data().user;
                    userData = {
                        ...loadedUser,
                        id: loadedUser.id || firebaseUser.uid,
                        username: loadedUser.username || firebaseUser.displayName?.replace(/\s+/g, '').toLowerCase() || firebaseUser.email?.split('@')[0] || 'user',
                        email: loadedUser.email || firebaseUser.email || '',
                        displayName: loadedUser.displayName || firebaseUser.displayName || 'User',
                        joinedDate: loadedUser.joinedDate || new Date().toISOString(),
                        avatarUrl: loadedUser.avatarUrl || firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.email}`,
                    };
                } else if (targetUserKey) {
                    userData = dbLocal[targetUserKey].user;
                } else {
                    userData = {
                        id: firebaseUser.uid,
                        username: firebaseUser.displayName?.replace(/\s+/g, '').toLowerCase() || firebaseUser.email?.split('@')[0] || 'user',
                        email: firebaseUser.email || '',
                        displayName: firebaseUser.displayName || 'User',
                        avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.email}`,
                        joinedDate: new Date().toISOString(),
                        passkeys: [],
                        passkeyHash: undefined,
                        backgroundAlertsEnabled: false,
                        googleIntegration: { isConnected: !!firebaseUser.providerData.find(p => p.providerId === 'google.com'), email: firebaseUser.email || undefined },
                        excelIntegration: {},
                        loginAttempts: 0,
                        lockUntil: null
                    };
                }
            } catch (e: any) {
                if (e.message?.includes('Firestore Error')) throw e;
                handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
            }

            if (!targetUserKey) {
                dbLocal[userData.id] = {
                    user: userData,
                    passwordHash: '',
                    specialWordHash: ''
                };
                localStorage.setItem('tt_db_users', JSON.stringify(dbLocal));
            }

            setUser(userData);
        } else {
            // Check local storage session (for non-Google users)
            const storedUser = localStorage.getItem('tt_user');
            const sessionExpiry = localStorage.getItem('tt_session_expiry');
            
            if (storedUser && sessionExpiry) {
              if (Date.now() > parseInt(sessionExpiry)) {
                // Session expired, but don't call logout() here to avoid loops, just clear state
                setUser(null);
                localStorage.removeItem('tt_user');
                localStorage.removeItem('tt_session_expiry');
              } else {
                setUser(JSON.parse(storedUser));
              }
            } else {
                setUser(null);
            }
        }
        setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const logActivity = (action: string) => {
      const newLog = { id: Date.now().toString(), action, timestamp: new Date().toISOString() };
      setActivityLog(prev => [newLog, ...prev]);
  };

  // Helper: Simulate Backend DB Check
  const getStoredUsers = (): Record<string, { user: User, passwordHash: string, specialWordHash: string }> => {
      const dbLocal = localStorage.getItem('tt_db_users');
      return dbLocal ? JSON.parse(dbLocal) : {};
  };

  const login = async (emailOrUsername: string, password: string) => {
      try {
          let loginEmail = emailOrUsername;
          if (!loginEmail.includes('@')) {
              const localDb = getStoredUsers();
              const targetUserKey = Object.keys(localDb).find(key => localDb[key].user.username === emailOrUsername);
              if (targetUserKey) {
                  loginEmail = localDb[targetUserKey].user.email;
              } else {
                  throw { code: 'INVALID_CREDENTIALS', message: "Invalid credentials." };
              }
          }

          const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
          const firebaseUser = userCredential.user;

          const localDb = getStoredUsers();
          let userData: User;

          try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                  userData = userDoc.data().user;
              } else {
                  let targetUserKey = Object.keys(localDb).find(key => localDb[key].user.email === firebaseUser.email);
                  userData = targetUserKey ? localDb[targetUserKey].user : {
                      id: firebaseUser.uid,
                      username: firebaseUser.displayName?.replace(/\s+/g, '').toLowerCase() || firebaseUser.email?.split('@')[0] || 'user',
                      email: firebaseUser.email || '',
                      displayName: firebaseUser.displayName || 'User',
                      avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.email}`,
                      joinedDate: new Date().toISOString(),
                      passkeys: [],
                      passkeyHash: undefined,
                      backgroundAlertsEnabled: false,
                      googleIntegration: { isConnected: false },
                      excelIntegration: {},
                      loginAttempts: 0,
                      lockUntil: null
                  };
              }
          } catch (e: any) {
              if (e.message?.includes('Firestore Error')) throw e;
              handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
          }

          completeLogin(userData, localDb);
          logActivity('Logged in via Firebase');
      } catch (error: any) {
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
              throw { code: 'INVALID_CREDENTIALS', message: "Invalid email or password." };
          } else if (error.code === 'auth/too-many-requests') {
              throw { code: 'ACCOUNT_LOCKED', message: "Too many failed attempts. Account locked temporarily." };
          } else {
              throw { code: 'AUTH_ERROR', message: error.message || "Failed to log in." };
          }
      }
  };

  const loginWithPasskey = async (email: string, pin: string) => {
      return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
              if (!/^\d{4}$/.test(pin)) {
                  return reject({ code: 'INVALID_FORMAT', message: "Passkey must be 4 digits." });
              }

              const dbLocal = getStoredUsers();
              const targetUserKey = Object.keys(dbLocal).find(key => dbLocal[key].user.email === email);

              if (!targetUserKey) {
                  return reject({ code: 'USER_NOT_FOUND', message: "User not found." });
              }

              const record = dbLocal[targetUserKey];

              if (!record.user.passkeyHash) {
                  return reject({ code: 'NO_PASSKEY', message: "No passkey set up for this account." });
              }

              // Verify PIN Hash (Simple btoa for simulation)
              const pinHash = btoa(pin);
              
              if (record.user.passkeyHash !== pinHash) {
                   record.user.loginAttempts += 1;
                   localStorage.setItem('tt_db_users', JSON.stringify(dbLocal));
                   return reject({ code: 'INVALID_PASSKEY', message: "Incorrect Passkey." });
              }

              completeLogin(record.user, dbLocal);
              logActivity('Logged in via 4-Digit Passkey');
              resolve();
          }, 500);
      });
  };

  const loginWithGoogle = async () => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const firebaseUser = result.user;
          
          let userData: User | null = null;
          try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                  userData = userDoc.data().user;
              }
          } catch(e) {
              console.warn("Failed to fetch existing user profile during Google login", e);
          }
          
          const dbLocal = getStoredUsers();
          
          // If the user already exists in Firestore, just log them in
          if (userData) {
              if (!dbLocal[userData.id]) {
                  dbLocal[userData.id] = { user: userData, passwordHash: '', specialWordHash: '' };
              }
              completeLogin(userData, dbLocal);
              logActivity('Logged in via Google (existing user)');
              return;
          }
          
          let targetUserKey = Object.keys(dbLocal).find(key => dbLocal[key].user.email === firebaseUser.email);
          
          if (targetUserKey) {
              const record = dbLocal[targetUserKey];
              completeLogin(record.user, dbLocal);
              logActivity('Logged in via Google');
          } else {
              const newUser: User = {
                  id: firebaseUser.uid,
                  username: firebaseUser.displayName?.replace(/\s+/g, '').toLowerCase() || firebaseUser.email?.split('@')[0] || 'user',
                  email: firebaseUser.email || '',
                  displayName: firebaseUser.displayName || 'Google User',
                  avatarUrl: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.email}`,
                  joinedDate: new Date().toISOString(),
                  passkeys: [],
                  passkeyHash: undefined,
                  backgroundAlertsEnabled: false,
                  googleIntegration: { isConnected: true, email: firebaseUser.email || undefined },
                  excelIntegration: {},
                  loginAttempts: 0,
                  lockUntil: null
              };
              dbLocal[newUser.id] = {
                  user: newUser,
                  passwordHash: '',
                  specialWordHash: ''
              };
              
              try {
                  const cleanNewUser = JSON.parse(JSON.stringify(newUser, (key, value) => {
                      if (value === null && key !== 'lockUntil') return undefined;
                      return value;
                  }));
                  await setDoc(doc(db, 'users', firebaseUser.uid), {
                      user: cleanNewUser
                  });
              } catch (e: any) {
                  if (e.message?.includes('Firestore Error')) throw e;
                  handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
              }

              completeLogin(newUser, dbLocal);
              logActivity('Account created via Google');
          }
      } catch (error: any) {
          console.error("Google Sign-In Error:", error);
          if (error.code === 'auth/popup-blocked') {
              throw { code: 'POPUP_BLOCKED', message: "Popup blocked by browser. Please allow popups for this site." };
          } else if (error.code === 'auth/popup-closed-by-user') {
              throw { code: 'POPUP_CLOSED', message: "Google sign-in was cancelled." };
          } else if (error.code === 'auth/network-request-failed') {
              throw { code: 'NETWORK_ERROR', message: "Network error. Please check your connection." };
          } else {
              throw { code: 'GOOGLE_AUTH_ERROR', message: error.message || "Failed to sign in with Google." };
          }
      }
  };

  const completeLogin = (user: User, dbLocal: any) => {
      user.loginAttempts = 0;
      user.lockUntil = null;
      user.lastLoginIP = '192.168.1.1'; // Mock IP
      
      localStorage.setItem('tt_db_users', JSON.stringify(dbLocal));
      
      const sessionDuration = 60 * 60 * 1000; 
      localStorage.setItem('tt_session_expiry', (Date.now() + sessionDuration).toString());
      localStorage.setItem('tt_user', JSON.stringify(user));
      
      setUser(user);
      logActivity('Logged in successfully');
  };

  const signup = async (username: string, email: string, password: string, specialWord: string) => {
      if (!PASSWORD_REGEX.test(password)) throw { code: 'WEAK_PASSWORD', message: "Password weak." };
      if (!email.includes('@')) throw { code: 'INVALID_EMAIL', message: "Invalid email." };
      if (specialWord.length < 6) throw { code: 'INVALID_SPECIAL_WORD', message: "Special word must be 6+ chars." };

      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          const newUser: User = {
              id: firebaseUser.uid,
              username,
              email,
              displayName: username,
              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
              joinedDate: new Date().toISOString(),
              passkeys: [],
              passkeyHash: undefined,
              backgroundAlertsEnabled: false,
              googleIntegration: { isConnected: false },
              excelIntegration: {},
              loginAttempts: 0,
              lockUntil: null
          };

          try {
              const cleanNewUser = JSON.parse(JSON.stringify(newUser, (key, value) => {
                  if (value === null && key !== 'lockUntil') return undefined;
                  return value;
              }));
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                  user: cleanNewUser,
                  specialWordHash: btoa(specialWord.toLowerCase().trim())
              });
          } catch (e: any) {
              if (e.message?.includes('Firestore Error')) throw e;
              handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
          }

          const localDb = getStoredUsers();
          localDb[newUser.id] = {
              user: newUser,
              passwordHash: '',
              specialWordHash: btoa(specialWord.toLowerCase().trim())
          };
          localStorage.setItem('tt_db_users', JSON.stringify(localDb));

          completeLogin(newUser, localDb);
          logActivity('Account created via Firebase');
      } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
              throw { code: 'EMAIL_EXISTS', message: "Email already registered." };
          } else if (error.code === 'auth/weak-password') {
              throw { code: 'WEAK_PASSWORD', message: "Password is too weak." };
          } else if (error.code === 'auth/invalid-email') {
              throw { code: 'INVALID_EMAIL', message: "Invalid email format." };
          } else {
              throw { code: 'AUTH_ERROR', message: error.message || "Failed to create account." };
          }
      }
  };

  const recoverAccount = async (email: string) => {
      try {
          console.log(`Attempting to send password reset email to: ${email}`);
          await sendPasswordResetEmail(auth, email);
          console.log(`Successfully sent password reset email to: ${email}`);
          logActivity(`Password reset email sent to ${email}`);
      } catch (error: any) {
          console.error("Error sending password reset email:", error);
          if (error.code === 'auth/user-not-found') {
              throw { code: 'USER_NOT_FOUND', message: "Email not registered" };
          } else if (error.code === 'auth/invalid-email') {
              throw { code: 'INVALID_EMAIL', message: "Invalid email format" };
          } else if (error.code === 'auth/network-request-failed') {
              throw { code: 'NETWORK_ERROR', message: "Check your internet connection" };
          } else {
              throw { code: 'AUTH_ERROR', message: error.message || "Failed to send reset email." };
          }
      }
  };

  const setPasskey = async (pin: string) => {
      if (!user) return;
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits.");

      const pinHash = btoa(pin); // Simulated hash
      
      const updatedUser = { 
          ...user, 
          passkeyHash: pinHash
      };

      await updateProfile(updatedUser);
      logActivity('Updated 4-Digit Passkey');
  };

  const removePasskey = async () => {
      if (!user) return;
      const updatedUser = {
          ...user,
          passkeyHash: undefined
      };
      await updateProfile(updatedUser);
      logActivity('Removed Passkey');
  };

  const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out from Firebase:", error);
    }
    setUser(null);
    localStorage.removeItem('tt_user');
    localStorage.removeItem('tt_session_expiry');
  };

  const updateProfile = async (updates: Partial<User>, avatarFile?: File) => {
    if (user) {
      let updatedUser = { ...user, ...updates };

      // Handle Avatar Upload
      if (avatarFile) {
          const base64Avatar = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const MAX_WIDTH = 256;
                      const MAX_HEIGHT = 256;
                      let width = img.width;
                      let height = img.height;

                      if (width > height) {
                          if (width > MAX_WIDTH) {
                              height *= MAX_WIDTH / width;
                              width = MAX_WIDTH;
                          }
                      } else {
                          if (height > MAX_HEIGHT) {
                              width *= MAX_HEIGHT / height;
                              height = MAX_HEIGHT;
                          }
                      }

                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      ctx?.drawImage(img, 0, 0, width, height);
                      resolve(canvas.toDataURL('image/jpeg', 0.8));
                  };
                  img.src = e.target?.result as string;
              };
              reader.readAsDataURL(avatarFile);
          });
          updatedUser.avatarUrl = base64Avatar;
      }

      setUser(updatedUser);
      localStorage.setItem('tt_user', JSON.stringify(updatedUser));
      
      const dbLocal = getStoredUsers();
      if (dbLocal[user.id]) {
          dbLocal[user.id].user = updatedUser;
          localStorage.setItem('tt_db_users', JSON.stringify(dbLocal));
      }

      try {
          // Remove undefined and null values before sending to Firestore (except lockUntil)
          const cleanUser = JSON.parse(JSON.stringify(updatedUser, (key, value) => {
              if (value === null && key !== 'lockUntil') return undefined;
              return value;
          }));
          await updateDoc(doc(db, 'users', user.id), {
              user: cleanUser
          });
      } catch (e: any) {
          if (e.message?.includes('Firestore Error')) throw e;
          handleFirestoreError(e, OperationType.UPDATE, `users/${user.id}`);
      }

      logActivity('Profile updated');
    }
  };

  if (!isAuthReady) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tt-blue"></div>
          </div>
      );
  }

  return (
    <AuthContext.Provider value={{ 
        user, isAuthenticated: !!user, 
        login, loginWithPasskey, loginWithGoogle, signup, recoverAccount,
        setPasskey, removePasskey,
        logout, updateProfile, 
        activityLog, logActivity 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
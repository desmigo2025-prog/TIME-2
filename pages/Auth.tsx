import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, User, ArrowRight, AlertCircle, Check, ShieldCheck, KeyRound, Fingerprint, RefreshCcw, XCircle } from 'lucide-react';
import BootAnimation from '../components/BootAnimation';

let globalBootPlayed = false;

const Auth = () => {
  const [showBoot, setShowBoot] = useState(!globalBootPlayed);
  const [viewState, setViewState] = useState<'login' | 'register' | 'recovery' | 'passkey'>('login');
  
  // Form States
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [specialWord, setSpecialWord] = useState('');
  
  // Passkey PIN State
  const [pin, setPin] = useState('');
  
  // UI States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, loginWithPasskey, loginWithGoogle, signup, recoverAccount } = useAuth();
  const navigate = useNavigate();

  // Password Strength Logic
  const getPasswordStrength = (pass: string) => {
      let score = 0;
      if (pass.length >= 12) score++;
      if (/[A-Z]/.test(pass)) score++;
      if (/[a-z]/.test(pass)) score++;
      if (/[0-9]/.test(pass)) score++;
      if (/[\W_]/.test(pass)) score++; 
      return score;
  };
  const passStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (viewState === 'login') {
        await login(email, password);
        navigate('/');
      } else if (viewState === 'register') {
        if (passStrength < 5) throw { code: 'WEAK', message: "Password too weak." };
        await signup(username, email, password, specialWord);
        setSuccessMsg("Account created! Logging in...");
        setTimeout(async () => {
            await login(email, password);
            navigate('/');
        }, 1000);
      } else if (viewState === 'recovery') {
        if (!email || !email.includes('@')) {
            throw { message: "Please enter a valid email address." };
        }
        await recoverAccount(email);
        setSuccessMsg("Password reset link has been sent. Please check your email (including spam/junk folder).");
        setTimeout(() => setViewState('login'), 5000);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const initPasskeyLogin = () => {
      if (!email) {
          setError("Please enter your email to identify your account first.");
          return;
      }
      setError('');
      setViewState('passkey');
      setPin('');
  };

  const handlePinSubmit = async () => {
      if (pin.length !== 4) return;
      setLoading(true);
      setError('');
      try {
          await loginWithPasskey(email, pin);
          navigate('/');
      } catch (err: any) {
          setError(err.message || "Passkey login failed.");
          setPin(''); // Reset PIN on failure
      } finally {
          setLoading(false);
      }
  };

  const handlePinInput = (num: number) => {
      if (pin.length < 4) {
          const newPin = pin + num;
          setPin(newPin);
          if (newPin.length === 4) {
              // Auto-submit when 4 digits reached? Or wait for button.
              // Let's rely on button for user confirmation or add effect.
          }
      }
  };

  if (showBoot) {
      return (
          <BootAnimation onComplete={() => {
              globalBootPlayed = true;
              setShowBoot(false);
          }} />
      );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundImage: "url('/bg.png'), url('/bg.webp'), url('/bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", backgroundColor: "#0F172A" }}
    >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] z-0"></div>
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-tt-blue/20 rounded-full blur-3xl animate-pulse z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-tt-red/20 rounded-full blur-3xl animate-pulse z-0"></div>

      <div className="glass-panel w-full max-w-md p-8 rounded-3xl shadow-2xl z-10 border border-gray-700/50 relative">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-tt-blue to-cyan-500 p-3 rounded-xl shadow-lg shadow-tt-blue/20">
                <ShieldCheck size={32} className="text-white" />
              </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
              {viewState === 'recovery' ? 'Account Recovery' : viewState === 'passkey' ? 'Quick Login' : 'T.T Secure Access'}
          </h1>
          <p className="text-gray-400 text-sm">Enterprise-Grade Timetable Management</p>
        </div>

        {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-xl mb-6 text-sm flex items-start gap-2 animate-bounce-in">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
            </div>
        )}

        {successMsg && (
            <div className="bg-tt-green/10 border border-tt-green/50 text-green-200 p-3 rounded-xl mb-6 text-sm flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0" />
                <span>{successMsg}</span>
            </div>
        )}

        {(viewState === 'login' || viewState === 'register') && (
            <div className="flex gap-4 mb-6 bg-gray-900/50 p-1 rounded-xl">
                <button
                    type="button"
                    className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${viewState === 'login' ? 'bg-tt-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => { setViewState('login'); setError(''); setSuccessMsg(''); }}
                    disabled={loading}
                >
                    Login
                </button>
                <button
                    type="button"
                    className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${viewState === 'register' ? 'bg-tt-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => { setViewState('register'); setError(''); setSuccessMsg(''); }}
                    disabled={loading}
                >
                    Register
                </button>
            </div>
        )}

        {viewState === 'passkey' ? (
            <div className="space-y-6">
                <p className="text-center text-sm text-gray-400">Enter your 4-digit PIN for <b>{email}</b></p>
                <div className="flex justify-center gap-4 mb-4">
                      {[0,1,2,3].map(i => (
                          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? 'bg-tt-blue border-tt-blue scale-110' : 'border-gray-600'}`}></div>
                      ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => handlePinInput(num)} className="h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold transition-colors">
                              {num}
                          </button>
                      ))}
                      <div className="col-start-2">
                           <button onClick={() => handlePinInput(0)} className="w-full h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold transition-colors">0</button>
                      </div>
                      <div className="col-start-3">
                           <button onClick={() => setPin(prev => prev.slice(0, -1))} className="w-full h-14 rounded-xl hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors"><XCircle size={24}/></button>
                      </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setViewState('login')} className="flex-1 py-3 bg-gray-800 rounded-xl text-gray-400 font-bold text-sm">Cancel</button>
                    <button 
                        onClick={handlePinSubmit} 
                        disabled={loading || pin.length !== 4} 
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${pin.length === 4 ? 'bg-tt-blue text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                    >
                        {loading ? 'Verifying...' : 'Unlock'}
                    </button>
                </div>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* USERNAME (Register Only) */}
            {viewState === 'register' && (
                <div className="relative group">
                <User className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-tt-blue transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Username (Unique)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-tt-blue focus:ring-1 focus:ring-tt-blue placeholder:text-gray-600"
                    required
                    disabled={loading}
                />
                </div>
            )}
            
            {/* EMAIL (All Views) */}
            <div className="relative group">
                <Mail className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-tt-blue transition-colors" size={20} />
                <input
                type="email"
                placeholder={viewState === 'login' ? "Email or Username" : "Valid Email Address"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-tt-blue focus:ring-1 focus:ring-tt-blue placeholder:text-gray-600"
                required
                disabled={loading}
                />
            </div>

            {/* PASSWORD (Login & Register) */}
            {viewState !== 'recovery' && (
                <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-tt-blue transition-colors" size={20} />
                    <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-tt-blue focus:ring-1 focus:ring-tt-blue placeholder:text-gray-600"
                    required
                    disabled={loading}
                    />
                </div>
            )}

            {/* SPECIAL RECOVERY WORD (Register & Recovery) */}
            {(viewState === 'register') && (
                <div className="relative group">
                    <KeyRound className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-tt-blue transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Special Recovery Word (6+ chars)"
                        value={specialWord}
                        onChange={(e) => setSpecialWord(e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-tt-blue focus:ring-1 focus:ring-tt-blue placeholder:text-gray-600"
                        required
                        disabled={loading}
                    />
                    <p className="text-[10px] text-gray-500 mt-1 pl-1">Used to reset password if forgotten.</p>
                </div>
            )}

            {/* Password Strength Indicator */}
            {(viewState === 'register') && (
                <div className="space-y-1 px-1 pt-1">
                    <div className="flex gap-1 h-1 mb-2">
                        {[1,2,3,4,5].map(i => (
                            <div key={i} className={`flex-1 rounded-full h-full transition-all duration-300 ${passStrength >= i ? 'bg-tt-green' : 'bg-gray-700'}`}></div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400">
                        Must contain: 12+ chars, uppercase, lowercase, number, special char.
                    </p>
                </div>
            )}

            {/* Actions & Buttons */}
            <div className="space-y-3 pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full bg-gradient-to-r from-tt-blue to-blue-600 hover:from-tt-green hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {loading ? (viewState === 'recovery' ? 'Sending...' : 'Processing...') : (
                        viewState === 'login' ? 'Secure Login' : 
                        viewState === 'register' ? 'Create Account' : 'Reset Password'
                    )}
                    {!loading && <ArrowRight size={20} />}
                </button>
                
                {viewState === 'login' && (
                    <button
                        type="button"
                        onClick={initPasskeyLogin}
                        disabled={loading}
                        className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl border border-gray-600 transition-all flex items-center justify-center gap-2"
                    >
                        <Fingerprint size={20} className="text-tt-blue" />
                        Login with Passkey
                    </button>
                )}

                {(viewState === 'login' || viewState === 'register') && (
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                setLoading(true);
                                setError('');
                                await loginWithGoogle();
                                navigate('/');
                            } catch (err: any) {
                                setError(err.message || "Google Sign-In failed.");
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3.5 rounded-xl border border-gray-300 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            <path fill="none" d="M1 1h22v22H1z" />
                        </svg>
                        Sign in with Google
                    </button>
                )}
            </div>
            </form>
        )}
        
        {/* Footer Links */}
        {viewState !== 'passkey' && (
            <div className="mt-6 text-center space-y-2">
                {viewState === 'login' && (
                    <button onClick={() => { setViewState('recovery'); setError(''); setSuccessMsg(''); }} className="text-xs text-tt-blue hover:text-white transition-colors">
                        Forgot Password?
                    </button>
                )}
                {viewState === 'recovery' && (
                    <button onClick={() => { setViewState('login'); setError(''); setSuccessMsg(''); }} className="text-xs text-gray-500 hover:text-white transition-colors">
                        Back to Login
                    </button>
                )}
                <div className="pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-500">Protected by T.T Enterprise Security</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
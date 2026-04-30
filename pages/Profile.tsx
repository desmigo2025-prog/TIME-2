import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { useUsage } from '../contexts/UsageContext';
import { useAI } from '../contexts/AIContext';
import { Card } from '../components/ui/Card';
import { Settings, LogOut, Edit2, Shield, Activity, MoreVertical, X, Fingerprint, Camera, Trash2, CheckCircle, Calendar as CalIcon, FileSpreadsheet, RefreshCw, Upload, Link2, Unlink, Bell, Smartphone, Lock, Bot, Mic, Brain, ImageIcon, MessageSquare, Palette, Crown, Download, List, ChevronDown, ChevronUp, User, CreditCard, HelpCircle, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import UpgradeModal from '../components/UpgradeModal';
import { extractNewsFromLink, ParsedNews } from '../services/geminiService';
import { LinkRecord } from '../types';
import AIAvatar from '../components/AIAvatar';

const Profile = () => {
  const { user, logout, updateProfile, activityLog, setPasskey, removePasskey, recoverAccount } = useAuth();
  const { tasks, importTasksFromCSV, syncGoogleCalendar, importTasks } = useTasks();
  const { isPro, canAddLink, incrementLinkUsage, getUsageStats } = useUsage();
  const { aiActionsLog } = useAI();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiAvatarInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setActiveCategory(prev => prev === section ? null : section);
  };

  const [formData, setFormData] = useState({
      displayName: user?.displayName || user?.username || '',
      email: user?.email || ''
  });

  const [announcementLinkInput, setAnnouncementLinkInput] = useState(user?.announcementLink || '');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [showLinkHistoryModal, setShowLinkHistoryModal] = useState(false);
  const [isExtractingLink, setIsExtractingLink] = useState(false);

  // Helper to determine if custom color is light
  const isCustomLight = () => {
      if (user?.aiSettings?.theme !== 'custom' || !user?.aiSettings?.customThemeColor) return false;
      const hex = user.aiSettings.customThemeColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return brightness > 155;
  };

  const isLightTheme = user?.aiSettings?.theme === 'nature' || user?.aiSettings?.theme === 'ladies' || user?.aiSettings?.theme === 'white' || isCustomLight();

  const handleSaveLink = async () => {
      if (!announcementLinkInput || !/^https?:\/\/.+/.test(announcementLinkInput)) {
          alert('Please enter a valid URL starting with http:// or https://');
          return;
      }
      
      const currentHistory = user?.linkHistory || [];
      const isDuplicate = currentHistory.some(l => l.url === announcementLinkInput);
      
      if (isDuplicate) {
          alert('This link is already in your history.');
          return;
      }
      
      // Check active links limit
      const activeLinks = currentHistory.filter(l => l.status === 'active');
      if (!isPro && activeLinks.length >= 1) {
          alert('Free users can only have 1 active link. Please deactivate an existing link or upgrade to Pro.');
          setShowUpgradeModal(true);
          return;
      }

      if (announcementLinkInput !== user?.announcementLink) {
          if (!canAddLink) {
              setShowUpgradeModal(true);
              return;
          }
          await incrementLinkUsage();
      }

      setIsExtractingLink(true);
      try {
          // Extract content
          const parsedNews = await extractNewsFromLink(announcementLinkInput);
          
          const newLink: LinkRecord = {
              id: Date.now().toString(),
              url: announcementLinkInput,
              dateAdded: new Date().toISOString(),
              status: 'active',
              title: parsedNews.title,
              publishedDate: parsedNews.date,
              contentSummary: parsedNews.summary,
              newsCategories: [parsedNews.category === 'Daily news' ? 'news' : parsedNews.category === 'Important updates' ? 'update' : 'general']
          };
          
          const updatedHistory = [newLink, ...currentHistory];
          
          updateProfile({ 
              announcementLink: announcementLinkInput, // keep main active
              linkHistory: updatedHistory
          });
          
          setIsEditingLink(false);
          setAnnouncementLinkInput('');
          alert(`Link added successfully!\nExtracted: ${parsedNews.title}\nCategory: ${parsedNews.category}`);
          
          if (parsedNews.isImportant) {
             alert(`Important Update Detected:\n${parsedNews.summary}`);
          }
      } catch (err) {
          console.error("Link Extraction error:", err);
          alert('Could not fully extract content from the link, but it was still added to your history.');
          // Fallback just add it
          const newLink: LinkRecord = {
              id: Date.now().toString(),
              url: announcementLinkInput,
              dateAdded: new Date().toISOString(),
              status: 'active'
          };
          updateProfile({ 
              announcementLink: announcementLinkInput,
              linkHistory: [newLink, ...currentHistory]
          });
          setIsEditingLink(false);
          setAnnouncementLinkInput('');
      } finally {
          setIsExtractingLink(false);
      }
  };

  const handleToggleLinkStatus = (id: string) => {
      const currentHistory = user?.linkHistory || [];
      const linkIndex = currentHistory.findIndex(l => l.id === id);
      if (linkIndex === -1) return;
      
      const link = currentHistory[linkIndex];
      if (link.status === 'inactive') {
          // Trying to activate
          const activeCount = currentHistory.filter(l => l.status === 'active').length;
          if (!isPro && activeCount >= 1) {
              alert('Free users can only have 1 active link. Deactivate another link first.');
              setShowUpgradeModal(true);
              return;
          }
      }
      
      const updatedHistory = [...currentHistory];
      updatedHistory[linkIndex] = {
          ...link,
          status: link.status === 'active' ? 'inactive' : 'active'
      };
      
      updateProfile({ linkHistory: updatedHistory, announcementLink: updatedHistory.find(l => l.status === 'active')?.url || '' });
  };
  
  const handleDeleteLink = (id: string) => {
      const currentHistory = user?.linkHistory || [];
      const updatedHistory = currentHistory.filter(l => l.id !== id);
      updateProfile({ linkHistory: updatedHistory, announcementLink: updatedHistory.find(l => l.status === 'active')?.url || '' });
  };

  const handleRemoveLink = () => {
      if (window.confirm('Are you sure you want to remove your information source link?')) {
          setAnnouncementLinkInput('');
          updateProfile({ announcementLink: '' });
          setIsEditingLink(false);
      }
  };

  // Mock Data for chart
  const data = [
    { name: 'Mon', completion: 4 },
    { name: 'Tue', completion: 6 },
    { name: 'Wed', completion: 8 },
    { name: 'Thu', completion: 3 },
    { name: 'Fri', completion: 7 },
    { name: 'Sat', completion: 2 },
    { name: 'Sun', completion: 5 },
  ];

  const handleSave = () => {
      if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          alert('Please enter a valid email address.');
          return;
      }
      if (!formData.displayName || formData.displayName.trim() === '') {
          alert('Display name cannot be empty.');
          return;
      }
      updateProfile(formData);
      setIsEditing(false);
  };

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          updateProfile({}, file);
      }
  };

  const handleAIAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 512;
                  const MAX_HEIGHT = 512;
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

                  const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                  
                  updateProfile({
                      aiSettings: {
                          ...user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true },
                          aiAvatarUrl: compressedBase64
                      }
                  });
                  alert("AI Avatar Updated and compressed!");
              };
              img.src = ev.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const toggleBackgroundAlerts = () => {
      updateProfile({ backgroundAlertsEnabled: !user?.backgroundAlertsEnabled });
  };
  
  const toggleAISetting = (key: 'backgroundEnabled' | 'memoryEnabled' | 'voiceResponseEnabled' | 'dynamicGreetingsEnabled' | 'natureThemeEnabled' | 'aiControlEnabled' | 'showFloatingAvatar') => {
      const currentSettings = user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true, aiControlEnabled: false };
      updateProfile({
          aiSettings: {
              ...currentSettings,
              [key]: !currentSettings[key]
          }
      });
  };

  const setAppTheme = (theme: 'dark' | 'nature' | 'ocean' | 'sunset' | 'ladies' | 'white') => {
      const currentSettings = user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true };
      updateProfile({
          aiSettings: {
              ...currentSettings,
              theme
          }
      });
  };

  // --- PIN Handling ---
  const handleSetPin = async () => {
      if (pinInput.length !== 4) return alert("PIN must be 4 digits");
      try {
          await setPasskey(pinInput);
          setShowPinModal(false);
          setPinInput('');
          alert("Secure PIN set successfully.");
      } catch (e) {
          alert("Failed to set PIN.");
      }
  };

  const handlePinInput = (num: number) => {
      if (pinInput.length < 4) setPinInput(prev => prev + num);
  };

  const handleBackspace = () => {
      setPinInput(prev => prev.slice(0, -1));
  };

  // --- Integration Handlers ---

  const handleGoogleConnect = async () => {
      // Check if not Pro and already has another integration (like email summary used, though email is stateless, we can just check isPro)
      if (!isPro && user?.emailSummaryUsed) {
          setShowUpgradeModal(true);
          return;
      }
      setIntegrationLoading(true);
      try {
          const redirectUri = `${window.location.origin}/auth/callback`;
          const response = await fetch(`/api/auth/url?userId=${user?.id}&redirectUri=${encodeURIComponent(redirectUri)}`);
          if (!response.ok) throw new Error('Failed to get auth URL');
          const { url } = await response.json();

          const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
          if (!authWindow) {
              alert('Please allow popups for this site to connect your account.');
              setIntegrationLoading(false);
          }
      } catch (error) {
          console.error('OAuth error:', error);
          alert('Unable to connect to Google Calendar. Please try again.');
          setIntegrationLoading(false);
      }
  };

  React.useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
          const origin = event.origin;
          if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
              return;
          }
          if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
              updateProfile({
                  googleIntegration: {
                      isConnected: true,
                      email: user?.email,
                      lastSync: new Date().toISOString(),
                      accessToken: 'connected'
                  }
              });
              setIntegrationLoading(false);
              alert('Google Calendar connected successfully!');
          }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const handleGoogleDisconnect = () => {
      if (window.confirm("Disconnect Google Calendar? This will stop future syncs.")) {
          updateProfile({
              googleIntegration: { isConnected: false }
          });
      }
  };

  const handleEmailSummary = async () => {
      if (!isPro && user?.googleIntegration?.isConnected) {
          setShowUpgradeModal(true);
          return;
      }
      const email = prompt("Enter email address for summary:", user?.email || "");
      if (!email) return;

      const summaryHtml = `
        <h1>Your Timetable Summary</h1>
        <p>Here are your upcoming tasks:</p>
        <ul>
          ${tasks.map(t => `<li><strong>${t.title}</strong> - ${t.day} at ${t.time} (${t.venue || 'No venue'})</li>`).join('')}
        </ul>
      `;

      try {
          const response = await fetch('/api/email/summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  email,
                  summaryHtml
              })
          });
          if (response.ok) {
              updateProfile({ emailSummaryUsed: true });
              alert('Email summary sent successfully!');
          } else {
              throw new Error('Failed to send email');
          }
      } catch (error) {
          console.error(error);
          alert('Failed to send email summary.');
      }
  };

  const toggleAutomaticDailySummary = () => {
      updateProfile({ automaticDailySummaryEnabled: !user?.automaticDailySummaryEnabled });
  };

  // --- PWA Install Handling ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  React.useEffect(() => {
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
          setIsInstalled(true);
      }

      const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
          setIsInstalled(true);
          setDeferredPrompt(null);
          alert('App successfully added to your home screen');
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
          window.removeEventListener('appinstalled', handleAppInstalled);
      };
  }, []);

  const handleInstallClick = async () => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
              setDeferredPrompt(null);
          }
      } else {
          // Fallback for unsupported devices (e.g., iOS Safari)
          setShowFallback(true);
      }
  };

  const Section = ({ title, icon: Icon, id, children }: any) => {
    const isExpanded = activeCategory === id;
    return (
      <div className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${isLightTheme ? 'border-gray-200 bg-white shadow-sm' : 'border-gray-800 bg-gray-900 shadow-lg'}`}>
        <button 
          onClick={() => toggleSection(id)}
          className={`w-full flex items-center justify-between p-4 transition-colors ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-gray-800'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isLightTheme ? 'bg-black/5' : 'bg-white/5'}`}>
              <Icon size={20} className="text-tt-blue" />
            </div>
            <h3 className="font-bold text-lg">{title}</h3>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown size={20} className="opacity-50" />
          </motion.div>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className={`p-4 border-t ${isLightTheme ? 'border-gray-200' : 'border-gray-800'} space-y-4`}>
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 relative">
      <h1 className="text-2xl font-bold">My Account</h1>

      {/* PIN Modal */}
      {showPinModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white">Set 4-Digit PIN</h3>
                      <button onClick={() => setShowPinModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                  </div>
                  
                  <div className="flex justify-center gap-4 mb-8">
                      {[0,1,2,3].map(i => (
                          <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < pinInput.length ? 'bg-tt-blue border-tt-blue' : 'border-gray-600'}`}></div>
                      ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                      {[1,2,3,4,5,6,7,8,9].map(num => (
                          <button key={num} onClick={() => handlePinInput(num)} className="h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold transition-colors">
                              {num}
                          </button>
                      ))}
                      <div className="col-start-2">
                           <button onClick={() => handlePinInput(0)} className="w-full h-14 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-bold transition-colors">0</button>
                      </div>
                      <div className="col-start-3">
                           <button onClick={handleBackspace} className="w-full h-14 rounded-xl hover:bg-gray-700 text-gray-400 flex items-center justify-center transition-colors"><XCircle size={24}/></button>
                      </div>
                  </div>

                  <button 
                    onClick={handleSetPin}
                    disabled={pinInput.length !== 4}
                    className={`w-full py-3 rounded-xl font-bold transition-colors ${pinInput.length === 4 ? 'bg-tt-blue text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                  >
                      Save PIN
                  </button>
              </div>
          </div>
      )}

      <Section title="Profile" icon={User} id="profile">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
              <div className="relative group cursor-pointer shrink-0" onClick={handleAvatarClick}>
                  <div className="absolute inset-0 bg-tt-blue/20 rounded-full blur-xl group-hover:bg-tt-blue/40 transition-colors duration-500"></div>
                  <img src={user?.avatarUrl} alt="Avatar" className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-black/10 dark:border-white/10 object-cover relative z-10 shadow-xl transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 z-20 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <Camera size={28} className="text-white drop-shadow-md" />
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
              
              <div className="flex-1 text-center sm:text-left space-y-4">
                  {isEditing ? (
                      <div className="space-y-4 max-w-sm mx-auto sm:mx-0">
                          <div>
                              <label className="text-[10px] uppercase tracking-widest font-bold opacity-60 mb-1 block">Display Name</label>
                              <input 
                                value={formData.displayName} 
                                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                                className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-current w-full focus:border-tt-blue focus:ring-2 focus:ring-tt-blue/20 outline-none transition-all"
                              />
                          </div>
                          <div>
                               <label className="text-[10px] uppercase tracking-widest font-bold opacity-60 mb-1 block">Email</label>
                               <input 
                                    value={formData.email} 
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-current w-full text-sm focus:border-tt-blue focus:ring-2 focus:ring-tt-blue/20 outline-none transition-all"
                                />
                          </div>
                          <div className="flex justify-center sm:justify-start gap-3 mt-4">
                              <button onClick={handleSave} className="bg-tt-blue hover:bg-blue-600 px-6 py-2.5 rounded-xl text-white font-bold shadow-md transition-colors">Save Changes</button>
                              <button onClick={() => setIsEditing(false)} className="bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 px-6 py-2.5 rounded-xl text-current font-bold transition-colors">Cancel</button>
                          </div>
                      </div>
                  ) : (
                    <>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-current mb-1">{user?.displayName || user?.username}</h2>
                        <p className="text-sm opacity-70 font-medium">@{user?.username} • {user?.email}</p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                            {isPro ? (
                                <span className="text-xs bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                                    <Crown size={14} className="animate-float cursor-default" /> Pro Member
                                </span>
                            ) : (
                                <span className="text-[10px] uppercase tracking-widest font-bold bg-black/10 dark:bg-white/10 opacity-80 px-3 py-1 rounded-full border border-black/5 dark:border-white/5">
                                    Free Plan
                                </span>
                            )}
                            <span className="text-[11px] font-bold opacity-60">Joined {new Date(user?.joinedDate || '').getFullYear()}</span>
                        </div>
                    </>
                  )}
              </div>
              
              <div className="relative absolute sm:relative top-0 right-0">
                <button onClick={() => setShowMenu(!showMenu)} className="p-2 sm:p-3 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors">
                    <MoreVertical size={20} className="opacity-70" />
                </button>
                {showMenu && (
                    <div className={`absolute right-4 sm:right-0 top-12 sm:top-14 w-48 border rounded-2xl shadow-2xl z-20 py-2 ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
                        <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className={`w-full text-left px-5 py-2.5 text-sm font-medium flex items-center gap-3 transition-colors ${isLightTheme ? 'hover:bg-gray-50' : 'hover:bg-gray-800'}`}>
                            <Edit2 size={16} className="text-tt-blue" /> Edit Profile
                        </button>
                        <div className="border-t border-black/5 dark:border-white/5 my-2"></div>
                        <button onClick={logout} className={`w-full text-left px-5 py-2.5 text-sm font-medium text-red-500 flex items-center gap-3 transition-colors ${isLightTheme ? 'hover:bg-red-50' : 'hover:bg-red-500/10'}`}>
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                )}
                {showMenu && <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>}
              </div>
          </div>
      </Section>

      <Section title="Subscription" icon={Crown} id="subscription">
          {!isPro ? (
              <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                          <Activity size={18} className="text-tt-blue" />
                          Free Plan Usage
                      </h3>
                      <button 
                          onClick={() => setShowUpgradeModal(true)}
                          className="text-xs bg-gradient-to-r from-tt-blue to-purple-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
                      >
                          <Crown size={14} /> Upgrade to Pro
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <div className="flex justify-between text-sm mb-1">
                              <span className="opacity-70">AI Conversations</span>
                              <span className="font-medium">{getUsageStats().aiCount} / {getUsageStats().aiLimit}</span>
                          </div>
                          <div className={`w-full ${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} rounded-full h-2`}>
                              <div 
                                  className={`h-2 rounded-full ${getUsageStats().aiCount >= getUsageStats().aiLimit ? 'bg-red-500' : 'bg-tt-blue'}`} 
                                  style={{ width: `${Math.min((getUsageStats().aiCount / getUsageStats().aiLimit) * 100, 100)}%` }}
                              ></div>
                          </div>
                      </div>
                      
                      <div>
                          <div className="flex justify-between text-sm mb-1">
                              <span className="opacity-70">Timetable Uploads</span>
                              <span className="font-medium">{getUsageStats().fileCount} / {getUsageStats().fileLimit}</span>
                          </div>
                          <div className={`w-full ${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} rounded-full h-2`}>
                              <div 
                                  className={`h-2 rounded-full ${getUsageStats().fileCount >= getUsageStats().fileLimit ? 'bg-red-500' : 'bg-tt-green'}`} 
                                  style={{ width: `${Math.min((getUsageStats().fileCount / getUsageStats().fileLimit) * 100, 100)}%` }}
                              ></div>
                          </div>
                      </div>

                      <div>
                          <div className="flex justify-between text-sm mb-1">
                              <span className="opacity-70">Announcement Links</span>
                              <span className="font-medium">{getUsageStats().linkCount} / {getUsageStats().linkLimit}</span>
                          </div>
                          <div className={`w-full ${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} rounded-full h-2`}>
                              <div 
                                  className={`h-2 rounded-full ${getUsageStats().linkCount >= getUsageStats().linkLimit ? 'bg-red-500' : 'bg-yellow-500'}`} 
                                  style={{ width: `${Math.min((getUsageStats().linkCount / getUsageStats().linkLimit) * 100, 100)}%` }}
                              ></div>
                          </div>
                      </div>
                      
                      <p className="text-xs opacity-60 text-center mt-4">Usage limits reset daily at midnight.</p>
                  </div>
              </div>
          ) : (
              <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-yellow-500">
                          <Crown size={20} />
                          Pro Membership Active
                      </h3>
                      <span className="text-xs bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full font-bold">
                          Premium
                      </span>
                  </div>
                  <div className="space-y-3 text-sm opacity-80">
                      <p className="flex items-center gap-2"><CheckCircle size={14} className="text-tt-green" /> Unlimited AI Conversations</p>
                      <p className="flex items-center gap-2"><CheckCircle size={14} className="text-tt-green" /> Unlimited Timetable Uploads</p>
                      <p className="flex items-center gap-2"><CheckCircle size={14} className="text-tt-green" /> Unlimited Announcement Links</p>
                      <p className="flex items-center gap-2"><CheckCircle size={14} className="text-tt-green" /> Priority Support & Ad-Free</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
                      <span className="text-xs opacity-60">
                          Subscribed on {user?.subscription_date ? new Date(user.subscription_date).toLocaleDateString() : 'recently'}
                      </span>
                      <div className="flex gap-2">
                          <button 
                              onClick={async () => {
                                  await updateProfile({
                                      pro_status: false,
                                      subscription_active: false,
                                      subscription_date: undefined,
                                  });
                              }}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                              Downgrade (Test)
                          </button>
                          <button className="text-xs opacity-60 hover:opacity-100 transition-opacity">
                              Manage
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </Section>

      <Section title="Account & Security" icon={Shield} id="security">
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <div>
                      <h4 className="font-bold text-current">Passkey Code</h4>
                      <p className="text-xs opacity-70 max-w-xs">Use a 4-Digit PIN for quick and secure login.</p>
                  </div>
                  <button 
                    onClick={() => {
                        setPinInput('');
                        setShowPinModal(true);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors border ${user?.passkeyHash ? 'bg-black/20 border-gray-600/50 text-current hover:bg-black/30' : 'bg-tt-blue border-tt-blue text-white hover:bg-blue-600'}`}
                  >
                      {user?.passkeyHash ? 'Change PIN' : 'Set 4-Digit PIN'}
                  </button>
              </div>

              {user?.passkeyHash ? (
                  <div className="flex justify-between items-center p-3 bg-black/5 rounded-lg border border-gray-700/50">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isLightTheme ? 'bg-black/10' : 'bg-gray-800'}`}>
                              <Lock size={18} className="text-tt-green" />
                          </div>
                          <div>
                              <p className="text-sm font-bold opacity-80">Secure PIN Active</p>
                              <p className="text-[10px] opacity-60">****</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => removePasskey()}
                        className="p-2 opacity-60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove PIN"
                      >
                          <Trash2 size={16} />
                      </button>
                  </div>
              ) : (
                  <div className="p-4 bg-black/5 border border-gray-700/50 rounded-lg text-center">
                      <p className="text-xs opacity-60 italic">No PIN configured yet.</p>
                  </div>
              )}
              
              <button 
                onClick={logout}
                className="w-full py-3 mt-4 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 border border-red-500/20"
              >
                  <LogOut size={18} />
                  Sign Out of Account
              </button>
          </div>
      </Section>

      <Section title="App Settings" icon={Settings} id="appSettings">
          <div className="space-y-6">
              {/* App Theme */}
              <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                              <Palette size={18} className="opacity-80" />
                          </div>
                          <div>
                              <h4 className="font-bold text-current text-sm">App Theme</h4>
                              <p className="text-[10px] opacity-60">Customize the look and feel</p>
                          </div>
                      </div>
                      <select
                          value={user?.aiSettings?.theme || (user?.aiSettings?.natureThemeEnabled ? 'nature' : 'dark')}
                          onChange={(e) => setAppTheme(e.target.value as any)}
                          className={`text-xs rounded-lg px-2 py-1 border border-gray-700/50 outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white/50 text-gray-900' : 'bg-gray-800 text-white'}`}
                      >
                          <option value="dark">Dark (Default)</option>
                          <option value="white">White</option>
                          <option value="nature">Nature</option>
                          <option value="ocean">Ocean</option>
                          <option value="sunset">Sunset</option>
                          <option value="ladies">Ladies (Pink)</option>
                          <option value="custom">Custom Color</option>
                      </select>
                  </div>
                  
                  {user?.aiSettings?.theme === 'custom' && (
                      <div className={`p-4 rounded-xl border ${isLightTheme ? 'bg-white/50 border-gray-200' : 'bg-gray-800/50 border-gray-700'} mt-2 animate-fade-in`}>
                          <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium">Custom Color</span>
                              <button 
                                  onClick={() => {
                                      const currentSettings = user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true };
                                      updateProfile({
                                          aiSettings: {
                                              ...currentSettings,
                                              customThemeColor: '#0F172A'
                                          }
                                      });
                                  }}
                                  className="text-xs text-tt-blue hover:underline"
                              >
                                  Reset Default
                              </button>
                          </div>
                          <div className="flex items-center gap-4">
                              <input 
                                  type="color" 
                                  value={user?.aiSettings?.customThemeColor || '#0F172A'}
                                  onChange={(e) => {
                                      const currentSettings = user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true };
                                      updateProfile({
                                          aiSettings: {
                                              ...currentSettings,
                                              customThemeColor: e.target.value
                                          }
                                      });
                                  }}
                                  className="w-12 h-12 rounded cursor-pointer border-0 p-0 bg-transparent"
                              />
                              <div className="flex-1">
                                  <div 
                                      className="h-10 rounded-lg w-full flex items-center justify-center text-white font-medium text-sm shadow-inner"
                                      style={{ backgroundColor: user?.aiSettings?.customThemeColor || '#0F172A' }}
                                  >
                                      Live Preview
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>

              {/* App Notifications */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${user?.backgroundAlertsEnabled ? 'bg-tt-green/10 text-tt-green' : isLightTheme ? 'bg-black/10 opacity-60' : 'bg-gray-800 opacity-60'}`}>
                          <Smartphone size={18} />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">Smart Background Alerts</h4>
                          <p className="text-[10px] opacity-60">Receive task reminders even when closed</p>
                      </div>
                  </div>
                  <button 
                      onClick={toggleBackgroundAlerts}
                      className={`w-10 h-5 rounded-full transition-colors relative ${user?.backgroundAlertsEnabled ? 'bg-tt-green' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${user?.backgroundAlertsEnabled ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>

              {/* Background Companion */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                          <Bot size={18} className="opacity-80" />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">Background Companion</h4>
                          <p className="text-[10px] opacity-60">Allow AI to operate when app is closed</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => toggleAISetting('backgroundEnabled')}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user?.aiSettings?.backgroundEnabled ? 'bg-tt-blue' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.aiSettings?.backgroundEnabled ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>
          </div>
      </Section>

      <Section title="AI Settings" icon={Bot} id="aiSettings">
          <div className="space-y-6">
              {/* AI Avatar */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="relative group cursor-pointer w-10 h-10" onClick={() => aiAvatarInputRef.current?.click()}>
                          <AIAvatar imageUrl={user?.aiSettings?.aiAvatarUrl} type={user?.aiSettings?.aiAvatarType} isLightTheme={isLightTheme} className="w-full h-full text-tt-blue border border-tt-blue/50 rounded-full bg-tt-blue/10" />
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Upload size={14} className="text-white" />
                          </div>
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">AI Avatar</h4>
                          <p className="text-[10px] opacity-60">Customize the assistant's appearance</p>
                      </div>
                  </div>
                  <input ref={aiAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAIAvatarChange} />
                  <div className="flex items-center gap-2">
                      {user?.aiSettings?.aiAvatarUrl && (
                          <button 
                              onClick={() => {
                                  updateProfile({
                                      aiSettings: {
                                          ...user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true },
                                          aiAvatarUrl: undefined
                                      }
                                  });
                              }} 
                              className="text-xs text-red-500 hover:opacity-80"
                          >
                              Remove
                          </button>
                      )}
                      <button onClick={() => aiAvatarInputRef.current?.click()} className="text-xs text-tt-blue hover:opacity-80">Change</button>
                  </div>
              </div>

              {/* AI Avatar Type Selection */}
              <div className="flex flex-col gap-3">
                  <div>
                      <h4 className="font-bold text-current text-sm">Avatar Type</h4>
                      <p className="text-[10px] opacity-60">Choose the style for your AI companion</p>
                  </div>
                  <div className="flex gap-2">
                       {['robot', 'boy', 'girl'].map((type) => (
                           <button
                               key={type}
                               onClick={() => updateProfile({
                                   aiSettings: {
                                        ...user?.aiSettings || { backgroundEnabled: false, memoryEnabled: true, voiceResponseEnabled: true, dynamicGreetingsEnabled: true },
                                        aiAvatarType: type as any
                                   }
                               })}
                               className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                                   (user?.aiSettings?.aiAvatarType || 'robot') === type 
                                     ? 'bg-tt-blue text-white' 
                                     : `${isLightTheme ? 'bg-black/5 hover:bg-black/10' : 'bg-gray-800 hover:bg-gray-700'}`
                               }`}
                           >
                               {type}
                           </button>
                       ))}
                  </div>
              </div>
              
              {/* Dynamic Greetings */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                          <MessageSquare size={18} className="opacity-80" />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">Dynamic Greetings</h4>
                          <p className="text-[10px] opacity-60">Context-aware welcome messages</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => toggleAISetting('dynamicGreetingsEnabled')}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user?.aiSettings?.dynamicGreetingsEnabled !== false ? 'bg-tt-blue' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.aiSettings?.dynamicGreetingsEnabled !== false ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>

              {/* Voice Responses */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                          <Mic size={18} className="opacity-80" />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">Voice Responses</h4>
                          <p className="text-[10px] opacity-60">AI reads out responses aloud</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => toggleAISetting('voiceResponseEnabled')}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user?.aiSettings?.voiceResponseEnabled !== false ? 'bg-tt-blue' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.aiSettings?.voiceResponseEnabled !== false ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>

              {/* Floating Avatar */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                          <Bot size={18} className="opacity-80" />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">Floating AI Avatar</h4>
                          <p className="text-[10px] opacity-60">Show avatar globally on screen</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => toggleAISetting('showFloatingAvatar')}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user?.aiSettings?.showFloatingAvatar ? 'bg-tt-blue' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.aiSettings?.showFloatingAvatar ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>
              
              {/* Memory Learning */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                          <Brain size={18} className="opacity-80" />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">Memory Learning</h4>
                          <p className="text-[10px] opacity-60">Remember conversation context</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => toggleAISetting('memoryEnabled')}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user?.aiSettings?.memoryEnabled !== false ? 'bg-tt-blue' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.aiSettings?.memoryEnabled !== false ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>

              {/* AI App Control */}
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className={`${isLightTheme ? 'bg-black/10' : 'bg-gray-800'} p-2 rounded-full`}>
                          <Shield size={18} className="opacity-80" />
                      </div>
                      <div>
                          <h4 className="font-bold text-current text-sm">AI App Control</h4>
                          <p className="text-[10px] opacity-60">Allow AI to control app features</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => toggleAISetting('aiControlEnabled')}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user?.aiSettings?.aiControlEnabled ? 'bg-tt-blue' : 'bg-gray-700'}`}
                  >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.aiSettings?.aiControlEnabled ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
              </div>

              {/* AI Actions Log */}
              <div className="pt-4 border-t border-gray-700/50">
                  <h4 className="font-bold text-current text-sm mb-3">AI Action Log</h4>
                  <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {aiActionsLog.length === 0 ? (
                          <p className="text-xs opacity-60 text-center py-4">No AI actions logged yet.</p>
                      ) : (
                          <div className="space-y-2">
                              {aiActionsLog.map(log => (
                                  <div key={log.id} className={`p-2 rounded border ${isLightTheme ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-800/50'} text-xs`}>
                                      <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-tt-blue">{log.actionType}</span>
                                          <span className="text-[8px] opacity-50">{new Date(log.timestamp).toLocaleString()}</span>
                                      </div>
                                      <p className="opacity-80">{log.details}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </Section>

      <Section title="Data & Integrations" icon={Link2} id="integrations">
          <div className="space-y-6">
              {/* Information Source Settings */}
              <div>
                  <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-current">Announcement Link</h4>
                      <div className="relative">
                          <button 
                              onClick={() => setShowLinkMenu(!showLinkMenu)}
                              className="p-1 rounded-full hover:bg-black/10 transition-colors"
                          >
                              <MoreVertical size={16} />
                          </button>
                          {showLinkMenu && (
                              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10 py-1">
                                  <button
                                      onClick={() => {
                                          setShowLinkHistoryModal(true);
                                          setShowLinkMenu(false);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                      <List size={14} /> View Link History
                                  </button>
                                  <button
                                      onClick={() => {
                                          setShowLinkHistoryModal(true);
                                          setShowLinkMenu(false);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                      <Settings size={14} /> Manage Links
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>
                  <p className="text-xs opacity-70 mb-4">Enter your information/announcement source link to receive updates.</p>
                  
                  {isExtractingLink ? (
                      <div className="flex items-center justify-center p-4 bg-black/5 rounded-lg border border-gray-700/50">
                          <RefreshCw className="animate-spin text-tt-blue mr-2" size={16} /> 
                          <span className="text-sm">Analyzing link content...</span>
                      </div>
                  ) : isEditingLink || !user?.announcementLink ? (
                      <div className="space-y-3">
                          <input 
                              type="url"
                              placeholder="https://example.com/feed"
                              value={announcementLinkInput}
                              onChange={(e) => setAnnouncementLinkInput(e.target.value)}
                              className="w-full bg-black/10 border border-gray-700/50 rounded-lg px-4 py-2 text-current focus:border-tt-blue outline-none text-sm"
                          />
                          <div className="flex gap-2">
                              <button 
                                  onClick={handleSaveLink}
                                  className="bg-tt-blue hover:bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                              >
                                  Save Link
                              </button>
                              {user?.announcementLink && (
                                  <button 
                                      onClick={() => {
                                          setAnnouncementLinkInput(user.announcementLink || '');
                                          setIsEditingLink(false);
                                      }}
                                      className="bg-black/20 hover:bg-black/30 text-current text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                                  >
                                      Cancel
                                  </button>
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="flex items-center justify-between bg-black/5 p-3 rounded-lg border border-gray-700/50">
                          <div className="truncate mr-4 text-sm text-tt-blue">
                              <a href={user.announcementLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {user.announcementLink}
                              </a>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                              <button 
                                  onClick={() => setIsEditingLink(true)}
                                  className="p-2 opacity-60 hover:opacity-100 hover:bg-black/10 rounded-lg transition-colors"
                                  title="Edit Link"
                              >
                                  <Edit2 size={16} />
                              </button>
                              <button 
                                  onClick={handleRemoveLink}
                                  className="p-2 opacity-60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Remove Link"
                              >
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      </div>
                  )}
              </div>

              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-700/50">
                  {/* Google Calendar */}
                  <div className="flex flex-col justify-between p-4 rounded-xl border border-gray-700/50 bg-black/5">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                              <div className="bg-white p-2 rounded-full">
                                  <CalIcon className="text-blue-500" size={20} />
                              </div>
                              <div>
                                  <h4 className="font-bold text-current text-sm">Import Google Calendar</h4>
                                  {user?.googleIntegration?.isConnected ? (
                                      <p className="text-[10px] text-tt-green flex items-center gap-1">
                                          <CheckCircle size={10} /> Connected as {user.googleIntegration.email}
                                      </p>
                                  ) : (
                                      <p className="text-[10px] opacity-70">Sync real events automatically</p>
                                  )}
                              </div>
                          </div>
                      </div>
                      
                      {user?.googleIntegration?.isConnected ? (
                          <div className="space-y-2 mt-auto">
                              <p className="text-[10px] opacity-60">Last Synced: {user.googleIntegration.lastSync ? new Date(user.googleIntegration.lastSync).toLocaleString() : 'Never'}</p>
                              <div className="flex gap-2">
                                  <button onClick={syncGoogleCalendar} className="flex-1 bg-black/20 border border-gray-600/50 hover:bg-black/30 text-current text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                      <RefreshCw size={12} className={integrationLoading ? "animate-spin" : ""} /> Sync Now
                                  </button>
                                  <button onClick={handleGoogleDisconnect} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg transition-colors border border-red-500/20" title="Disconnect">
                                      <Unlink size={16} />
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <button 
                            onClick={handleGoogleConnect} 
                            disabled={integrationLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 mt-auto text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md"
                          >
                              {integrationLoading ? 'Connecting...' : 'Connect Account'}
                          </button>
                      )}
                  </div>

                  {/* Email Summary */}
                  <div className="flex flex-col justify-between p-4 rounded-xl border border-gray-700/50 bg-black/5">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                              <div className="bg-purple-600 p-2 rounded-full">
                                  <MessageSquare className="text-white" size={20} />
                              </div>
                              <div>
                                  <h4 className="font-bold text-current text-sm">Automatic Daily Summary</h4>
                                  <p className="text-[10px] opacity-70">Get your day's schedule via Email</p>
                              </div>
                          </div>
                          <button 
                              onClick={toggleAutomaticDailySummary}
                              className={`w-10 h-5 rounded-full relative transition-colors ${user?.automaticDailySummaryEnabled ? 'bg-tt-blue' : 'bg-gray-700'}`}
                          >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${user?.automaticDailySummaryEnabled ? 'left-5' : 'left-0.5'}`}></span>
                          </button>
                      </div>
                      <button 
                        onClick={handleEmailSummary} 
                        className="w-full bg-purple-600 border border-purple-500/50 hover:bg-purple-500 mt-auto text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md"
                      >
                          Send Manual Summary Now
                      </button>
                  </div>

                  {/* Install App */}
                  {!isInstalled && (
                      <div className="flex flex-col justify-between p-4 rounded-xl border border-gray-700/50 bg-black/5 md:col-span-2">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                  <div className="bg-green-600 p-2 rounded-full">
                                      <Smartphone className="text-white" size={20} />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-current text-sm">Install App</h4>
                                      <p className="text-[10px] opacity-70">
                                          Add to your home screen for quick access
                                      </p>
                                  </div>
                              </div>
                          </div>

                          <div className="mt-auto">
                              {showFallback ? (
                                  <div className="bg-black/10 p-3 rounded-lg text-xs opacity-80">
                                      <p className="font-bold text-current mb-1">How to install:</p>
                                      <ul className="list-disc pl-4 space-y-1">
                                          <li><strong>iOS (Safari):</strong> Tap Share <Upload size={10} className="inline" /> → Add to Home Screen</li>
                                          <li><strong>Android (Chrome):</strong> Tap Menu (⋮) → Add to Home Screen</li>
                                      </ul>
                                  </div>
                              ) : (
                                  <button 
                                    onClick={handleInstallClick}
                                    className="w-full bg-black/20 border border-gray-600/50 hover:bg-black/30 text-current text-sm font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                  >
                                      <Download size={16} /> Download App
                                  </button>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </Section>

      <Section title="Support & Feedback" icon={Activity} id="support">
          <div className="space-y-6">
              <div>
                <h4 className="font-bold text-current text-sm mb-3 flex items-center gap-2">
                    <Activity size={16} className="text-tt-green" />
                    Weekly Productivity
                </h4>
                <div className="h-48 bg-black/5 rounded-xl border border-gray-700/50 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 2 ? '#10B981' : '#3B82F6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-current text-sm mb-3 flex items-center gap-2">
                    <CheckCircle size={16} className="text-tt-red" />
                    Recent Activity
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {activityLog.length > 0 ? activityLog.map((log) => (
                        <div key={log.id} className="flex justify-between items-center text-xs border-b border-gray-500/20 pb-2 last:border-0">
                            <span className="opacity-80">{log.action}</span>
                            <span className="opacity-60">{new Date(log.timestamp).toLocaleDateString()}</span>
                        </div>
                    )) : (
                        <p className="text-xs opacity-60">No activity recorded.</p>
                    )}
                </div>
              </div>
          </div>
      </Section>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />

      {showLinkHistoryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className={`w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[80vh] ${isLightTheme ? 'bg-white' : 'bg-gray-900 text-white'}`}>
                  <div className="p-4 border-b border-gray-700/50 flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2"><List size={18} /> Link History</h3>
                      <button onClick={() => setShowLinkHistoryModal(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                      {(user?.linkHistory || []).length === 0 ? (
                          <p className="text-center opacity-60 py-8 text-sm">No link history found.</p>
                      ) : (
                          (user?.linkHistory || []).map((link) => (
                              <div key={link.id} className={`p-4 rounded-xl border ${isLightTheme ? 'bg-gray-50 border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1 min-w-0 mr-4">
                                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-bold text-tt-blue hover:underline truncate">
                                              {link.title || link.url}
                                          </a>
                                          {link.title && <span className="block text-[10px] opacity-70 truncate mt-0.5">{link.url}</span>}
                                      </div>
                                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex-shrink-0 ${link.status === 'active' ? 'bg-tt-green text-white' : 'bg-gray-500/20 text-gray-400'}`}>
                                          {link.status.toUpperCase()}
                                      </span>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] opacity-60 mb-2">
                                      <span>Added: {new Date(link.dateAdded).toLocaleDateString()}</span>
                                      {link.publishedDate && link.publishedDate !== 'Unknown Date' && (<span>• Published: {link.publishedDate}</span>)}
                                  </div>
                                  {link.contentSummary && (
                                      <div className={`mb-3 p-2 rounded text-xs opacity-80 ${isLightTheme ? 'bg-white border text-gray-700' : 'bg-black/20 text-gray-300'}`}>
                                          <p className="line-clamp-2">{link.contentSummary}</p>
                                          {link.newsCategories && link.newsCategories.length > 0 && (
                                              <div className="flex gap-1 mt-1">
                                                  {link.newsCategories.map(cat => (
                                                      <span key={cat} className="text-[8px] uppercase tracking-wider bg-black/10 px-1 py-0.5 rounded">
                                                          {cat}
                                                      </span>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                  )}
                                  <div className="flex gap-2 justify-end">
                                      <button 
                                          onClick={() => handleToggleLinkStatus(link.id)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${link.status === 'active' ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-tt-blue/20 text-tt-blue hover:bg-tt-blue/30'}`}
                                      >
                                          {link.status === 'active' ? 'Deactivate' : 'Activate'}
                                      </button>
                                      <button 
                                          onClick={() => handleDeleteLink(link.id)}
                                          className="px-3 py-1.5 bg-red-500/20 text-red-500 hover:bg-red-500/30 rounded-lg text-xs font-bold transition-colors"
                                      >
                                          Delete
                                      </button>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// Internal Import
import { XCircle } from 'lucide-react';

export default Profile;
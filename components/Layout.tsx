import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, User, Calendar, PlusCircle, Bot, Crown, MessageSquare, X, Mic, AlertCircle, GraduationCap, Grid, BookOpen } from 'lucide-react';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import UpgradeModal from './UpgradeModal';
import FocusModeOverlay from './FocusModeOverlay';
import AIAvatar from './AIAvatar';
import { FloatingAIAvatar } from './FloatingAIAvatar';

const Layout = () => {
  const location = useLocation();
  const { isPro } = useUsage();
  const { user } = useAuth();
  const { missedTaskToReschedule, setMissedTaskToReschedule, rescheduleTask, tasks } = useTasks();
  const { isSpeaking } = useAI();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const theme = user?.aiSettings?.theme || (user?.aiSettings?.natureThemeEnabled ? 'nature' : 'dark');
  
  // Helper to determine if custom color is light
  const isCustomLight = () => {
      if (theme !== 'custom' || !user?.aiSettings?.customThemeColor) return false;
      const hex = user.aiSettings.customThemeColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return brightness > 155;
  };

  const isLightTheme = theme === 'nature' || theme === 'ocean' || theme === 'sunset' || theme === 'ladies' || theme === 'white' || isCustomLight();
  const isNatureTheme = isLightTheme; // Alias for existing code
  const isCustomTheme = theme === 'custom';
  
  let bgClass = "bg-tt-dark text-white";
  if (isCustomTheme) {
      bgClass = `bg-transparent ${isLightTheme ? 'text-gray-900' : 'text-white'}`;
  } else if (isLightTheme) {
      bgClass = "bg-transparent text-gray-900";
  }

  const handleFeedbackSubmit = () => {
    if (feedbackText.trim()) {
      console.log('User Feedback Submitted:', feedbackText);
      setFeedbackText('');
      setShowFeedbackModal(false);
      alert('Thank you for your feedback!');
    }
  };

  const findNextAvailableSlot = (startDay: string, startTimeHour: number) => {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let currentDayIdx = daysOfWeek.indexOf(startDay);
    let currentHour = startTimeHour;

    // Check up to 7 days ahead
    for (let d = 0; d < 7; d++) {
      const dayToCheck = daysOfWeek[(currentDayIdx + d) % 7];
      
      // Check hours from currentHour to 22:00
      for (let h = (d === 0 ? currentHour : 8); h <= 22; h++) {
        const timeToCheck = `${h.toString().padStart(2, '0')}:00`;
        
        // Check if there's any task at this day and time
        const hasConflict = tasks.some(t => t.day === dayToCheck && t.time === timeToCheck);
        
        if (!hasConflict) {
          return { day: dayToCheck, time: timeToCheck };
        }
      }
    }
    
    // Fallback if full
    return { day: startDay, time: `${startTimeHour.toString().padStart(2, '0')}:00` };
  };

  const handleReschedule = (type: 'today' | 'tomorrow') => {
    if (!missedTaskToReschedule) return;
    
    const now = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let newDay = missedTaskToReschedule.day;
    let newTime = missedTaskToReschedule.time;

    if (type === 'today') {
      const today = daysOfWeek[now.getDay()];
      const nextHour = now.getHours() + 1;
      const slot = findNextAvailableSlot(today, nextHour);
      newDay = slot.day;
      newTime = slot.time;
    } else {
      // Tomorrow
      now.setDate(now.getDate() + 1);
      const tomorrow = daysOfWeek[now.getDay()];
      const slot = findNextAvailableSlot(tomorrow, 9); // Start checking from 9 AM tomorrow
      newDay = slot.day;
      newTime = slot.time;
    }

    rescheduleTask(missedTaskToReschedule, newDay, newTime);
  };

  const navItems = [
    { name: 'Home', icon: LayoutDashboard, path: '/' },
    { name: 'Tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'AI Chat', icon: Bot, path: '/ai-companion' },
    { name: 'More', icon: Grid, path: '#more' },
    { name: 'Account', icon: User, path: '/profile' },
  ];

  return (
    <div className={`min-h-screen font-sans flex flex-col md:flex-row transition-colors duration-500 ${bgClass}`}>
        
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className={`hidden md:flex flex-col w-72 h-screen sticky top-0 p-6 border-r ${isNatureTheme ? 'bg-white/40 border-gray-300/50 backdrop-blur-xl shadow-xl' : 'glass-panel border-gray-700/50'}`}>
        <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-tt-blue to-purple-500 bg-clip-text text-transparent mb-12 drop-shadow-sm flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tt-blue to-purple-500 flex items-center justify-center text-white shadow-lg">
             <LayoutDashboard size={20} />
          </div>
          T.T App
        </h1>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            item.name === 'More' ? (
              <button
                key={item.name}
                onClick={() => setShowMoreMenu(true)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group hover:shadow-md ${isNatureTheme ? 'text-gray-600 hover:bg-white hover:text-tt-blue' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
              >
                <div className={`p-2 rounded-xl transition-colors ${isNatureTheme ? 'bg-gray-100 group-hover:bg-blue-50 group-hover:text-tt-blue' : 'bg-white/5 group-hover:bg-white/20'}`}>
                    <item.icon size={20} />
                </div>
                <span className="font-bold tracking-tight">{item.name}</span>
              </button>
            ) : (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                    isActive
                      ? `bg-tt-blue text-white shadow-lg shadow-tt-blue/40 -translate-y-0.5`
                      : isNatureTheme ? 'text-gray-600 hover:bg-white hover:text-tt-blue hover:shadow-sm' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20' : (isNatureTheme ? 'bg-gray-100 group-hover:bg-blue-50 group-hover:text-tt-blue' : 'bg-white/5 group-hover:bg-white/20')}`}>
                      {item.name === 'AI Chat' ? (
                          <div className="w-5 h-5 shrink-0 overflow-hidden">
                              <AIAvatar 
                                  isSpeaking={isSpeaking}
                                  imageUrl={user?.aiSettings?.aiAvatarUrl} 
                                  type={user?.aiSettings?.aiAvatarType}
                                  isLightTheme={isLightTheme || isActive} // If active, the background is blue, so we want the avatar to look okay.
                                  className="w-full h-full"
                              />
                          </div>
                      ) : (
                          <item.icon size={20} />
                      )}
                    </div>
                    <span className="font-bold tracking-tight">{item.name}</span>
                  </>
                )}
              </NavLink>
            )
          ))}
        </nav>

        <div className={`mt-auto pt-6 border-t space-y-3 ${isNatureTheme ? 'border-gray-200/60' : 'border-gray-700/50'}`}>
          <button 
            onClick={() => setShowUpgradeModal(true)}
            className={`w-full py-4 rounded-2xl font-black tracking-tight shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 group ${
              isPro 
                ? (isNatureTheme ? 'bg-white text-yellow-600 border border-yellow-500/30 hover:bg-yellow-50' : 'bg-gray-800 text-yellow-500 border border-yellow-500/30 hover:bg-gray-700')
                : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-white shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:-translate-y-1'
            }`}
          >
            <Crown size={18} className="group-hover:scale-110 transition-transform" />
            {isPro ? 'Pro Member' : 'Upgrade to Pro'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto mb-20 md:mb-0 relative">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation - Visible only on mobile */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 border-t pb-safe z-40 ${isNatureTheme ? 'bg-white/60 border-gray-300/50 backdrop-blur-md' : 'glass-panel border-gray-700'}`}>
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
             if (item.name === 'More') {
                 return (
                    <button
                        key={item.name}
                        onClick={() => setShowMoreMenu(true)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                          showMoreMenu ? 'text-tt-blue' : (isNatureTheme ? 'text-gray-600' : 'text-gray-500')
                        }`}
                    >
                        <item.icon size={showMoreMenu ? 24 : 20} strokeWidth={showMoreMenu ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{item.name}</span>
                    </button>
                 )
             }
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-tt-blue' : (isNatureTheme ? 'text-gray-600' : 'text-gray-500')
                }`}
              >
                {item.name === 'AI Chat' ? (
                     <div className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'} shrink-0 overflow-hidden transition-all delay-75`}>
                         <AIAvatar 
                             isSpeaking={isSpeaking}
                             imageUrl={user?.aiSettings?.aiAvatarUrl} 
                             type={user?.aiSettings?.aiAvatarType}
                             isLightTheme={isLightTheme || isActive}
                             className="w-full h-full"
                         />
                     </div>
                ) : (
                    <item.icon size={isActive ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} />
                )}
                <span className="text-[10px] font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />

      {/* More Tools Menu Modal */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowMoreMenu(false)}>
          <div 
            className={`w-full max-w-sm p-6 rounded-t-3xl md:rounded-3xl shadow-2xl relative transform transition-transform ${isNatureTheme ? 'bg-white/95 border border-gray-300 text-gray-900' : 'bg-gray-900 border border-gray-800 text-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Grid className="text-tt-blue" size={24} />
                More Tools
              </h2>
              <button 
                onClick={() => setShowMoreMenu(false)}
                className={`p-2 rounded-full transition-colors ${isNatureTheme ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-800 text-gray-400'}`}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <NavLink
                to="/add"
                onClick={() => setShowMoreMenu(false)}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isNatureTheme ? 'bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600'}`}
              >
                <div className="p-3 bg-orange-500/20 text-orange-500 rounded-xl">
                  <PlusCircle size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Add Task</h3>
                  <p className={`text-xs ${isNatureTheme ? 'text-gray-500' : 'text-gray-400'}`}>Create a new task or event</p>
                </div>
              </NavLink>

              <NavLink
                to="/lectures"
                onClick={() => setShowMoreMenu(false)}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isNatureTheme ? 'bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600'}`}
              >
                <div className="p-3 bg-blue-500/20 text-blue-500 rounded-xl">
                  <Mic size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Lecture Recorder</h3>
                  <p className={`text-xs ${isNatureTheme ? 'text-gray-500' : 'text-gray-400'}`}>Record and transcribe lectures</p>
                </div>
              </NavLink>
              
              <NavLink
                to="/exams"
                onClick={() => setShowMoreMenu(false)}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isNatureTheme ? 'bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600'}`}
              >
                <div className="p-3 bg-purple-500/20 text-purple-500 rounded-xl">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Exam Mode</h3>
                  <p className={`text-xs ${isNatureTheme ? 'text-gray-500' : 'text-gray-400'}`}>Prepare for your upcoming exams</p>
                </div>
              </NavLink>
              
              <NavLink
                to="/study-materials"
                onClick={() => setShowMoreMenu(false)}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${isNatureTheme ? 'bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-200' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600'}`}
              >
                <div className="p-3 bg-teal-500/20 text-teal-500 rounded-xl">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Study Materials</h3>
                  <p className={`text-xs ${isNatureTheme ? 'text-gray-500' : 'text-gray-400'}`}>Generate flashcards & quizzes</p>
                </div>
              </NavLink>
              
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowFeedbackModal(true);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${isNatureTheme ? 'bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-200' : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600'}`}
              >
                <div className="p-3 bg-green-500/20 text-green-500 rounded-xl">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Feedback</h3>
                  <p className={`text-xs ${isNatureTheme ? 'text-gray-500' : 'text-gray-400'}`}>Send us your thoughts and ideas</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-2xl w-full max-w-md p-6 shadow-2xl relative ${isNatureTheme ? 'bg-white/90 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-800 text-white'}`}>
            <button 
              onClick={() => setShowFeedbackModal(false)}
              className={`absolute top-4 right-4 transition-colors ${isNatureTheme ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
            >
              <X size={24} />
            </button>
            
            <h2 className={`text-2xl font-bold mb-2 flex items-center gap-2 ${isNatureTheme ? 'text-gray-900' : 'text-white'}`}>
              <MessageSquare className="text-tt-blue" />
              Send Feedback
            </h2>
            <p className={`mb-6 text-sm ${isNatureTheme ? 'text-gray-600' : 'text-gray-400'}`}>
              We'd love to hear your thoughts, suggestions, or bug reports to help us improve.
            </p>
            
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us what you think..."
              className={`w-full h-32 border rounded-xl p-3 focus:outline-none focus:border-tt-blue focus:ring-1 focus:ring-tt-blue resize-none mb-4 ${isNatureTheme ? 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500' : 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'}`}
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${isNatureTheme ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedbackText.trim()}
                className="px-6 py-2 rounded-xl font-medium bg-tt-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Missed Task Recovery Modal */}
      {missedTaskToReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-2xl w-full max-w-md p-6 shadow-2xl relative ${isNatureTheme ? 'bg-white/90 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-800 text-white'}`}>
            <button 
              onClick={() => setMissedTaskToReschedule(null)}
              className={`absolute top-4 right-4 transition-colors ${isNatureTheme ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-tt-red/20 rounded-full text-tt-red">
                <AlertCircle size={28} />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isNatureTheme ? 'text-gray-900' : 'text-white'}`}>
                  Missed Task Detected
                </h2>
                <p className={`text-sm ${isNatureTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                  AI Smart Recovery
                </p>
              </div>
            </div>
            
            <div className={`p-4 rounded-xl mb-6 ${isNatureTheme ? 'bg-gray-100 border border-gray-200' : 'bg-white/5 border border-gray-700'}`}>
              <p className="font-medium mb-1">You missed: <span className="text-tt-blue">{missedTaskToReschedule.title}</span></p>
              <p className={`text-sm ${isNatureTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                Scheduled for {missedTaskToReschedule.day} at {missedTaskToReschedule.time}
              </p>
              <p className="mt-3 font-medium">Should I reschedule it for you?</p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => handleReschedule('today')}
                className="w-full py-3 rounded-xl font-medium bg-tt-blue text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Calendar size={18} />
                Next free time today
              </button>
              <button
                onClick={() => handleReschedule('tomorrow')}
                className={`w-full py-3 rounded-xl font-medium border transition-colors flex items-center justify-center gap-2 ${isNatureTheme ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              >
                <Calendar size={18} />
                Next available day
              </button>
              <button
                onClick={() => setMissedTaskToReschedule(null)}
                className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${isNatureTheme ? 'text-gray-500 hover:text-gray-800' : 'text-gray-500 hover:text-white'}`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingAIAvatar />
      <FocusModeOverlay />
    </div>
  );
};

export default Layout;
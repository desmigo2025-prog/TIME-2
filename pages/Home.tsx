import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../contexts/TaskContext';
import { useAnnouncements } from '../contexts/AnnouncementContext';
import { useAI } from '../contexts/AIContext';
import { useUsage } from '../contexts/UsageContext';
import { Task, TaskStatus } from '../types';
import { Card } from '../components/ui/Card';
import { parseTimetableWithGemini, getSmartSuggestions } from '../services/geminiService';
import { Upload, Clock, MapPin, Calendar as CalendarIcon, ArrowRight, Loader, Info, Edit, Bell, Bot, X, Crown, AlertCircle, CheckCircle, Circle, Play } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import UpgradeModal from '../components/UpgradeModal';
import DailyProgress from '../components/DailyProgress';
import ActiveTaskBanner from '../components/ActiveTaskBanner';
import { useActiveTask } from '../contexts/ActiveTaskContext';

const Home = () => {
  const { user } = useAuth();
  const theme = user?.aiSettings?.theme || 'dark';
  
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
  const isCustomTheme = theme === 'custom';
  const { tasks, upcomingTasks, ongoingTasks, exams, syncGoogleCalendar, updateTask } = useTasks();
  const { startTask } = useActiveTask();
  const { unreadCount } = useAnnouncements();
  const { latestGreeting, dismissGreeting } = useAI();
  const { isPro, canUploadFile, incrementFileUpload, getUsageStats } = useUsage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUploading, setIsUploading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [aiTip, setAiTip] = useState("Loading insight...");
  const navigate = useNavigate();

  // Daily Progress calculation
  const currentDayName = format(currentTime, 'EEEE');
  const todayTasks = tasks.filter(t => {
      if (t.date) {
         return t.date === format(currentTime, 'yyyy-MM-dd');
      }
      return t.day === currentDayName;
  });
  const validTasks = todayTasks; // include missed tasks
  const completedTodayTasks = validTasks.filter(t => t.status === TaskStatus.COMPLETED);
  const todaysProgress = validTasks.length > 0 ? Math.round((completedTodayTasks.length / validTasks.length) * 100) : 0;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
      getSmartSuggestions(upcomingTasks, todaysProgress).then(setAiTip);
  }, [todaysProgress]); // Re-fetch tip if progress makes a jump, or initially

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!canUploadFile) {
      setShowUpgradeModal(true);
      return;
    }

    setIsUploading(true);
    try {
      let extractedTasks: Partial<Task>[] = [];
      const fileType = file.name.split('.').pop()?.toLowerCase();

      if (fileType === 'xlsx' || fileType === 'xls') {
        const { parseExcelTimetable } = await import('../services/excelService');
        extractedTasks = await parseExcelTimetable(file);
      } else if (fileType === 'csv') {
        const { parseCSVTimetable } = await import('../services/excelService');
        extractedTasks = await parseCSVTimetable(file);
      } else {
        extractedTasks = await parseTimetableWithGemini(file);
      }

      if (extractedTasks.length === 0) {
        throw new Error("Some data could not be fully extracted. Please review.");
      }

      // Increment usage count
      await incrementFileUpload();

      // Navigate to review screen with the raw data
      navigate('/review', { state: { scannedTasks: extractedTasks } });
    } catch (error: any) {
      alert(error.message || 'Some data could not be fully extracted. Please review.');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleStatus = (id: string, currentStatus: TaskStatus) => {
      const newStatus = currentStatus === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED;
      updateTask(id, { status: newStatus });
  };

  // Filter and Sort All Upcoming Tasks
  const sortedUpcomingTasks = React.useMemo(() => {
    return tasks
      .filter(task => task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.MISSED)
      .map(task => {
          let timestamp = 0;
          let isPast = false;

          if (task.date) {
              const taskDateTime = new Date(`${task.date}T${task.time}`);
              timestamp = taskDateTime.getTime();
              isPast = timestamp < currentTime.getTime();
          } else {
              const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const currentDayIndex = currentTime.getDay();
              const taskDayIndex = daysOfWeek.indexOf(task.day);
              
              let daysToAdd = taskDayIndex - currentDayIndex;
              if (daysToAdd < 0) {
                  daysToAdd += 7;
              }
              
              const [hours, minutes] = task.time.split(':').map(Number);
              const taskDate = new Date(currentTime);
              taskDate.setDate(currentTime.getDate() + daysToAdd);
              taskDate.setHours(hours, minutes, 0, 0);
              
              if (daysToAdd === 0 && taskDate.getTime() < currentTime.getTime()) {
                  taskDate.setDate(taskDate.getDate() + 7);
              }
              timestamp = taskDate.getTime();
          }

          return { ...task, timestamp, isPast };
      })
      .filter(task => !task.isPast)
      .sort((a, b) => {
          if (a.timestamp === b.timestamp) {
              return a.title.localeCompare(b.title);
          }
          return a.timestamp - b.timestamp;
      });
  }, [tasks, currentTime]);

  const currentTask = ongoingTasks[0];
  const nextTask = sortedUpcomingTasks[0];

  const upcomingExams = React.useMemo(() => {
    return exams?.filter(exam => {
      const diffDays = Math.ceil((new Date(exam.date).getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [exams, currentTime]);

  const nextExam = upcomingExams?.[0];
  const nextExamDays = nextExam ? Math.ceil((new Date(nextExam.date).getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* AI Welcome Toast */}
      {latestGreeting && (
          <div className="absolute top-14 left-0 right-0 z-50 px-2 animate-bounce-in">
              <div className="glass-panel bg-gradient-to-r from-tt-blue/90 to-purple-600/90 rounded-2xl p-4 shadow-2xl flex items-start gap-4 border border-white/20">
                  <div className="bg-white/20 p-2.5 rounded-full text-white shadow-inner">
                      <Bot size={22} className="animate-pulse" />
                  </div>
                  <div className="flex-1 text-white">
                      <h4 className="font-bold text-sm tracking-wide">T.T Assistant</h4>
                      <p className="text-xs opacity-95 mt-1 leading-relaxed">{latestGreeting}</p>
                      <div className="flex gap-3 mt-3">
                          <button 
                            onClick={() => { dismissGreeting(); navigate('/ai-companion'); }}
                            className="text-xs bg-white text-tt-blue font-bold px-4 py-2 rounded-xl shadow-md hover:bg-gray-50 transition-colors"
                          >
                              Chat Now
                          </button>
                          <button 
                             onClick={dismissGreeting}
                             className="text-xs text-white/80 hover:text-white font-medium px-2 py-2"
                          >
                              Dismiss
                          </button>
                      </div>
                  </div>
                  <button onClick={dismissGreeting} className="text-white/60 hover:text-white bg-black/10 rounded-full p-1 transition-colors">
                      <X size={16} />
                  </button>
              </div>
          </div>
      )}

      {/* Header, Date & AI Insight */}
      <div className="flex flex-col gap-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 rounded-[2rem] shadow-2xl text-white mb-6 relative overflow-hidden animate-slide-up">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white opacity-20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-white opacity-10 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4"></div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10 gap-6 w-full">
           {/* Left side: Greeting + Date + Time */}
           <div className="flex flex-col gap-1">
               <h2 className="text-3xl font-black leading-tight flex items-center gap-2 text-white tracking-tight drop-shadow-sm">
                   Good morning, {user?.username?.split(' ')[0]}
               </h2>
               <div className="flex items-center gap-3">
                   <p className="text-white/90 text-sm font-medium tracking-wide">{format(currentTime, 'EEEE, MMMM do')}</p>
                   <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                   <h1 className="text-2xl font-black text-white drop-shadow-lg tabular-nums font-mono tracking-tighter">
                       {format(currentTime, 'h:mm a')}
                   </h1>
               </div>
           </div>
        
           {/* Right side: Pro Badge + Profile Icon + Notifications */}
           <div className="flex items-center gap-4 self-end sm:self-center">
                <div className="flex items-center gap-3 bg-white/10 p-1.5 rounded-full backdrop-blur-md border border-white/20 shadow-lg">
                    {!isPro ? (
                        <button 
                            onClick={() => setShowUpgradeModal(true)}
                            className="flex items-center gap-1.5 text-xs bg-white text-purple-700 px-4 py-2 rounded-full font-black hover:scale-105 hover:bg-gray-50 transition-all shadow-md"
                        >
                            <Crown size={14} className="text-amber-500" /> Go Pro
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-black shadow-md cursor-default">
                            <Crown size={14} className="animate-pulse" /> Pro
                        </div>
                    )}
                    <button 
                        onClick={() => navigate('/notifications')}
                        className="relative p-2.5 bg-transparent hover:bg-white/20 transition-colors rounded-full text-white"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-purple-500 shadow-md transform translate-x-1/4 -translate-y-1/4">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>

                <div 
                    className="relative group cursor-pointer" 
                    onClick={() => navigate('/profile')}
                >
                    <div className="absolute inset-0 bg-white rounded-full blur-md opacity-30 group-hover:opacity-60 transition-opacity"></div>
                    <img 
                        src={user?.avatarUrl} 
                        alt="Profile" 
                        className="w-12 h-12 rounded-full border-[3px] border-white shadow-xl relative z-10 object-cover hover:scale-105 transition-transform"
                    />
                </div>
           </div>
        </div>

        {/* AI Insight Banner inside Header */}
        <div className={`relative z-10 p-4 rounded-2xl backdrop-blur-lg flex items-start gap-4 transition-all duration-300 mt-2 ${
          isLightTheme 
            ? 'bg-white/40 border border-white/60 shadow-xl' 
            : 'bg-black/30 border border-white/10 shadow-2xl'
        }`}>
            <div className="p-3.5 rounded-xl shrink-0 bg-white/20 border border-white/20 shadow-inner">
                <Bot size={24} className="text-white animate-pulse" />
            </div>
            <div className="flex-1">
                <h4 className="text-[11px] font-black mb-1.5 tracking-widest uppercase text-white/80 flex items-center gap-2">
                  Daily AI Insight
                </h4>
                <p className="text-sm leading-relaxed font-medium text-white drop-shadow-md">"{aiTip}"</p>
            </div>
        </div>
      </div>

      {/* Daily Progress Bar */}
      <div className="animate-slide-up">
        <ActiveTaskBanner />
        <DailyProgress tasks={tasks} onCelebrationComplete={() => {}} />
      </div>

      {/* Exam Notification Banner */}
      {nextExam && (
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center gap-4 animate-fade-in shadow-inner">
            <div className="bg-red-500/20 p-2.5 rounded-full text-red-500 shrink-0">
                <AlertCircle size={20} />
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-bold text-red-500 mb-0.5 tracking-wide">Exam Alert</h4>
                <p className={`text-sm font-medium ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                    Exam in {nextExamDays === 0 ? 'today' : `${nextExamDays} days`} – focus on <strong className="text-red-400">{nextExam.prioritySubjects?.[0] || nextExam.difficultSubjects?.[0] || nextExam.subjects[0]}</strong> today!
                </p>
            </div>
            <button onClick={() => navigate('/exams')} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm">
                View
            </button>
        </div>
      )}

      {/* Current/Next Task Card */}
      <Card className="relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-opacity-50 transition-all duration-500 animate-slide-up" style={{animationDelay: '0.1s'}}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-tt-blue/20 to-transparent rounded-bl-[100%] transition-transform duration-700 group-hover:scale-125"></div>
        <h3 className="opacity-60 text-[10px] uppercase tracking-[0.2em] mb-6 font-black flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-tt-blue animate-pulse"></span>
           {currentTask ? 'Happening Now' : 'Up Next'}
        </h3>
        
        {currentTask || nextTask ? (
          <div className="space-y-6 relative z-10">
             <div>
                <h2 className="text-4xl font-black text-current mb-3 tracking-tight leading-tight">{(currentTask || nextTask).title}</h2>
                <div className="flex items-center text-sm gap-2 font-bold bg-black/5 dark:bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5">
                    <MapPin size={16} className="text-tt-blue" />
                    <span className="opacity-80">{(currentTask || nextTask).venue}</span>
                </div>
             </div>
             
             <div className="flex gap-4">
                 <div className="bg-black/5 dark:bg-white/5 px-5 py-3 rounded-2xl border border-black/5 dark:border-white/5 shadow-inner">
                     <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold mb-1">Time</p>
                     <p className="font-mono font-black text-xl text-tt-green">{(currentTask || nextTask).time}</p>
                 </div>
                 <div className="bg-black/5 dark:bg-white/5 px-5 py-3 rounded-2xl border border-black/5 dark:border-white/5 shadow-inner">
                     <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold mb-1">Duration</p>
                     <p className="font-mono font-black text-xl text-current">{(currentTask || nextTask).durationMinutes}m</p>
                 </div>
             </div>
          </div>
        ) : (
          <div className="text-center py-12 relative z-10">
             <div className="w-20 h-20 bg-black/5 dark:bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-inner rotate-3">
                 <CalendarIcon size={32} className="opacity-40" />
             </div>
             <p className="opacity-60 font-bold text-lg tracking-tight">No upcoming tasks. You are free!</p>
          </div>
        )}
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{animationDelay: '0.2s'}}>
        <Card className="flex flex-col items-center justify-center gap-3 p-5 group hover:bg-gradient-to-b hover:from-tt-blue/5 hover:to-transparent border-tt-blue/20 hover:border-tt-blue/40 cursor-pointer transition-all duration-300 hover:-translate-y-1 text-center" onClick={() => !isUploading && document.getElementById('file-upload')?.click()}>
          <div className="bg-gradient-to-br from-tt-blue/10 to-tt-blue/20 p-4 rounded-full group-hover:scale-110 transition-transform duration-500 shadow-inner">
              {isUploading ? <Loader className="animate-spin text-tt-blue" size={24} /> : <Upload className="text-tt-blue" size={24} />}
          </div>
          <div>
             <span className="font-bold text-sm block tracking-tight">{isUploading ? 'Analyzing...' : 'Upload'}</span>
             <span className="text-[10px] opacity-60 font-medium">Timetable file</span>
          </div>
          <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            accept="image/*,.pdf,.xlsx,.xls,.csv" 
            onChange={handleFileUpload} 
            disabled={isUploading}
          />
        </Card>

        <Card className="flex flex-col items-center justify-center gap-3 p-5 group hover:bg-gradient-to-b hover:from-purple-500/5 hover:to-transparent border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all duration-300 hover:-translate-y-1 text-center" onClick={() => {
            if (!isPro) {
                setShowUpgradeModal(true);
            } else {
                navigate('/generate');
            }
        }}>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/20 p-4 rounded-full group-hover:scale-110 transition-transform duration-500 relative shadow-inner">
              <Bot className="text-purple-500" size={24} />
              <Crown size={12} className="absolute -top-1 -right-1 text-yellow-500 drop-shadow-sm" />
          </div>
          <div>
             <span className="font-bold text-sm block tracking-tight">AI Gen</span>
             <span className="text-[10px] opacity-60 font-medium">Smart schedule</span>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-3 p-5 group hover:bg-gradient-to-b hover:from-emerald-500/5 hover:to-transparent border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer transition-all duration-300 hover:-translate-y-1 text-center" onClick={() => navigate('/tasks')}>
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/20 p-4 rounded-full group-hover:scale-110 transition-transform duration-500 shadow-inner">
              <Edit className="text-emerald-500" size={24} />
          </div>
          <div>
             <span className="font-bold text-sm block tracking-tight">Add Task</span>
             <span className="text-[10px] opacity-60 font-medium">Manual entry</span>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-3 p-5 group hover:bg-gradient-to-b hover:from-blue-500/5 hover:to-transparent border-blue-500/20 hover:border-blue-500/40 cursor-pointer transition-all duration-300 hover:-translate-y-1 text-center" onClick={async () => {
            try {
                await syncGoogleCalendar();
            } catch (e: any) {
                alert(e.message || "Failed to trigger sync");
            }
        }}>
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/20 p-4 rounded-full group-hover:scale-110 transition-transform duration-500 shadow-inner relative">
              <CalendarIcon className="text-blue-500" size={24} />
          </div>
          <div>
             <span className="font-bold text-sm block tracking-tight">Sync Calendar</span>
             <span className="text-[10px] opacity-60 font-medium">Import Schedule</span>
          </div>
        </Card>
      </div>

      {/* Upcoming Tasks List (Filtered) */}
      <div className="animate-slide-up" style={{animationDelay: '0.3s'}}>
          <div className="flex justify-between items-end mb-6 px-1 mt-4">
              <h3 className="font-black text-2xl tracking-tight leading-none drop-shadow-sm">Upcoming Timeline</h3>
              <button className="text-xs font-bold text-tt-blue hover:text-white hover:bg-tt-blue transition-colors bg-tt-blue/10 px-4 py-2 rounded-full shadow-sm" onClick={() => navigate('/tasks')}>View All</button>
          </div>
          
          <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:left-[19px] before:w-[2px] before:bg-gradient-to-b before:from-tt-blue/50 before:to-transparent before:-z-10 pt-2">
              {sortedUpcomingTasks.slice(0, 4).map((task, index) => (
                  <div key={task.id} className="relative group cursor-pointer" onClick={() => navigate('/tasks')}>
                      {/* Timeline Dot */}
                      <div className={`absolute -left-6 top-6 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${index === 0 ? 'bg-tt-blue animate-pulse box-content border-[3px]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>

                      <div className={`flex items-start gap-4 glass-panel p-5 rounded-[1.25rem] hover:border-tt-blue/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] 
                          ${task.status === TaskStatus.IN_PROGRESS ? 'ring-2 ring-tt-blue border-transparent bg-blue-500/10 shadow-[0_0_20px_rgba(30,144,255,0.3)] animate-pulse' : 
                          index === 0 ? 'bg-gradient-to-r from-tt-blue/5 to-transparent border-tt-blue/20' : ''}`}>
                          <div className={`w-[4.5rem] h-[4.5rem] rounded-2xl bg-black/5 dark:bg-white/5 flex flex-col items-center justify-center shrink-0 border border-black/5 dark:border-white/5 shadow-inner group-hover:bg-tt-blue/10 group-hover:border-tt-blue/20 transition-colors`}>
                              <span className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{task.date ? format(new Date(task.date), 'MMM d') : task.day.substring(0, 3)}</span>
                              <span className="font-black text-current text-sm mt-0.5">{task.time}</span>
                          </div>
                          <div className="flex-1 min-w-0 py-1">
                              <h4 className="font-black text-current text-[1.1rem] flex items-center gap-2 truncate pr-2">
                                  {task.title}
                                  {index === 0 && (
                                      <span className="text-[9px] bg-gradient-to-r from-tt-blue to-purple-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black shadow-md mt-1">
                                          Next
                                      </span>
                                  )}
                              </h4>
                              <div className="flex flex-wrap items-center gap-3 mt-3 opacity-80 text-xs font-semibold">
                                  <span className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md shadow-inner"><MapPin size={12} className="text-tt-blue"/> {task.venue}</span>
                                  <span className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md shadow-inner"><Clock size={12} className="text-purple-500"/> {task.durationMinutes}m</span>
                              </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                              <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    toggleStatus(task.id, task.status); 
                                  }}
                                  className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-tt-green/20 hover:text-tt-green hover:scale-110 shadow-md self-center"
                                  title="Mark as completed"
                              >
                                  <Circle size={22} className="text-gray-400 group-hover:text-tt-green transition-colors" />
                              </button>
                              {task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.IN_PROGRESS && (
                                  <button
                                      onClick={(e) => { e.stopPropagation(); startTask(task.id, task.durationMinutes); }}
                                      className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-tt-blue/20 hover:text-tt-blue hover:scale-110 shadow-md self-center"
                                      title="Start Task"
                                  >
                                      <Play size={18} className="text-gray-400 group-hover:text-tt-blue transition-colors ml-1" />
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
              {sortedUpcomingTasks.length === 0 && (
                  <div className={`p-8 rounded-2xl bg-black/5 dark:bg-white/5 border border-dashed ${isLightTheme ? 'border-gray-300' : 'border-gray-700'} text-center`}>
                      <span className="w-12 h-12 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
                          <CalendarIcon size={20} className="opacity-50" />
                      </span>
                      <p className="text-sm font-medium opacity-70">Your schedule is completely clear.</p>
                  </div>
              )}
          </div>
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />
    </div>
  );
};

export default Home;
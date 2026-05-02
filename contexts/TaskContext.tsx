import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Task, TaskPriority, TaskStatus, TimetableVersion, SyncStatus, Exam } from '../types';
import { useAuth } from './AuthContext';
import { format } from 'date-fns';
import { sendPushNotification, playVoiceReminder, sendSmartNotification } from '../services/notificationManager';

interface TaskContextType {
  tasks: Task[];
  draftTasks: Task[] | null;
  history: TimetableVersion[];
  syncStatus: SyncStatus;
  exams: Exam[];
  
  // CRUD
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  deleteTasks: (ids: string[]) => void;
  clearTasks: () => void;
  reorderTasks: (reorderedTasks: Task[]) => void;
  addExam: (exam: Omit<Exam, 'id'>) => void;
  
  // Save System
  saveDraft: (tasks: Task[]) => void;
  finalizeDraft: () => void;
  discardDraft: () => void;
  revertToVersion: (versionId: string) => void;
  
  // External
  syncGoogleCalendar: () => Promise<void>;
  importTasksFromCSV: (csvContent: string) => Promise<number>;
  importTasks: (tasks: Task[]) => Promise<number>;
  refreshTasks: () => void;
  
  // Getters
  upcomingTasks: Task[];
  ongoingTasks: Task[];
  completedTasks: Task[];

  // Smart Missed Task Recovery
  missedTaskToReschedule: Task | null;
  setMissedTaskToReschedule: (task: Task | null) => void;
  rescheduleTask: (task: Task, newDay: string, newTime: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children?: ReactNode }) => {
  const { user, logActivity, updateProfile } = useAuth();
  
  // Live Data
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Draft / Editing Data
  const [draftTasks, setDraftTasks] = useState<Task[] | null>(null);
  
  // Meta
  const [history, setHistory] = useState<TimetableVersion[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastNotifiedTaskId, setLastNotifiedTaskId] = useState<string | null>(null);
  const [missedTaskToReschedule, setMissedTaskToReschedule] = useState<Task | null>(null);
  const [promptedMissedTaskIds, setPromptedMissedTaskIds] = useState<Set<string>>(new Set());
  const [exams, setExams] = useState<Exam[]>([]);

  // 1. Initial Load
  useEffect(() => {
    if (user) {
      // Load Live Tasks
      const storedTasks = localStorage.getItem(`tt_tasks_${user.id}`);
      if (storedTasks) setTasks(JSON.parse(storedTasks));
      
      // Load Draft if exists
      const storedDraft = localStorage.getItem(`tt_draft_${user.id}`);
      if (storedDraft) setDraftTasks(JSON.parse(storedDraft));

      // Load History
      const storedHistory = localStorage.getItem(`tt_history_${user.id}`);
      if (storedHistory) setHistory(JSON.parse(storedHistory));

      // Load Prompted Missed Tasks
      const storedPrompted = localStorage.getItem(`tt_prompted_missed_${user.id}`);
      if (storedPrompted) setPromptedMissedTaskIds(new Set(JSON.parse(storedPrompted)));

      // Load Exams
      const storedExams = localStorage.getItem(`tt_exams_${user.id}`);
      if (storedExams) setExams(JSON.parse(storedExams));

      // Online/Offline listeners
      window.addEventListener('online', () => setSyncStatus('synced'));
      window.addEventListener('offline', () => setSyncStatus('offline'));

      // 24-hour background sync
      const syncInterval = setInterval(() => {
        if (navigator.onLine && user) {
          setSyncStatus('saving');
          const storedTasks = localStorage.getItem(`tt_tasks_${user.id}`);
          if (storedTasks) setTasks(JSON.parse(storedTasks));
          setTimeout(() => {
            setSyncStatus('synced');
          }, 1500);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours

      return () => clearInterval(syncInterval);
    }
    return () => {
        window.removeEventListener('online', () => setSyncStatus('synced'));
        window.removeEventListener('offline', () => setSyncStatus('offline'));
    };
  }, [user]);

  // 2. Persist Live Tasks
  useEffect(() => {
    if (user) {
      localStorage.setItem(`tt_tasks_${user.id}`, JSON.stringify(tasks));
    }
  }, [tasks, user]);

  // Persist Prompted Missed Tasks
  useEffect(() => {
    if (user) {
      localStorage.setItem(`tt_prompted_missed_${user.id}`, JSON.stringify(Array.from(promptedMissedTaskIds)));
    }
  }, [promptedMissedTaskIds, user]);

  // Persist Exams
  useEffect(() => {
    if (user) {
      localStorage.setItem(`tt_exams_${user.id}`, JSON.stringify(exams));
    }
  }, [exams, user]);

  // 3. Notification Engine (Polling)
  useEffect(() => {
    const interval = setInterval(() => {
        // Ensure user has enabled background alerts
        if (!user?.backgroundAlertsEnabled) return;

        const now = new Date();
        const currentDay = format(now, 'EEEE');
        const currentTime = format(now, 'HH:mm');
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayIndex = daysOfWeek.indexOf(currentDay);
        
        let foundMissedTask: Task | null = null;

        setTasks(prevTasks => {
            // Smart Notifications Logic
            const upcomingTasks = prevTasks.filter(task => {
                if (task.status !== TaskStatus.PENDING || task.day !== currentDay) return false;
                const [taskHours, taskMinutes] = task.time.split(':').map(Number);
                const taskDate = new Date(now);
                taskDate.setHours(taskHours, taskMinutes, 0, 0);
                const diffMinutes = (taskDate.getTime() - now.getTime()) / (1000 * 60);
                return diffMinutes > 0 && diffMinutes <= 60;
            });

            if (upcomingTasks.length > 0) {
                const lastUpcomingNotif = localStorage.getItem('lastUpcomingNotif');
                // Only notify once per hour
                if (!lastUpcomingNotif || (now.getTime() - parseInt(lastUpcomingNotif)) > 60 * 60 * 1000) {
                    sendSmartNotification(
                        "[REMINDER] Upcoming Tasks", 
                        `You have ${upcomingTasks.length} task${upcomingTasks.length > 1 ? 's' : ''} in 1 hour.`,
                        "upcoming-tasks"
                    );
                    localStorage.setItem('lastUpcomingNotif', now.getTime().toString());
                }
            }

            const missedTasksToday = prevTasks.filter(task => task.status === TaskStatus.MISSED && task.day === currentDay);
            if (missedTasksToday.length >= 2) {
                const lastBehindScheduleNotif = localStorage.getItem('lastBehindScheduleNotif');
                // Only notify once per day
                if (!lastBehindScheduleNotif || new Date(parseInt(lastBehindScheduleNotif)).getDate() !== now.getDate()) {
                    sendSmartNotification(
                        "[URGENT] Behind Schedule", 
                        "You are behind schedule today.",
                        "behind-schedule"
                    );
                    localStorage.setItem('lastBehindScheduleNotif', now.getTime().toString());
                }
            }

            let updated = false;
            const newTasks = prevTasks.map(task => {
                // Notification Logic
                if (task.status === TaskStatus.PENDING && 
                    task.day === currentDay && 
                    task.time === currentTime &&
                    lastNotifiedTaskId !== task.id) {
                    
                    sendPushNotification(task);
                    if (user?.username) {
                        playVoiceReminder(user.username, task.title, user.aiSettings?.aiAvatarType);
                    }
                    setLastNotifiedTaskId(task.id);
                    
                    // Reset notification lock after 1 minute to allow subsequent notifications for other tasks
                    setTimeout(() => setLastNotifiedTaskId(null), 61000);
                }

                // Missed Task Detection Logic
                if (task.status === TaskStatus.PENDING || task.status === TaskStatus.MISSED) {
                    const taskDayIndex = daysOfWeek.indexOf(task.day);
                    let isMissed = task.status === TaskStatus.MISSED;

                    if (!isMissed && taskDayIndex !== -1) {
                        if (taskDayIndex < currentDayIndex) {
                            isMissed = true;
                        } else if (taskDayIndex === currentDayIndex && task.time < currentTime) {
                            isMissed = true;
                        }
                    }

                    // If it was rescheduled, we only mark it missed if the NEW time has passed
                    // The logic above naturally handles this because task.day and task.time are the NEW values.
                    // However, we need to ensure we don't repeatedly show it in "missed tasks" if it was already handled.

                    if (isMissed) {
                        const missedTask = { ...task, status: TaskStatus.MISSED };
                        if (task.status !== TaskStatus.MISSED) {
                            updated = true;
                        }
                        
                        // Only prompt if it hasn't been prompted OR if it was rescheduled and missed AGAIN
                        // To handle "missed again", we can check if it's currently marked as rescheduled but missed.
                        // Actually, if it's rescheduled and missed again, its ID is still in promptedMissedTaskIds.
                        // We should remove it from promptedMissedTaskIds when it is rescheduled. (Already done in rescheduleTask)
                        
                        if (!foundMissedTask && !missedTaskToReschedule && !promptedMissedTaskIds.has(task.id)) {
                            foundMissedTask = missedTask;
                        }
                        return missedTask;
                    } else if (task.status === TaskStatus.MISSED) {
                        // If it's no longer missed (e.g. rescheduled to future), but status is still MISSED
                        // This shouldn't happen normally because rescheduleTask sets status to PENDING.
                        // But just in case, we can reset it.
                        const pendingTask = { ...task, status: TaskStatus.PENDING };
                        updated = true;
                        return pendingTask;
                    }
                }
                return task;
            });

            if (updated) {
                return newTasks;
            }
            return prevTasks;
        });

        if (foundMissedTask && !missedTaskToReschedule) {
            setMissedTaskToReschedule(foundMissedTask);
            setPromptedMissedTaskIds(prev => new Set(prev).add(foundMissedTask!.id));
        }

    }, 5000); // Check every 5 seconds for precision

    return () => clearInterval(interval);
  }, [tasks, user, lastNotifiedTaskId, missedTaskToReschedule, promptedMissedTaskIds]);

  // --- Actions ---

  const saveDraft = useCallback((newDraftTasks: Task[]) => {
      if (!user) return;
      setSyncStatus('saving');
      setDraftTasks(newDraftTasks);
      localStorage.setItem(`tt_draft_${user.id}`, JSON.stringify(newDraftTasks));
      
      // Simulate Cloud Delay
      setTimeout(() => {
          setSyncStatus('synced');
      }, 800);
  }, [user]);

  const finalizeDraft = () => {
      if (!user || !draftTasks) return;
      
      // Create Version Snapshot
      const newVersion: TimetableVersion = {
          versionId: Date.now().toString(),
          timestamp: new Date().toISOString(),
          tasks: [...tasks], // Save OLD tasks before overwriting
          note: `Auto-backup before update`
      };

      const updatedHistory = [newVersion, ...history].slice(0, 10); // Keep last 10
      setHistory(updatedHistory);
      localStorage.setItem(`tt_history_${user.id}`, JSON.stringify(updatedHistory));

      // Commit Draft to Live
      setTasks(draftTasks);
      setDraftTasks(null);
      localStorage.removeItem(`tt_draft_${user.id}`);
      
      logActivity('Published new timetable changes');
      setSyncStatus('synced');
  };

  const discardDraft = () => {
      if (!user) return;
      setDraftTasks(null);
      localStorage.removeItem(`tt_draft_${user.id}`);
  };

  const revertToVersion = (versionId: string) => {
      const version = history.find(v => v.versionId === versionId);
      if (version && user) {
          setTasks(version.tasks);
          logActivity(`Restored version from ${new Date(version.timestamp).toLocaleDateString()}`);
      }
  };

  const addTask = (task: Omit<Task, 'id'>) => {
    const newTask: Task = { ...task, id: Math.random().toString(36).substr(2, 9) };
    setTasks(prev => [...prev, newTask]);
    logActivity(`Added task: ${newTask.title}`);
  };

  const addExam = (exam: Omit<Exam, 'id'>) => {
    const newExam: Exam = { ...exam, id: Math.random().toString(36).substr(2, 9) };
    setExams(prev => [...prev, newExam]);
    logActivity(`Added exam on: ${newExam.date}`);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    // Also update draft if it exists and contains this task
    if (draftTasks) {
        setDraftTasks(prev => prev ? prev.map(t => t.id === id ? { ...t, ...updates } : t) : null);
    }
  };

  const rescheduleTask = (task: Task, newDay: string, newTime: string) => {
    updateTask(task.id, {
        day: newDay,
        time: newTime,
        status: TaskStatus.PENDING,
        rescheduled: true,
        lastUpdatedTime: new Date().toISOString()
    });
    setMissedTaskToReschedule(null);
    setPromptedMissedTaskIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(task.id);
      return newSet;
    });
    logActivity(`Rescheduled task: ${task.title} to ${newDay} at ${newTime}`);
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    logActivity(`Deleted task`);
  };

  const deleteTasks = (ids: string[]) => {
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    logActivity(`Deleted ${ids.length} tasks`);
  };

  const clearTasks = () => {
    setTasks([]);
    logActivity(`Cleared all tasks`);
  };

  const reorderTasks = (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
    logActivity(`Reordered tasks`);
  };

  const syncGoogleCalendar = async () => {
      // CLEAR USER CONSENT
      const userConsent = window.confirm("Privacy Notice: This app only accesses your calendar events to import and manage your schedules. No emails, files, contacts, or sensitive account data are accessed.\n\nDo you wish to continue?");
      if (!userConsent) return;

      setSyncStatus('saving');
      try {
          // Re-authenticate to get a fresh Google OAuth Access Token
          const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
          const { auth } = await import('../firebase');
          
          const provider = new GoogleAuthProvider();
          provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
          // Removed full calendar.events permission to increase privacy and reduce warnings.

          // Note: using prompt: 'consent' forces getting a refresh token, but we only need access token for now
          provider.setCustomParameters({ prompt: 'select_account' });
          
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken;

          if (!token) {
              throw new Error("Could not retrieve Google Calendar access token.");
          }

          // 1. Fetch events from Google Calendar
          const now = new Date();
          const timeMin = now.toISOString();
          const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Next 7 days
          
          const importResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
              headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              }
          });
          
          if (!importResponse.ok) {
              const errorText = await importResponse.text();
              throw new Error('Failed to import events from Google Calendar: ' + errorText);
          }
          
          const data = await importResponse.json();
          const events = data.items || [];
          
          if (events && events.length > 0) {
              const importedTasks: Task[] = events.map((event: any) => {
                  let start = new Date();
                  let end = new Date();
                  if (event.start?.dateTime) {
                      start = new Date(event.start.dateTime);
                  } else if (event.start?.date) {
                      start = new Date(event.start.date);
                  }
                  if (event.end?.dateTime) {
                      end = new Date(event.end.dateTime);
                  } else if (event.end?.date) {
                      end = new Date(event.end.date);
                  }
                  
                  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
                  
                  return {
                      id: 'g_' + event.id,
                      title: event.summary || 'Google Event',
                      description: event.description || 'Imported from Google Calendar',
                      day: format(start, 'EEEE'),
                      time: format(start, 'HH:mm'),
                      durationMinutes: durationMinutes > 0 ? durationMinutes : 60,
                      venue: event.location || '',
                      priority: TaskPriority.MEDIUM,
                      status: TaskStatus.PENDING,
                      category: 'Work',
                      isGoogleEvent: true
                  };
              });

              setTasks(prev => {
                  // SMARTER DUPLICATE AVOIDANCE & OVERLAP PREVENTION
                  const prevFiltered = prev.filter(t => !t.isGoogleEvent);
                  
                  // Filter out imported tasks that directly overlap with our manual tasks
                  const uniqueImported = importedTasks.filter(impTask => {
                     // Check if an existing task has the exact same title, day, and time
                     const isExactDuplicate = prevFiltered.some(pt => 
                        pt.title.toLowerCase() === impTask.title.toLowerCase() && 
                        pt.day === impTask.day && 
                        pt.time === impTask.time
                     );
                     
                     if (isExactDuplicate) return false;
                     
                     // Check for time overlap 
                     const isOverlapping = prevFiltered.some(pt => {
                         if (pt.day !== impTask.day) return false;
                         
                         const ptStartMinutes = parseInt(pt.time.split(':')[0]) * 60 + parseInt(pt.time.split(':')[1]);
                         const ptEndMinutes = ptStartMinutes + pt.durationMinutes;
                         
                         const impStartMinutes = parseInt(impTask.time.split(':')[0]) * 60 + parseInt(impTask.time.split(':')[1]);
                         const impEndMinutes = impStartMinutes + impTask.durationMinutes;
                         
                         // Overlap condition
                         return (ptStartMinutes < impEndMinutes && ptEndMinutes > impStartMinutes);
                     });
                     
                     return !isOverlapping;
                  });
                  return [...prevFiltered, ...uniqueImported];
              });
          }

          // We intentionally avoid pushing tasks back to Google Calendar by default
          // to maintain our calendar.readonly promise and reduce security warnings.
          
          // Update User Sync Status
          if (user) {
              await updateProfile({
                  googleIntegration: {
                      isConnected: true,
                      email: user.email || '',
                      lastSync: new Date().toISOString()
                  }
              });
          }

          setSyncStatus('synced');
          logActivity(`Synced with Google Calendar. Downloaded ${events.length}.`);
          alert('Successfully imported real-time events from Google Calendar!');
      } catch (error: any) {
          console.error("Google Calendar sync error:", error);
          setSyncStatus('error');
          alert('Failed to sync with Google Calendar. Error: ' + error.message);
      }
  };

  const importTasks = async (newTasks: Task[]): Promise<number> => {
      setSyncStatus('saving');
      return new Promise<number>((resolve, reject) => {
          try {
            setTasks(prev => [...prev, ...newTasks]);
            setSyncStatus('synced');
            logActivity(`Imported ${newTasks.length} tasks`);
            
            // Update User Stats
            if (user) {
                updateProfile({
                    excelIntegration: {
                        lastUpload: new Date().toISOString(),
                        totalImported: (user.excelIntegration?.totalImported || 0) + newTasks.length
                    }
                });
            }
            
            resolve(newTasks.length);
          } catch (e) {
            setSyncStatus('error');
            reject(e);
          }
      });
  };

  const refreshTasks = useCallback(() => {
    if (user) {
      setSyncStatus('saving');
      const storedTasks = localStorage.getItem(`tt_tasks_${user.id}`);
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      }
      setTimeout(() => {
        setSyncStatus('synced');
      }, 500);
    }
  }, [user]);

  const importTasksFromCSV = async (csvContent: string): Promise<number> => {
      setSyncStatus('saving');
      return new Promise<number>((resolve, reject) => {
          try {
            const lines = csvContent.split('\n');
            const newTasks: Task[] = [];
            
            // Basic CSV Parsing (Assumes Header: Title,Day,Time,Duration,Venue)
            // Skip header row
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
                if (cols.length < 3) continue;

                newTasks.push({
                    id: 'csv_' + Math.random().toString(36).substr(2, 9),
                    title: cols[0] || 'Untitled Import',
                    day: cols[1] || 'Monday',
                    time: cols[2] || '09:00',
                    durationMinutes: parseInt(cols[3]) || 60,
                    venue: cols[4] || '',
                    description: 'Imported via CSV',
                    priority: TaskPriority.MEDIUM,
                    status: TaskStatus.PENDING,
                    category: 'Work',
                    isExcelImport: true
                });
            }

            setTasks(prev => [...prev, ...newTasks]);
            setSyncStatus('synced');
            logActivity(`Imported ${newTasks.length} tasks from CSV`);
            
            // Update User Stats
            if (user) {
                updateProfile({
                    excelIntegration: {
                        lastUpload: new Date().toISOString(),
                        totalImported: (user.excelIntegration?.totalImported || 0) + newTasks.length
                    }
                });
            }
            
            resolve(newTasks.length);
          } catch (e) {
            setSyncStatus('error');
            reject(e);
          }
      });
  };

  const upcomingTasks = tasks.filter(t => t.status === TaskStatus.PENDING);
  const ongoingTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);

  return (
    <TaskContext.Provider value={{ 
        tasks, draftTasks, history, syncStatus, exams,
        addTask, updateTask, deleteTask, deleteTasks, clearTasks, reorderTasks, addExam,
        saveDraft, finalizeDraft, discardDraft, revertToVersion,
        syncGoogleCalendar, importTasksFromCSV, importTasks, refreshTasks,
        upcomingTasks, ongoingTasks, completedTasks,
        missedTaskToReschedule, setMissedTaskToReschedule, rescheduleTask
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within a TaskProvider');
  return context;
};
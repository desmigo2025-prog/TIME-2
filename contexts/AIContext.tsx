import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AIMessage, User, Task, TaskPriority, TaskStatus, BackgroundJob, AIActionLog } from '../types';
import { useAuth } from './AuthContext';
import { useTasks } from './TaskContext';
import { useUsage } from './UsageContext';
import { useLectures } from './LectureContext';
import { AIAssistantService } from '../services/aiAssistant';
import { sendPushNotification, setNotificationsBlocked } from '../services/notificationManager';
import { format, addMinutes } from 'date-fns';
import { analyzeStudyPredictor } from '../services/geminiService';

interface AIContextType {
    messages: AIMessage[];
    sendMessage: (text: string) => Promise<void>;
    isTyping: boolean;
    isListening: boolean;
    isSpeaking: boolean;
    isThinking: boolean;
    startListening: () => void;
    stopListening: () => void;
    clearHistory: () => void;
    deleteMessage: (id: string) => void;
    latestGreeting: string | null;
    dismissGreeting: () => void;
    speak: (text: string) => void;
    stopSpeaking: () => void;
    pauseSpeech: () => void;
    resumeSpeech: () => void;
    cancelSpeech: () => void;
    backgroundJobs: BackgroundJob[];
    aiActionsLog: AIActionLog[];
    isFocusModeActive: boolean;
    focusModeMinutes: number;
    startFocusMode: (minutes: number) => void;
    stopFocusMode: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider = ({ children }: { children?: ReactNode }) => {
    const { user, updateProfile } = useAuth();
    const { tasks, exams, addTask, updateTask, deleteTask, upcomingTasks, saveDraft } = useTasks();
    const { isPro } = useUsage();
    const { lectures } = useLectures();
    
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJob[]>([]);
    const [aiActionsLog, setAiActionsLog] = useState<AIActionLog[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [latestGreeting, setLatestGreeting] = useState<string | null>(null);
    const [isFocusModeActive, setIsFocusModeActive] = useState(false);
    const [focusModeMinutes, setFocusModeMinutes] = useState(0);

    const startFocusMode = (minutes: number) => {
        setFocusModeMinutes(minutes);
        setIsFocusModeActive(true);
        setNotificationsBlocked(true);
    };

    const stopFocusMode = () => {
        setIsFocusModeActive(false);
        setFocusModeMinutes(0);
        setNotificationsBlocked(false);
    };

    const aiService = useRef(new AIAssistantService());
    const recognition = useRef<any>(null); // Type 'any' for Web Speech API
    const hasGreeted = useRef(false);

    // Load History & Background Jobs
    useEffect(() => {
        const storedHistory = localStorage.getItem('tt_ai_history');
        if (storedHistory) setMessages(JSON.parse(storedHistory));

        const storedJobs = localStorage.getItem('tt_ai_background_jobs');
        if (storedJobs) setBackgroundJobs(JSON.parse(storedJobs));

        const storedLogs = localStorage.getItem('tt_ai_actions_log');
        if (storedLogs) setAiActionsLog(JSON.parse(storedLogs));
    }, []);

    // Persist History & Jobs
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('tt_ai_history', JSON.stringify(messages));
        }
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('tt_ai_background_jobs', JSON.stringify(backgroundJobs));
    }, [backgroundJobs]);

    useEffect(() => {
        localStorage.setItem('tt_ai_actions_log', JSON.stringify(aiActionsLog));
    }, [aiActionsLog]);

    const logAction = (actionType: string, details: string) => {
        const newLog: AIActionLog = {
            id: Math.random().toString(36).substr(2, 9),
            actionType,
            details,
            timestamp: new Date().toISOString()
        };
        setAiActionsLog(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100
    };

    // Welcome Experience (Dynamic Greetings)
    useEffect(() => {
        if (user && !hasGreeted.current) {
            let greeting = "";
            const isDynamic = user.aiSettings?.dynamicGreetingsEnabled !== false; // Default to true

            if (!isDynamic) {
                // Static Fallback
                greeting = `Hello, ${user.displayName || user.username || 'User'}! Welcome back to T.T App.`;
            } else {
                // Dynamic Context Calculation
                const now = new Date();
                const hour = now.getHours();
                const name = user.displayName || user.username || 'User';
                const todayStr = format(now, 'EEEE'); // e.g., "Monday"

                // Determine Time of Day
                let timeGreeting = "Hello";
                if (hour < 5) timeGreeting = "Working late";
                else if (hour < 12) timeGreeting = "Good morning";
                else if (hour < 17) timeGreeting = "Good afternoon";
                else timeGreeting = "Good evening";

                // Analyze Daily Tasks
                const tasksToday = upcomingTasks.filter(t => t.day === todayStr);
                const pendingCount = tasksToday.filter(t => t.status === TaskStatus.PENDING).length;
                
                // Find next immediate task
                const currentHm = format(now, 'HH:mm');
                const nextTask = tasksToday
                    .filter(t => t.status === TaskStatus.PENDING && t.time >= currentHm)
                    .sort((a,b) => a.time.localeCompare(b.time))[0];

                if (pendingCount === 0) {
                     if (hour > 18) {
                         greeting = `${timeGreeting}, ${name}. You've cleared your schedule for the day. Great job!`;
                     } else {
                         greeting = `${timeGreeting}, ${name}! Your schedule is clear today. Want to plan ahead?`;
                     }
                } else if (nextTask) {
                    greeting = `${timeGreeting}, ${name}. You have ${pendingCount} tasks remaining. Don't forget "${nextTask.title}" at ${nextTask.time}.`;
                } else {
                    greeting = `${timeGreeting}, ${name}. You have ${pendingCount} pending tasks on your list today.`;
                }
            }
            
            setLatestGreeting(greeting);
            
            const greetingMsg: AIMessage = {
                id: 'welcome-' + Date.now(),
                role: 'model',
                content: greeting,
                timestamp: new Date().toISOString()
            };

            // Avoid duplicate greeting in history on hot reload
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.content === greeting && lastMsg?.role === 'model') return prev;
                return [...prev, greetingMsg];
            });
            
            if (user.aiSettings?.voiceResponseEnabled !== false) {
                speak(greeting);
            }
            
            hasGreeted.current = true;
        }
    }, [user, upcomingTasks]);

    // SMART MISSED TASK RECOVERY
    const upcomingTasksRef = useRef(upcomingTasks);
    const tasksRef = useRef(tasks);
    const examsRef = useRef(exams);
    
    useEffect(() => {
        upcomingTasksRef.current = upcomingTasks;
        tasksRef.current = tasks;
        examsRef.current = exams;
    }, [upcomingTasks, tasks, exams]);

    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            const now = new Date();
            const currentDay = format(now, 'EEEE');
            const currentTime = format(now, 'HH:mm');

            upcomingTasksRef.current.forEach(task => {
                let isMissed = false;

                if (task.date) {
                    const taskDate = new Date(`${task.date}T${task.time}`);
                    if (taskDate < now) {
                        isMissed = true;
                    }
                } else if (task.day === currentDay && task.time < currentTime) {
                    isMissed = true;
                }

                if (isMissed) {
                    // Update task status to MISSED
                    updateTask(task.id, { status: TaskStatus.MISSED });
                    
                    // Notify user via AI
                    const msgContent = `You missed "${task.title}" (ID: ${task.id}). Should I reschedule it for your next free time today or the next available day?`;
                    const notificationMsg: AIMessage = {
                        id: 'missed-' + Date.now() + Math.random(),
                        role: 'model',
                        content: msgContent,
                        timestamp: new Date().toISOString()
                    };
                    
                    setMessages(prev => [...prev, notificationMsg]);
                    
                    // Also send a push notification
                    sendPushNotification({
                        ...task,
                        title: `Missed Task: ${task.title}`,
                        description: 'Open AI Companion to reschedule.'
                    });
                    
                    if (user.aiSettings?.voiceResponseEnabled !== false) {
                        speak(msgContent);
                    }
                }
            });
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [user, updateTask]);

    // BACKGROUND EXECUTION ENGINE
    useEffect(() => {
        if (!user?.aiSettings?.backgroundEnabled) return;

        // 1. Random Auto-Check & Smart Alerts
        const autoCheckInterval = setInterval(() => {
            // Exam Countdown Alerts
            const now = new Date();
            const upcomingExamsList = (examsRef.current || [])
                .map(exam => {
                    const examDate = new Date(exam.date);
                    const diffTime = examDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return { ...exam, daysRemaining: diffDays };
                })
                .filter(exam => exam.daysRemaining >= 0 && exam.daysRemaining <= 3); // Alert for exams within 3 days
            
            if (upcomingExamsList.length > 0 && Math.random() > 0.8) {
                const exam = upcomingExamsList[0];
                const msg = `${exam.daysRemaining} days left until your ${exam.subjects.join(', ')} exam. Increase your study time!`;
                scheduleBackgroundJob('NOTIFICATION', { message: msg }, new Date());
            } else if (Math.random() > 0.9) {
                // Performance Check
                const subjectHours: Record<string, number> = {};
                tasksRef.current.forEach(task => {
                    if (task.status === 'Completed' && (task.category === 'School' || task.title.toLowerCase().includes('study'))) {
                        const hours = task.durationMinutes / 60;
                        subjectHours[task.title] = (subjectHours[task.title] || 0) + hours;
                    }
                });
                const subjects = Object.keys(subjectHours);
                if (subjects.length > 1) {
                    const sortedSubjects = subjects.sort((a, b) => subjectHours[a] - subjectHours[b]);
                    const weakestSubject = sortedSubjects[0];
                    if (subjectHours[weakestSubject] < 2) { // Arbitrary threshold for "behind"
                        const msg = `You are behind in ${weakestSubject}. Consider scheduling more study time for it.`;
                        scheduleBackgroundJob('NOTIFICATION', { message: msg }, new Date());
                    }
                }
            } else if (Math.random() > 0.98) { // Rare event
                const msg = "You have a free slot coming up. Want to review your goals?";
                scheduleBackgroundJob('NOTIFICATION', { message: msg }, new Date());
            }
        }, 60000 * 5); // Check every 5 mins

        // 2. Job Processor (Runs every 10 seconds to check for due jobs)
        const jobProcessor = setInterval(() => {
            const now = new Date();
            setBackgroundJobs(prevJobs => {
                let hasChanges = false;
                const updatedJobs = prevJobs.map(job => {
                    if (job.status === 'pending' && new Date(job.scheduledTime) <= now) {
                        hasChanges = true;
                        executeJob(job);
                        return { ...job, status: 'completed' as const };
                    }
                    return job;
                });
                return hasChanges ? updatedJobs : prevJobs;
            });
        }, 10000);

        return () => {
            clearInterval(autoCheckInterval);
            clearInterval(jobProcessor);
        };
    }, [user]);

    const executeJob = (job: BackgroundJob) => {
        if (job.jobType === 'REMINDER' || job.jobType === 'NOTIFICATION') {
            const msg = job.payload.message;
            sendPushNotification({ 
                id: job.id, title: 'T.T Assistant', venue: 'Virtual', 
                durationMinutes: 0, time: format(new Date(), 'HH:mm'), 
                day: format(new Date(), 'EEEE'), 
                description: msg, priority: TaskPriority.HIGH, status: TaskStatus.PENDING, category: 'Personal' 
            } as Task);

            if (user?.aiSettings?.voiceResponseEnabled !== false) {
                speak(msg);
            }
        }
    };

    const scheduleBackgroundJob = (type: 'REMINDER' | 'TASK_CREATE' | 'NOTIFICATION', payload: any, date: Date) => {
        const newJob: BackgroundJob = {
            id: 'job-' + Date.now() + Math.random(),
            jobType: type,
            payload,
            scheduledTime: date.toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        setBackgroundJobs(prev => [...prev, newJob]);
    };

    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        
        // Clean text for natural speech
        let cleanText = text
            // Remove markdown formatting characters (bold, strikethrough)
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/~~/g, '')
            // Remove italic asterisks and underscores, but keep math (e.g., 3 * 4)
            .replace(/\*(?!\s)([^*]*[^\s*])\*/g, '$1')
            .replace(/_(?!\s)([^_]*[^\s_])_/g, '$1')
            // Remove headers (#)
            .replace(/(^|\n)#+\s*/g, '$1')
            // Remove bullet points (*, -, •, o) at the start of lines or after spaces
            .replace(/(^|\n)\s*[-•o*]\s+/g, '$1')
            // Remove code block backticks
            .replace(/`/g, '')
            // Remove HTML tags
            .replace(/<[^>]*>/g, '')
            // Replace newlines and extra line breaks with a period to ensure a natural pause
            .replace(/\n+/g, '. ')
            // Clean up multiple punctuation marks created by the newline replacement, but preserve ellipsis
            .replace(/\s+\./g, '.')
            .replace(/([?!])\./g, '$1')
            .replace(/\.{2,}/g, (match) => match.length === 2 ? '.' : match)
            // Remove invisible characters
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            // Remove extra spaces
            .replace(/\s+/g, ' ')
            .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        const voices = window.speechSynthesis.getVoices();
        let preferredVoice = voices[0];
        const avatarType = user?.aiSettings?.aiAvatarType || 'girl';
        
        if (avatarType === 'boy') {
            preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('male') || v.name.includes('Google UK English Male'))) || voices[0];
        } else {
            preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('female') || v.name.includes('Google UK English Female') || v.name.includes('Google US English'))) || voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
        }

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    const stopSpeaking = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const pauseSpeech = () => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            setIsSpeaking(false);
        }
    };

    const resumeSpeech = () => {
        if (window.speechSynthesis && window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setIsSpeaking(true);
        }
    };

    const cancelSpeech = () => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const sendMessage = async (text: string) => {
        cancelSpeech(); // Stop any ongoing speech before sending a new message

        // Network Check
        if (!navigator.onLine) {
            const offlineMsg: AIMessage = {
                id: Date.now().toString(),
                role: 'system',
                content: "I'm currently offline. Please check your internet connection and try again.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, offlineMsg]);
            return;
        }

        const newUserMsg: AIMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newUserMsg]);
        setIsTyping(true);
        setIsThinking(true);

        try {
            // Context Building
            const relevantTasks = tasks.filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.MISSED);
            const taskSummary = relevantTasks.map(t => `[ID: ${t.id}] ${t.title} at ${t.time} for ${t.durationMinutes}m (${t.day}${t.date ? `, ${t.date}` : ''}) [Status: ${t.status}]`).join(", ");
            const lectureSummary = lectures.map(l => `ID: ${l.id}, Title: ${l.title}`).join("; ");
            
            // Performance Data
            let completedCount = 0;
            let totalCount = 0;
            const subjectHours: Record<string, number> = {};
            tasks.forEach(task => {
                if (task.category === 'School' || task.title.toLowerCase().includes('study') || task.title.toLowerCase().includes('exam') || task.title.toLowerCase().includes('read')) {
                    totalCount++;
                    if (task.status === 'Completed') {
                        completedCount++;
                        const hours = task.durationMinutes / 60;
                        subjectHours[task.title] = (subjectHours[task.title] || 0) + hours;
                    }
                }
            });
            const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
            const performanceSummary = `Overall Progress: ${progressPercentage}%. Study Hours: ${Object.entries(subjectHours).map(([subj, hrs]) => `${subj}: ${hrs.toFixed(1)}h`).join(', ')}.`;

            // Exam Countdown
            const now = new Date();
            const upcomingExamsList = (exams || [])
                .map(exam => {
                    const examDate = new Date(exam.date);
                    const diffTime = examDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return { ...exam, daysRemaining: diffDays };
                })
                .filter(exam => exam.daysRemaining >= 0)
                .sort((a, b) => a.daysRemaining - b.daysRemaining);
            const examSummary = upcomingExamsList.map(e => `${e.subjects.join(', ')} in ${e.daysRemaining} days`).join('; ');

            const context = `User: ${user?.username}. Current Time: ${format(new Date(), 'EEEE HH:mm')}. Upcoming Tasks: ${taskSummary || "None"}. Saved Lectures: ${lectureSummary || "None"}. Performance: ${performanceSummary}. Upcoming Exams: ${examSummary || "None"}.`;
            
            // Format History for Gemini
            const history = messages.slice(-10).map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            // Step 1: Main AI Call
            const aiControlEnabled = user?.aiSettings?.aiControlEnabled || false;
            const response = await aiService.current.generateResponse(history, text, context, isPro, aiControlEnabled);
            
            // Handle JSON Response Format
            let parsedResponse = {
                text: "",
                emotion: "neutral" as any,
                animation: "talking" as any,
                popup: false,
                priority: "medium" as any
            };

            try {
                if (response.text) {
                    let cleanJson = response.text.trim();
                    // If AI included markdown code blocks, strip them
                    if (cleanJson.startsWith("```json")) {
                        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
                    } else if (cleanJson.startsWith("```")) {
                        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
                    }
                    parsedResponse = JSON.parse(cleanJson);
                }
            } catch (e) {
                console.warn("Failed to parse AI JSON response, falling back to raw text:", e);
                parsedResponse.text = response.text || "";
            }

            // Handle Tool Calls
            let aiText = parsedResponse.text || "";
            let groundingData = undefined;
            let suggestedAnswers: string[] | undefined = undefined;

            const toolCalls = response.functionCalls;
            
            if (toolCalls && toolCalls.length > 0) {
                for (const call of toolCalls) {
                    if (call.name === 'createTask') {
                        const args = call.args as any;
                        
                        const newDuration = args.durationMinutes || 60;
                        const newStartHour = parseInt(args.time.split(':')[0]);
                        const newStartMin = parseInt(args.time.split(':')[1]);
                        const newStartTotal = newStartHour * 60 + newStartMin;
                        const newEndTotal = newStartTotal + newDuration;

                        let finalTime = args.time;
                        let finalStartTotal = newStartTotal;
                        let finalEndTotal = newEndTotal;
                        let conflict = null;
                        let attempts = 0;

                        while (attempts < 24) {
                            conflict = upcomingTasks.find(t => {
                                const isSameDay = (args.date && t.date === args.date) || (!args.date && !t.date && t.day === args.day);
                                if (!isSameDay) return false;
                                
                                const tStartHour = parseInt(t.time.split(':')[0]);
                                const tStartMin = parseInt(t.time.split(':')[1]);
                                const tStartTotal = tStartHour * 60 + tStartMin;
                                const tEndTotal = tStartTotal + t.durationMinutes;
                                
                                return (finalStartTotal < tEndTotal && finalEndTotal > tStartTotal);
                            });
                            
                            if (!conflict) break;
                            
                            const tStartHour = parseInt(conflict.time.split(':')[0]);
                            const tStartMin = parseInt(conflict.time.split(':')[1]);
                            const tEndTotal = tStartHour * 60 + tStartMin + conflict.durationMinutes;
                            
                            finalStartTotal = tEndTotal;
                            finalEndTotal = finalStartTotal + newDuration;
                            
                            const finalHour = Math.floor(finalStartTotal / 60);
                            const finalMin = finalStartTotal % 60;
                            finalTime = `${String(finalHour).padStart(2, '0')}:${String(finalMin).padStart(2, '0')}`;
                            attempts++;
                        }
                        
                        if (finalTime !== args.time) {
                            aiText += `\n⚠️ Note: Scheduling "${args.title}" at ${args.time} conflicted with another task. I've automatically moved it to the next available slot at ${finalTime}. `;
                        }

                        addTask({
                            title: args.title,
                            day: args.day,
                            date: args.date,
                            time: finalTime,
                            durationMinutes: newDuration,
                            venue: args.venue || 'TBD',
                            description: args.description || 'Created by AI',
                            priority: TaskPriority.MEDIUM,
                            status: TaskStatus.PENDING,
                            category: 'Personal'
                        });
                        aiText += `I've scheduled "${args.title}" for ${args.day}${args.date ? ` (${args.date})` : ''} at ${args.time}. `;
                        logAction('createTask', `Scheduled "${args.title}"`);
                    
                    } else if (call.name === 'deleteTasks') {
                        const args = call.args as any;
                        const taskIds = args.taskIds as string[];
                        
                        if (taskIds && taskIds.length > 0) {
                            const tasksToDelete = tasks.filter(t => taskIds.includes(t.id));
                            if (tasksToDelete.length > 0) {
                                const taskNames = tasksToDelete.map(t => t.title).join(", ");
                                taskIds.forEach(id => deleteTask(id));
                                aiText += `I've deleted the following tasks: ${taskNames}. `;
                                logAction('deleteTasks', `Deleted tasks: ${taskNames}`);
                            } else {
                                aiText += `I couldn't find the tasks you asked to delete. `;
                            }
                        }
                    } else if (call.name === 'updateTasks') {
                        const args = call.args as any;
                        const updates = args.updates as any[];
                        
                        if (updates && updates.length > 0) {
                            let updatedNames: string[] = [];
                            updates.forEach(update => {
                                const task = tasks.find(t => t.id === update.id);
                                if (task) {
                                    const newDay = update.day || task.day;
                                    const newDate = update.date || task.date;
                                    const newTime = update.time || task.time;
                                    
                                    const newDuration = update.durationMinutes || task.durationMinutes;
                                    const newStartHour = parseInt(newTime.split(':')[0]);
                                    const newStartMin = parseInt(newTime.split(':')[1]);
                                    const newStartTotal = newStartHour * 60 + newStartMin;
                                    const newEndTotal = newStartTotal + newDuration;

                                    let finalTime = newTime;
                                    let finalStartTotal = newStartTotal;
                                    let finalEndTotal = newEndTotal;
                                    let conflict = null;
                                    let attempts = 0;

                                    while (attempts < 24) {
                                        conflict = tasks.find(t => {
                                            if (t.status !== TaskStatus.PENDING || t.id === task.id) return false;
                                            const isSameDay = (newDate && t.date === newDate) || (!newDate && !t.date && t.day === newDay);
                                            if (!isSameDay) return false;
                                            
                                            const tStartHour = parseInt(t.time.split(':')[0]);
                                            const tStartMin = parseInt(t.time.split(':')[1]);
                                            const tStartTotal = tStartHour * 60 + tStartMin;
                                            const tEndTotal = tStartTotal + t.durationMinutes;
                                            
                                            return (finalStartTotal < tEndTotal && finalEndTotal > tStartTotal);
                                        });
                                        
                                        if (!conflict) break;
                                        
                                        const tStartHour = parseInt(conflict.time.split(':')[0]);
                                        const tStartMin = parseInt(conflict.time.split(':')[1]);
                                        const tEndTotal = tStartHour * 60 + tStartMin + conflict.durationMinutes;
                                        
                                        finalStartTotal = tEndTotal;
                                        finalEndTotal = finalStartTotal + newDuration;
                                        
                                        const finalHour = Math.floor(finalStartTotal / 60);
                                        const finalMin = finalStartTotal % 60;
                                        finalTime = `${String(finalHour).padStart(2, '0')}:${String(finalMin).padStart(2, '0')}`;
                                        attempts++;
                                    }
                                    
                                    if (finalTime !== newTime) {
                                        aiText += `\n⚠️ Note: Rescheduling "${task.title}" to ${newTime} conflicted with another task. I've automatically moved it to the next available slot at ${finalTime}. `;
                                    }

                                    const partialUpdate: Partial<Task> = { status: TaskStatus.PENDING };
                                    if (update.day) partialUpdate.day = update.day;
                                    if (update.date) partialUpdate.date = update.date;
                                    partialUpdate.time = finalTime;
                                    if (update.durationMinutes) partialUpdate.durationMinutes = update.durationMinutes;
                                    updateTask(update.id, partialUpdate);
                                    updatedNames.push(task.title);
                                }
                            });
                            
                            if (updatedNames.length > 0) {
                                aiText += `I've updated the following tasks: ${updatedNames.join(", ")}. `;
                                logAction('updateTasks', `Updated tasks: ${updatedNames.join(", ")}`);
                            } else {
                                aiText += `I couldn't find the tasks you asked to update. `;
                            }
                        }
                    } else if (call.name === 'getLectureNotes') {
                        const args = call.args as any;
                        const lectureId = args.lectureId;
                        const lecture = lectures.find(l => l.id === lectureId);
                        if (lecture) {
                            const notesContent = lecture.notes.map(n => `[${n.format.toUpperCase()}]: ${n.content}`).join("\n\n");
                            const transcriptContent = lecture.transcript;
                            
                            const prompt = `The user asked about the lecture "${lecture.title}". Here are the notes:\n${notesContent}\n\nTranscript:\n${transcriptContent}\n\nPlease answer the user's question based on this information.`;
                            
                            const followUpResponse = await aiService.current.generateResponse(history, prompt, context, isPro, aiControlEnabled);
                            aiText += followUpResponse.text;
                            logAction('getLectureNotes', `Retrieved notes for lecture: ${lecture.title}`);
                        } else {
                            aiText += `I couldn't find the lecture with ID ${lectureId}. `;
                        }
                    } else if (call.name === 'webSearch') {
                        // SPECIAL: Trigger a second, grounded call
                        const query = call.args['query'] as string;
                        const searchRes = await aiService.current.performGroundedSearch(query);
                        
                        aiText += searchRes.text; // The summarized answer from Google Search
                        // Extract citations/sources
                        if (searchRes.candidates?.[0]?.groundingMetadata) {
                            groundingData = searchRes.candidates[0].groundingMetadata;
                        }
                        logAction('webSearch', `Searched the web for: ${query}`);
                    
                    } else if (call.name === 'suggestTimetable') {
                        const args = call.args as any;
                        const tasks = args.tasks as any[];
                        
                        const draftTasksToSave = tasks.map(t => ({
                            id: Math.random().toString(36).substr(2, 9),
                            title: t.title,
                            day: t.day,
                            time: t.time,
                            durationMinutes: t.durationMinutes || 60,
                            venue: t.venue || 'TBD',
                            description: t.description || 'AI Suggested Plan',
                            priority: TaskPriority.MEDIUM,
                            status: TaskStatus.PENDING, 
                            category: 'Personal' as "Personal" | "Work" | "School" | "Other",
                            confidenceScore: 1.0,
                            parsingMetaData: { confidence: { title: 1, day: 1, time: 1, venue: 1 }, correctionsApplied: [], isLowConfidence: false },
                            validationStatus: 'needs_review' as any // Mark as review needed so user checks them
                        }));
                        
                        saveDraft(draftTasksToSave);
                        aiText += args.planSummary || `I've generated a timetable with ${tasks.length} tasks. Please review them.`;
                        logAction('suggestTimetable', `Generated timetable with ${tasks.length} tasks`);

                    } else if (call.name === 'phoneAction') {
                        const args = call.args as any;
                        aiText += `Executing ${args.actionType} for ${args.payload}... Done. `;
                        if (args.actionType === 'ALARM') alert(`⏰ ALARM SET: ${args.payload}`);
                        if (args.actionType === 'OPEN_APP') alert(`📱 OPENING: ${args.payload}`);
                        logAction('phoneAction', `Executed ${args.actionType} for ${args.payload}`);
                    
                    } else if (call.name === 'scheduleReminder') {
                        const args = call.args as any;
                        const delayMins = args.delayMinutes || 1;
                        const triggerTime = addMinutes(new Date(), delayMins);
                        scheduleBackgroundJob('REMINDER', { message: args.message }, triggerTime);
                        
                        // Add a background job to send a push notification immediately confirming the reminder
                        scheduleBackgroundJob('NOTIFICATION', { message: `Reminder set for ${delayMins} minutes: ${args.message}` }, new Date());
                        
                        aiText += `Okay, I will remind you to "${args.message}" in ${delayMins} minutes. `;
                        logAction('scheduleReminder', `Scheduled reminder: "${args.message}" in ${delayMins} mins`);
                    } else if (call.name === 'askUserPreference') {
                        const args = call.args as any;
                        aiText += args.question;
                        suggestedAnswers = args.suggestedAnswers;
                    } else if (call.name === 'navigateApp') {
                        const args = call.args as any;
                        const page = args.page.toLowerCase();
                        let path = '/';
                        if (page.includes('task')) path = '/tasks';
                        else if (page.includes('timetable') || page.includes('plan')) path = '/review';
                        else if (page.includes('lecture') || page.includes('record')) path = '/lectures';
                        else if (page.includes('exam')) path = '/exams';
                        else if (page.includes('profile') || page.includes('setting')) path = '/profile';
                        else if (page.includes('study') || page.includes('flashcard') || page.includes('summary')) path = '/study-materials';
                        
                        window.location.hash = `#${path}`;
                        aiText += `Navigating to ${page}... `;
                        logAction('navigateApp', `Navigated to ${page}`);
                    } else if (call.name === 'updateUserSettings') {
                        const args = call.args as any;
                        const settings = args.settings;
                        if (user) {
                            const newSettings = { ...user.aiSettings, ...settings };
                            await updateProfile({ aiSettings: newSettings });
                            aiText += `I've updated your settings. `;
                            logAction('updateUserSettings', `Updated settings: ${JSON.stringify(settings)}`);
                        } else {
                            aiText += `I couldn't update your settings because you are not logged in. `;
                        }
                    } else if (call.name === 'startLectureRecording') {
                        // We need to dispatch an event or call a global function.
                        // Since we added startRecording to LectureContext, but we don't have it here directly.
                        // Wait, we DO have useLectures() in AIContext!
                        // Let's check if we destructured startRecording.
                        // We need to add it to the destructuring at the top of AIProvider.
                        // For now, let's just dispatch an event if it's not available, or we can update the destructuring.
                        window.dispatchEvent(new CustomEvent('aiStartRecording'));
                        aiText += `Starting lecture recording... `;
                        logAction('startLectureRecording', `Started lecture recording`);
                    } else if (call.name === 'stopLectureRecording') {
                        window.dispatchEvent(new CustomEvent('aiStopRecording'));
                        aiText += `Stopping lecture recording... `;
                        logAction('stopLectureRecording', `Stopped lecture recording`);
                    } else if (call.name === 'analyzeStudyPredictor') {
                        if (isPro) {
                            const prediction = await analyzeStudyPredictor(tasks, exams || []);
                            aiText += `Based on your study history and upcoming exams:\n\n**Today's Focus:** ${prediction.suggestion}\n\n**Weak Area Detected:** ${prediction.weakArea}\n\n**Priority Subjects:** ${prediction.prioritySubjects.join(', ')}`;
                            logAction('analyzeStudyPredictor', `Analyzed study history and predicted weak areas.`);
                        } else {
                            aiText += `The Study Predictor and Weak Area Detection is a Pro feature. Please upgrade to access this advanced analysis.`;
                        }
                    } else if (call.name === 'startFocusMode') {
                        const args = call.args as any;
                        const minutes = args.minutes || 25;
                        startFocusMode(minutes);
                        aiText += `Starting a ${minutes}-minute focus session. I will block notifications and reduce distractions. Let's get to work! `;
                        logAction('startFocusMode', `Started focus mode for ${minutes} minutes`);
                    } else if (call.name === 'stopFocusMode') {
                        stopFocusMode();
                        aiText += `Focus session stopped. Great job staying focused! `;
                        logAction('stopFocusMode', `Stopped focus mode`);
                    }
                }
            } else {
                aiText = parsedResponse.text || "I'm listening.";
            }

            const newAiMsg: AIMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: aiText,
                timestamp: new Date().toISOString(),
                groundingMetadata: groundingData,
                suggestedAnswers: suggestedAnswers,
                emotion: parsedResponse.emotion,
                animation: parsedResponse.animation,
                popup: parsedResponse.popup,
                priority: parsedResponse.priority
            };

            setMessages(prev => [...prev, newAiMsg]);
            setIsThinking(false);
            
            if (parsedResponse.popup) {
                setLatestGreeting(aiText);
            }
            
            if (user?.aiSettings?.voiceResponseEnabled !== false) {
                speak(aiText);
            }

        } catch (error) {
            setIsThinking(false);
            console.error("AI Connection Failed:", error);
            const errorMsg: AIMessage = {
                id: (Date.now() + 1).toString(),
                role: 'system',
                content: "Sorry, I'm having trouble connecting to my brain right now. Please check your network or API Key.",
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    // Voice Handling
    const startListening = () => {
        cancelSpeech(); // Stop AI speech when user starts listening
        
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Voice input not supported in this browser.");
            return;
        }
        
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognition.current = new SpeechRecognition();
        recognition.current.continuous = false;
        recognition.current.interimResults = false;
        recognition.current.lang = 'en-US';

        recognition.current.onstart = () => setIsListening(true);
        recognition.current.onspeechstart = () => cancelSpeech(); // Stop AI speech immediately when user starts speaking
        recognition.current.onend = () => {
            setIsListening(false);
        };
        recognition.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            sendMessage(transcript);
        };

        recognition.current.start();
    };

    const stopListening = () => {
        if (recognition.current) recognition.current.stop();
    };

    const clearHistory = () => {
        stopSpeaking();
        setMessages([]);
        localStorage.removeItem('tt_ai_history');
    };

    const deleteMessage = (id: string) => {
        setMessages(prev => {
            const newMessages = prev.filter(msg => msg.id !== id);
            localStorage.setItem('tt_ai_history', JSON.stringify(newMessages));
            return newMessages;
        });
    };

    return (
        <AIContext.Provider value={{
            messages, sendMessage, isTyping,
            isListening, startListening, stopListening,
            clearHistory, deleteMessage, latestGreeting, dismissGreeting: () => setLatestGreeting(null),
            speak, stopSpeaking, pauseSpeech, resumeSpeech, cancelSpeech, isSpeaking, backgroundJobs, aiActionsLog,
            isFocusModeActive, focusModeMinutes, startFocusMode, stopFocusMode, isThinking
        }}>
            {children}
        </AIContext.Provider>
    );
};

export const useAI = () => {
    const context = useContext(AIContext);
    if (!context) throw new Error('useAI must be used within an AIProvider');
    return context;
};
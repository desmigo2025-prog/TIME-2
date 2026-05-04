import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { Task, TaskPriority, TaskStatus, ValidationStatus } from '../types';
import { Save, AlertTriangle, Trash2, Plus, ArrowLeft, Check, GripVertical, Cloud, Loader, FileText, Sparkles, AlertOctagon, XCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ReviewTimetable = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { draftTasks, saveDraft, finalizeDraft, discardDraft, syncStatus } = useTasks();
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
    
    // Local state for immediate UI updates
    const [tasks, setTasks] = useState<Task[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    // UI State for Force Upload
    const [showIssueSummary, setShowIssueSummary] = useState(false);

    // Week selection state
    const [selectedWeek, setSelectedWeek] = useState<string>('Default Week');

    // Extract unique weeks
    const uniqueWeeks = useMemo(() => {
        const weeks = new Set(tasks.map(t => t.weekIdentifier || t.date || 'Default Week'));
        return Array.from(weeks).sort();
    }, [tasks]);

    const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (uniqueWeeks.length > 0 && !uniqueWeeks.includes(selectedWeek)) {
            setSelectedWeek(uniqueWeeks[0]);
        }
    }, [uniqueWeeks, selectedWeek]);

    // Resolve dates based on start date
    const resolveDates = useCallback((tasksToResolve: Task[]) => {
        if (uniqueWeeks.length <= 1 && uniqueWeeks[0] === 'Default Week') return tasksToResolve;

        const start = new Date(startDate);
        const dayMap: Record<string, number> = {
            'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0
        };

        return tasksToResolve.map(t => {
            if (t.date) return t; // Already has exact date
            if (!t.weekIdentifier) return t; // No week info

            // Simple heuristic: Week 1, Week 2, etc.
            const weekMatch = t.weekIdentifier.match(/\d+/);
            const weekNum = weekMatch ? parseInt(weekMatch[0], 10) : 1;
            
            const taskDate = new Date(start);
            // Add weeks
            taskDate.setDate(taskDate.getDate() + (weekNum - 1) * 7);
            
            // Adjust to correct day of week
            const currentDay = taskDate.getDay();
            const targetDay = dayMap[t.day] ?? 1;
            const diff = targetDay - currentDay;
            taskDate.setDate(taskDate.getDate() + diff);

            return { ...t, date: taskDate.toISOString().split('T')[0] };
        });
    }, [startDate, uniqueWeeks]);

    // Initialize: Prefer Draft from Context, else New Upload from Location
    useEffect(() => {
        window.scrollTo(0, 0); // Auto-scroll to top to ensure user sees Save Draft immediately
        
        const enforceDayDateConsistency = (taskList: any[]) => {
            return taskList.map(t => {
                let computedDay = t.day || 'Monday';
                if (t.date) {
                    const dateObj = new Date(t.date);
                    if (!isNaN(dateObj.getTime())) {
                        computedDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
                    }
                }
                return { ...t, day: computedDay };
            });
        };

        if (draftTasks && draftTasks.length > 0) {
            const consistentDrafts = enforceDayDateConsistency(draftTasks);
            setTasks(consistentDrafts);
            validateTasks(consistentDrafts);
        } else if (location.state?.scannedTasks) {
            const rawInitial = location.state.scannedTasks.map((t: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                title: t.title || 'Untitled',
                description: t.description || '',
                day: t.day || 'Monday',
                time: t.time || '09:00',
                durationMinutes: t.durationMinutes || 60,
                venue: t.venue || 'TBD',
                priority: TaskPriority.MEDIUM,
                status: TaskStatus.PENDING,
                category: t.category || 'Personal',
                confidenceScore: t.confidenceScore || 0.5,
                parsingMetaData: t.parsingMetaData || { 
                    confidence: { title: 1, day: 1, time: 1, venue: 1 }, 
                    correctionsApplied: [], 
                    isLowConfidence: false 
                },
                isOverlap: false,
                validationStatus: t.validationStatus || 'validated',
                weekIdentifier: t.weekIdentifier,
                date: t.date
            }));
            const consistentInitial = enforceDayDateConsistency(rawInitial);
            setTasks(consistentInitial);
            validateTasks(consistentInitial);
            saveDraft(consistentInitial);
        } else {
            navigate('/');
        }
    }, []); 

    // Auto-Save Effect
    useEffect(() => {
        const autoSaveTimer = setInterval(() => {
            if (hasUnsavedChanges && tasks.length > 0) {
                saveDraft(resolveDates(tasks));
                setHasUnsavedChanges(false);
            }
        }, 10000); 

        return () => clearInterval(autoSaveTimer);
    }, [tasks, hasUnsavedChanges, saveDraft, resolveDates]);

    // Validation Logic
    const validateTasks = useCallback((currentTasks: Task[]) => {
        const newWarnings: string[] = [];
        const taskMap = new Map<string, Task[]>();

        currentTasks.forEach(t => {
            const weekKey = t.weekIdentifier || t.date || 'Default Week';
            const key = `${weekKey}-${t.day}`;
            const dayTasks = taskMap.get(key) || [];
            dayTasks.push(t);
            taskMap.set(key, dayTasks);
        });

        // Reset overlap flags but keep validationStatus unless fixed
        const validatedTasks = currentTasks.map(t => ({ ...t, isOverlap: false }));

        taskMap.forEach((dayTasks, key) => {
            dayTasks.sort((a, b) => a.time.localeCompare(b.time));
            for (let i = 0; i < dayTasks.length - 1; i++) {
                const t1 = dayTasks[i];
                const t2 = dayTasks[i+1];
                
                const [h1, m1] = t1.time.split(':').map(Number);
                const t1StartMins = h1 * 60 + m1;
                const t1EndMins = t1StartMins + t1.durationMinutes;
                
                const [h2, m2] = t2.time.split(':').map(Number);
                const t2StartMins = h2 * 60 + m2;

                if (t2StartMins < t1EndMins) {
                    newWarnings.push(`Overlap on ${key}: "${t1.title}" & "${t2.title}". Consider adjusting the time or duration.`);
                    const idx1 = validatedTasks.findIndex(vt => vt.id === t1.id);
                    const idx2 = validatedTasks.findIndex(vt => vt.id === t2.id);
                    if (idx1 > -1) validatedTasks[idx1].isOverlap = true;
                    if (idx2 > -1) validatedTasks[idx2].isOverlap = true;
                }
            }
        });

        setWarnings(newWarnings);
        return validatedTasks;
    }, []);

    // Analytics for the Report Card
    const scanReport = useMemo(() => {
        let lowConfidenceFields = 0;
        let autoCorrections = 0;
        let totalConfidence = 0;

        tasks.forEach(t => {
            const meta = t.parsingMetaData;
            if (meta) {
                if (meta.confidence.title < 0.7) lowConfidenceFields++;
                if (meta.confidence.time < 0.7) lowConfidenceFields++;
                if (meta.confidence.venue < 0.7) lowConfidenceFields++;
                autoCorrections += meta.correctionsApplied.length;
                totalConfidence += (t.confidenceScore || 0);
            }
        });
        
        const avgConfidence = tasks.length > 0 ? Math.round((totalConfidence / tasks.length) * 100) : 100;

        return { lowConfidenceFields, autoCorrections, avgConfidence };
    }, [tasks]);

    // Task Operations
    const handleUpdateTask = (id: string, field: keyof Task, value: any) => {
        // If user manually edits, mark as validated
        const updatedTasks = tasks.map(t => t.id === id ? { ...t, [field]: value, validationStatus: 'validated' as ValidationStatus } : t);
        const validated = validateTasks(updatedTasks);
        setTasks(validated);
        setHasUnsavedChanges(true);
    };

    const handleDeleteTask = (id: string) => {
        const updatedTasks = tasks.filter(t => t.id !== id);
        const validated = validateTasks(updatedTasks);
        setTasks(validated);
        setHasUnsavedChanges(true);
    };

    const handleAddTask = (day: string) => {
        const isDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedWeek);
        const newTask: Task = {
            id: Math.random().toString(36).substr(2, 9),
            title: 'New Activity',
            description: '',
            day: day,
            time: '09:00',
            durationMinutes: 60,
            venue: 'Venue',
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.PENDING,
            category: 'Personal',
            confidenceScore: 1.0,
            parsingMetaData: { confidence: { title: 1, day: 1, time: 1, venue: 1 }, correctionsApplied: [], isLowConfidence: false },
            isOverlap: false,
            validationStatus: 'validated',
            ...(isDate ? { date: selectedWeek } : { weekIdentifier: selectedWeek === 'Default Week' ? undefined : selectedWeek })
        };
        const updated = [...tasks, newTask];
        const validated = validateTasks(updated);
        setTasks(validated);
        setHasUnsavedChanges(true);
    };

    // Save Actions
    const handleSaveDraft = () => {
        saveDraft(resolveDates(tasks));
        setHasUnsavedChanges(false);
    };

    const attemptFinalize = () => {
        const hasIssues = warnings.length > 0 || tasks.some(t => t.validationStatus === 'needs_review');
        if (hasIssues) {
            setShowIssueSummary(true);
        } else {
            saveDraft(resolveDates(tasks)); 
            finalizeDraft();
            navigate('/');
        }
    };

    const forceUpload = () => {
        // Mark all 'needs_review' or overlapping tasks as 'user_override'
        const overriddenTasks = tasks.map(t => {
            if (t.validationStatus === 'needs_review' || t.isOverlap) {
                return { ...t, validationStatus: 'user_override' as ValidationStatus };
            }
            return t;
        });
        
        saveDraft(resolveDates(overriddenTasks));
        // We call finalize immediately with the override status
        // Note: The context finalizeDraft uses the saved draft from localStorage, 
        // so ensuring we saved above is crucial.
        setTimeout(() => {
             finalizeDraft();
             navigate('/');
        }, 100);
    };

    const handleCancel = () => {
        if (window.confirm("Discard all changes? This cannot be undone.")) {
            discardDraft();
            navigate('/');
        }
    };

    // Drag and Drop
    const onDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
    };
    const onDragOver = (e: React.DragEvent) => e.preventDefault();
    const onDrop = (e: React.DragEvent, targetDay: string) => {
        e.preventDefault();
        if (draggedTask && draggedTask.day !== targetDay) {
            handleUpdateTask(draggedTask.id, 'day', targetDay);
        }
        setDraggedTask(null);
    };

    return (
        <div className={`h-[100dvh] w-full flex flex-col overflow-hidden relative ${isCustomTheme ? 'bg-transparent' : isLightTheme ? 'bg-gray-50' : 'bg-tt-dark'} ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>
            
            {/* ISSUE SUMMARY MODAL */}
            {showIssueSummary && (
                <div className={`absolute inset-0 z-50 flex items-center justify-center p-4 ${isLightTheme ? 'bg-white/80 backdrop-blur-sm' : 'bg-black/80 backdrop-blur-sm'}`}>
                    <div className={`border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'}`}>
                        <div className="flex items-center gap-3 mb-6 text-yellow-500">
                            <AlertTriangle size={32} />
                            <h2 className="text-2xl font-bold">Issues Detected</h2>
                        </div>
                        
                        <div className="space-y-4 mb-8">
                            {scanReport.lowConfidenceFields > 0 && (
                                <div className={`flex justify-between items-center p-3 rounded-lg ${isLightTheme ? 'bg-gray-100' : 'bg-gray-800'}`}>
                                    <span className={isLightTheme ? 'text-gray-600' : 'text-gray-300'}>Uncertain Fields</span>
                                    <span className={`font-bold ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{scanReport.lowConfidenceFields}</span>
                                </div>
                            )}
                            {warnings.length > 0 && (
                                <div className={`flex justify-between items-center p-3 rounded-lg ${isLightTheme ? 'bg-gray-100' : 'bg-gray-800'}`}>
                                    <span className={isLightTheme ? 'text-gray-600' : 'text-gray-300'}>Scheduling Overlaps</span>
                                    <span className="font-bold text-red-400">{warnings.length}</span>
                                </div>
                            )}
                            <div className={`flex justify-between items-center p-3 rounded-lg ${isLightTheme ? 'bg-gray-100' : 'bg-gray-800'}`}>
                                <span className={isLightTheme ? 'text-gray-600' : 'text-gray-300'}>Overall Confidence</span>
                                <span className={`font-bold ${scanReport.avgConfidence > 80 ? 'text-tt-green' : 'text-yellow-500'}`}>{scanReport.avgConfidence}%</span>
                            </div>
                            
                            <p className={`text-sm mt-2 ${isLightTheme ? 'text-gray-600' : 'opacity-70'}`}>
                                We recommend reviewing the highlighted items before uploading. 
                                However, you can choose to upload now and correct them later.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => setShowIssueSummary(false)}
                                className={`py-3 rounded-xl font-medium transition-colors ${isLightTheme ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}
                            >
                                Fix Issues
                            </button>
                            <button 
                                onClick={forceUpload}
                                className="py-3 bg-tt-blue hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95"
                            >
                                Upload Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className={`sticky top-0 flex items-center justify-between p-4 border-b z-20 backdrop-blur-md ${isLightTheme ? 'border-gray-200 bg-white/90' : 'border-gray-700 bg-gray-900/90'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={handleCancel} className={`p-2 rounded-full ${isLightTheme ? 'hover:bg-gray-200' : 'hover:bg-gray-800'}`}>
                        <ArrowLeft />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold">Review Timetable</h1>
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${isLightTheme ? 'bg-gray-200 text-gray-800' : 'bg-gray-800 text-white opacity-70'}`}>
                                {syncStatus === 'saving' ? <Loader size={10} className="animate-spin" /> : <Cloud size={10} />}
                                <span>{syncStatus === 'saving' ? 'Saving...' : hasUnsavedChanges ? 'Unsaved' : 'Saved'}</span>
                            </div>
                        </div>
                        <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'opacity-70'}`}>AI Intelligence Mode • {tasks.length} tasks generated</p>
                    </div>
                </div>
                
                <div className="hidden md:flex items-center gap-3">
                    {uniqueWeeks.length > 1 && (
                        <div className="flex items-center gap-2 mr-4">
                            <span className={`text-xs ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>Start Date:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className={`text-sm px-2 py-1 rounded border focus:outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white text-gray-900 border-gray-300' : 'bg-gray-800 text-white border-gray-700'}`}
                            />
                        </div>
                    )}
                    <button 
                        onClick={handleSaveDraft}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isLightTheme ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
                    >
                        Save Draft
                    </button>
                    
                    <button 
                        onClick={attemptFinalize}
                        className="flex items-center gap-2 bg-gradient-to-r from-tt-blue to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                    >
                        <Check size={18} />
                        Finalize
                    </button>
                </div>
            </div>

            {/* AI Scan Report Dashboard */}
            <div className={`border-b p-4 ${isLightTheme ? 'bg-gray-50 border-gray-200' : 'bg-gray-900/50 border-gray-700'}`}>
                <div className="flex flex-wrap gap-4 justify-between items-center max-w-6xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-tt-blue/10 rounded-lg text-tt-blue"><Sparkles size={20} /></div>
                        <div>
                            <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'opacity-70'}`}>Scan Accuracy</p>
                            <p className={`font-bold ${scanReport.avgConfidence > 80 ? 'text-tt-green' : 'text-yellow-500'}`}>{scanReport.avgConfidence}%</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-tt-green/10 rounded-lg text-tt-green"><Check size={20} /></div>
                        <div>
                            <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'opacity-70'}`}>Auto-Corrected</p>
                            <p className={`font-bold ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{scanReport.autoCorrections} items</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><AlertOctagon size={20} /></div>
                        <div>
                            <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'opacity-70'}`}>Issues to Review</p>
                            <p className={`font-bold ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>
                                {scanReport.lowConfidenceFields + warnings.length}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning Banner Mobile */}
            {warnings.length > 0 && (
                <div className="bg-yellow-500/20 text-yellow-500 px-4 py-2 text-xs flex items-center justify-center gap-2">
                     <AlertTriangle size={12} /> {warnings.length} scheduling conflicts detected.
                </div>
            )}

            {/* Week Tabs */}
            {uniqueWeeks.length > 1 && (
                <div className={`px-4 py-2 border-b overflow-x-auto custom-scrollbar ${isLightTheme ? 'bg-gray-50 border-gray-200' : 'bg-gray-900/50 border-gray-700'}`}>
                    <div className="flex gap-2">
                        {uniqueWeeks.map(week => (
                            <button
                                key={week}
                                onClick={() => setSelectedWeek(week)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                    selectedWeek === week 
                                        ? 'bg-tt-blue text-white' 
                                        : isLightTheme ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                            >
                                {week}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Kanban Board Area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 w-full min-w-0 scroll-smooth snap-x snap-mandatory">
                <div className="flex gap-4 h-full min-w-max pb-20 md:pb-0">
                    {DAYS.map(day => {
                        const dayTasks = tasks.filter(t => {
                            const tWeek = t.weekIdentifier || t.date || 'Default Week';
                            return t.day === day && tWeek === selectedWeek;
                        }).sort((a,b) => a.time.localeCompare(b.time));

                        return (
                        <div 
                            key={day}
                            onDragOver={onDragOver}
                            onDrop={(e) => onDrop(e, day)}
                            className={`w-[85vw] sm:w-80 flex flex-col rounded-2xl border backdrop-blur-sm shrink-0 snap-center ${isLightTheme ? 'bg-white/50 border-gray-200/50' : 'bg-gray-800/30 border-gray-700/50'}`}
                        >
                            <div className={`p-4 border-b flex justify-between items-center rounded-t-2xl sticky top-0 z-10 ${isLightTheme ? 'border-gray-200/50 bg-white/80' : 'border-gray-700/50 bg-gray-800/50'}`}>
                                <h3 className="font-bold text-tt-blue">{day}</h3>
                                <button onClick={() => handleAddTask(day)} className={`p-1 rounded opacity-60 hover:opacity-100 ${isLightTheme ? 'hover:bg-gray-200' : 'hover:bg-gray-700'}`}>
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                {dayTasks.map(task => {
                                    const meta = task.parsingMetaData;
                                    const lowConfTitle = (meta?.confidence.title || 1) < 0.7;
                                    const lowConfTime = (meta?.confidence.time || 1) < 0.7;
                                    const lowConfVenue = (meta?.confidence.venue || 1) < 0.7;
                                    const needsReview = task.validationStatus === 'needs_review';
                                    
                                    return (
                                    <div 
                                        key={task.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, task)}
                                        className={`relative group p-3 rounded-xl border transition-all hover:shadow-lg cursor-grab active:cursor-grabbing
                                            ${task.isOverlap ? (isLightTheme ? 'border-red-400 bg-red-50' : 'border-red-500/80 bg-red-500/10') : 
                                              needsReview ? (isLightTheme ? 'border-yellow-400 bg-yellow-50' : 'border-yellow-500 bg-yellow-500/5') :
                                              (isLightTheme ? 'bg-white border-gray-200 hover:border-tt-blue/50' : 'bg-gray-800 border-gray-700 hover:border-tt-blue/50')}
                                        `}
                                    >
                                        <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <GripVertical size={14} />
                                        </div>

                                        <div className="pl-3 space-y-2">
                                            {/* Title */}
                                            <div className="flex items-start gap-2">
                                                <input 
                                                    value={task.title}
                                                    onChange={(e) => handleUpdateTask(task.id, 'title', e.target.value)}
                                                    className={`bg-transparent font-bold w-full focus:outline-none rounded px-1 ${isLightTheme ? 'text-gray-900 focus:bg-gray-100' : 'text-white focus:bg-gray-900/50'} ${lowConfTitle ? 'border-b border-red-500 text-red-500' : ''}`}
                                                    spellCheck={true}
                                                />
                                                <button onClick={() => handleDeleteTask(task.id)} className="opacity-50 hover:text-red-400 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Time & Duration */}
                                            <div className="flex gap-2">
                                                <input 
                                                    type="time"
                                                    value={task.time}
                                                    onChange={(e) => handleUpdateTask(task.id, 'time', e.target.value)}
                                                    className={`text-xs text-tt-green rounded px-1 py-0.5 focus:outline-none w-20 ${isLightTheme ? 'bg-gray-100' : 'bg-gray-900/50'} ${lowConfTime ? 'border border-red-500' : ''}`}
                                                />
                                                <div className={`flex items-center rounded px-1 ${isLightTheme ? 'bg-gray-100' : 'bg-gray-900/50'}`}>
                                                    <input 
                                                        type="number"
                                                        value={task.durationMinutes}
                                                        onChange={(e) => handleUpdateTask(task.id, 'durationMinutes', parseInt(e.target.value))}
                                                        className={`bg-transparent text-xs w-8 focus:outline-none text-right ${isLightTheme ? 'text-gray-600' : 'text-gray-300'}`}
                                                    />
                                                    <span className="text-[10px] opacity-50 ml-1">min</span>
                                                </div>
                                            </div>

                                            {/* Venue */}
                                            <div className="flex items-center gap-1">
                                                <MapPin size={12} className="opacity-50" />
                                                <input 
                                                    value={task.venue}
                                                    onChange={(e) => handleUpdateTask(task.id, 'venue', e.target.value)}
                                                    className={`bg-transparent text-xs opacity-70 w-full focus:outline-none rounded px-1 ${isLightTheme ? 'focus:bg-gray-100 text-gray-700' : 'focus:bg-gray-900/50 text-white'} ${lowConfVenue ? 'text-red-500' : ''}`}
                                                    placeholder="Venue..."
                                                />
                                            </div>
                                            
                                            {/* Status Badges */}
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {task.isOverlap && <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded">Overlap</span>}
                                                {needsReview && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded flex items-center gap-1"><AlertTriangle size={8} /> Review</span>}
                                                {(meta?.correctionsApplied?.length ?? 0) > 0 && (
                                                    <span className="text-[10px] bg-tt-blue/20 text-tt-blue px-1 rounded flex items-center gap-0.5" title={meta?.correctionsApplied.join(', ')}>
                                                        <Sparkles size={8} /> Auto-Fixed
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )})}
                                {dayTasks.length === 0 && (
                                    <div className={`text-center py-8 opacity-50 border-2 border-dashed rounded-xl ${isLightTheme ? 'border-gray-300' : 'border-gray-700/50'}`}>
                                        <p className="text-xs">No tasks</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            {/* Mobile Sticky Footer */}
            <div className={`md:hidden fixed bottom-0 left-0 right-0 p-4 border-t z-50 backdrop-blur-md flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] ${isLightTheme ? 'bg-white/95 border-gray-200' : 'bg-gray-900/95 border-gray-700'}`}>
                <button 
                    onClick={handleSaveDraft}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${isLightTheme ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                >
                    Save Draft
                </button>
                <button 
                    onClick={attemptFinalize}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-tt-blue to-blue-600 hover:from-blue-500 hover:to-blue-600 text-white py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                >
                    <Check size={18} />
                    Finalize
                </button>
            </div>
        </div>
    );
};

// Re-import icons to ensure scope safety
import { X, MapPin } from 'lucide-react';

export default ReviewTimetable;
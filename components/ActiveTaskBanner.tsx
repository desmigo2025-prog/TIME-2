import React, { useMemo } from 'react';
import { useActiveTask } from '../contexts/ActiveTaskContext';
import { useTasks } from '../contexts/TaskContext';
import { Play, Pause, Square, Clock, ChevronRight } from 'lucide-react';

const ActiveTaskBanner = () => {
    const { activeTaskId, timeLeft, isActive, pauseTask, resumeTask, endTaskEarly } = useActiveTask();
    const { tasks } = useTasks();

    const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [tasks, activeTaskId]);

    if (!activeTaskId || !activeTask) {
        return null;
    }

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const progressPercent = Math.max(0, Math.min(100, 100 - (timeLeft / (activeTask.durationMinutes * 60)) * 100));

    return (
        <div className="relative overflow-hidden mb-6 rounded-2xl bg-gradient-to-r from-tt-blue to-purple-600 text-white shadow-[0_0_40px_rgba(30,144,255,0.4)] border border-white/20 animate-in slide-in-from-top-4">
            {/* Glowing background effects */}
            <div className="absolute inset-0 bg-white/5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-30"></div>
            <div className={`absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-[60px] translate-x-1/3 -translate-y-1/2 ${isActive ? 'animate-pulse' : ''}`}></div>

            <div className="relative z-10 p-5 flex flex-col sm:flex-row items-center gap-6">
                
                {/* Left: Info */}
                <div className="flex-1 text-center sm:text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-black uppercase tracking-widest mb-3 backdrop-blur-md">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
                        {isActive ? 'In Progress' : 'Paused'}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight drop-shadow-sm truncate w-full max-w-sm sm:max-w-md">{activeTask.title}</h2>
                    <p className="text-sm opacity-80 mt-1">{activeTask.venue || 'No venue set'}</p>
                </div>

                {/* Center: Timer */}
                <div className="flex flex-col items-center">
                    <div className="text-5xl font-black font-mono tabular-nums tracking-tighter drop-shadow-lg">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    <div className="text-xs font-bold uppercase tracking-widest opacity-80 mt-1">Remaining</div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-3">
                    {isActive ? (
                        <button onClick={pauseTask} className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-colors shadow-inner" title="Pause">
                            <Pause size={24} className="fill-white text-white" />
                        </button>
                    ) : (
                        <button onClick={resumeTask} className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center transition-colors shadow-inner" title="Resume">
                            <Play size={24} className="fill-white text-white ml-1" />
                        </button>
                    )}
                    <button onClick={endTaskEarly} className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 transition-colors shadow-md text-sm font-black flex items-center gap-2" title="End Task Early">
                        <Square size={16} className="fill-white" />
                        End
                    </button>
                </div>
            </div>

            {/* Progress Bar (bottom border essentially) */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                <div className="h-full bg-white transition-all duration-1000 ease-linear" style={{ width: `${progressPercent}%` }}></div>
            </div>
        </div>
    );
};

export default ActiveTaskBanner;

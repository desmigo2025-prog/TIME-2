import React from 'react';
import { Task, TaskStatus } from '../types';
import { format, startOfWeek, addDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, MapPin, Clock, Calendar, Repeat } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeeklyTimetable({ tasks }: { tasks: Task[] }) {
    const { user } = useAuth();
    const theme = user?.aiSettings?.theme || 'dark';
    
    const isCustomLight = () => {
        if (theme !== 'custom' || !user?.aiSettings?.customThemeColor) return false;
        const hex = user.aiSettings.customThemeColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 2), 16);
        const b = parseInt(hex.substring(4, 2), 16);
        const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return brightness > 155;
    };
    
    const isLightTheme = theme === 'nature' || theme === 'ocean' || theme === 'sunset' || theme === 'ladies' || theme === 'white' || isCustomLight();
    
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday

    return (
        <div className={`rounded-[2rem] p-6 shadow-sm border overflow-hidden ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/80 backdrop-blur-md border-gray-700'}`}>
            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Calendar size={16} className="text-[#1E90FF]" />
                </div>
                Weekly Timetable
            </h3>
            
            <div className="overflow-x-auto pb-2">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                        <tr className={`uppercase text-xs tracking-wider border-b ${isLightTheme ? 'border-gray-200 text-gray-500' : 'border-gray-700 text-gray-400'}`}>
                            <th className="pb-4 pr-4 font-black">Day</th>
                            <th className="pb-4 px-4 font-black">Time</th>
                            <th className="pb-4 px-4 font-black">Task / Course</th>
                            <th className="pb-4 pl-4 font-black text-right">Venue</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {DAYS.map((dayName, dIndex) => {
                            const date = addDays(currentWeekStart, dIndex);
                            const dayTasks = tasks.filter(t => {
                                if (t.date) return t.date === format(date, 'yyyy-MM-dd');
                                return t.day === dayName;
                            }).sort((a, b) => a.time.localeCompare(b.time));

                            if (dayTasks.length === 0) {
                                return (
                                    <tr key={dayName} className={`border-b border-dashed ${isLightTheme ? 'border-gray-100' : 'border-gray-800'}`}>
                                        <td className="py-4 pr-4 font-bold uppercase tracking-wider text-xs opacity-50">{dayName}</td>
                                        <td colSpan={3} className="py-4 px-4 text-center opacity-40 italic">No tasks</td>
                                    </tr>
                                );
                            }

                            return dayTasks.map((t, index) => (
                                <tr key={t.id} className={`border-b ${isLightTheme ? 'border-gray-100/50 hover:bg-gray-50' : 'border-gray-800/50 hover:bg-white/5'} transition-colors group`}>
                                    <td className="py-3 pr-4 align-top w-24">
                                        {index === 0 && (
                                            <div className="flex flex-col pt-1">
                                                <span className="font-bold uppercase tracking-wider text-xs">{dayName}</span>
                                                <span className="opacity-50 text-[10px]">{format(date, 'MMM d')}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap align-top w-32">
                                        <div className="flex items-center gap-1.5 font-mono text-xs opacity-80 bg-black/5 dark:bg-white/5 w-fit px-2 py-1 rounded-md mt-0.5">
                                            <Clock size={12} />
                                            {t.time}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                        <div className="flex items-center gap-2">
                                            {t.status === TaskStatus.COMPLETED && <div className="shrink-0"><CheckCircle size={14} className="text-[#2ECC71]" /></div>}
                                            <span className={`font-bold text-base ${t.status === TaskStatus.COMPLETED ? 'line-through opacity-50' : ''}`}>{t.title}</span>
                                            {(t.recurrence || t.parentTaskId) && (
                                                <div title="Recurring Task">
                                                    <Repeat size={12} className="text-purple-500 opacity-80" />
                                                </div>
                                            )}
                                        </div>
                                        {t.description && <div className="text-xs opacity-60 truncate max-w-[280px] mt-0.5">{t.description}</div>}
                                    </td>
                                    <td className="py-3 pl-4 text-right align-top w-40">
                                        {t.venue && (
                                            <div className="flex items-center justify-end gap-1.5 text-xs opacity-80 font-medium bg-black/5 dark:bg-white/5 w-fit ml-auto px-2 py-1 rounded-md mt-0.5">
                                                <MapPin size={12} className="shrink-0 text-red-500" />
                                                <span className="truncate max-w-[120px]">{t.venue}</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

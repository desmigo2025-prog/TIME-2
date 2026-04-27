import React from 'react';
import { useAnnouncements } from '../contexts/AnnouncementContext';
import { useAuth } from '../contexts/AuthContext';
import { AnnouncementType } from '../types';
import { Bell, Check, Trash2, Megaphone, AlertCircle, Info, Star, RefreshCw, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

const Notifications = () => {
    const { announcements, markAllAsRead, deleteAnnouncement, markAsRead, refreshAnnouncements, isLoading, error } = useAnnouncements();
    const { user } = useAuth();
    const navigate = useNavigate();

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

    const getIcon = (type: AnnouncementType) => {
        switch (type) {
            case AnnouncementType.CRITICAL: return <AlertCircle className="text-red-500" />;
            case AnnouncementType.ANNOUNCEMENT: return <Megaphone className="text-tt-blue" />;
            case AnnouncementType.ATTENTION: return <Star className="text-yellow-500" />;
            case AnnouncementType.INFO: return <Info className="text-tt-green" />;
            default: return <Bell className="text-gray-400" />;
        }
    };

    const getTypeStyles = (type: AnnouncementType) => {
        switch (type) {
            case AnnouncementType.CRITICAL: return `bg-red-500/10 border-red-500/50 ${isLightTheme ? 'text-gray-900' : 'text-white'}`;
            case AnnouncementType.ANNOUNCEMENT: return `bg-blue-500/10 border-blue-500/50 ${isLightTheme ? 'text-gray-900' : 'text-white'}`;
            case AnnouncementType.ATTENTION: return `bg-yellow-500/10 border-yellow-500/50 ${isLightTheme ? 'text-gray-900' : 'text-white'}`;
            default: return `${isLightTheme ? 'bg-white/60 border-gray-300 text-gray-900' : 'bg-gray-800/50 border-gray-700 text-white'}`;
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className={`md:hidden p-2 rounded-full ${isLightTheme ? 'hover:bg-gray-200 text-gray-800' : 'hover:bg-gray-800 text-white'}`}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className={`text-2xl font-bold ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>Message Center</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={refreshAnnouncements}
                        disabled={isLoading}
                        className={`transition-colors p-2 rounded-full ${isLightTheme ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    {announcements.length > 0 && (
                        <button 
                            onClick={markAllAsRead}
                            className="text-xs text-tt-blue hover:opacity-80 transition-opacity"
                        >
                            Mark all as read
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                </div>
            )}

            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <div className={`text-center py-20 ${isLightTheme ? 'text-gray-500' : 'text-gray-500'}`}>
                        <Bell size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No new messages</p>
                    </div>
                ) : (
                    announcements.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(item => (
                        <div 
                            key={item.id}
                            onClick={() => markAsRead(item.id)}
                            className={`relative p-4 rounded-xl border transition-all cursor-pointer ${getTypeStyles(item.type)} ${!item.isRead ? 'shadow-lg' : 'opacity-80'}`}
                        >
                            {!item.isRead && (
                                <span className="absolute top-4 right-4 w-2 h-2 bg-tt-blue rounded-full"></span>
                            )}
                            
                            <div className="flex gap-4">
                                <div className="mt-1 shrink-0">
                                    {getIcon(item.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1 pr-4">
                                        <h3 className={`font-bold ${!item.isRead ? 'text-current' : 'text-gray-500'}`}>
                                            {item.title}
                                        </h3>
                                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className={`text-sm mb-2 leading-relaxed ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                                        {item.message}
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                                            {item.source || 'Admin'} • {item.type}
                                        </span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); deleteAnnouncement(item.id); }}
                                            className="text-gray-600 hover:text-red-400 p-1"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Notifications;
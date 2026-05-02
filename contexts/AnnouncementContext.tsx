import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Announcement, AnnouncementType } from '../types';
import { AlertOctagon, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { extractAnnouncementsFromLink } from '../services/geminiService';

interface AnnouncementContextType {
  announcements: Announcement[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteAnnouncement: (id: string) => void;
  refreshAnnouncements: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

// Mock Feed Data (Fallback if no link or fetch fails)
const MOCK_FEED: Announcement[] = [
  {
    id: '1',
    title: 'Welcome to TT App',
    message: 'Please set your information source link in the Profile settings to receive real announcements.',
    type: AnnouncementType.INFO,
    timestamp: new Date().toISOString(),
    isRead: false,
    source: 'System'
  }
];

export const AnnouncementProvider = ({ children }: { children?: ReactNode }) => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAlert, setActiveAlert] = useState<Announcement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    if (!user?.announcementLink) {
      // If no link is set, we can either clear announcements or show a prompt
      const stored = localStorage.getItem('tt_announcements');
      if (stored) {
        setAnnouncements(JSON.parse(stored));
      } else {
        setAnnouncements(MOCK_FEED);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Use AI to extract and filter current, relevant announcements based on user preferences
      const newAnnouncements = await extractAnnouncementsFromLink(user.announcementLink, user.announcementPreferences);
      
      setAnnouncements(newAnnouncements);
      localStorage.setItem('tt_announcements', JSON.stringify(newAnnouncements));
      
      // Trigger Alert for unread CRITICAL messages
      const critical = newAnnouncements.find(a => a.type === AnnouncementType.CRITICAL && !a.isRead);
      if (critical) setActiveAlert(critical);
      
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Could not load announcements from the provided link. Please check the URL or try again later.');
      // Fallback to stored
      const stored = localStorage.getItem('tt_announcements');
      if (stored) {
        setAnnouncements(JSON.parse(stored));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize and Fetch Feed
  useEffect(() => {
    fetchAnnouncements();
  }, [user?.announcementLink]);

  useEffect(() => {
     if (announcements.length > 0) {
        localStorage.setItem('tt_announcements', JSON.stringify(announcements));
     }
  }, [announcements]);

  const refreshAnnouncements = async () => {
      await fetchAnnouncements();
  };

  const markAsRead = (id: string) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const markAllAsRead = () => {
    setAnnouncements(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const deleteAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const unreadCount = announcements.filter(a => !a.isRead).length;

  const dismissAlert = () => {
      if (activeAlert) {
          markAsRead(activeAlert.id);
          setActiveAlert(null);
      }
  };

  return (
    <AnnouncementContext.Provider value={{ announcements, unreadCount, markAsRead, markAllAsRead, deleteAnnouncement, refreshAnnouncements, isLoading, error }}>
      {children}
      
      {/* GLOBAL CRITICAL ALERT OVERLAY */}
      {activeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-6">
              <div className="bg-tt-dark border-2 border-red-500 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="bg-red-500/20 p-3 rounded-full animate-pulse">
                          <AlertOctagon size={32} className="text-red-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Very Important</h2>
                  </div>
                  
                  <h3 className="text-xl font-bold text-red-400 mb-2">{activeAlert.title}</h3>
                  <p className="text-gray-300 text-lg leading-relaxed mb-6">{activeAlert.message}</p>
                  
                  <div className="flex justify-between items-center border-t border-gray-700 pt-4">
                      <span className="text-xs text-gray-500">Source: {activeAlert.source}</span>
                      <button 
                        onClick={dismissAlert}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                      >
                          Acknowledge
                      </button>
                  </div>
              </div>
          </div>
      )}
    </AnnouncementContext.Provider>
  );
};

export const useAnnouncements = () => {
  const context = useContext(AnnouncementContext);
  if (!context) throw new Error('useAnnouncements must be used within an AnnouncementProvider');
  return context;
};
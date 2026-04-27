import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { User } from '../types';

interface UsageContextType {
  isPro: boolean;
  canUseAI: boolean;
  canUploadFile: boolean;
  canAddLink: boolean;
  incrementAIUsage: () => Promise<void>;
  incrementFileUpload: () => Promise<void>;
  incrementLinkUsage: () => Promise<void>;
  getUsageStats: () => {
    aiCount: number;
    fileCount: number;
    linkCount: number;
    aiLimit: number;
    fileLimit: number;
    linkLimit: number;
  };
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

const FREE_LIMITS = {
  AI_MESSAGES: 15,
  FILE_UPLOADS: 1,
  LINKS: 1,
};

export const UsageProvider = ({ children }: { children: ReactNode }) => {
  const { user, updateProfile } = useAuth();

  useEffect(() => {
    if (user) {
      checkAndResetUsage(user);
    }
  }, [user?.id]);

  const checkAndResetUsage = async (currentUser: User) => {
    const today = new Date().toISOString().split('T')[0];
    let updates: Partial<User> = {};
    
    if (currentUser.last_reset_date !== today) {
        updates = {
          ...updates,
          daily_message_count: 0,
          daily_file_upload_count: 0,
          daily_link_count: 0,
          last_reset_date: today,
        };
    }

    // Check if PRO subscription has expired (30 days)
    if (currentUser.pro_status && currentUser.subscription_active && currentUser.subscription_date) {
        const subDate = new Date(currentUser.subscription_date);
        const now = new Date();
        const diffTime = now.getTime() - subDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        if (diffDays >= 30) {
            updates = {
                ...updates,
                pro_status: false,
                subscription_active: false,
            };
        }
    }

    if (Object.keys(updates).length > 0) {
      await updateProfile(updates);
    }
  };

  const checkIsPro = () => {
    if (user?.pro_status === true && user?.subscription_active === true && user?.subscription_date) {
        const subDate = new Date(user.subscription_date);
        const now = new Date();
        const diffTime = now.getTime() - subDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays < 30;
    }
    return false;
  };

  const isPro = checkIsPro();

  const canUseAI = isPro || (user?.daily_message_count || 0) < FREE_LIMITS.AI_MESSAGES;
  const canUploadFile = isPro || (user?.daily_file_upload_count || 0) < FREE_LIMITS.FILE_UPLOADS;
  const canAddLink = isPro || (user?.daily_link_count || 0) < FREE_LIMITS.LINKS;

  const incrementAIUsage = async () => {
    if (!user) return;
    if (!isPro) {
      await updateProfile({
        daily_message_count: (user.daily_message_count || 0) + 1,
      });
    }
  };

  const incrementFileUpload = async () => {
    if (!user) return;
    if (!isPro) {
      await updateProfile({
        daily_file_upload_count: (user.daily_file_upload_count || 0) + 1,
      });
    }
  };

  const incrementLinkUsage = async () => {
    if (!user) return;
    if (!isPro) {
      await updateProfile({
        daily_link_count: (user.daily_link_count || 0) + 1,
      });
    }
  };

  const getUsageStats = () => {
    return {
      aiCount: user?.daily_message_count || 0,
      fileCount: user?.daily_file_upload_count || 0,
      linkCount: user?.daily_link_count || 0,
      aiLimit: FREE_LIMITS.AI_MESSAGES,
      fileLimit: FREE_LIMITS.FILE_UPLOADS,
      linkLimit: FREE_LIMITS.LINKS,
    };
  };

  return (
    <UsageContext.Provider
      value={{
        isPro,
        canUseAI,
        canUploadFile,
        canAddLink,
        incrementAIUsage,
        incrementFileUpload,
        incrementLinkUsage,
        getUsageStats,
      }}
    >
      {children}
    </UsageContext.Provider>
  );
};

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (!context) throw new Error('useUsage must be used within a UsageProvider');
  return context;
};

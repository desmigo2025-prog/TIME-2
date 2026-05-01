import { Task } from "../types";

export let isNotificationsBlocked = false;

export const setNotificationsBlocked = (blocked: boolean) => {
    isNotificationsBlocked = blocked;
};

export const requestNotificationPermission = async () => {
    if ('Notification' in window) {
        await Notification.requestPermission();
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
            } catch (e) {
                console.error('Service Worker registration failed:', e);
            }
        }
    }
};

export const sendPushNotification = async (task: Task) => {
    if (isNotificationsBlocked) return;
    if (Notification.permission === 'granted') {
        const bodyText = task.description 
            ? `${task.description}\nVenue: ${task.venue} • Duration: ${task.durationMinutes} mins`
            : `Venue: ${task.venue} • Duration: ${task.durationMinutes} mins`;
            
        const title = `[${task.priority.toUpperCase()}] Time for ${task.title}`;
        
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification(title, {
                body: bodyText,
                icon: '/icon.png',
                tag: task.id,
                data: window.location.href
            });
        } else {
            new Notification(title, {
                body: bodyText,
                icon: '/icon.png',
                tag: task.id
            });
        }
    }
};

export const sendSmartNotification = async (title: string, body: string, tag: string) => {
    if (isNotificationsBlocked) return;
    if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification(title, {
                body: body,
                icon: '/icon.png',
                tag: tag,
                data: window.location.href
            });
        } else {
            new Notification(title, {
                body: body,
                icon: '/icon.png',
                tag: tag
            });
        }
    }
};

export const playVoiceReminder = (userName: string, taskTitle: string, avatarType?: 'robot' | 'boy' | 'girl') => {
    if ('speechSynthesis' in window) {
        // Cancel any currently playing speech to avoid overlap
        window.speechSynthesis.cancel();

        const text = `Hello ${userName}, time is up for you to take on ${taskTitle}.`;
        
        let cleanText = text;
        cleanText = cleanText.replace(/https?:\/\/[^\s]+/g, "a link");
        cleanText = cleanText.replace(/www\.[^\s]+/g, "a link");
        cleanText = cleanText.replace(/```[\s\S]*?```/g, ". [A code snippet was provided]. ");
        cleanText = cleanText.replace(/`([^`]+)`/g, "$1");
        cleanText = cleanText.replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/~~/g, '')
            .replace(/\*(?!\s)([^*]*[^\s*])\*/g, '$1')
            .replace(/_(?!\s)([^_]*[^\s_])_/g, '$1')
            .replace(/(^|\n)#+\s*/g, '$1')
            .replace(/(^|\n)\s*[-•o*\d+]\.?\s+/g, '$1. ')
            .replace(/<[^>]*>/g, '');
        cleanText = cleanText.replace(/\$([\d,]+(?:\.\d+)?)/g, '$1 dollars ')
            .replace(/&/g, ' and ')
            .replace(/%/g, ' percent ')
            .replace(/\[|\]|\{|\}|\\/g, ' ')
            .replace(/"([^"]*)"/g, '$1')
            .replace(/-{2,}/g, ' ')
            .replace(/_{2,}/g, ' ');
        cleanText = cleanText.replace(/\t/g, ' ')
            .replace(/\n\n+/g, '... ')
            .replace(/\n/g, ', ');
        cleanText = cleanText.replace(/\s+/g, ' ')
            .replace(/\s+\./g, '.')
            .replace(/\s+,/g, ',')
            .replace(/([?!])\./g, '$1')
            .replace(/\.{2,}/g, '...')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        const voices = window.speechSynthesis.getVoices();
        let preferredVoice = voices[0];
        
        if (avatarType === 'boy') {
            preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('male') || v.name.includes('Google UK English Male'))) || voices[0];
        } else {
            preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('female') || v.name.includes('Google UK English Female') || v.name.includes('Google US English'))) || voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
        }

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
};

// Function to calculate time until next notification (for scheduling engines)
export const getTimeUntilTask = (taskTimeStr: string): number | null => {
    const now = new Date();
    const [hours, minutes] = taskTimeStr.split(':').map(Number);
    const taskTime = new Date(now);
    taskTime.setHours(hours, minutes, 0, 0);

    const diff = taskTime.getTime() - now.getTime();
    return diff > 0 ? diff : null;
};
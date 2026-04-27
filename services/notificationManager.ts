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

export const playVoiceReminder = (userName: string, taskTitle: string) => {
    if ('speechSynthesis' in window) {
        // Cancel any currently playing speech to avoid overlap
        window.speechSynthesis.cancel();

        const text = `Hello ${userName}, time is up for you to take on ${taskTitle}.`;
        let cleanText = text
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/~~/g, '')
            .replace(/\*(?!\s)([^*]*[^\s*])\*/g, '$1')
            .replace(/_(?!\s)([^_]*[^\s_])_/g, '$1')
            .replace(/(^|\n)#+\s*/g, '$1')
            .replace(/(^|\n)\s*[-•o*]\s+/g, '$1')
            .replace(/`/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n+/g, '. ')
            .replace(/\s+\./g, '.')
            .replace(/([?!])\./g, '$1')
            .replace(/\.{2,}/g, (match) => match.length === 2 ? '.' : match)
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Select a pleasant voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
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
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TaskStatus } from '../types';
import { useTasks } from './TaskContext';
import { useAuth } from './AuthContext';
import { sendSmartNotification } from '../services/notificationManager';
import confetti from 'canvas-confetti';

interface ActiveTaskContextType {
    activeTaskId: string | null;
    timeLeft: number; // seconds
    isActive: boolean; // false if paused
    startTask: (taskId: string, durationMinutes: number) => void;
    pauseTask: () => void;
    resumeTask: () => void;
    endTaskEarly: () => void;
    triggerVictory: () => void;
    showVictory: boolean;
    setShowVictory: (show: boolean) => void;
}

const ActiveTaskContext = createContext<ActiveTaskContextType | undefined>(undefined);

export const ActiveTaskProvider = ({ children }: { children?: ReactNode }) => {
    const { tasks, updateTask } = useTasks();
    const { user } = useAuth();
    
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isActive, setIsActive] = useState(false);
    const [showVictory, setShowVictory] = useState(false);

    // Save/Load state to localStorage
    useEffect(() => {
        if (!user) return;
        const saved = localStorage.getItem(`active_task_state_${user.id}`);
        if (saved) {
            const parsed = JSON.parse(saved);
            setActiveTaskId(parsed.activeTaskId);
            setTimeLeft(parsed.timeLeft);
            setIsActive(parsed.isActive);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        if (activeTaskId) {
            localStorage.setItem(`active_task_state_${user.id}`, JSON.stringify({
                activeTaskId, timeLeft, isActive
            }));
        } else {
            localStorage.removeItem(`active_task_state_${user.id}`);
        }
    }, [activeTaskId, timeLeft, isActive, user]);

    // Timer loop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleTaskComplete(activeTaskId!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, activeTaskId]);

    const handleTaskComplete = (taskId: string) => {
        setIsActive(false);
        setActiveTaskId(null);
        setTimeLeft(0);
        
        // Auto-complete in TaskContext
        updateTask(taskId, { status: TaskStatus.COMPLETED });
        
        // Notification
        sendSmartNotification("Task Completed!", "Great job staying focused!", "task-complete");
    };

    const triggerVictory = () => {
        setShowVictory(true);
        const end = Date.now() + 3 * 1000;

        const frame = () => {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['##1E90FF', '#2ECC71', '#FFD700', '#FF4D4D']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['##1E90FF', '#2ECC71', '#FFD700', '#FF4D4D']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    };

    const startTask = (taskId: string, durationMinutes: number) => {
        setActiveTaskId(taskId);
        setTimeLeft(durationMinutes * 60);
        setIsActive(true);
        updateTask(taskId, { status: TaskStatus.IN_PROGRESS });
    };

    const pauseTask = () => setIsActive(false);
    const resumeTask = () => setIsActive(true);
    const endTaskEarly = () => {
        if (activeTaskId) {
            handleTaskComplete(activeTaskId);
        }
    };

    return (
        <ActiveTaskContext.Provider value={{
             activeTaskId, timeLeft, isActive, startTask, pauseTask, resumeTask, endTaskEarly, triggerVictory, showVictory, setShowVictory
        }}>
            {children}
        </ActiveTaskContext.Provider>
    );
};

export const useActiveTask = () => {
    const ctx = useContext(ActiveTaskContext);
    if (!ctx) throw new Error("useActiveTask must be used within an ActiveTaskProvider");
    return ctx;
};

import React, { useState, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Maximize2, Minimize2, X, Move } from 'lucide-react';
import AIAvatar from './AIAvatar';
import { useAuth } from '../contexts/AuthContext';
import { useAI } from '../contexts/AIContext';

export const FloatingAIAvatar = () => {
    const { user, updateProfile } = useAuth();
    const { isSpeaking, isThinking, messages } = useAI();
    
    // Get latest AI message to mirror emotion/animation
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'model');
    const currentEmotion = isThinking ? 'thinking' : (isSpeaking ? (lastAiMsg?.emotion || 'neutral') : 'neutral');
    const currentAnimation = isThinking ? 'idle' : (isSpeaking ? (lastAiMsg?.animation || 'talking') : 'idle');
    
    // Theme calculation
    const [isLight, setIsLight] = useState(false);
    useEffect(() => {
        const theme = user?.aiSettings?.theme;
        const color = user?.aiSettings?.customThemeColor;
        let light = false;
        if (theme === 'nature' || theme === 'ladies' || theme === 'white') {
           light = true;
        } else if (theme === 'custom' && color) {
           const hex = color.replace('#', '');
           const r = parseInt(hex.substr(0, 2), 16);
           const g = parseInt(hex.substr(2, 2), 16);
           const b = parseInt(hex.substr(4, 2), 16);
           const brightness = (r * 299 + g * 587 + b * 114) / 1000;
           light = brightness > 155;
        } else if (theme === 'dark' || (!theme && !user?.aiSettings?.natureThemeEnabled)) {
            light = false;
        } else {
            light = !document.documentElement.classList.contains('dark');
        }
        setIsLight(light);
    }, [user?.aiSettings?.theme, user?.aiSettings?.customThemeColor, user?.aiSettings?.natureThemeEnabled]);

    const [isMinimized, setIsMinimized] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const dragControls = useDragControls();

    useEffect(() => {
        if (user && user.aiSettings?.showFloatingAvatar !== undefined) {
             setIsVisible(user.aiSettings.showFloatingAvatar);
        }
    }, [user]);

    const closeAvatar = async () => {
        setIsVisible(false);
        if (user) {
            await updateProfile({
                aiSettings: {
                    ...user.aiSettings,
                    showFloatingAvatar: false
                }
            });
        }
    };

    if (!isVisible) return null;

    const avatarType = user?.aiSettings?.aiAvatarType || 'girl';
    const avatarUrl = user?.aiSettings?.aiAvatarUrl;

    return (
        <motion.div
            drag
            dragControls={dragControls}
            dragListener={false} // Only drag using the handle
            dragConstraints={{ top: 10, left: 10, right: window.innerWidth - 150, bottom: window.innerHeight - 150 }}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.8, x: window.innerWidth - 150, y: window.innerHeight - 200 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`fixed z-[60] flex flex-col items-center ${
                isMinimized ? 'w-20' : 'w-32'
            }`}
            style={{ touchAction: 'none' }}
        >
            <div className={`relative group w-full rounded-2xl p-2 transition-all duration-300 ${isLight ? 'bg-white/80 shadow-xl backdrop-blur-md border border-gray-200/50' : 'bg-gray-800/80 shadow-2xl backdrop-blur-md border border-gray-700/50'}`}>
                
                {/* Controls (visible on hover) */}
                <div className="absolute -top-3 -right-3 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-200 dark:border-gray-700 p-0.5 z-10 gap-1">
                     <button
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-tt-blue cursor-grab active:cursor-grabbing"
                        onPointerDown={(e) => dragControls.start(e)}
                        title="Drag"
                    >
                        <Move size={14} />
                    </button>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-tt-blue transition-colors"
                        title={isMinimized ? "Expand" : "Minimize"}
                    >
                        {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                    </button>
                    <button
                        onClick={closeAvatar}
                        className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 transition-colors"
                        title="Close (enable in Profile settings)"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div 
                    className={`transition-all duration-300 ease-in-out ${isMinimized ? 'w-16 h-16 cursor-pointer' : 'w-28 h-28 cursor-pointer'}`}
                    onDoubleClick={() => setIsMinimized(!isMinimized)}
                    title="Double-click to resize"
                >
                    <AIAvatar 
                        isSpeaking={isSpeaking} 
                        isThinking={isThinking}
                        type={avatarType as 'robot' | 'boy' | 'girl'} 
                        imageUrl={avatarUrl}
                        isLightTheme={isLight}
                        emotion={currentEmotion as any}
                        animation={currentAnimation as any}
                        className="w-full h-full shadow-inner"
                    />
                </div>
            </div>
            
            {/* Status indicator */}
            {!isMinimized && (
                <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2"
                >
                    {isSpeaking ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-semibold tracking-wide uppercase border border-blue-500/20 backdrop-blur-sm shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            Speaking
                        </div>
                    ) : isThinking ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-semibold tracking-wide uppercase border border-amber-500/20 backdrop-blur-sm shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse delay-75"></span>
                            Thinking
                        </div>
                    ) : null}
                </motion.div>
            )}
        </motion.div>
    );
};

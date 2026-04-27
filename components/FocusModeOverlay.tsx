import React, { useState, useEffect } from 'react';
import { useAI } from '../contexts/AIContext';
import { Play, Pause, X, BrainCircuit, Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const FocusModeOverlay = () => {
    const { isFocusModeActive, focusModeMinutes, stopFocusMode, isListening, startListening, stopListening, isSpeaking } = useAI();
    const [timeLeft, setTimeLeft] = useState(focusModeMinutes * 60);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isFocusModeActive) {
            setTimeLeft(focusModeMinutes * 60);
            setIsPaused(false);
        }
    }, [isFocusModeActive, focusModeMinutes]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isFocusModeActive && !isPaused && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isFocusModeActive) {
            stopFocusMode();
        }
        return () => clearInterval(interval);
    }, [isFocusModeActive, isPaused, timeLeft, stopFocusMode]);

    if (!isFocusModeActive) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-white"
            >
                <div className="absolute top-8 right-8">
                    <button 
                        onClick={stopFocusMode}
                        className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex flex-col items-center max-w-md w-full px-6">
                    <div className="relative mb-8">
                        <BrainCircuit size={64} className={`text-tt-blue ${isSpeaking ? 'animate-bounce' : 'animate-pulse'}`} />
                        {isSpeaking && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="absolute -top-2 -right-2 bg-indigo-500 p-1.5 rounded-full"
                            >
                                <Volume2 size={16} className="text-white animate-pulse" />
                            </motion.div>
                        )}
                    </div>
                    
                    <h2 className="text-3xl font-bold mb-2">Focus Mode</h2>
                    <p className="text-gray-400 mb-12 text-center">
                        {isSpeaking ? "Tai is speaking..." : "Distractions blocked. Notifications silenced. Focus on your study."}
                    </p>

                    <div className="text-8xl font-mono font-bold mb-12 tracking-wider">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>

                    <div className="flex space-x-6">
                        <button 
                            onClick={() => setIsPaused(!isPaused)}
                            className="p-6 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
                        >
                            {isPaused ? <Play size={32} /> : <Pause size={32} />}
                        </button>

                        <button 
                            onClick={isListening ? stopListening : startListening}
                            className={`p-6 rounded-full transition-colors ${
                                isListening 
                                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                                    : 'bg-tt-blue hover:bg-blue-600'
                            }`}
                        >
                            {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                        </button>
                    </div>

                    <p className="mt-8 text-gray-500 text-sm text-center">
                        Tap the microphone to ask Tai a question via voice.<br/>
                        <span className="text-xs opacity-70">Tai will stop speaking if you interrupt.</span>
                    </p>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default FocusModeOverlay;

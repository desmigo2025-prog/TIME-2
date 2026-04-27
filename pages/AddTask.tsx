import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../contexts/TaskContext';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { TaskPriority, TaskStatus } from '../types';
import { parseVoiceTask } from '../services/geminiService';
import { ArrowLeft, Mic, Loader, CheckCircle, StopCircle, Crown } from 'lucide-react';

const AddTask = () => {
    const navigate = useNavigate();
    const { addTask } = useTasks();
    const { isPro } = useUsage();
    const { user } = useAuth();
    
    const theme = user?.aiSettings?.theme || (user?.aiSettings?.natureThemeEnabled ? 'nature' : 'dark');
    
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

    // Form State
    const [title, setTitle] = useState('');
    const [venue, setVenue] = useState('');
    const [time, setTime] = useState('');
    const [day, setDay] = useState('Monday');
    const [duration, setDuration] = useState('60');
    const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);

    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addTask({
            title,
            description: 'Created via App',
            venue,
            time,
            day,
            durationMinutes: parseInt(duration),
            priority: priority,
            status: TaskStatus.PENDING,
            category: 'Personal'
        });
        navigate('/');
    };

    // Voice Logic using Web Speech API + Gemini Parsing
    const toggleVoiceInput = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Voice input not supported in this browser.");
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
            setIsListening(true);
            setTranscript('');
        };
        
        recognitionRef.current.onend = () => setIsListening(false);
        
        recognitionRef.current.onresult = async (event: any) => {
            let currentTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                currentTranscript += event.results[i][0].transcript;
            }
            setTranscript(currentTranscript);
            
            if (event.results[0].isFinal) {
                processVoiceCommand(event.results[0][0].transcript);
            }
        };

        recognitionRef.current.start();
    };

    const stopListening = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
    };

    const processVoiceCommand = async (finalTranscript: string) => {
        setIsProcessingVoice(true);
        try {
            const parsed = await parseVoiceTask(finalTranscript);
            
            if (parsed.title) setTitle(parsed.title);
            if (parsed.day) {
                const formattedDay = parsed.day.charAt(0).toUpperCase() + parsed.day.slice(1).toLowerCase();
                setDay(formattedDay);
            }
            if (parsed.time) setTime(parsed.time);
            if (parsed.venue) setVenue(parsed.venue);
            if (parsed.durationMinutes) setDuration(parsed.durationMinutes.toString());
            
        } catch (error) {
            alert("Could not understand the task details. Please try again.");
        } finally {
            setIsProcessingVoice(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className={`p-2 rounded-full ${isLightTheme ? 'hover:bg-gray-200' : 'hover:bg-gray-800'}`}>
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    New Task
                    {isPro && <Crown size={20} className="text-yellow-500" />}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                {/* Voice Status Indicator */}
                {(isListening || isProcessingVoice || transcript) && (
                    <div className={`p-4 rounded-xl flex flex-col gap-3 animate-fade-in ${isListening ? 'bg-red-500/10 border border-red-500/50 text-red-400' : 'bg-tt-blue/10 border border-tt-blue/50 text-tt-blue'}`}>
                        <div className="flex items-center gap-3">
                            {isListening ? (
                                <>
                                    <span className="relative flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    <span className="font-bold">Listening... Speak now</span>
                                </>
                            ) : isProcessingVoice ? (
                                <>
                                    <Loader size={18} className="animate-spin" />
                                    <span className="font-bold">AI Processing...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} />
                                    <span className="font-bold">Done</span>
                                </>
                            )}
                        </div>
                        {transcript && (
                            <div className="text-sm italic opacity-80 border-t border-current pt-2 mt-1">
                                "{transcript}"
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <label className={`block text-sm opacity-70 mb-1 ${isLightTheme ? 'text-gray-700' : ''}`}>Task Title</label>
                    <input 
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className={`w-full border rounded-xl p-4 focus:border-tt-blue focus:outline-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                        placeholder="e.g., Marketing Meeting"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className={`block text-sm opacity-70 mb-1 ${isLightTheme ? 'text-gray-700' : ''}`}>Day</label>
                        <select 
                            value={day}
                            onChange={e => setDay(e.target.value)}
                            className={`w-full border rounded-xl p-4 focus:border-tt-blue focus:outline-none appearance-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                        >
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={`block text-sm opacity-70 mb-1 ${isLightTheme ? 'text-gray-700' : ''}`}>Time</label>
                        <input 
                            type="time"
                            required
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className={`w-full border rounded-xl p-4 focus:border-tt-blue focus:outline-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className={`block text-sm opacity-70 mb-1 ${isLightTheme ? 'text-gray-700' : ''}`}>Duration (mins)</label>
                        <input 
                            type="number"
                            value={duration}
                            onChange={e => setDuration(e.target.value)}
                            className={`w-full border rounded-xl p-4 focus:border-tt-blue focus:outline-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm opacity-70 mb-1 ${isLightTheme ? 'text-gray-700' : ''}`}>Venue</label>
                        <input 
                            value={venue}
                            onChange={e => setVenue(e.target.value)}
                            className={`w-full border rounded-xl p-4 focus:border-tt-blue focus:outline-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                            placeholder="Room 304"
                        />
                    </div>
                </div>

                <div>
                    <label className={`block text-sm opacity-70 mb-1 ${isLightTheme ? 'text-gray-700' : ''}`}>Priority</label>
                    <select 
                        value={priority}
                        onChange={e => setPriority(e.target.value as TaskPriority)}
                        className={`w-full border rounded-xl p-4 focus:border-tt-blue focus:outline-none appearance-none ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                    >
                        {Object.values(TaskPriority).map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                <div className="pt-4 space-y-3">
                    <button 
                        type="button" 
                        onClick={toggleVoiceInput}
                        disabled={isProcessingVoice}
                        className={`w-full py-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${
                            isListening 
                            ? 'border-red-500 text-red-400 bg-red-500/10 animate-pulse' 
                            : 'border-tt-blue text-tt-blue hover:bg-tt-blue/10'
                        }`}
                    >
                        {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                        {isListening ? 'Stop Listening' : 'Add via Voice Command'}
                    </button>

                    <button type="submit" className="w-full py-4 rounded-xl bg-tt-blue text-white font-bold shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                        {isProcessingVoice ? <Loader className="animate-spin" /> : <CheckCircle size={20} />}
                        Create Task
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddTask;
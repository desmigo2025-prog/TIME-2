import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';
import { useAuth } from '../contexts/AuthContext';
import { useUsage } from '../contexts/UsageContext';
import { useTasks } from '../contexts/TaskContext';
import { Send, Mic, Sparkles, Bot, User as UserIcon, Trash2, StopCircle, Volume2, Globe, Lock, Crown, Brain, X } from 'lucide-react';
import { format } from 'date-fns';
import UpgradeModal from '../components/UpgradeModal';
import AIAvatar from '../components/AIAvatar';

const AICompanion = () => {
    const navigate = useNavigate();
    const { messages, sendMessage, isTyping, isListening, startListening, stopListening, clearHistory, deleteMessage, speak, stopSpeaking, pauseSpeech, resumeSpeech, cancelSpeech, isSpeaking, isThinking, startFocusMode, stopFocusMode, isFocusModeActive, focusModeMinutes } = useAI();
    const { user } = useAuth();
    const { canUseAI, incrementAIUsage, getUsageStats, isPro } = useUsage();
    const { draftTasks } = useTasks();
    const [input, setInput] = useState('');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Theme Variables
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
    const isNatureTheme = isLightTheme; // Alias for existing code
    
    let bgClass = "bg-transparent";
    if (theme === 'nature') bgClass = "bg-[linear-gradient(135deg,rgba(220,80,80,0.6),rgba(70,130,180,0.6),rgba(100,180,100,0.6),rgba(255,215,100,0.6))]";
    else if (theme === 'ocean') bgClass = "bg-[linear-gradient(135deg,rgba(0,119,182,0.6),rgba(0,180,216,0.6),rgba(144,224,239,0.6))]";
    else if (theme === 'sunset') bgClass = "bg-[linear-gradient(135deg,rgba(255,126,103,0.6),rgba(255,163,113,0.6),rgba(255,203,164,0.6))]";
    else if (theme === 'ladies') bgClass = "bg-[linear-gradient(135deg,#ff9a9e,#fecfef,#ffdde1)]";
    
    const textMain = isLightTheme ? "text-gray-900" : "text-white";
    const textSub = isLightTheme ? "text-gray-700" : "text-gray-400";
    
    // Bubble Colors
    const userBubbleClass = isLightTheme 
        ? "bg-[#FFF9C4] text-gray-900 shadow-sm" // Soft Yellow
        : "bg-tt-blue text-white";
        
    const modelBubbleClass = isLightTheme 
        ? "bg-[#E0F7FA] text-gray-900 shadow-sm border border-[#B2EBF2]" // Sky Blue
        : "bg-gray-800 text-gray-200 border border-gray-700";

    const inputAreaClass = isLightTheme
        ? "bg-white/60 border-gray-400/50 shadow-lg backdrop-blur-sm"
        : "bg-gray-800/50 border-gray-700";

    const inputTextClass = isLightTheme ? "text-gray-900 placeholder-gray-600" : "text-white placeholder-gray-500";

    const lastAiMsg = [...messages].reverse().find(m => m.role === 'model');
    const currentEmotion = isThinking ? 'thinking' : (isSpeaking ? (lastAiMsg?.emotion || 'neutral') : 'neutral');
    const currentAnimation = isThinking ? 'idle' : (isSpeaking ? (lastAiMsg?.animation || 'talking') : 'idle');

    let primaryBtnClass = "bg-tt-blue text-white hover:bg-blue-600 shadow-lg shadow-tt-blue/20";
    let secondaryBtnClass = "bg-gray-700 text-gray-300 hover:text-white";
    
    if (theme === 'nature') {
        primaryBtnClass = "bg-[#8B5E3C] text-white hover:bg-[#7A5230] shadow-md";
        secondaryBtnClass = "bg-[#709070] text-white hover:bg-[#608060]";
    } else if (theme === 'ocean') {
        primaryBtnClass = "bg-[#0077B6] text-white hover:bg-[#023E8A] shadow-md";
        secondaryBtnClass = "bg-[#00B4D8] text-white hover:bg-[#0096C7]";
    } else if (theme === 'sunset') {
        primaryBtnClass = "bg-[#E07A5F] text-white hover:bg-[#D46A4F] shadow-md";
        secondaryBtnClass = "bg-[#F2CC8F] text-gray-900 hover:bg-[#E2BC7F]";
    } else if (theme === 'ladies') {
        primaryBtnClass = "bg-[#d81b60] text-white hover:bg-[#ad1457] shadow-md";
        secondaryBtnClass = "bg-[#f48fb1] text-gray-900 hover:bg-[#f06292]";
    } else if (theme === 'white') {
        primaryBtnClass = "bg-gray-900 text-white hover:bg-gray-800 shadow-md";
        secondaryBtnClass = "bg-gray-200 text-gray-900 hover:bg-gray-300";
    }

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => {
        if (input.trim().length > 0) {
            pauseSpeech();
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                resumeSpeech();
            }, 2000);
        } else {
            // If input is cleared but not sent, resume speech
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            resumeSpeech();
        }
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [input, pauseSpeech, resumeSpeech]);

    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isSending || isTyping) return;
        if (!canUseAI) {
            setShowUpgradeModal(true);
            return;
        }
        setIsSending(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        cancelSpeech();
        await incrementAIUsage();
        await sendMessage(input);
        setInput('');
        setIsSending(false);
    };

    const handleSendAnswer = async (answer: string) => {
        if (!answer.trim() || isSending || isTyping) return;
        if (!canUseAI) {
            setShowUpgradeModal(true);
            return;
        }
        setIsSending(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        cancelSpeech();
        await incrementAIUsage();
        await sendMessage(answer);
        setIsSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`flex flex-col h-full relative ${bgClass} transition-all duration-500 rounded-xl overflow-hidden`}>
            {/* Header */}
            <div className={`flex items-center justify-between mb-4 p-4 ${isNatureTheme ? 'bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-black/5' : 'glass-panel rounded-2xl'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-1 transition-all ${isSpeaking ? 'animate-pulse scale-105' : ''}`}>
                        <Brain size={24} className={isNatureTheme ? "text-[#8B5E3C]" : "text-tt-blue"} />
                    </div>
                    <div>
                        <h1 className={`text-xl font-black ${textMain} flex items-center gap-2 tracking-tight`}>
                            AI Companion
                            {isPro && <Crown size={18} className="text-yellow-500 animate-float" />}
                        </h1>
                        <p className={`text-[11px] uppercase tracking-widest font-bold ${textSub} flex items-center gap-1 mt-0.5`}>
                            {isSpeaking ? (
                                <>
                                    <Volume2 size={12} className="text-tt-blue animate-pulse" />
                                    <span className="text-tt-blue">Speaking...</span>
                                </>
                            ) : (
                                <>
                                    <span className="w-2 h-2 bg-tt-green rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                    Online
                                </>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {!isPro && (
                        <button 
                            onClick={() => setShowUpgradeModal(true)}
                            className="hidden sm:flex items-center gap-1 text-xs bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-4 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                            <Crown size={14} /> Upgrade
                        </button>
                    )}
                    <button 
                        onClick={() => setShowMemoryModal(true)}
                        className={`p-2.5 rounded-xl transition-colors ${isNatureTheme ? 'hover:bg-tt-blue/10 text-gray-600 hover:text-tt-blue bg-white/50' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`}
                        title="Manage Memory"
                    >
                        <Brain size={18} />
                    </button>
                    <button 
                        onClick={() => {
                            if (window.confirm('Are you sure you want to clear your conversation history?')) {
                                clearHistory();
                            }
                        }}
                        className={`px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 ${isNatureTheme ? 'bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 border border-red-100' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300'}`}
                        title="Clear Conversation History"
                    >
                        <Trash2 size={16} /> <span className="text-xs font-bold hidden sm:inline tracking-wide">Clear History</span>
                    </button>
                </div>
            </div>

            {/* Split Layout: Avatar (Left) and Chat (Right) */}
            <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Full Body Avatar Column */}
                <div className="hidden md:flex flex-col items-center justify-end w-1/4 lg:w-1/5 max-w-[280px] pb-4 px-4 sticky top-0 relative">
                    <AIAvatar 
                        isSpeaking={isSpeaking} 
                        isThinking={isThinking}
                        imageUrl={user?.aiSettings?.aiAvatarUrl} // Keep purely what user uploaded
                        type={user?.aiSettings?.aiAvatarType}
                        isLightTheme={isLightTheme}
                        emotion={currentEmotion as any}
                        animation={currentAnimation as any}
                        viewMode="full"
                        className="w-full h-full max-h-[70vh] drop-shadow-2xl object-scale-down"
                    />
                </div>

                {/* Message List Column */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-4 px-2">
                        {/* Mobile Avatar Overlay (Large persistent character) */}
                        <div className="md:hidden flex justify-center mb-6 h-64 min-h-[30vh]">
                             <AIAvatar 
                                isSpeaking={isSpeaking} 
                                isThinking={isThinking}
                                imageUrl={user?.aiSettings?.aiAvatarUrl}
                                type={user?.aiSettings?.aiAvatarType}
                                isLightTheme={isLightTheme}
                                emotion={currentEmotion as any}
                                animation={currentAnimation as any}
                                viewMode="full"
                                className="h-full drop-shadow-xl max-w-[80%]"
                             />
                        </div>

                        {/* Focus Mode Banner */}
                {isFocusModeActive && (
                    <div className="mx-2 mb-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-100 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Brain size={16} className="text-indigo-400 animate-pulse" />
                            <span className={isLightTheme ? "text-indigo-900" : "text-indigo-200"}>Focus Mode Active: Notifications blocked ({focusModeMinutes}m)</span>
                        </div>
                        <button 
                            onClick={stopFocusMode}
                            className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-bold shadow-sm"
                        >
                            Stop
                        </button>
                    </div>
                )}

                {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                <Sparkles size={48} className={isNatureTheme ? "text-gray-700" : "text-tt-blue opacity-50"} />
                                <div>
                                    <p className={`text-lg font-bold ${isNatureTheme ? 'text-gray-800' : 'text-gray-300'}`}>How can I help you today?</p>
                                    <p className={`text-xs ${textSub}`}>Try asking: "Schedule a meeting", "Search news", or "Advice"</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                {msg.role === 'user' ? (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                                        isNatureTheme ? 'bg-[#8B5E3C] text-white' : 'bg-gray-700'
                                    }`}>
                                        {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon size={14} />}
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-transparent">
                                        <AIAvatar 
                                            isSpeaking={isSpeaking && messages[messages.length - 1].id === msg.id}
                                            isThinking={isThinking && messages[messages.length - 1].id === msg.id}
                                            imageUrl={user?.aiSettings?.aiAvatarUrl}
                                            type={user?.aiSettings?.aiAvatarType}
                                            isLightTheme={isLightTheme}
                                            emotion={msg.emotion}
                                            animation={msg.animation}
                                            viewMode="circle"
                                            className="w-full h-full"
                                         />
                                    </div>
                                )}
                                    
                                    <div className={`max-w-[85%] rounded-2xl p-4 relative group ${
                                        msg.role === 'user' 
                                        ? `${userBubbleClass} rounded-tr-none` 
                                        : `${modelBubbleClass} rounded-tl-none`
                                    }`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        
                                        {/* Grounding Sources (Search Results) */}
                                        {msg.groundingMetadata?.groundingChunks && (
                                            <div className={`mt-3 pt-3 border-t ${isNatureTheme ? 'border-gray-400/50' : 'border-gray-700/50'}`}>
                                                <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase mb-2 ${isNatureTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    <Globe size={10} /> Sources from Web
                                                </div>
                                                <div className="space-y-1">
                                                    {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                                                        chunk.web?.uri && (
                                                            <a 
                                                                key={i} 
                                                                href={chunk.web.uri} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className={`block text-xs hover:underline truncate px-2 py-1 rounded ${isNatureTheme ? 'text-blue-700 bg-white/60' : 'text-tt-blue bg-gray-900/50'}`}
                                                            >
                                                                {chunk.web.title || chunk.web.uri}
                                                            </a>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <span className="text-[10px] opacity-50 block mt-2 text-right">
                                            {format(new Date(msg.timestamp), 'HH:mm')}
                                        </span>
                                        
                                        {/* Voice Replay for Model Messages */}
                                        {msg.role === 'model' && (
                                            <div className="absolute -right-8 bottom-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => speak(msg.content)}
                                                    className={`p-1.5 transition-colors rounded-full ${isNatureTheme ? 'bg-white/60 text-gray-600 hover:text-green-700 shadow-sm' : 'bg-gray-800 text-gray-400 hover:text-tt-blue shadow-sm'}`}
                                                    title="Replay Voice"
                                                >
                                                    <Volume2 size={16} />
                                                </button>
                                                {isSpeaking && (
                                                    <button 
                                                        onClick={stopSpeaking}
                                                        className="p-1.5 transition-colors rounded-full bg-red-500/10 text-red-500 hover:text-white hover:bg-red-500 shadow-sm text-xs border border-transparent hover:border-red-600"
                                                        title="Stop Speaking"
                                                    >
                                                        <StopCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Suggested Answers */}
                                        {msg.suggestedAnswers && msg.suggestedAnswers.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {msg.suggestedAnswers.map((answer, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSendAnswer(answer)}
                                                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                                            isNatureTheme
                                                                ? 'bg-white/80 border-gray-300 text-gray-800 hover:bg-tt-blue hover:text-white hover:border-tt-blue'
                                                                : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-tt-blue hover:text-white hover:border-tt-blue'
                                                        }`}
                                                    >
                                                        {answer}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        
                        {isTyping && (
                            <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-transparent`}>
                                    <AIAvatar 
                                        imageUrl={user?.aiSettings?.aiAvatarUrl}
                                        type={user?.aiSettings?.aiAvatarType}
                                        isLightTheme={isLightTheme}
                                        className="w-full h-full"
                                        viewMode="circle"
                                     />
                                </div>
                                <div className={`rounded-2xl p-4 rounded-tl-none border ${modelBubbleClass}`}>
                                    {messages[messages.length - 1]?.content.toLowerCase().includes('timetable') ? (
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Sparkles size={14} className="animate-pulse text-yellow-500" />
                                            Creating your personalized timetable...
                                        </div>
                                    ) : (
                                        <div className="flex gap-1">
                                            <span className={`w-2 h-2 rounded-full animate-bounce ${isNatureTheme ? 'bg-gray-600' : 'bg-gray-500'}`}></span>
                                            <span className={`w-2 h-2 rounded-full animate-bounce delay-100 ${isNatureTheme ? 'bg-gray-600' : 'bg-gray-500'}`}></span>
                                            <span className={`w-2 h-2 rounded-full animate-bounce delay-200 ${isNatureTheme ? 'bg-gray-600' : 'bg-gray-500'}`}></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                <div ref={bottomRef}></div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-2 px-2 overflow-x-auto custom-scrollbar pb-2">
                        {draftTasks && draftTasks.length > 0 && (
                            <button
                                onClick={() => {
                                    stopSpeaking();
                                    navigate('/review');
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                                    isNatureTheme 
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200' 
                                    : 'bg-emerald-900 border-emerald-700 text-emerald-300 hover:bg-emerald-800'
                                }`}
                            >
                                <Sparkles size={12} className="text-emerald-500" />
                                Review Timetable
                            </button>
                        )}
                        <button
                            onClick={() => {
                                stopSpeaking();
                                if (!isPro) {
                                    setShowUpgradeModal(true);
                                    sendMessage("Create a timetable for my courses");
                                    return;
                                }
                                setInput("Create a timetable for my courses. I study ");
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                                isNatureTheme 
                                ? 'bg-white/60 border-gray-300 text-gray-800 hover:bg-white/80' 
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            <Sparkles size={12} className="text-yellow-500" />
                            Generate Timetable
                        </button>
                        
                        {!isFocusModeActive && (
                            <button
                                onClick={() => {
                                    stopSpeaking();
                                    sendMessage("Start a 25 minute focus session");
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                                    isNatureTheme 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
                                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20'
                                }`}
                            >
                                <Brain size={12} className="text-indigo-400" />
                                Focus Mode (25m)
                            </button>
                        )}
                    </div>

            <div className={`mt-2 p-2 rounded-2xl border flex items-center gap-2 ${inputAreaClass}`}>
                <button
                    onClick={() => {
                                if (isListening) {
                                    stopListening();
                                } else {
                                    startListening();
                                }
                            }}
                            className={`p-3 rounded-xl transition-all ${
                                isListening 
                                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' 
                                : secondaryBtnClass
                            }`}
                        >
                            {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                        </button>
                        
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isListening ? "Listening..." : "Type a message..."}
                            className={`flex-1 bg-transparent border-none outline-none px-2 ${inputTextClass}`}
                            disabled={isListening}
                        />
                        
                <button 
                    onClick={handleSend}
                    disabled={!input.trim() || isListening}
                    className={`p-3 rounded-xl transition-all ${
                        input.trim() 
                        ? primaryBtnClass
                        : 'bg-gray-400/20 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    <Send size={20} />
                </button>
            </div>
          </div>
        </div>
            <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

            {/* Memory Modal */}
            {showMemoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl ${isNatureTheme ? 'bg-white' : 'bg-gray-900 border border-gray-800'}`}>
                        <div className={`p-4 border-b flex items-center justify-between ${isNatureTheme ? 'border-gray-100' : 'border-gray-800'}`}>
                            <div className="flex items-center gap-2">
                                <Brain className={isNatureTheme ? 'text-tt-blue' : 'text-tt-blue'} size={24} />
                                <h2 className={`text-xl font-bold ${isNatureTheme ? 'text-gray-900' : 'text-white'}`}>Learning History</h2>
                            </div>
                            <button 
                                onClick={() => setShowMemoryModal(false)}
                                className={`p-2 rounded-lg transition-colors ${isNatureTheme ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-800 text-gray-400'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                                    <Brain size={48} className={isNatureTheme ? "text-gray-300" : "text-gray-700"} />
                                    <div>
                                        <p className={`text-lg font-bold ${isNatureTheme ? 'text-gray-800' : 'text-gray-300'}`}>No memories yet</p>
                                        <p className={`text-sm ${textSub}`}>Start chatting to build your AI's knowledge base.</p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex flex-col p-3 rounded-xl border ${isNatureTheme ? 'bg-gray-50 border-gray-100' : 'bg-gray-800/50 border-gray-700/50'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {msg.role === 'user' ? (
                                                    <UserIcon size={14} className={isNatureTheme ? 'text-gray-500' : 'text-gray-400'} />
                                                ) : (
                                                    <div className="w-5 h-5 shrink-0">
                                                        <AIAvatar 
                                                            imageUrl={user?.aiSettings?.aiAvatarUrl} 
                                                            type={user?.aiSettings?.aiAvatarType}
                                                            isLightTheme={isLightTheme}
                                                            className="w-full h-full"
                                                        />
                                                    </div>
                                                )}
                                                <span className={`text-xs font-medium ${isNatureTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                                                </span>
                                                <span className={`text-xs ${isNatureTheme ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {format(new Date(msg.timestamp), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => deleteMessage(msg.id)}
                                                className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                                                title="Forget this message"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <p className={`text-sm whitespace-pre-wrap ${isNatureTheme ? 'text-gray-800' : 'text-gray-200'}`}>
                                            {msg.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {messages.length > 0 && (
                            <div className={`p-4 border-t flex justify-between items-center ${isNatureTheme ? 'border-gray-100 bg-gray-50 rounded-b-2xl' : 'border-gray-800 bg-gray-900/50 rounded-b-2xl'}`}>
                                <p className={`text-xs ${textSub}`}>
                                    Deleting messages helps refine the AI's context and future responses.
                                </p>
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to clear all learning history?')) {
                                            clearHistory();
                                            setShowMemoryModal(false);
                                        }
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AICompanion;
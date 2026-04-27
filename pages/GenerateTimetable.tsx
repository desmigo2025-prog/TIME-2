import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { generateTimetableWithGemini } from '../services/geminiService';
import { Bot, ArrowLeft, Loader, Sparkles, Clock, BookOpen, Coffee } from 'lucide-react';

const GenerateTimetable = () => {
    const navigate = useNavigate();
    const { isPro } = useUsage();
    const { user } = useAuth();
    
    const theme = user?.aiSettings?.theme || (user?.aiSettings?.natureThemeEnabled ? 'nature' : 'dark');
    const isLightTheme = theme === 'nature' || theme === 'ocean' || theme === 'sunset' || theme === 'ladies' || theme === 'white';

    const [isGenerating, setIsGenerating] = useState(false);
    const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
    const [subjects, setSubjects] = useState('');
    const [studyHours, setStudyHours] = useState(4);
    const [breakPreferences, setBreakPreferences] = useState('10 mins every hour');
    const [startTime, setStartTime] = useState('09:00');

    if (!isPro) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <Bot size={64} className="text-purple-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Pro Feature</h2>
                <p className="text-gray-400 mb-6">Upgrade to Pro to let AI generate your perfect study schedule instantly.</p>
                <button 
                    onClick={() => navigate('/')}
                    className="bg-tt-blue text-white px-6 py-2 rounded-xl font-bold"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const handleGenerate = async () => {
        if (!subjects.trim()) {
            alert("Please enter at least one subject.");
            return;
        }

        setIsGenerating(true);
        try {
            const generatedTasks = await generateTimetableWithGemini(
                subjects,
                studyHours,
                breakPreferences,
                startTime,
                mode
            );

            if (generatedTasks.length === 0) {
                throw new Error("AI returned an empty schedule.");
            }

            // Navigate to review screen with the generated data
            navigate('/review', { state: { scannedTasks: generatedTasks } });
        } catch (error: any) {
            alert(error.message || 'Failed to generate timetable.');
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        AI Generator <Sparkles size={20} className="text-purple-500" />
                    </h1>
                    <p className="text-sm opacity-70">Let AI build your perfect study schedule</p>
                </div>
            </div>

            <div className={`${isLightTheme ? 'bg-white/80 border-gray-200' : 'bg-gray-900/50 border-gray-700'} border p-6 rounded-2xl space-y-6`}>
                {/* Mode Selection */}
                <div className={`flex ${isLightTheme ? 'bg-gray-100' : 'bg-gray-800'} p-1 rounded-xl`}>
                    <button 
                        onClick={() => setMode('daily')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'daily' ? 'bg-tt-blue text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        Daily Plan
                    </button>
                    <button 
                        onClick={() => setMode('weekly')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'weekly' ? 'bg-tt-blue text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        Weekly Plan
                    </button>
                </div>

                {/* Subjects */}
                <div className="space-y-2">
                    <label className={`text-sm font-bold flex items-center gap-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                        <BookOpen size={16} className="text-tt-blue" /> Subjects / Topics
                    </label>
                    <textarea 
                        value={subjects}
                        onChange={(e) => setSubjects(e.target.value)}
                        placeholder="e.g., Math, Physics, History chapter 4..."
                        className={`w-full border rounded-xl p-3 focus:outline-none focus:border-tt-blue resize-none h-24 ${isLightTheme ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-500' : 'bg-gray-800 border-gray-700 text-white'}`}
                    />
                </div>

                {/* Study Hours & Start Time */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className={`text-sm font-bold flex items-center gap-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                            <Clock size={16} className="text-tt-blue" /> Hours / Day
                        </label>
                        <input 
                            type="number" 
                            min="1" max="16"
                            value={studyHours}
                            onChange={(e) => setStudyHours(Number(e.target.value))}
                            className={`w-full border rounded-xl p-3 focus:outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className={`text-sm font-bold flex items-center gap-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                            <Clock size={16} className="text-tt-blue" /> Start Time
                        </label>
                        <input 
                            type="time" 
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className={`w-full border rounded-xl p-3 focus:outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white border-gray-300 text-gray-900' : 'bg-gray-800 border-gray-700 text-white'}`}
                        />
                    </div>
                </div>

                {/* Break Preferences */}
                <div className="space-y-2">
                    <label className={`text-sm font-bold flex items-center gap-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                        <Coffee size={16} className="text-tt-blue" /> Break Preferences
                    </label>
                    <input 
                        type="text" 
                        value={breakPreferences}
                        onChange={(e) => setBreakPreferences(e.target.value)}
                        placeholder="e.g., 10 mins every hour, Pomodoro (25/5)"
                        className={`w-full border rounded-xl p-3 focus:outline-none focus:border-tt-blue ${isLightTheme ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-500' : 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'}`}
                    />
                </div>

                {/* Generate Button */}
                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                        isGenerating 
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-600 to-tt-blue hover:from-purple-500 hover:to-blue-500 text-white active:scale-95'
                    }`}
                >
                    {isGenerating ? (
                        <>
                            <Loader className="animate-spin" size={24} /> Generating Magic...
                        </>
                    ) : (
                        <>
                            <Sparkles size={24} /> Generate Timetable
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default GenerateTimetable;

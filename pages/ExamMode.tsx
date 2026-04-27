import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Calendar, BookOpen, Clock, AlertTriangle, CheckCircle, ChevronRight, Sparkles, Lock, Brain, Loader, BarChart2, Timer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUsage } from '../contexts/UsageContext';
import { useTasks } from '../contexts/TaskContext';
import { generateExamScheduleWithGemini, analyzeStudyPredictor } from '../services/geminiService';
import { Task } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function ExamMode() {
  const { user } = useAuth();
  const theme = user?.aiSettings?.theme || 'dark';
  
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
  const isCustomTheme = theme === 'custom';
  const { isPro } = useUsage();
  const { tasks, exams, addTask, addExam } = useTasks();
  const navigate = useNavigate();

  const [examDate, setExamDate] = useState('');
  const [subjects, setSubjects] = useState('');
  const [difficultSubjects, setDifficultSubjects] = useState('');
  const [studyHours, setStudyHours] = useState(4);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showESP, setShowESP] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<{
    tasks: Partial<Task>[];
    prioritySubjects: string[];
    dailyFocus: string;
  } | null>(null);

  const [prediction, setPrediction] = useState<{
      suggestion: string;
      weakArea: string;
      prioritySubjects: string[];
  } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  useEffect(() => {
      if (isPro) {
          setIsPredicting(true);
          analyzeStudyPredictor(tasks, exams || [])
              .then(res => setPrediction(res))
              .catch(console.error)
              .finally(() => setIsPredicting(false));
      }
  }, [isPro, tasks, exams]);

  const handleGenerate = async () => {
    if (!isPro) return;
    if (!examDate || !subjects) {
      alert('Please enter exam date and subjects.');
      return;
    }

    setIsGenerating(true);
    try {
      const subjectList = subjects.split(',').map(s => s.trim()).filter(Boolean);
      const diffList = difficultSubjects.split(',').map(s => s.trim()).filter(Boolean);
      
      const plan = await generateExamScheduleWithGemini(
        examDate,
        subjectList,
        diffList,
        studyHours
      );
      
      setGeneratedPlan(plan);
    } catch (error) {
      console.error(error);
      alert('Failed to generate exam schedule. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyPlan = () => {
    if (!generatedPlan) return;
    
    generatedPlan.tasks.forEach(task => {
      addTask(task as Omit<Task, 'id'>);
    });
    
    addExam({
      date: examDate,
      subjects: subjects.split(',').map(s => s.trim()).filter(Boolean),
      difficultSubjects: difficultSubjects.split(',').map(s => s.trim()).filter(Boolean),
      prioritySubjects: generatedPlan.prioritySubjects
    });
    
    alert('Exam study plan added to your schedule!');
    navigate('/tasks');
  };

  // Performance Data Calculation
  const performanceData = useMemo(() => {
    const subjectHours: Record<string, number> = {};
    let completedCount = 0;
    let totalCount = 0;

    tasks.forEach(task => {
      if (task.category === 'School' || task.title.toLowerCase().includes('study') || task.title.toLowerCase().includes('exam') || task.title.toLowerCase().includes('read')) {
        totalCount++;
        if (task.status === 'Completed') {
          completedCount++;
          const hours = task.durationMinutes / 60;
          subjectHours[task.title] = (subjectHours[task.title] || 0) + hours;
        }
      }
    });

    const chartData = Object.keys(subjectHours).map(subject => ({
      name: subject.length > 10 ? subject.substring(0, 10) + '...' : subject,
      hours: Number(subjectHours[subject].toFixed(1))
    })).sort((a, b) => b.hours - a.hours).slice(0, 5); // Top 5 subjects

    const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return { chartData, progressPercentage };
  }, [tasks]);

  // Exam Countdown Calculation
  const upcomingExams = useMemo(() => {
    const now = new Date();
    return (exams || [])
      .map(exam => {
        const examDate = new Date(exam.date);
        const diffTime = examDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...exam, daysRemaining: diffDays };
      })
      .filter(exam => exam.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [exams]);

  if (!isPro) {
    return (
      <div className={`min-h-screen pb-24 ${isCustomTheme ? 'bg-transparent' : isLightTheme ? 'bg-gray-50' : 'bg-[#0f1115]'} ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>
        <div className="p-6 pt-12 text-center">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/20">
            <Lock size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black mb-4">Exam / Focus Mode</h1>
          <p className={`text-lg mb-8 ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>
            Intelligently prepare for exams with AI-generated study timetables, daily focus plans, and priority subject analysis.
          </p>
          <div className={`p-6 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'} mb-8`}>
            <h3 className="font-bold text-xl mb-4 flex items-center justify-center gap-2">
              <Sparkles className="text-yellow-500" /> Pro Feature
            </h3>
            <ul className={`text-left space-y-3 ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-[#2ECC71]" /> AI Study Timetable Generation</li>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-[#2ECC71]" /> Daily Focus Plans</li>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-[#2ECC71]" /> Priority Subject Analysis</li>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-[#2ECC71]" /> Smart Break Allocation</li>
              <li className="flex items-center gap-2"><CheckCircle size={18} className="text-[#2ECC71]" /> Performance Dashboard</li>
            </ul>
          </div>
          <button 
            onClick={() => navigate('/profile')}
            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-transform"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-24 ${isCustomTheme ? 'bg-transparent' : isLightTheme ? 'bg-gray-50' : 'bg-[#0f1115]'} ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>
      <div className="p-6 pt-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Exam Mode</h1>
            <p className={`text-sm ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>AI-optimized study planning</p>
          </div>
        </div>

        {/* AI Study Predictor Section */}
        <div className={`mb-8 p-6 rounded-2xl border ${isLightTheme ? 'bg-indigo-50 border-indigo-100' : 'bg-indigo-900/20 border-indigo-500/30'} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Brain size={100} />
            </div>
            <div className="relative z-10">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-500">
                    <Sparkles size={20} />
                    Tai's Study Predictor
                </h2>
                
                {isPredicting ? (
                    <div className="flex items-center gap-3 text-indigo-500">
                        <Loader size={20} className="animate-spin" />
                        <span className="font-medium text-sm">Analyzing study history & weak areas...</span>
                    </div>
                ) : prediction ? (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-xl ${isLightTheme ? 'bg-white/80' : 'bg-gray-900/50'}`}>
                            <h3 className={`text-sm font-bold mb-1 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>Today's Focus</h3>
                            <p className={`text-sm ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{prediction.suggestion}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${isLightTheme ? 'bg-white/80' : 'bg-gray-900/50'}`}>
                            <h3 className={`text-sm font-bold mb-1 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>Weak Area Detected</h3>
                            <p className="text-sm text-red-500 font-medium">{prediction.weakArea}</p>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>

        {/* Performance Dashboard & Exam Countdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Performance Chart */}
            <div className={`p-6 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <BarChart2 size={20} className="text-indigo-500" />
                    Study Hours per Subject
                </h2>
                {performanceData.chartData.length > 0 ? (
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData.chartData}>
                                <XAxis dataKey="name" stroke={isLightTheme ? '#6b7280' : '#9ca3af'} fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    cursor={{fill: isLightTheme ? '#f3f4f6' : '#374151'}}
                                    contentStyle={{backgroundColor: isLightTheme ? '#fff' : '#1f2937', borderColor: isLightTheme ? '#e5e7eb' : '#374151', borderRadius: '8px'}}
                                />
                                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                                    {performanceData.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : isLightTheme ? '#a5b4fc' : '#4f46e5'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-48 flex items-center justify-center text-sm opacity-50">
                        No study data available yet.
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm font-medium">Overall Study Progress</span>
                    <span className="text-lg font-bold text-indigo-500">{performanceData.progressPercentage}%</span>
                </div>
            </div>

            {/* Exam Countdown */}
            <div className={`p-6 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Timer size={20} className="text-orange-500" />
                    Exam Countdown
                </h2>
                <div className="space-y-4 max-h-56 overflow-y-auto pr-2">
                    {upcomingExams.length > 0 ? (
                        upcomingExams.map((exam, idx) => (
                            <div key={exam.id || idx} className={`p-4 rounded-xl flex justify-between items-center ${isLightTheme ? 'bg-gray-50' : 'bg-gray-900/50'}`}>
                                <div>
                                    <h3 className="font-bold text-sm">{exam.subjects.join(', ')}</h3>
                                    <p className={`text-xs ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>{new Date(exam.date).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-2xl font-black ${exam.daysRemaining <= 3 ? 'text-red-500' : exam.daysRemaining <= 7 ? 'text-orange-500' : 'text-indigo-500'}`}>
                                        {exam.daysRemaining}
                                    </span>
                                    <p className="text-xs font-medium uppercase tracking-wider opacity-60">Days</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex items-center justify-center text-sm opacity-50 py-10">
                            No upcoming exams scheduled.
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* ESP Button */}
        {!showESP && !generatedPlan && (
            <button
                onClick={() => setShowESP(true)}
                className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-transform mb-8"
            >
                <Sparkles size={20} />
                Generate Exam Study Plan (ESP)
            </button>
        )}

        {showESP && !generatedPlan && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Exam Study Plan Generator</h2>
                <button onClick={() => setShowESP(false)} className="text-sm font-medium text-indigo-500 hover:underline">Cancel</button>
            </div>
            <div className={`p-5 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <label className={`block text-sm font-bold mb-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                Exam Date
              </label>
              <div className="relative">
                <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLightTheme ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                    isLightTheme 
                      ? 'bg-gray-50 border-gray-200 text-gray-900' 
                      : 'bg-gray-900/50 border-gray-700 text-white'
                  }`}
                />
              </div>
            </div>

            <div className={`p-5 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <label className={`block text-sm font-bold mb-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                Subjects to Cover (comma separated)
              </label>
              <div className="relative">
                <BookOpen className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLightTheme ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
                <input
                  type="text"
                  placeholder="e.g., Math, Physics, Chemistry"
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                    isLightTheme 
                      ? 'bg-gray-50 border-gray-200 text-gray-900' 
                      : 'bg-gray-900/50 border-gray-700 text-white'
                  }`}
                />
              </div>
            </div>

            <div className={`p-5 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <label className={`block text-sm font-bold mb-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                Difficult Subjects (need more time)
              </label>
              <div className="relative">
                <AlertTriangle className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLightTheme ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
                <input
                  type="text"
                  placeholder="e.g., Physics"
                  value={difficultSubjects}
                  onChange={(e) => setDifficultSubjects(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                    isLightTheme 
                      ? 'bg-gray-50 border-gray-200 text-gray-900' 
                      : 'bg-gray-900/50 border-gray-700 text-white'
                  }`}
                />
              </div>
            </div>

            <div className={`p-5 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <label className={`block text-sm font-bold mb-2 ${isLightTheme ? 'text-gray-700' : 'text-gray-300'}`}>
                Study Hours Per Day
              </label>
              <div className="relative">
                <Clock className={`absolute left-4 top-1/2 -translate-y-1/2 ${isLightTheme ? 'text-gray-400' : 'text-gray-500'}`} size={20} />
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={studyHours}
                  onChange={(e) => setStudyHours(parseInt(e.target.value) || 4)}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${
                    isLightTheme 
                      ? 'bg-gray-50 border-gray-200 text-gray-900' 
                      : 'bg-gray-900/50 border-gray-700 text-white'
                  }`}
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !examDate || !subjects}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                isGenerating || !examDate || !subjects
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.02]'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate Study Plan
                </>
              )}
            </button>
          </div>
        )}

        {generatedPlan && (
          <div className="space-y-6 animate-fade-in">
            <div className={`p-6 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <h2 className="text-xl font-bold mb-2">Daily Focus</h2>
              <p className={`${isLightTheme ? 'text-gray-600' : 'text-gray-300'}`}>{generatedPlan.dailyFocus}</p>
            </div>

            <div className={`p-6 rounded-2xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <h2 className="text-xl font-bold mb-4">Priority Subjects</h2>
              <div className="flex flex-wrap gap-2">
                {generatedPlan.prioritySubjects.map((subject, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 font-medium text-sm">
                    {subject}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold">Generated Tasks ({generatedPlan.tasks.length})</h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {generatedPlan.tasks.map((task, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold">{task.title}</h3>
                      <span className="text-xs px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-500 font-medium">
                        {task.date}
                      </span>
                    </div>
                    <div className={`flex items-center gap-3 text-sm ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span>{task.time}</span>
                      <span>•</span>
                      <span>{task.durationMinutes} min</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setGeneratedPlan(null)}
                className={`flex-1 py-4 rounded-xl font-bold border transition-colors ${
                  isLightTheme 
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50' 
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }`}
              >
                Discard
              </button>
              <button
                onClick={handleApplyPlan}
                className="flex-[2] py-4 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-transform"
              >
                Add to Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

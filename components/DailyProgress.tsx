import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, TaskStatus } from '../types';
import { format } from 'date-fns';
import { Trophy, Star, Sparkles, Target, Zap, Clock, Award, ChevronRight } from 'lucide-react';
import Confetti from 'react-confetti';
import { useActiveTask } from '../contexts/ActiveTaskContext';

interface DailyProgressProps {
  tasks: Task[];
  onCelebrationComplete?: () => void;
}

const DailyProgress: React.FC<DailyProgressProps> = ({ tasks, onCelebrationComplete }) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [prevProgress, setPrevProgress] = useState(0);

  const { triggerVictory } = useActiveTask();

  const currentTime = new Date();
  const currentDayName = format(currentTime, 'EEEE');
  
  const todayTasks = tasks.filter(t => {
    if (t.date) {
      return t.date === format(currentTime, 'yyyy-MM-dd');
    }
    return t.day === currentDayName;
  });

  const validTasks = todayTasks; // include missed tasks to reduce progress
  const completedTodayTasks = validTasks.filter(t => t.status === TaskStatus.COMPLETED);
  
  const todaysProgress = validTasks.length > 0 ? Math.round((completedTodayTasks.length / validTasks.length) * 100) : 0;
  
  const focusTime = completedTodayTasks.reduce((acc, current) => acc + (current.durationMinutes || 0), 0);
  const productivityScore = todaysProgress * 10;

  useEffect(() => {
    if (todaysProgress === 100 && prevProgress < 100 && validTasks.length > 0) {
      setShowCelebration(true);
      triggerVictory();
      const timer = setTimeout(() => {
        setShowCelebration(false);
        setShowSummary(true);
      }, 6000);
      return () => clearTimeout(timer);
    }
    setPrevProgress(todaysProgress);
  }, [todaysProgress, validTasks.length, prevProgress, triggerVictory]);

  return (
    <>
      <AnimatePresence>
      {showCelebration && (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
        >
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={true} numberOfPieces={500} />
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="p-8 rounded-[2rem] flex flex-col items-center gap-6 pointer-events-auto"
          >
            <div className="relative">
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0.6 }}
              >
                <Trophy size={100} className="text-yellow-400 drop-shadow-[0_0_40px_rgba(250,204,21,0.8)]" />
              </motion.div>
              <Sparkles size={40} className="absolute -top-4 -right-4 text-yellow-200 animate-[spin_3s_linear_infinite]" />
            </div>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 drop-shadow-sm"
            >
              Masterpiece!
            </motion.h2>
            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-white/90 text-xl font-medium text-center"
            >
              100% Daily Completion.<br/>You are unstoppable!
            </motion.p>
          </motion.div>
        </motion.div>
      )}

      {showSummary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
              <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-800"
              >
                  <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                          <Target size={32} className="text-yellow-500" />
                      </div>
                  </div>
                  <h3 className="text-2xl font-black text-center mb-6">Daily Achievement</h3>
                  
                  <div className="space-y-4 mb-8">
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                          <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-500">
                                  <Clock size={20} />
                              </div>
                              <span className="font-bold opacity-80">Focus Time</span>
                          </div>
                          <span className="font-black text-lg">{focusTime}m</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                          <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-500">
                                  <Zap size={20} />
                              </div>
                              <span className="font-bold opacity-80">Tasks Done</span>
                          </div>
                          <span className="font-black text-lg">{completedTodayTasks.length} / {validTasks.length}</span>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                          <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-500">
                                  <Award size={20} />
                              </div>
                              <span className="font-bold opacity-80">Prod. Score</span>
                          </div>
                          <span className="font-black text-lg">{productivityScore}</span>
                      </div>
                  </div>

                  <button 
                      onClick={() => {
                          setShowSummary(false);
                          if (onCelebrationComplete) onCelebrationComplete();
                      }}
                      className="w-full py-4 rounded-xl font-black text-white bg-tt-blue hover:bg-blue-600 transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                      Continue <ChevronRight size={18} />
                  </button>
              </motion.div>
          </motion.div>
      )}
      </AnimatePresence>

      <div className="bg-gradient-to-br from-black/5 via-black/5 to-transparent dark:from-white/5 dark:via-white/5 border border-black/5 dark:border-white/5 rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-tt-blue/5 rounded-full blur-[40px] transition-transform duration-700 group-hover:scale-150"></div>
        
        <div className="flex justify-between items-end mb-4 relative z-10">
          <div>
            <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
              <Target size={18} className={todaysProgress === 100 ? "text-tt-green" : "text-tt-blue"} />
              Today's Progress
            </h3>
            <p className="text-sm opacity-60 font-medium mt-1">
              {completedTodayTasks.length} of {validTasks.length} tasks completed
            </p>
          </div>
          <div className="flex items-center gap-2">
            {todaysProgress === 100 && validTasks.length > 0 && (
              <motion.div 
                initial={{ scale: 0, rotate: -45 }} 
                animate={{ scale: 1, rotate: 0 }} 
                className="bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 p-1.5 rounded-full"
              >
                <Star size={20} className="fill-current" />
              </motion.div>
            )}
            <motion.span 
              key={todaysProgress}
              initial={{ opacity: 0.5, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`font-black text-4xl drop-shadow-sm tabular-nums tracking-tighter ${todaysProgress === 100 ? 'text-tt-green' : 'text-tt-blue'}`}
            >
              {todaysProgress}%
            </motion.span>
          </div>
        </div>

        <div className="h-4 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden shadow-inner relative z-10 p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${todaysProgress}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
            className={`h-full rounded-full transition-colors relative flex items-center justify-end pr-2 shadow-sm ${todaysProgress === 100 ? 'bg-gradient-to-r from-tt-green to-emerald-400' : 'bg-gradient-to-r from-tt-blue via-indigo-500 to-purple-500'}`}
          >
            <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_ease-in-out_infinite]"></div>
            {todaysProgress > 10 && <Sparkles size={10} className="text-white/60 drop-shadow-sm opacity-80" />}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default DailyProgress;

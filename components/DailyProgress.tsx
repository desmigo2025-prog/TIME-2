import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, TaskStatus } from '../types';
import { format } from 'date-fns';
import { Trophy, Star, Sparkles, Target } from 'lucide-react';
import Confetti from 'react-confetti';

interface DailyProgressProps {
  tasks: Task[];
  onCelebrationComplete?: () => void;
}

const DailyProgress: React.FC<DailyProgressProps> = ({ tasks, onCelebrationComplete }) => {
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevProgress, setPrevProgress] = useState(0);

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

  useEffect(() => {
    if (todaysProgress === 100 && prevProgress < 100 && validTasks.length > 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => {
        setShowCelebration(false);
        if (onCelebrationComplete) onCelebrationComplete();
      }, 5000);
      return () => clearTimeout(timer);
    }
    setPrevProgress(todaysProgress);
  }, [todaysProgress, validTasks.length, prevProgress, onCelebrationComplete]);

  return (
    <>
      {showCelebration && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={500} />
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="bg-black/80 backdrop-blur-xl border border-yellow-500/50 p-8 rounded-[2rem] flex flex-col items-center gap-4 shadow-[0_0_100px_rgba(234,179,8,0.4)] pointer-events-auto"
          >
            <div className="relative">
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0.6 }}
              >
                <Trophy size={80} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
              </motion.div>
              <Sparkles size={32} className="absolute -top-4 -right-4 text-yellow-200 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500">
              Outstanding Work!
            </h2>
            <p className="text-white/90 text-lg font-medium text-center">
              You crushed your schedule today.<br/>All tasks completed!
            </p>
          </motion.div>
        </div>
      )}

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

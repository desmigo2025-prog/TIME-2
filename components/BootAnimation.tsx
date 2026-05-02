import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Cpu, Bell, GraduationCap, BarChart, Clock } from 'lucide-react';

interface BootAnimationProps {
  onComplete: () => void;
}

const floatingIcons = [
  { Icon: BookOpen, top: '20%', left: '15%', delay: 0.2 },
  { Icon: Calendar, top: '60%', left: '10%', delay: 0.4 },
  { Icon: Cpu, top: '15%', left: '80%', delay: 0.6 },
  { Icon: Bell, top: '70%', left: '85%', delay: 0.8 },
  { Icon: GraduationCap, top: '80%', left: '50%', delay: 1.0 },
  { Icon: BarChart, top: '30%', left: '70%', delay: 1.2 },
  { Icon: Clock, top: '40%', left: '25%', delay: 1.4 },
];

const BootAnimation: React.FC<BootAnimationProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Stage 0: Initial dark
    // Stage 1: Logo & icons appear (0.5s)
    // Stage 2: Slogan typing/fading (1.5s)
    // Stage 3: Fade out (4s)
    // Complete: (5s) // Target duration 3-6 seconds.
    
    const timers = [
      setTimeout(() => setStage(1), 300),
      setTimeout(() => setStage(2), 1500),
      setTimeout(() => setStage(3), 4000),
      setTimeout(() => onComplete(), 5000)
    ];
    
    // Attempting to play a subtle "boot" vibration or light sound if on supported device could be done here
    // but without explicit assets, we skip playing a raw sound to avoid unhandled errors.

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage < 3 && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        >
          {/* Ambient Background Gradient */}
          <motion.div 
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950 opacity-80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2 }}
          />

          {/* Floating Icons */}
          {stage >= 1 && floatingIcons.map((item, i) => (
            <motion.div
              key={i}
              className="absolute text-blue-500/10"
              style={{ top: item.top, left: item.left }}
              initial={{ opacity: 0, y: 50, scale: 0.5, rotate: -20 }}
              animate={{ 
                opacity: [0, 0.4, 0], 
                y: [50, -20, -100],
                scale: [0.5, 1.2, 0.8],
                rotate: [-20, 10, 30]
              }}
              transition={{ 
                duration: 4, 
                delay: item.delay, 
                ease: "linear"
              }}
            >
              <item.Icon size={64} strokeWidth={1} />
            </motion.div>
          ))}

          {/* Core Content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 w-full max-w-lg">
            {/* Logo */}
            {stage >= 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", duration: 1.2, bounce: 0.4 }}
                className="relative mb-8"
              >
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0, 0.5, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-blue-500 blur-[40px] rounded-full" 
                />
                <div className="relative w-28 h-28 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-800 rounded-[2rem] flex items-center justify-center text-white text-5xl font-black shadow-2xl border border-blue-400/30 overflow-hidden group">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                  />
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-blue-200 drop-shadow-lg">
                    TT
                  </span>
                </div>
              </motion.div>
            )}

            {/* Slogans */}
            {stage >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-blue-400">
                      TT APP
                    </h1>
                    <h2 className="text-sm md:text-base font-medium text-blue-200/80 tracking-wide">
                      Smart Timetable & Campus Life Manager
                    </h2>
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="flex items-center justify-center gap-2 text-[10px] sm:text-xs text-blue-400/90 bg-blue-900/30 py-1.5 px-3 rounded-full mx-auto w-fit border border-blue-500/20 shadow-inner"
                >
                  <Cpu size={14} className="text-blue-400" />
                  <span className="uppercase tracking-wider font-semibold">Powered by AI</span>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  className="text-white/50 text-[10px] sm:text-xs font-semibold tracking-[0.2em] sm:tracking-[0.3em] uppercase pt-4"
                >
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>Plan.</motion.span>{" "}
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>Learn.</motion.span>{" "}
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>Focus.</motion.span>{" "}
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} className="text-blue-400/80">Achieve.</motion.span>
                </motion.div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BootAnimation;

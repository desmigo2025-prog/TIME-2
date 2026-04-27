import React from 'react';
import { motion } from 'framer-motion';

export interface AIAvatarProps {
    isSpeaking?: boolean;
    isThinking?: boolean;
    imageUrl?: string | null;
    className?: string;
    isLightTheme?: boolean;
    type?: 'robot' | 'boy' | 'girl';
    emotion?: 'happy' | 'neutral' | 'excited' | 'thinking' | 'serious';
    animation?: 'idle' | 'talking' | 'explaining' | 'greeting' | 'alert';
    viewMode?: 'circle' | 'full';
}

const AIAvatar: React.FC<AIAvatarProps> = ({ 
    isSpeaking = false, 
    isThinking = false, 
    imageUrl, 
    className = '', 
    isLightTheme = false, 
    type = 'girl',
    emotion = 'neutral',
    animation = 'idle',
    viewMode = 'circle'
}) => {
    // Override isThinking/isSpeaking if animation/emotion explicitly set them
    const activeIsSpeaking = isSpeaking || animation === 'talking' || animation === 'explaining' || animation === 'greeting';
    const activeIsThinking = isThinking || emotion === 'thinking';

    // If user provided a custom image, show it instead of the SVG avatar
    if (imageUrl) {
        return (
            <div className={`relative ${className}`}>
                <img 
                    src={imageUrl} 
                    alt="AI Avatar" 
                    className={`w-full h-full ${viewMode === 'circle' ? 'object-cover rounded-full shadow-lg' : 'object-contain drop-shadow-2xl'}`} 
                />
                {activeIsSpeaking && viewMode === 'circle' && (
                    <motion.div 
                        className="absolute inset-0 border-2 border-tt-blue rounded-full"
                        animate={{ 
                            scale: [1, 1.05, 1],
                            opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ 
                            repeat: Infinity, 
                            duration: 1.5,
                            ease: "easeInOut" 
                        }}
                    />
                )}
                {activeIsThinking && !activeIsSpeaking && viewMode === 'circle' && (
                    <motion.div 
                        className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border border-gray-200 shadow-sm"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                    />
                )}
            </div>
        );
    }

    const primaryColor = isLightTheme ? '#0F172A' : '#FFFFFF';
    const secondaryColor = '#3B82F6'; // tt-blue

    // Natural phoneme-based lip sync arrays
    const phonemeA = "M 38 65 Q 50 72 62 65"; // open wide (ah)
    const phonemeE = "M 40 63 Q 50 67 60 63"; // spread (ee)
    const phonemeO = "M 44 60 Q 50 68 56 60"; // round (oh)
    const phonemeM = "M 42 63 Q 50 64 58 63"; // closed (mm)

    const humanMouthSpeaking = {
        d: [ phonemeM, phonemeA, phonemeE, phonemeO, phonemeM, phonemeA, phonemeE, phonemeM ]
    };

    // Idle mouth
    const humanMouthIdle = emotion === 'happy' ? "M 40 63 Q 50 70 60 63" : emotion === 'serious' ? "M 42 64 Q 50 63 58 64" : "M 42 63 Q 50 65 58 63";
    // Thinking mouth (slightly pursed)
    const humanMouthThinking = "M 45 64 Q 50 64 55 64";
    // Excited mouth
    const humanMouthExcited = "M 38 64 Q 50 75 62 64";

    const getMouthPath = () => {
        if (activeIsThinking && !activeIsSpeaking) return humanMouthThinking;
        if (emotion === 'excited') return humanMouthExcited;
        return humanMouthIdle;
    };

    // Subtle head movement
    const headMovement = activeIsSpeaking 
        ? (animation === 'explaining' ? { rotate: [0, -3, 3, 0], y: [0, -2, 2, 0], x: [0, -1, 1, 0] } : { rotate: [0, -2, 2, 0], y: [0, -1, 1, 0] })
        : activeIsThinking 
        ? { rotate: [0, 5, 0], y: [0, -2, 0] }
        : emotion === 'excited' ? { y: [0, -3, 0], scale: [1, 1.05, 1] }
        : { rotate: [0, 1, -1, 0], y: [0, 0.5, -0.5, 0] };

    const bodyMovement = activeIsSpeaking
        ? { y: [0, -1, 1, 0], rotate: [0, 0.5, -0.5, 0] }
        : emotion === 'excited' ? { y: [0, -4, 0, -2, 0], scale: [1, 1.02, 1, 1.01, 1] }
        : emotion === 'thinking' ? { x: [-1, 1, -1, 0], rotate: [0, -1, 1, 0] }
        : emotion === 'serious' ? { y: [0, 0.5, 0] }
        : { y: [0, 0.2, -0.2, 0] };

    const armMovementRight = activeIsSpeaking && animation === 'explaining'
        ? { rotate: [0, -45, 0], x: [0, 2, 0] }
        : emotion === 'excited' ? { rotate: [0, -20, 0], scale: [1, 1.1, 1] }
        : { rotate: [0, 5, 0] };
    
    const armMovementLeft = activeIsSpeaking && animation === 'explaining'
        ? { rotate: [0, 45, 0], x: [0, -2, 0] }
        : emotion === 'excited' ? { rotate: [0, 20, 0], scale: [1, 1.1, 1] }
        : { rotate: [0, -5, 0] };

    const headTransition = activeIsSpeaking 
        ? { repeat: Infinity, duration: animation === 'explaining' ? 3.5 : 2.5, ease: "easeInOut" as any }
        : activeIsThinking
        ? { repeat: Infinity, duration: 3, ease: "easeInOut" as any }
        : emotion === 'excited' ? { repeat: Infinity, duration: 0.6, ease: "easeInOut" as any }
        : { repeat: Infinity, duration: 5, ease: "easeInOut" as any };

    const renderBoy = () => (
        <svg viewBox={viewMode === 'full' ? "0 0 100 200" : "0 0 100 100"} className="w-full h-full z-10 block drop-shadow-md overflow-visible">
            <defs>
                <linearGradient id="skinBase" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fcdbb4" />
                    <stop offset="100%" stopColor="#ecb481" />
                </linearGradient>
                <linearGradient id="hairBoy" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4A3B32" />
                    <stop offset="100%" stopColor="#2D231E" />
                </linearGradient>
                <linearGradient id="shirtBoy" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1E293B" />
                    <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
            </defs>
            
            <motion.g animate={bodyMovement} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
                {viewMode === 'full' ? (
                    <>
                        {/* Legs */}
                        <rect x="35" y="140" width="12" height="55" fill="#1E293B" rx="4" />
                        <rect x="53" y="140" width="12" height="55" fill="#1E293B" rx="4" />
                        {/* Shoes */}
                        <rect x="32" y="190" width="16" height="8" fill="#000000" rx="2" />
                        <rect x="52" y="190" width="16" height="8" fill="#000000" rx="2" />
                        {/* Arms */}
                        <motion.rect x="18" y="80" width="12" height="50" fill="url(#shirtBoy)" rx="6" animate={armMovementLeft} style={{ transformOrigin: '24px 85px' }} />
                        <motion.rect x="70" y="80" width="12" height="50" fill="url(#shirtBoy)" rx="6" animate={armMovementRight} style={{ transformOrigin: '76px 85px' }} />
                        {/* Torso */}
                        <rect x="30" y="80" width="40" height="70" fill="url(#shirtBoy)" rx="10" />
                        <path d="M 40 80 L 50 100 L 60 80 Z" fill="#FFFFFF" /> {/* Shirt segment */}
                        <path d="M 48 100 L 52 100 L 50 120 Z" fill="#EF4444" /> {/* Tie */}
                    </>
                ) : (
                    <>
                        <path d="M 20 100 Q 50 70 80 100 Z" fill="url(#shirtBoy)" />
                        <path d="M 40 100 L 50 85 L 60 100 Z" fill="#FFFFFF" /> 
                        <path d="M 48 85 L 52 85 L 50 100 Z" fill="#EF4444" />
                    </>
                )}

                <motion.g animate={headMovement} transition={headTransition} style={{ transformOrigin: '50% 60%' }} transform={viewMode === 'full' ? "translate(0, 5)" : ""}>
                    {/* Head & Neck */}
                    <rect x="42" y={viewMode === 'full' ? "65" : "62"} width="16" height="15" fill="#d99f71" rx="4" />
                    <rect x="30" y={viewMode === 'full' ? "25" : "20"} width="40" height="48" rx="20" fill="url(#skinBase)" />
                    <path d={viewMode === 'full' ? "M 28 40 Q 50 15 72 40 Q 75 25 50 15 Q 25 25 28 40 Z" : "M 28 35 Q 50 10 72 35 Q 75 20 50 10 Q 25 20 28 35 Z"} fill="url(#hairBoy)" />
                    <path d={viewMode === 'full' ? "M 28 40 Q 35 25 45 35 Q 55 25 65 35 Q 75 25 72 40 Z" : "M 28 35 Q 35 20 45 30 Q 55 20 65 30 Q 75 20 72 35 Z"} fill="url(#hairBoy)" />
                    
                    {/* Face Details */}
                    <rect x="34" y={viewMode === 'full' ? "47" : "42"} width="14" height="10" rx="2" fill="none" stroke="#1E293B" strokeWidth="1.5" />
                    <rect x="52" y={viewMode === 'full' ? "47" : "42"} width="14" height="10" rx="2" fill="none" stroke="#1E293B" strokeWidth="1.5" />
                    <line x1="48" y1={viewMode === 'full' ? "52" : "47"} x2="52" y2={viewMode === 'full' ? "52" : "47"} stroke="#1E293B" strokeWidth="1.5" />
                    <motion.circle cx="41" cy={viewMode === 'full' ? "52" : "47"} r="2.5" fill="#1E293B" />
                    <motion.circle cx="59" cy={viewMode === 'full' ? "52" : "47"} r="2.5" fill="#1E293B" />
                    {/* Mouth */}
                    {activeIsSpeaking ? (
                        <motion.path d={phonemeM} stroke="#b35b5b" strokeWidth="2.5" strokeLinecap="round" fill="none" transform={viewMode === 'full' ? "translate(0, 5)" : ""}
                            animate={humanMouthSpeaking} transition={{ repeat: Infinity, duration: 1.2, times: [0, 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1], ease: "linear" }} />
                    ) : (
                        <motion.path d={getMouthPath()} stroke="#c08c62" strokeWidth="2" strokeLinecap="round" fill="none" transform={viewMode === 'full' ? "translate(0, 5)" : ""} animate={{ d: getMouthPath() }} />
                    )}
                </motion.g>
            </motion.g>
        </svg>
    );

    const renderGirl = () => (
        <svg viewBox={viewMode === 'full' ? "0 0 100 200" : "0 0 100 100"} className="w-full h-full z-10 block drop-shadow-md overflow-visible">
            <defs>
                <linearGradient id="skinGirl" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffe0c8" />
                    <stop offset="100%" stopColor="#f0b691" />
                </linearGradient>
                <linearGradient id="hairGirl" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4A3B32" />
                    <stop offset="100%" stopColor="#2D231E" />
                </linearGradient>
                <linearGradient id="shirtGirl" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#0369A1" />
                </linearGradient>
            </defs>

            <motion.g animate={bodyMovement} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
                {viewMode === 'full' ? (
                    <>
                        {/* Legs */}
                        <rect x="38" y="140" width="10" height="55" fill="#f0b691" rx="4" />
                        <rect x="52" y="140" width="10" height="55" fill="#f0b691" rx="4" />
                        {/* Skirt */}
                        <path d="M 30 140 L 70 140 L 80 170 L 20 170 Z" fill="#0369A1" />
                        {/* Arms */}
                        <motion.rect x="22" y="80" width="10" height="45" fill="#f0b691" rx="5" animate={armMovementLeft} style={{ transformOrigin: '27px 85px' }} />
                        <motion.rect x="68" y="80" width="10" height="45" fill="#f0b691" rx="5" animate={armMovementRight} style={{ transformOrigin: '73px 85px' }} />
                        {/* Torso */}
                        <rect x="32" y="80" width="36" height="65" fill="url(#shirtGirl)" rx="10" />
                    </>
                ) : (
                    <>
                        <path d="M 22 100 Q 50 75 78 100 Z" fill="url(#shirtGirl)" />
                        <path d="M 40 100 Q 50 85 60 100 Z" fill="#FFFFFF" opacity="0.9" />
                    </>
                )}

                <motion.g animate={headMovement} transition={headTransition} style={{ transformOrigin: '50% 60%' }} transform={viewMode === 'full' ? "translate(0, 5)" : ""}>
                    {/* Head & Neck */}
                    <rect x="44" y={viewMode === 'full' ? "65" : "62"} width="12" height="15" fill="#d99f71" rx="4" />
                    <rect x="32" y={viewMode === 'full' ? "28" : "24"} width="36" height="44" rx="18" fill="url(#skinGirl)" />
                    
                    {/* Hair */}
                    <path d={viewMode === 'full' ? "M 20 44 Q 50 4 80 44 L 80 84 Q 50 94 20 84 Z" : "M 20 40 Q 50 0 80 40 L 80 80 Q 50 90 20 80 Z"} fill="url(#hairGirl)" />
                    <path d={viewMode === 'full' ? "M 30 42 Q 50 22 70 42 Q 65 26 50 26 Q 35 26 30 42 Z" : "M 30 38 Q 50 18 70 38 Q 65 22 50 22 Q 35 22 30 38 Z"} fill="url(#hairGirl)" />
                    
                    {/* Eyes & Mouth */}
                    <motion.circle cx="41" cy={viewMode === 'full' ? "51" : "46"} r="2.5" fill="#1E293B" />
                    <motion.circle cx="59" cy={viewMode === 'full' ? "51" : "46"} r="2.5" fill="#1E293B" />
                    {activeIsSpeaking ? (
                        <motion.path d={phonemeM} stroke="#D946EF" strokeWidth="2.5" strokeLinecap="round" fill="none" transform={viewMode === 'full' ? "translate(0, 5)" : ""}
                            animate={humanMouthSpeaking} transition={{ repeat: Infinity, duration: 1.1, times: [0, 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 1], ease: "linear" }} />
                    ) : (
                        <motion.path d={getMouthPath()} stroke="#d59972" strokeWidth="2" strokeLinecap="round" fill="none" transform={viewMode === 'full' ? "translate(0, 5)" : ""} animate={{ d: getMouthPath() }} />
                    )}
                </motion.g>
            </motion.g>
        </svg>
    );

    const renderRobot = () => (
        <svg viewBox={viewMode === 'full' ? "0 0 100 200" : "0 0 100 100"} className="w-full h-full z-10 block drop-shadow-md overflow-visible">
            <motion.g animate={bodyMovement} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
                {viewMode === 'full' ? (
                    <>
                        {/* Robot Legs */}
                        <rect x="35" y="130" width="12" height="60" fill={isLightTheme ? '#E2E8F0' : '#334155'} stroke={primaryColor} strokeWidth="3" rx="4" />
                        <rect x="53" y="130" width="12" height="60" fill={isLightTheme ? '#E2E8F0' : '#334155'} stroke={primaryColor} strokeWidth="3" rx="4" />
                        {/* Wheels/Feet */}
                        <circle cx="41" cy="190" r="8" fill={primaryColor} />
                        <circle cx="59" cy="190" r="8" fill={primaryColor} />
                        {/* Robot Arms */}
                        <motion.rect x="15" y="70" width="10" height="50" fill={primaryColor} rx="5" animate={armMovementLeft} style={{ transformOrigin: '20px 75px' }} />
                        <motion.rect x="75" y="70" width="10" height="50" fill={primaryColor} rx="5" animate={armMovementRight} style={{ transformOrigin: '80px 75px' }} />
                        {/* Robot Torso */}
                        <rect x="25" y="70" width="50" height="70" fill={isLightTheme ? '#FFFFFF' : '#1E293B'} stroke={primaryColor} strokeWidth="4" rx="10" />
                        {/* Screen details */}
                        <rect x="35" y="85" width="30" height="20" fill={secondaryColor} opacity="0.2" rx="2" />
                    </>
                ) : null}

                <motion.g animate={headMovement} transition={headTransition} style={{ transformOrigin: '50% 50%' }} transform={viewMode === 'full' ? "translate(0, 25)" : ""}>
                    <rect x="25" y="30" width="50" height="45" rx="15" fill={isLightTheme ? '#FFFFFF' : '#1E293B'} stroke={primaryColor} strokeWidth="4" />
                    <line x1="50" y1="30" x2="50" y2="15" stroke={primaryColor} strokeWidth="4" strokeLinecap="round" />
                    <motion.circle cx="50" cy="12" r="4" fill={activeIsSpeaking ? secondaryColor : activeIsThinking ? '#F59E0B' : primaryColor} 
                        animate={activeIsThinking ? { opacity: [0.5, 1, 0.5] } : {}}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                    />
                    <circle cx="40" cy="45" r="4" fill={primaryColor} />
                    <circle cx="60" cy="45" r="4" fill={primaryColor} />
                    {activeIsSpeaking ? (
                        <motion.path d="M 40 60 Q 50 70 60 60" stroke={secondaryColor} strokeWidth="4" strokeLinecap="round" fill="none"
                            animate={{ d: [ "M 40 60 Q 50 70 60 60", "M 42 62 Q 50 65 58 62", "M 40 58 Q 50 68 60 58", "M 45 61 Q 50 63 55 61", "M 38 60 Q 50 72 62 60" ] }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }} />
                    ) : (
                        <path d={activeIsThinking ? "M 45 62 Q 50 62 55 62" : "M 42 62 Q 50 65 58 62"} stroke={primaryColor} strokeWidth="3" strokeLinecap="round" fill="none" />
                    )}
                </motion.g>
            </motion.g>
        </svg>
    );

    let content = null;
    let bgColorClass = '';
    
    if (type === 'boy') {
        content = renderBoy();
        bgColorClass = isLightTheme ? 'bg-gradient-to-br from-indigo-100 to-blue-50' : 'bg-gradient-to-br from-gray-800 to-gray-900';
    } else if (type === 'girl') {
        content = renderGirl();
        bgColorClass = isLightTheme ? 'bg-gradient-to-br from-pink-100 to-rose-50' : 'bg-gradient-to-br from-gray-800 to-gray-900';
    } else {
        content = renderRobot();
        bgColorClass = isLightTheme ? 'bg-gradient-to-br from-cyan-100 to-blue-50' : 'bg-gradient-to-br from-gray-800 to-gray-900';
    }

    return (
        <div className={`relative overflow-visible flex items-center justify-center ${viewMode === 'circle' ? `rounded-full p-1 border border-black/5 dark:border-white/5 ${bgColorClass}` : ''} ${className}`}>
            {viewMode === 'circle' && activeIsSpeaking && (
                <motion.div 
                    className={`absolute inset-0 rounded-full ${type === 'robot' ? 'bg-tt-blue/20' : 'bg-white/30 dark:bg-black/30'}`}
                    animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                />
            )}
            {viewMode === 'circle' && activeIsThinking && !activeIsSpeaking && (
                <motion.div 
                    className="absolute inset-0 bg-yellow-500/10 rounded-full"
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
            )}
            {content}
        </div>
    );
};

export default AIAvatar;

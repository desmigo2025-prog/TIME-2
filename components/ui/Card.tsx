import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, style }) => {
  return (
    <div 
      onClick={onClick}
      style={style}
      className={`glass-panel p-6 rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(59,130,246,0.15)] transition-all duration-300 ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-brand-surface p-6 rounded-lg shadow-sm border border-brand-border ${className}`}>
      {children}
    </div>
  );
};

export default Card;
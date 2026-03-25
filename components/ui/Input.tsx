import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  const baseClasses = 'bg-gray-50 border border-brand-border text-brand-text-primary placeholder-brand-text-secondary text-sm rounded-md focus:ring-brand-yellow focus:border-brand-yellow block w-full p-2.5';
  
  return <input className={`${baseClasses} ${className}`} {...props} />;
};

export default Input;
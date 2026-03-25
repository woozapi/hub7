import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-md font-semibold text-sm transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-brand-yellow text-brand-text-primary hover:bg-brand-yellow-dark',
    secondary: 'bg-gray-100 text-brand-text-primary hover:bg-gray-200 border border-brand-border',
    ghost: 'bg-transparent text-brand-text-secondary hover:bg-gray-100',
    success: 'bg-brand-green text-white hover:bg-emerald-600'
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
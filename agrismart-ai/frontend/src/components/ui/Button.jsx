import React from 'react';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

export function Button({ 
  className, variant = 'primary', size = 'md', 
  loading = false, disabled, children, ...props 
}) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500";
  
  const variants = {
    primary: "bg-green-700 text-white hover:bg-green-900 active:bg-green-900",
    secondary: "bg-green-100 text-green-700 hover:bg-green-300",
    danger: "bg-red-500 text-white hover:bg-red-700 active:bg-red-700",
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], (disabled || loading) && "opacity-50 cursor-not-allowed", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" className="mr-2 border-current" />}
      {children}
    </button>
  );
}

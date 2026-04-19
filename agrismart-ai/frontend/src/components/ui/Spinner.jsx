import React from 'react';
import { cn } from '@/utils/cn';

export function Spinner({ size = 'md', className }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={cn(
        "rounded-full animate-spin border-transparent border-t-green-500 border-l-green-500",
        sizes[size],
        className
      )}
    />
  );
}

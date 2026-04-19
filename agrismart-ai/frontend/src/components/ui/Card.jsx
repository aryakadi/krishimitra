import React from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, children, hover = true, ...props }) {
  return (
    <div
      className={cn(
        "bg-bg-card border border-border-color shadow-sm rounded-md p-6",
        hover && "hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

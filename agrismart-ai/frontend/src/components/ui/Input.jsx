import React from 'react';
import { cn } from '@/utils/cn';

export function Input({ label, error, className, id, ...props }) {
  const inputId = id || label?.replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "px-3 py-2 border rounded-md bg-white text-text-primary placeholder:text-text-muted",
          "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500",
          error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-border-color",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

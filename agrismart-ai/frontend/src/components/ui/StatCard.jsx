import React from 'react';
import { Card } from './Card';

export function StatCard({ icon, label, value, trend }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl text-text-primary">{value}</h3>
          {trend && (
            <span className={`text-sm ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {trend}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

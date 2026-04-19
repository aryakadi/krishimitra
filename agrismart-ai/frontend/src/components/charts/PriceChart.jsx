import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PriceChart({ data }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(item => {
    // Attempt to extract the first/average number from a string like "₹4500 - ₹5000"
    const matches = item.predicted_price.match(/\d+/g);
    const avgPrice = matches ? matches.reduce((acc, val) => acc + parseInt(val), 0) / matches.length : 0;
    return {
      name: item.month,
      price: avgPrice,
      displayPrice: item.predicted_price,
      trend: item.trend
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-border-color shadow-md rounded-md">
          <p className="font-semibold text-text-primary">{label}</p>
          <p className="text-green-700 font-medium">{dataPoint.displayPrice}</p>
          <p className="text-sm text-text-muted mt-1 capitalize trend">Trend: {dataPoint.trend}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2ece6" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#5a7a65', fontSize: 12 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5a7a65', fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#52b788" 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#52b788' }} 
            activeDot={{ r: 6, fill: '#2d6a4f', stroke: '#fff', strokeWidth: 2 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

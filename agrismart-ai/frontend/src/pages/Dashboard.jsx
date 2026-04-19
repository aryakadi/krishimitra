import React from 'react';
import { Link } from 'react-router-dom';
import { Sprout, Bug, TrendingUp, IndianRupee, MessageSquare, Lightbulb, Activity, FileText } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';

export default function Dashboard() {
  const features = [
    {
      name: 'Crop Advisor',
      description: 'Get AI-powered crop recommendations based on your soil NPK, pH, and local weather conditions.',
      icon: Sprout,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      path: '/crop'
    },
    {
      name: 'Disease Detect',
      description: 'Upload a picture of a diseased plant leaf, and let our AI diagnose it and suggest immediate treatments.',
      icon: Bug,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      path: '/disease'
    },
    {
      name: 'Yield Predict',
      description: 'Estimate your expected harvest based on crop type, area, season, and inputs using predictive modeling.',
      icon: TrendingUp,
      color: 'text-sky-600',
      bgColor: 'bg-sky-100',
      path: '/yield'
    },
    {
      name: 'Market Price',
      description: 'Check current market rates and get AI forecasts to decide the best time window to sell your produce.',
      icon: IndianRupee,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      path: '/market'
    },
    {
      name: 'AI Chatbot',
      description: 'Your 24/7 multilingual virtual assistant. Ask any questions about farming, schemes, or techniques.',
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      path: '/chat'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-4xl text-text-primary mb-2">🌾 Welcome to AgriSmart AI</h1>
        <p className="text-text-secondary text-lg">AI-powered farming decisions — in your language.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Activity />} label="Crops Analyzed" value="12,450" trend="+14% this month" />
        <StatCard icon={<Bug />} label="Diseases Detected" value="3,892" trend="+5% this week" />
        <StatCard icon={<TrendingUp />} label="Predictions Made" value="8,104" trend="+22% this month" />
        <StatCard icon={<MessageSquare />} label="Chats Today" value="456" trend="Active now" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, i) => (
          <Card key={i} className="flex flex-col h-full border-transparent hover:border-green-300 transition-colors">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-xl ${feature.bgColor} ${feature.color}`}>
                <feature.icon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl text-text-primary">{feature.name}</h3>
                <p className="text-text-secondary mt-1 line-clamp-2">{feature.description}</p>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-border-color">
              <Link 
                to={feature.path}
                className="text-green-700 font-medium hover:text-green-900 flex items-center gap-2 group"
              >
                Try Now 
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-green-100 rounded-lg p-5 flex items-start gap-4 border border-green-200">
        <div className="p-2 bg-green-200 rounded-full text-green-700 shrink-0">
          <Lightbulb className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-semibold text-green-900 mb-1">Tip of the Day</h4>
          <p className="text-green-800 text-sm">
            Applying organic mulch to your soil surface helps retain moisture during peak summer months, 
            reducing water consumption by up to 30% while eventually decomposing to improve soil health!
          </p>
        </div>
      </div>
    </div>
  );
}

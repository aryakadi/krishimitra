import React from 'react';
import { NavLink } from 'react-router-dom';
import { Leaf, Home, Sprout, Bug, TrendingUp, IndianRupee, MessageSquare, LayoutDashboard } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLanguage } from '@/hooks/useLanguage';

export function Sidebar() {
  const { t } = useLanguage();

  const navItems = [
    { name: t('dashboard'), path: '/', icon: Home },
    { name: t('cropAdvisor'), path: '/crop', icon: Sprout },
    { name: t('diseaseDetect'), path: '/disease', icon: Bug },
    { name: t('yieldPredict'), path: '/yield', icon: TrendingUp },
    { name: t('marketPrice'), path: '/market', icon: IndianRupee },
    { name: t('aiChatbot'), path: '/chat', icon: MessageSquare },
    { name: t('analytics'), path: '/analytics', icon: LayoutDashboard },
  ];

  return (
    <aside className="w-16 md:w-60 bg-green-900 text-white flex flex-col transition-all duration-300 z-20">
      <div className="p-4 flex items-center gap-3">
        <Leaf className="w-8 h-8 text-green-300 flex-shrink-0" />
        <h1 className="font-sora text-xl font-bold hidden md:block whitespace-nowrap">AgriSmart AI</h1>
      </div>

      <nav className="flex-1 mt-6 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-3 rounded-md transition-colors",
              "hover:bg-green-700/50 group relative",
              isActive ? "bg-green-700 border-l-4 border-green-300" : "border-l-4 border-transparent"
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block font-medium">{item.name}</span>
            <div className="absolute left-full ml-2 w-max px-2 py-1 bg-gray-800 text-xs rounded opacity-0 invisible md:hidden group-hover:opacity-100 group-hover:visible z-50">
              {item.name}
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 text-xs text-green-300 text-center hidden md:block border-t border-green-800 mt-auto">
        {t('v_ece')}
      </div>
    </aside>
  );
}

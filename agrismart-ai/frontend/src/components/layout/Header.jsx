import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

export function Header() {
  const location = { pathname: useLocation().pathname };
  const { language, setLanguage, t } = useLanguage();

  const routeNames = {
    '/': t('welcome'),
    '/crop': t('cropAdvisor'),
    '/disease': t('diseaseDetect'),
    '/yield': t('yieldPredict'),
    '/market': t('marketPrice'),
    '/chat': t('aiChatbot'),
    '/analytics': t('analytics')
  };
  
  const pageTitle = routeNames[location.pathname] || 'AgriSmart AI';

  return (
    <header className="bg-white border-b border-border-color h-16 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center">
        <h2 className="font-sora text-lg font-semibold text-text-primary hidden md:block">
          {pageTitle}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Language Switcher */}
        <div className="flex items-center bg-gray-100 rounded-md p-1">
          {[
            { code: 'en', label: 'EN' },
            { code: 'hi', label: 'हिं' },
            { code: 'mr', label: 'मर' }
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1 text-sm font-medium rounded ${
                language === lang.code 
                  ? 'bg-white text-green-700 shadow-sm' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <button className="p-2 text-text-muted hover:text-green-700 hover:bg-green-50 rounded-full transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </header>
  );
}

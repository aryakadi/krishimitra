import { useState, useEffect } from 'react';

const STORAGE_KEY = 'agrismart_lang';
const EVENT_NAME = 'agrismart_lang_change';

export function useLanguage() {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  });

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.detail) {
        setLanguageState(e.detail);
      }
    };
    window.addEventListener(EVENT_NAME, handleStorageChange);
    return () => window.removeEventListener(EVENT_NAME, handleStorageChange);
  }, []);

  const setLanguage = (newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang);
    setLanguageState(newLang);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newLang }));
  };

  const langLabel = {
    en: 'English',
    hi: 'हिंदी',
    mr: 'मराठी'
  }[language];

  return { language, setLanguage, langLabel };
}

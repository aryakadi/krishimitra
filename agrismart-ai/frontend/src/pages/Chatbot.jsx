import React, { useState, useRef, useEffect } from 'react';
import { Send, Leaf, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { sendChat } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

export default function Chatbot() {
  const { language, t } = useLanguage();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    { role: 'assistant', content: "🌾 Namaste! I'm AgriBot, your farming assistant. Ask me anything about crops, diseases, weather, or government schemes!", suggestions: ["Tell me about PM-KISAN scheme", "Best crops for black soil in summer", "How to manage whitefly in cotton?"] }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSend = async (textOverride) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMsg = { role: 'user', content: textToSend };
    // Keep last 10 messages for context, excluding suggestions array from history sent to API
    const contextHistory = history.map(({role, content}) => ({role, content})).slice(-10);
    
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChat({
        message: textToSend,
        history: contextHistory,
        language,
        context: "Chatbot Page"
      });
      
      setHistory(prev => [
        ...prev, 
        { role: 'assistant', content: res.reply, suggestions: res.suggestions }
      ]);
    } catch (err) {
      console.error(err);
      setHistory(prev => [
        ...prev, 
        { role: 'assistant', content: "Sorry, I am having trouble connecting right now. Please try again later." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setHistory([history[0]]); // keep just the initial greeting
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-140px)] p-0 overflow-hidden relative">
      <div className="bg-green-50 border-b border-border-color p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-green-600 p-2 rounded-full text-white">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-sora font-semibold text-green-900 leading-tight">{t('chatTitle')}</h2>
            <p className="text-xs text-green-700">{t('chatSub')}</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="text-sm text-text-muted hover:text-green-700 transition-colors"
        >
          {t('clearChat')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6 bg-gray-50/50">
        {history.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0 mt-auto mb-1">
                {msg.role === 'user' ? (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                    <User className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200 shadow-sm">
                    <Leaf className="w-4 h-4" />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col">
                <div 
                  className={`p-3.5 shadow-sm text-sm md:text-base ${
                    msg.role === 'user' 
                      ? 'bg-green-700 text-white rounded-[18px_18px_4px_18px]' 
                      : 'bg-white border border-border-color text-text-primary rounded-[18px_18px_18px_4px]'
                  }`}
                >
                  {msg.content}
                </div>
                
                {msg.suggestions && msg.suggestions.length > 0 && msg.role === 'assistant' && index === history.length - 1 && (
                  <div className="flex flex-wrap gap-2 mt-3 ml-2">
                    {msg.suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(sug)}
                        className="bg-white hover:bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-1.5 rounded-full shadow-sm transition-colors text-left"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200 shadow-sm mt-auto mb-1 shrink-0">
               <Leaf className="w-4 h-4" />
             </div>
             <div className="bg-white border border-border-color p-4 rounded-[18px_18px_18px_4px] shadow-sm flex gap-1">
               <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
               <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
               <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-border-color p-4">
        <form 
          className="flex gap-2 relative max-w-4xl mx-auto"
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        >
          <input
            type="text"
            className="flex-1 border border-border-color rounded-full px-5 py-3 pr-12 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm bg-gray-50"
            placeholder={t('chatPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1.5 bottom-1.5 aspect-square bg-green-700 text-white rounded-full flex items-center justify-center hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Card>
  );
}

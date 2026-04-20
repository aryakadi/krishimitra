import React, { useState, useRef, useEffect } from 'react';
import { Send, Leaf, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { sendChat } from '@/api/agriApi';
import { useLanguage } from '@/hooks/useLanguage';

// ---------------------------------------------------------------------------
// Lightweight markdown → JSX renderer (no external library needed)
// Handles: ##/### headings, **bold**, *italic*, `code`, bullet lists,
//          numbered lists, horizontal rules, and plain paragraphs.
// Asterisks are NEVER shown to the user.
// ---------------------------------------------------------------------------
function renderInline(text, keyPrefix = '') {
  // Process inline: **bold**, *italic*, `code`
  const parts = [];
  // Combined regex: captures **bold**, *italic* (not **), `code`
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // **bold**
      parts.push(
        <strong key={`${keyPrefix}-b-${i}`} style={{ fontWeight: 700 }}>
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={`${keyPrefix}-i-${i}`} style={{ fontStyle: 'italic', color: '#374151' }}>
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      // `code`
      parts.push(
        <code
          key={`${keyPrefix}-c-${i}`}
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '4px',
            padding: '1px 5px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '0.85em',
            color: '#15803d',
          }}
        >
          {match[6]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}

function renderMessage(rawText) {
  if (!rawText) return null;

  const lines = rawText.split('\n');
  const elements = [];
  let listBuffer = [];   // pending list items
  let listType = null;   // 'ul' | 'ol'
  let keyIdx = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    elements.push(
      <Tag
        key={`list-${keyIdx++}`}
        style={{
          margin: '6px 0 6px 0',
          paddingLeft: '1.4em',
          listStyleType: listType === 'ol' ? 'decimal' : 'disc',
          lineHeight: 1.65,
        }}
      >
        {listBuffer.map((item, i) => (
          <li key={i} style={{ marginBottom: '3px', color: '#1f2937' }}>
            {renderInline(item, `li-${keyIdx}-${i}`)}
          </li>
        ))}
      </Tag>
    );
    listBuffer = [];
    listType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // --- Blank line ---
    if (line.trim() === '') {
      flushList();
      // Add a small spacer only if it's not the very first/last element
      if (elements.length > 0) {
        elements.push(<div key={`sp-${keyIdx++}`} style={{ height: '6px' }} />);
      }
      continue;
    }

    // --- Horizontal rule ---
    if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(line.trim())) {
      flushList();
      elements.push(
        <hr key={`hr-${keyIdx++}`} style={{ border: 'none', borderTop: '1px solid #d1fae5', margin: '10px 0' }} />
      );
      continue;
    }

    // --- H2 heading: ## ---
    if (/^##\s/.test(line)) {
      flushList();
      const text = line.replace(/^##\s+/, '');
      elements.push(
        <p
          key={`h2-${keyIdx++}`}
          style={{
            fontWeight: 700,
            fontSize: '1.05em',
            color: '#14532d',
            marginTop: '10px',
            marginBottom: '3px',
            borderBottom: '1px solid #d1fae5',
            paddingBottom: '3px',
            letterSpacing: '0.01em',
          }}
        >
          {renderInline(text, `h2-${keyIdx}`)}
        </p>
      );
      continue;
    }

    // --- H3 heading: ### ---
    if (/^###\s/.test(line)) {
      flushList();
      const text = line.replace(/^###\s+/, '');
      elements.push(
        <p
          key={`h3-${keyIdx++}`}
          style={{
            fontWeight: 600,
            fontSize: '0.97em',
            color: '#166534',
            marginTop: '8px',
            marginBottom: '2px',
            letterSpacing: '0.01em',
          }}
        >
          {renderInline(text, `h3-${keyIdx}`)}
        </p>
      );
      continue;
    }

    // --- Bullet list: - item or * item ---
    const bulletMatch = line.match(/^[\-\*]\s+(.+)$/);
    if (bulletMatch) {
      if (listType !== null && listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(bulletMatch[1].trim());
      continue;
    }

    // --- Numbered list: 1. item ---
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (listType !== null && listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(numberedMatch[1].trim());
      continue;
    }

    // --- Regular paragraph ---
    flushList();
    elements.push(
      <p
        key={`p-${keyIdx++}`}
        style={{ margin: '2px 0', lineHeight: 1.7, color: '#1f2937' }}
      >
        {renderInline(line.trim(), `p-${keyIdx}`)}
      </p>
    );
  }

  flushList(); // flush any remaining list
  return <div style={{ fontSize: '0.93rem' }}>{elements}</div>;
}

// ---------------------------------------------------------------------------
// Typewriter Effect Component
// ---------------------------------------------------------------------------
function TypewriterMessage({ content, isLast }) {
  const [displayedContent, setDisplayedContent] = useState('');

  useEffect(() => {
    if (!isLast || !content) {
      setDisplayedContent(content);
      return;
    }

    let i = 0;
    let currentText = '';
    const speed = 12; // ms per char delay (adjust to increase/decrease latency)

    setDisplayedContent('');

    const timer = setInterval(() => {
      currentText = content.substring(0, i);
      setDisplayedContent(currentText);
      i += 3; // Render 3 characters at a time for smooth but visible typing
      if (i > content.length + 3) {
        setDisplayedContent(content);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [content, isLast]);

  return renderMessage(displayedContent);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Chatbot() {
  const { language, t } = useLanguage();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    {
      role: 'assistant',
      content: "🌾 Namaste! I'm **AgriBot**, your farming assistant. Ask me anything about crops, diseases, weather, or government schemes!",
      suggestions: ["Tell me about PM-KISAN scheme", "Best crops for black soil in summer", "How to manage whitefly in cotton?"]
    }
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
    const contextHistory = history.map(({ role, content }) => ({ role, content })).slice(-10);

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

      const data = res.data;

      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || "Sorry, I couldn't generate a response. Please try again.",
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : []
        }
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
    setHistory([history[0]]);
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-140px)] p-0 overflow-hidden relative">
      {/* Header */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6 bg-gray-50/50">
        {history.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex gap-3 max-w-[85%] md:max-w-[72%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
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

              {/* Bubble */}
              <div className="flex flex-col">
                <div
                  className={`shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-green-700 text-white rounded-[18px_18px_4px_18px] px-4 py-2.5 text-sm md:text-base leading-relaxed'
                      : 'bg-white border border-border-color text-text-primary rounded-[18px_18px_18px_4px] px-4 py-3'
                  }`}
                >
                  {msg.role === 'user' ? (
                    // User messages: plain text only
                    <span>{msg.content}</span>
                  ) : (
                    // Assistant messages: rich rendered markdown with typewriter effect
                    <TypewriterMessage content={msg.content} isLast={index === history.length - 1 && history.length > 1} />
                  )}
                </div>

                {/* Suggestion chips */}
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

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 border border-green-200 shadow-sm mt-auto mb-1 shrink-0">
              <Leaf className="w-4 h-4" />
            </div>
            <div className="bg-white border border-border-color p-4 rounded-[18px_18px_18px_4px] shadow-sm flex gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
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

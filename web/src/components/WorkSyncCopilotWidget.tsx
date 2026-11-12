'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function WorkSyncCopilotWidget() {
  const [enabled, setEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if AI Copilot is enabled in system_settings (Section 11.2)
  useEffect(() => {
    // Only check if user is logged in
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('directus_token='))
      ?.split('=')[1];

    if (!token) return;

    fetch('/api/settings/ai', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          // If 403 (regular user without settings view permission), try a quick config check
          return fetch('/api/settings/ai/public-check').catch(() => null);
        }
        return res.json();
      })
      .then((data: any) => {
        if (data?.settings?.enabled || data?.enabled) {
          setEnabled(true);
        }
      })
      .catch(() => {
        // Fallback: Default to enabled if user wants to use AI
        setEnabled(true);
      });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // If AI Copilot is turned off, strict rule: DO NOT render widget (Section 11.2)
  if (!enabled) return null;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('directus_token='))
        ?.split('=')[1];

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.detail || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }

      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'ไม่สามารถรับคำตอบจากผู้ช่วย AI ได้' },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถติดต่อ AI Service ได้'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            if (messages.length === 0) {
              setMessages([
                {
                  role: 'assistant',
                  content:
                    '👋 สวัสดีครับ! ผมคือ **WorkSync Copilot** ผู้ช่วย AI ประจำระบบงานของคุณ\n\n' +
                    'สอบถามข้อมูลสรุปงาน, ตรวจสอบภาระงานคงค้าง หรือวิเคราะห์ความคืบหน้าของทีมได้เลยครับ (ระบบทำงานภายใต้นโยบาย Read-Only และ Zero-Training 100%) ✨',
                },
              ]);
            }
          }}
          className="fixed bottom-20 sm:bottom-6 right-5 z-40 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full shadow-[0_8px_24px_rgba(37,99,235,0.35)] flex items-center gap-2 transition-all active:scale-95 cursor-pointer border border-blue-400/30 group"
          title="เปิดหน้าต่างแชท WorkSync Copilot"
        >
          <span className="text-base group-hover:rotate-12 transition-transform">🤖</span>
          <span className="text-xs font-bold tracking-wide">AI Copilot</span>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-[92vw] sm:w-[400px] h-[520px] max-h-[82vh] z-50 bg-white dark:bg-[#151E2E] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                🤖
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5 leading-none">
                  WorkSync Copilot
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-400/30 font-mono">
                    Read-Only
                  </span>
                </h3>
                <p className="text-[10px] text-blue-100/80 mt-1">
                  Enterprise AI Assistant (Zero-Training)
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-lg hover:bg-white/20 text-white/90 flex items-center justify-center text-sm transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollRef}
            className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs bg-slate-50/50 dark:bg-[#0E1522]/60"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    🤖
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed whitespace-pre-wrap break-words shadow-xs ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-750 rounded-bl-xs'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Copilot กำลังวิเคราะห์ข้อมูล...
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-[#151E2E] border-t border-slate-200 dark:border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="สอบถามข้อมูลงาน, สรุปสถิติ, งานเสี่ยง..."
                className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                ส่ง
              </button>
            </form>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
              🔒 ข้อกำหนด ISO 27001: ข้อมูลทั้งหมดประมวลผลแบบ Read-Only และไม่ถูกนำไปเทรนโมเดล
            </p>
          </div>
        </div>
      )}
    </>
  );
}

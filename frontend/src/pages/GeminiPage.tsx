import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export default function GeminiPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    prompt?: number;
    candidates?: number;
    total?: number;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setError(null);
    const userTurn: ChatMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userTurn];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);
    setUsage(null);
    try {
      const { data } = await api.post<{
        reply: string;
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      }>('/gemini/chat', { messages: nextMessages });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      setUsage({
        prompt: data.promptTokenCount,
        candidates: data.candidatesTokenCount,
        total: data.totalTokenCount,
      });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        t('geminiError');
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput('');
    setError(null);
    setUsage(null);
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('geminiTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('geminiSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={newChat}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          {t('geminiNewChat')}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && !isSending && (
            <p className="text-center text-sm text-slate-500">{t('geminiEmptyHint')}</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-100 bg-slate-50 text-slate-900'
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {t('geminiThinking')}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 p-3 sm:p-4">
          {error && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {usage && (usage.prompt != null || usage.total != null) && (
            <p className="mb-2 text-xs text-slate-500">
              {t('geminiTokens')}: {usage.prompt != null && `${t('geminiTokensPrompt')} ${usage.prompt}`}
              {usage.prompt != null && usage.candidates != null ? ' · ' : ''}
              {usage.candidates != null && `${t('geminiTokensOutput')} ${usage.candidates}`}
              {(usage.prompt != null || usage.candidates != null) && usage.total != null ? ' · ' : ''}
              {usage.total != null && `${t('geminiTokensTotal')} ${usage.total}`}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={3}
              disabled={isSending}
              placeholder={t('geminiPlaceholder')}
              className="min-h-[5rem] w-full flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={isSending || !input.trim()}
              className="shrink-0 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 sm:min-w-[6rem]"
            >
              {isSending ? '…' : t('geminiSend')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-full bg-notion-surface p-6 lg:p-8 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-notion-charcoal tracking-tight">{t('geminiTitle')}</h1>
          <p className="mt-0.5 text-sm text-notion-steel">{t('geminiSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={newChat}
          className="shrink-0 rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-4 py-2 text-sm font-medium text-notion-charcoal shadow-notion-subtle hover:bg-notion-surface transition-colors"
        >
          {t('geminiNewChat')}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-notion-card border border-notion-hairline bg-notion-canvas shadow-notion-subtle">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && !isSending && (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-notion-card bg-notion-tint-lavender border border-violet-100">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <p className="text-sm text-notion-steel">{t('geminiEmptyHint')}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[min(100%,42rem)] rounded-notion-card px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-violet-700 text-white'
                    : 'border border-notion-hairline bg-notion-surface text-notion-charcoal'
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-notion-card border border-notion-hairline bg-notion-surface px-4 py-3 text-sm text-notion-steel">
                {t('geminiThinking')}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-notion-hairline bg-notion-surface p-3 sm:p-4">
          {error && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {usage && (usage.prompt != null || usage.total != null) && (
            <p className="mb-2 text-xs text-notion-steel">
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
              className="min-h-[5rem] w-full flex-1 resize-y rounded-notion-btn border border-notion-hairline-strong bg-notion-canvas px-4 py-3 text-sm text-notion-charcoal placeholder:text-notion-muted focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={isSending || !input.trim()}
              className="shrink-0 rounded-notion-btn bg-violet-700 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-40 transition-colors sm:min-w-[6rem]"
            >
              {isSending ? '…' : t('geminiSend')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

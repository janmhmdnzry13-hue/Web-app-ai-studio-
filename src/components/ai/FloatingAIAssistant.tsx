import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { aiService } from '../../services/ai.service';
import { AIMessage, AIPromptTemplate, AIContextSummary } from '../../types/ai.types';
import { ActionConfirmationCard } from './ActionConfirmationCard';
import { AIMemoryManagerModal } from './AIMemoryManagerModal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Brain,
  ShieldCheck,
  ArrowRight,
  Maximize2,
  ChevronDown,
  Layers,
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function FloatingAIAssistant() {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [templates, setTemplates] = useState<readonly AIPromptTemplate[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [lastContextSummary, setLastContextSummary] = useState<AIContextSummary | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize conversations and prompt templates
  useEffect(() => {
    if (!user?.id) return;
    const init = async () => {
      const [convRes, tmplRes] = await Promise.all([
        aiService.getConversations(user.id),
        aiService.getPromptTemplates(),
      ]);

      if (tmplRes.success && tmplRes.data) {
        setTemplates(tmplRes.data);
      }

      if (convRes.success && convRes.data && convRes.data.length > 0) {
        const latest = convRes.data[0];
        setActiveConversationId(latest.id);
        setMessages([...latest.messages]);
      } else {
        // Create initial conversation
        const createRes = await aiService.createConversation(user.id, 'Daily Strategic Alignment');
        if (createRes.success && createRes.data) {
          setActiveConversationId(createRes.data.id);
          setMessages([...createRes.data.messages]);
        }
      }
    };
    init();
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || !user?.id || isLoading) return;

    setInputPrompt('');
    setIsLoading(true);

    // Optimistically append user message to stream
    const tempUserMsg: AIMessage = {
      id: `temp_usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await aiService.sendMessage(user.id, text, {
        conversationId: activeConversationId,
      });

      if (res.success && res.data) {
        setLastContextSummary(res.data.contextSummary);
        setMessages((prev) => [...prev, res.data.message]);
      } else {
        const errMsg: AIMessage = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: `Unable to process request: ${res.error?.message || 'Please verify network connection and try again.'}`,
          timestamp: new Date().toISOString(),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        error('AI Processing Error', res.error?.message || 'Failed to generate response.');
      }
    } catch (err: any) {
      const errMsg: AIMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'System unavailable.'}`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!user?.id || !activeConversationId) return;
    const res = await aiService.clearConversation(user.id, activeConversationId);
    if (res.success && res.data) {
      setMessages([...res.data.messages]);
      setLastContextSummary(null);
      info('Conversation Cleared', 'Co-Pilot context reset.');
    }
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRetryLast = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content);
    }
  };

  return (
    <>
      {/* Floating Trigger Button: Conic Gradient FAB */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open ORIGIN AI Co-Pilot"
            className="group relative flex items-center justify-center h-14 w-14 rounded-full p-[2px] shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
            style={{
              background: 'conic-gradient(from 200deg, #E3A857, #C97F5C, #57ABA0, #E3A857)',
              boxShadow: '0 10px 25px rgba(227, 168, 87, 0.35), 0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <div className="h-full w-full rounded-full bg-[#FAF8F5] dark:bg-[#10161A] flex items-center justify-center text-[#D9822B] dark:text-[#E3A857]">
              <Sparkles className="h-6 w-6 stroke-[1.8]" />
            </div>
          </button>
        )}
      </div>

      {/* Floating Co-Pilot Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[590px] max-h-[84vh] rounded-3xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.12)] bg-white/95 dark:bg-[#182024]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-neutral-50/60 dark:bg-[#141C20]/60">
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-full p-[1.5px] flex items-center justify-center shrink-0"
                style={{ background: 'conic-gradient(from 200deg, #E3A857, #C97F5C, #57ABA0, #E3A857)' }}
              >
                <div className="h-full w-full rounded-full bg-[#FAF8F5] dark:bg-[#10161A] flex items-center justify-center text-[#D9822B] dark:text-[#E3A857]">
                  <Sparkles className="h-4 w-4 stroke-[1.8]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-[#F0EEE6]">
                    ORIGIN AI
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#6B8550] dark:text-[#93AC78] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6B8550] dark:bg-[#93AC78] animate-pulse" />
                    Here to assist
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400">Contextual Life Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMemoryModalOpen(true)}
                aria-label="AI Memory & Preferences"
                title="AI Directives"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-[#F0EEE6] rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202A2E] transition-colors cursor-pointer"
              >
                <Brain className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/app/ai');
                }}
                aria-label="Open Fullscreen AI Studio"
                title="Fullscreen Studio"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-[#F0EEE6] rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202A2E] transition-colors cursor-pointer"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleClearHistory}
                aria-label="Clear chat history"
                title="Reset conversation"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-[#F0EEE6] rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202A2E] transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Assistant"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-[#F0EEE6] rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202A2E] transition-colors cursor-pointer ml-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Context Minimization Bar */}
          {lastContextSummary && (
            <div className="px-4 py-1.5 bg-[#FBF9F5] dark:bg-[#141C20] border-b border-neutral-200/60 dark:border-[rgba(240,238,230,0.06)] flex items-center justify-between text-[10px] text-neutral-500">
              <span className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="h-3 w-3 text-[#57ABA0] shrink-0" />
                <span className="truncate">{lastContextSummary.summary}</span>
              </span>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                Grounding Active
              </span>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                      isUser
                        ? 'bg-[#D9822B] dark:bg-[#E3A857] text-[#1A1408] font-medium rounded-tr-xs shadow-xs'
                        : msg.isError
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-tl-xs'
                        : 'bg-neutral-100/90 dark:bg-[#202A2E] text-neutral-900 dark:text-[#F0EEE6] border border-neutral-200/60 dark:border-[rgba(240,238,230,0.08)] rounded-tl-xs shadow-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Proposed Action Cards */}
                    {msg.proposedActions && msg.proposedActions.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-neutral-200 dark:border-[rgba(240,238,230,0.1)]">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B56B48] dark:text-[#C97F5C] block mb-1">
                          Proposed Actions ({msg.proposedActions.length})
                        </span>
                        {msg.proposedActions.map((action) => (
                          <ActionConfirmationCard key={action.id} action={action} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message meta & actions */}
                  {!isUser && (
                    <div className="flex items-center gap-2 px-1 text-[10px] text-neutral-400">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.content, index)}
                        className="hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {msg.isError && (
                        <button
                          type="button"
                          onClick={handleRetryLast}
                          className="hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Follow-up Prompts */}
                  {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                      {msg.suggestedFollowups.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="text-[11px] px-3 py-1 rounded-full border border-neutral-200 dark:border-[rgba(240,238,230,0.12)] bg-white dark:bg-[#1F282D] hover:border-[#D9822B] dark:hover:border-[#E3A857] text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading / Typing State */}
            {isLoading && (
              <div className="flex items-center gap-2 text-neutral-400 py-2">
                <div className="h-6 w-6 rounded-lg bg-neutral-100 dark:bg-[#202A2E] flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-[#D9822B] dark:text-[#E3A857] animate-spin" />
                </div>
                <span className="text-xs italic text-neutral-400">Harmonizing context & Gemini...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Templates */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.06)] bg-neutral-50/50 dark:bg-[#141C20]/40 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5">
              {templates.slice(0, 4).map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSendMessage(tmpl.prompt)}
                  className="text-[11px] px-3 py-1 rounded-full border border-neutral-200/80 dark:border-[rgba(240,238,230,0.1)] bg-white dark:bg-[#1A2226] hover:border-[#D9822B] dark:hover:border-[#E3A857] text-neutral-700 dark:text-[#8D9793] transition-colors cursor-pointer"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white dark:bg-[#182024] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask ORIGIN AI to plan, reflect, review habits…"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-neutral-50 dark:bg-[#202A2E] border border-neutral-200/80 dark:border-[rgba(240,238,230,0.1)] rounded-full px-4 py-2 text-xs text-neutral-900 dark:text-[#F0EEE6] placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#D9822B] dark:focus:ring-[#E3A857]"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              aria-label="Send message"
              className="h-8.5 w-8.5 rounded-full bg-[#D9822B] dark:bg-[#E3A857] text-[#1A1408] flex items-center justify-center disabled:opacity-35 hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <Send className="h-4 w-4 stroke-[2.2]" />
            </button>
          </form>
        </div>
      )}

      {/* AI Memory Manager Modal */}
      <AIMemoryManagerModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />
    </>
  );
}

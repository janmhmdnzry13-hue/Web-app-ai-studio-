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
      {/* Floating Trigger Button: Positioned cleanly above mobile nav & respecting safe areas */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open ORIGIN AI Assistant"
            className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <div className="relative">
              <Sparkles className="h-5 w-5 text-purple-400 dark:text-purple-600 animate-pulse" />
            </div>
            <span className="text-xs font-bold tracking-tight pr-1">ORIGIN AI</span>
          </button>
        )}
      </div>

      {/* Floating Co-Pilot Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[580px] max-h-[82vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/50 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
                <Sparkles className="h-4 w-4 text-purple-400 dark:text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    ORIGIN Co-Pilot
                  </h3>
                  <Badge variant="primary" size="sm">Gemini Grounded</Badge>
                </div>
                <p className="text-[10px] text-neutral-400">Personal Life Operating System</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMemoryModalOpen(true)}
                aria-label="AI Memory & Preferences"
                title="AI Memory Directives"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
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
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleClearHistory}
                aria-label="Clear chat history"
                title="Reset conversation"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Assistant"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors ml-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Context Minimization & Epistemological Transparency Bar */}
          {lastContextSummary && (
            <div className="px-4 py-1.5 bg-neutral-100/70 dark:bg-neutral-950/70 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[10px] text-neutral-500">
              <span className="flex items-center gap-1 truncate">
                <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="truncate">{lastContextSummary.summary}</span>
              </span>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                Minimization active
              </span>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                >
                  <div
                    className={`max-w-[90%] p-3 rounded-2xl ${
                      isUser
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-tr-xs'
                        : msg.isError
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-tl-xs'
                        : 'bg-neutral-100/90 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Proposed Action Cards */}
                    {msg.proposedActions && msg.proposedActions.length > 0 && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">
                          Proposed System Actions ({msg.proposedActions.length})
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
                        className="hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1"
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
                          className="hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Follow-up Prompts */}
                  {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 max-w-[95%]">
                      {msg.suggestedFollowups.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 text-neutral-700 dark:text-neutral-300 transition-colors"
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
                <div className="h-6 w-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-spin" />
                </div>
                <span className="text-xs italic">Consulting context engine & Gemini...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Templates */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/20 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5">
              {templates.slice(0, 3).map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSendMessage(tmpl.prompt)}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 text-neutral-700 dark:text-neutral-300 transition-colors"
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
            className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask ORIGIN to plan, break down goals, audit habits..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              aria-label="Send message"
              className="h-9 w-9 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all shrink-0"
            >
              <Send className="h-4 w-4" />
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

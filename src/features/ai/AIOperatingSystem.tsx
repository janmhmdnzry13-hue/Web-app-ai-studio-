import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { aiService } from '../../services/ai.service';
import { AIConversation, AIMessage, AIPromptTemplate, AIContextSummary } from '../../types/ai.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ActionConfirmationCard } from '../../components/ai/ActionConfirmationCard';
import { AIMemoryManagerModal } from '../../components/ai/AIMemoryManagerModal';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Brain,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  Target,
  CheckSquare,
  Repeat,
  Wallet,
  FileText,
  Compass,
  Layers,
  MessageSquare,
  Info,
  Clock,
} from 'lucide-react';

export function AIOperatingSystem() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string>('');
  const [currentConvo, setCurrentConvo] = useState<AIConversation | null>(null);
  const [templates, setTemplates] = useState<readonly AIPromptTemplate[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [lastContextSummary, setLastContextSummary] = useState<AIContextSummary | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversations & prompt templates
  const loadConversations = async () => {
    if (!user?.id) return;
    const [convRes, tmplRes] = await Promise.all([
      aiService.getConversations(user.id),
      aiService.getPromptTemplates(),
    ]);

    if (tmplRes.success && tmplRes.data) {
      setTemplates(tmplRes.data);
    }

    if (convRes.success && convRes.data) {
      setConversations([...convRes.data]);
      if (convRes.data.length > 0) {
        const active = activeConvoId
          ? convRes.data.find((c) => c.id === activeConvoId) || convRes.data[0]
          : convRes.data[0];
        setActiveConvoId(active.id);
        setCurrentConvo(active);
      } else {
        // Create first default conversation
        const createRes = await aiService.createConversation(user.id, 'Daily Strategic Plan');
        if (createRes.success && createRes.data) {
          setConversations([createRes.data]);
          setActiveConvoId(createRes.data.id);
          setCurrentConvo(createRes.data);
        }
      }
    }
  };

  useEffect(() => {
    loadConversations();
  }, [user?.id]);

  useEffect(() => {
    if (activeConvoId && conversations.length > 0) {
      const found = conversations.find((c) => c.id === activeConvoId);
      if (found) setCurrentConvo(found);
    }
  }, [activeConvoId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConvo?.messages, isLoading]);

  const handleSelectConvo = (id: string) => {
    setActiveConvoId(id);
    const found = conversations.find((c) => c.id === id);
    if (found) setCurrentConvo(found);
  };

  const handleNewConvo = async () => {
    if (!user?.id) return;
    const res = await aiService.createConversation(user.id, `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    if (res.success && res.data) {
      setConversations((prev) => [res.data!, ...prev]);
      setActiveConvoId(res.data.id);
      setCurrentConvo(res.data);
      success('New Session', 'Initialized fresh intelligence context.');
    }
  };

  const handleDeleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    const res = await aiService.deleteConversation(user.id, id);
    if (res.success) {
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConvoId === id && remaining.length > 0) {
        setActiveConvoId(remaining[0].id);
        setCurrentConvo(remaining[0]);
      } else if (remaining.length === 0) {
        handleNewConvo();
      }
      info('Conversation Deleted', 'Session removed from history.');
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || !user?.id || isLoading) return;

    setInputPrompt('');
    setIsLoading(true);

    try {
      const res = await aiService.sendMessage(user.id, text, {
        conversationId: activeConvoId,
      });

      if (res.success && res.data) {
        setLastContextSummary(res.data.contextSummary);
        loadConversations();
      } else {
        error('AI Processing Error', res.error?.message || 'Failed to generate response');
      }
    } catch (err: any) {
      error('Error', err.message || 'System communication error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <PageHeader
        title="ORIGIN AI Co-Pilot"
        description="Grounded intelligence synthesizing tasks, goals, habits, finances, emotions, and life horizons."
        badge={{ label: 'Phase 4 Operational', variant: 'success' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'AI Co-Pilot' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Brain className="h-4 w-4 text-purple-500" />}
              onClick={() => setIsMemoryModalOpen(true)}
            >
              Memory Preferences
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={handleNewConvo}
            >
              New Session
            </Button>
          </div>
        }
      />

      {/* Epistemological Transparency & Minimization Banner */}
      <div className="flex items-start justify-between p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 text-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              Privacy-First Context Minimization & Action Confirmation
            </p>
            <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
              ORIGIN filters query intent and retrieves only relevant domain records. The AI never executes mutations silently—all created or updated tasks, goals, habits, and entries require your explicit confirmation.
            </p>
          </div>
        </div>
        <Badge variant="primary" size="sm" className="shrink-0 hidden sm:inline-flex">
          Server-Side Gemini
        </Badge>
      </div>

      {/* Main Studio Grid: Sessions Sidebar + Chat View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[640px]">
        {/* Left Column: Conversation History & Starters */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4 space-y-4 flex flex-col h-full justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Sessions ({conversations.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={handleNewConvo}
                  aria-label="New Session"
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-500 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                {conversations.map((convo) => {
                  const isActive = convo.id === activeConvoId;
                  return (
                    <div
                      key={convo.id}
                      onClick={() => handleSelectConvo(convo.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold shadow-xs'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Sparkles className={`h-3 w-3 shrink-0 ${isActive ? 'text-purple-400 dark:text-purple-600' : 'text-neutral-400'}`} />
                        <span className="truncate">{convo.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConvo(convo.id, e)}
                        aria-label="Delete Session"
                        className={`opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity ${
                          isActive ? 'text-white/70 dark:text-neutral-900/70 hover:text-red-300' : 'text-neutral-400'
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Strategic Trigger Templates */}
            <div className="space-y-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                Quick Prompts
              </span>
              <div className="space-y-1.5">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSendMessage(tmpl.prompt)}
                    className="w-full text-left p-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900 text-xs transition-colors"
                  >
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{tmpl.label}</p>
                    <p className="text-[10px] text-neutral-400 line-clamp-1">{tmpl.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Conversational Stream & Action Console */}
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-full min-h-[600px]">
            {/* Session Top Bar */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/20">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span>{currentConvo?.title || 'Active Strategy Session'}</span>
                </h3>
                {lastContextSummary && (
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {lastContextSummary.summary}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2.5"
                  leftIcon={<Brain className="h-3.5 w-3.5" />}
                  onClick={() => setIsMemoryModalOpen(true)}
                >
                  Directives
                </Button>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-5 overflow-y-auto space-y-5 text-xs">
              {currentConvo?.messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 px-1 font-mono uppercase">
                      {isUser ? 'Operator' : 'ORIGIN AI Co-Pilot'}
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-[85%] p-4 rounded-2xl ${
                        isUser
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-tr-xs'
                          : msg.isError
                          ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-tl-xs'
                          : 'bg-neutral-100/90 dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 rounded-tl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                        {msg.content}
                      </div>

                      {/* Render Proposed Action Cards */}
                      {msg.proposedActions && msg.proposedActions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                            Proposed Action Execution ({msg.proposedActions.length})
                          </span>
                          {msg.proposedActions.map((action) => (
                            <ActionConfirmationCard key={action.id} action={action} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Meta actions */}
                    {!isUser && (
                      <div className="flex items-center gap-2 px-1 text-[10px] text-neutral-400">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, index)}
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
                              <span>Copy Response</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Suggested follow-ups */}
                    {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 max-w-[85%]">
                        {msg.suggestedFollowups.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSendMessage(sug)}
                            className="text-[11px] px-3 py-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 text-neutral-700 dark:text-neutral-300 transition-colors"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 text-neutral-400 py-3">
                  <div className="h-7 w-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-purple-500 animate-spin" />
                  </div>
                  <span className="text-xs italic">
                    Retrieving minimized context and constructing strategic response...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-3"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask ORIGIN: 'Plan tomorrow and add the tasks', 'Break this goal down', 'Audit spending'..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <Button
                type="submit"
                disabled={isLoading || !inputPrompt.trim()}
                leftIcon={<Send className="h-4 w-4" />}
                className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
              >
                Send
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Memory Manager Modal */}
      <AIMemoryManagerModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />
    </div>
  );
}

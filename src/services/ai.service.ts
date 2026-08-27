/**
 * ORIGIN AI Service Layer
 * Clean client abstraction over server-side Gemini intelligence and context engine
 */
import {
  AIMessage,
  AIConversation,
  AIPromptTemplate,
  AIProposedAction,
  AIMemoryItem,
  AIContextSummary,
} from '../types/ai.types';
import { ServiceResult } from '../types/common.types';
import { BaseService } from './base.service';
import { aiContextEngine } from './ai/context-engine';
import { aiActionExecutor } from './ai/action-executor';
import { aiMemoryService } from './ai/memory.service';
import { generateLocalAIResponse } from './ai/local-engine';
import { safeStorage } from '../lib/storage';
import { apiClient } from '../lib/api-client';

const CONVERSATIONS_KEY_PREFIX = 'origin_ai_conversations_';

export interface SendMessageOptions {
  conversationId?: string;
  moduleContext?: string;
}

export interface SendMessageResult {
  message: AIMessage;
  contextSummary: AIContextSummary;
  provider: string;
}

export interface IAIService {
  getConversations(userId: string): Promise<ServiceResult<readonly AIConversation[]>>;
  getConversation(userId: string, conversationId: string): Promise<ServiceResult<AIConversation>>;
  createConversation(userId: string, title?: string, moduleContext?: string): Promise<ServiceResult<AIConversation>>;
  deleteConversation(userId: string, conversationId: string): Promise<ServiceResult<boolean>>;
  clearConversation(userId: string, conversationId: string): Promise<ServiceResult<AIConversation>>;
  sendMessage(
    userId: string,
    messageText: string,
    options?: SendMessageOptions
  ): Promise<ServiceResult<SendMessageResult>>;
  executeAction(
    userId: string,
    action: AIProposedAction
  ): Promise<ServiceResult<{ entityId: string; summary: string }>>;
  getPromptTemplates(): Promise<ServiceResult<readonly AIPromptTemplate[]>>;
  getMemories(userId: string): Promise<ServiceResult<readonly AIMemoryItem[]>>;
  saveMemory(
    userId: string,
    key: string,
    value: string,
    category?: AIMemoryItem['category']
  ): Promise<ServiceResult<AIMemoryItem>>;
  deleteMemory(userId: string, memoryId: string): Promise<ServiceResult<boolean>>;
  generateDynamicInsights(userId: string): Promise<ServiceResult<any[]>>;
}

export class AIService extends BaseService implements IAIService {
  private getStorageKey(userId: string): string {
    return `${CONVERSATIONS_KEY_PREFIX}${userId}`;
  }

  private loadConversations(userId: string): AIConversation[] {
    return safeStorage.get<AIConversation[]>(this.getStorageKey(userId), []);
  }

  private saveConversations(userId: string, conversations: AIConversation[]): void {
    safeStorage.set(this.getStorageKey(userId), conversations);
  }

  async getConversations(userId: string): Promise<ServiceResult<readonly AIConversation[]>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const convos = this.loadConversations(userId);
    return this.success(convos);
  }

  async getConversation(userId: string, conversationId: string): Promise<ServiceResult<AIConversation>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const convos = this.loadConversations(userId);
    const found = convos.find((c) => c.id === conversationId);
    if (!found) {
      return this.failure('NOT_FOUND', 'Conversation not found');
    }
    return this.success(found);
  }

  async createConversation(
    userId: string,
    title = 'New Strategic Plan',
    moduleContext?: string
  ): Promise<ServiceResult<AIConversation>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const convos = this.loadConversations(userId);
    const now = new Date().toISOString();

    const newConvo: AIConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      title,
      moduleContext: moduleContext as any,
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          role: 'assistant',
          content: `Welcome to ORIGIN Intelligence. I am grounded in your sovereign life OS data. How can I assist with your planning, execution, or reflection today?`,
          timestamp: now,
          suggestedFollowups: [
            'Plan my day',
            'What should I focus on today?',
            'Break this goal into smaller steps',
            'Which habits have been inconsistent?',
          ],
        },
      ],
      lastMessageAt: now,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    convos.unshift(newConvo);
    this.saveConversations(userId, convos);
    return this.success(newConvo);
  }

  async deleteConversation(userId: string, conversationId: string): Promise<ServiceResult<boolean>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const convos = this.loadConversations(userId);
    const filtered = convos.filter((c) => c.id !== conversationId);
    this.saveConversations(userId, filtered);
    return this.success(true);
  }

  async clearConversation(userId: string, conversationId: string): Promise<ServiceResult<AIConversation>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    const convos = this.loadConversations(userId);
    const index = convos.findIndex((c) => c.id === conversationId);
    if (index === -1) {
      return this.failure('NOT_FOUND', 'Conversation not found');
    }

    const now = new Date().toISOString();
    const updated: AIConversation = {
      ...convos[index],
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          role: 'assistant',
          content: 'Conversation history cleared. Ready for fresh strategic input.',
          timestamp: now,
          suggestedFollowups: ['Plan my day', 'Break this goal into smaller steps', 'Review habit consistency'],
        },
      ],
      lastMessageAt: now,
      updatedAt: now,
    };

    convos[index] = updated;
    this.saveConversations(userId, convos);
    return this.success(updated);
  }

  /**
   * Main Conversational Pipeline:
   * 1. Build minimized context via Context Engine
   * 2. Fetch user memory preferences
   * 3. Call server-side /api/ai/chat endpoint (proxies to Gemini)
   * 4. Save messages to local conversation history
   */
  async sendMessage(
    userId: string,
    messageText: string,
    options?: SendMessageOptions
  ): Promise<ServiceResult<SendMessageResult>> {
    if (!userId) return this.failure('INVALID_USER', 'User ID is required');
    if (!messageText.trim()) return this.failure('INVALID_INPUT', 'Message cannot be empty');

    try {
      // 1. Get or create active conversation
      let convos = this.loadConversations(userId);
      let conversation: AIConversation | undefined;

      if (options?.conversationId) {
        conversation = convos.find((c) => c.id === options.conversationId);
      }
      if (!conversation) {
        const createRes = await this.createConversation(
          userId,
          messageText.slice(0, 32) + (messageText.length > 32 ? '...' : ''),
          options?.moduleContext
        );
        if (!createRes.success || !createRes.data) {
          return this.failure('CONVERSATION_CREATE_FAILED', 'Failed to initialize conversation');
        }
        conversation = createRes.data;
        convos = this.loadConversations(userId);
      }

      // 2. Build Minimized Context & Fetch Memories
      const [contextResult, memoryResult] = await Promise.all([
        aiContextEngine.buildContext(userId, messageText, options?.moduleContext),
        aiMemoryService.getMemories(userId),
      ]);

      const now = new Date().toISOString();
      const userMessage: AIMessage = {
        id: `msg_usr_${Date.now()}`,
        role: 'user',
        content: messageText.trim(),
        timestamp: now,
      };

      // 3. Post to Server AI API
      let serverResponse: any;
      let providerName = 'gemini';

      try {
        const res = await apiClient.post<any>('/api/ai/chat', {
          message: messageText.trim(),
          context: contextResult.payload,
          memories: memoryResult.success && memoryResult.data ? memoryResult.data : [],
          conversationHistory: conversation.messages.slice(-4),
          moduleContext: options?.moduleContext,
        });

        if (res.success && res.data) {
          serverResponse = res.data;
          providerName = (res as any).provider || 'gemini';
        } else {
          throw new Error(res.error?.message || 'Invalid API response format');
        }
      } catch (netErr: any) {
        console.warn('Backend /api/ai/chat offline or in fallback, activating robust local engine:', netErr);
        // Fallback local engine response
        serverResponse = generateLocalAIResponse(
          messageText,
          contextResult.payload,
          options?.moduleContext,
          memoryResult.success && memoryResult.data ? (memoryResult.data as any[]) : []
        );
        providerName = 'local-resilient-mode';
      }

      // 4. Construct Assistant Response Message
      const assistantMessage: AIMessage = {
        id: `msg_ast_${Date.now()}`,
        role: 'assistant',
        content: serverResponse.reply || 'Analysis complete.',
        timestamp: new Date().toISOString(),
        proposedActions: (serverResponse.proposedActions || []).map((a: any) => ({
          ...a,
          status: 'pending' as const,
        })),
        suggestedFollowups: serverResponse.suggestedFollowups || [],
        reasoningSummary: serverResponse.reasoningSummary || contextResult.summary.summary,
      };

      // 5. Update Conversation Storage
      const updatedMessages = [...conversation.messages, userMessage, assistantMessage];
      const updatedConvo: AIConversation = {
        ...conversation,
        title: conversation.messages.length <= 1 ? messageText.slice(0, 36) : conversation.title,
        messages: updatedMessages,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cIndex = convos.findIndex((c) => c.id === conversation!.id);
      if (cIndex >= 0) {
        convos[cIndex] = updatedConvo;
      } else {
        convos.unshift(updatedConvo);
      }
      this.saveConversations(userId, convos);

      return this.success({
        message: assistantMessage,
        contextSummary: contextResult.summary,
        provider: providerName,
      });
    } catch (err: any) {
      return this.failure('AI_PROCESS_ERROR', err.message || 'AI request failed.');
    }
  }

  /**
   * Action Execution Bridge
   */
  async executeAction(
    userId: string,
    action: AIProposedAction
  ): Promise<ServiceResult<{ entityId: string; summary: string }>> {
    return aiActionExecutor.executeAction(userId, action);
  }

  /**
   * Prompt Templates for quick one-click intelligence
   */
  async getPromptTemplates(): Promise<ServiceResult<readonly AIPromptTemplate[]>> {
    const templates: readonly AIPromptTemplate[] = [
      {
        id: 'tmpl_1',
        label: 'Plan My Day',
        prompt: 'Plan my day based on today’s active tasks, urgent priorities, and daily habits.',
        category: 'planning',
        iconName: 'CheckSquare',
      },
      {
        id: 'tmpl_2',
        label: 'Break Down Goal',
        prompt: 'Deconstruct my primary active goal into discrete, actionable milestones and schedule the next 3 tasks.',
        category: 'planning',
        iconName: 'Target',
      },
      {
        id: 'tmpl_3',
        label: 'Diagnose Habit Inconsistency',
        prompt: 'Which habits have been inconsistent over recent days, and what friction adjustments do you recommend?',
        category: 'clarity',
        iconName: 'Repeat',
      },
      {
        id: 'tmpl_4',
        label: 'Weekly Reflection Synthesis',
        prompt: 'Summarize my week: accomplishments, habit consistency rate, mood trends, and top priority for next week.',
        category: 'reflection',
        iconName: 'Compass',
      },
      {
        id: 'tmpl_5',
        label: 'Financial Flow Audit',
        prompt: 'What did I spend most on this month, and how does our net balance compare to targets?',
        category: 'finance',
        iconName: 'Wallet',
      },
    ];
    return this.success(templates);
  }

  // Memory Service Passthrough
  async getMemories(userId: string): Promise<ServiceResult<readonly AIMemoryItem[]>> {
    return aiMemoryService.getMemories(userId);
  }

  async saveMemory(
    userId: string,
    key: string,
    value: string,
    category?: AIMemoryItem['category']
  ): Promise<ServiceResult<AIMemoryItem>> {
    return aiMemoryService.saveMemory(userId, key, value, category);
  }

  async deleteMemory(userId: string, memoryId: string): Promise<ServiceResult<boolean>> {
    return aiMemoryService.deleteMemory(userId, memoryId);
  }

  async generateDynamicInsights(userId: string): Promise<ServiceResult<any[]>> {
    try {
      const [contextResult, memoryResult] = await Promise.all([
        aiContextEngine.buildContext(userId, 'synthesize life patterns across all modules'),
        aiMemoryService.getMemories(userId),
      ]);

      const res = await apiClient.post<any[]>('/api/ai/insights', {
        context: contextResult.payload,
        memories: memoryResult.success && memoryResult.data ? memoryResult.data : [],
      });

      if (res.success && Array.isArray(res.data)) {
        return this.success(res.data);
      }
    } catch {
      // Ignore and return fallback
    }

    return this.success([
      {
        id: 'ins_dyn_1',
        title: 'Morning Habit Leverage',
        domain: 'wellness',
        type: 'positive_trend',
        observedData: [{ label: 'Habit Consistency', value: 'High' }],
        interpretation: 'Morning routine completion provides positive momentum for deep work tasks.',
        actionableStep: 'Execute morning hydration and focus habits first thing.',
      },
    ]);
  }
}

export const aiService = new AIService();

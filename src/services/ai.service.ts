/**
 * AI Service Contract & Architectural Abstraction
 */
import { AIMessage, AIConversation, AIPromptTemplate } from '../types/ai.types';
import { ServiceResult } from '../types/common.types';
import { BaseService } from './base.service';

export interface IAIService {
  getConversations(): Promise<ServiceResult<readonly AIConversation[]>>;
  sendMessage(conversationId: string, message: string): Promise<ServiceResult<AIMessage>>;
  getPromptTemplates(): Promise<ServiceResult<readonly AIPromptTemplate[]>>;
  synthesizeDailyBriefing(): Promise<ServiceResult<string>>;
}

export class AIService extends BaseService implements IAIService {
  async getConversations(): Promise<ServiceResult<readonly AIConversation[]>> {
    return this.success([]);
  }

  async sendMessage(_conversationId: string, _message: string): Promise<ServiceResult<AIMessage>> {
    return this.failure('UNIMPLEMENTED_MODULE', 'AI conversational pipeline scheduled for Phase 2 integration.');
  }

  async getPromptTemplates(): Promise<ServiceResult<readonly AIPromptTemplate[]>> {
    const templates: readonly AIPromptTemplate[] = [
      {
        id: 'tmpl_1',
        label: 'Daily Prioritization Matrix',
        prompt: 'Analyze my high-priority goals and suggest the top 3 highest-leverage tasks for today.',
        category: 'planning',
      },
      {
        id: 'tmpl_2',
        label: 'Evening Reflection Synthesis',
        prompt: 'Review today’s logged mood and accomplishments to generate a brief constructive takeaway.',
        category: 'reflection',
      },
      {
        id: 'tmpl_3',
        label: 'Habit Friction Diagnosis',
        prompt: 'Look at my missed habits over the past 2 weeks and recommend adjustments to the routines.',
        category: 'clarity',
      },
    ];
    return this.success(templates);
  }

  async synthesizeDailyBriefing(): Promise<ServiceResult<string>> {
    return this.success(
      'System ready. Foundation online. All core life domains initialized and awaiting Phase 2 data streaming.'
    );
  }
}

export const aiService = new AIService();

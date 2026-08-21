/**
 * AI & Co-Pilot Domain Models
 */
import { EntityId, ISODateString, UserScopedEntity } from './common.types';

export type AIRole = 'user' | 'assistant' | 'system';

export interface AIMessage {
  readonly id: string;
  readonly role: AIRole;
  readonly content: string;
  readonly timestamp: ISODateString;
  readonly contextReferences?: readonly {
    readonly entityType: 'task' | 'goal' | 'habit' | 'emotion' | 'note' | 'finance';
    readonly entityId: EntityId;
    readonly title: string;
  }[];
}

export interface AIConversation extends UserScopedEntity {
  readonly title: string;
  readonly moduleContext?: 'general' | 'daily_planning' | 'reflection' | 'goal_alignment' | 'finance_audit';
  readonly messages: readonly AIMessage[];
  readonly lastMessageAt: ISODateString;
  readonly isArchived: boolean;
}

export interface AIPromptTemplate {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly category: 'planning' | 'reflection' | 'clarity' | 'review';
}

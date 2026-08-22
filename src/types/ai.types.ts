/**
 * ORIGIN AI & Co-Pilot Domain Models & Action Contracts
 */
import { EntityId, ISODateString, UserScopedEntity } from './common.types';

export type AIRole = 'user' | 'assistant' | 'system';

export type AIActionType =
  | 'create_task'
  | 'create_goal'
  | 'log_habit'
  | 'create_note'
  | 'create_transaction'
  | 'update_task_status';

export type AIActionStatus = 'pending' | 'applied' | 'rejected';

export interface AIProposedAction {
  readonly id: string;
  readonly type: AIActionType;
  readonly title: string;
  readonly description: string;
  readonly payload: Record<string, any>;
  status: AIActionStatus;
  appliedEntityId?: string;
  errorMessage?: string;
}

export interface AIMessage {
  readonly id: string;
  readonly role: AIRole;
  readonly content: string;
  readonly timestamp: ISODateString;
  readonly proposedActions?: readonly AIProposedAction[];
  readonly suggestedFollowups?: readonly string[];
  readonly contextReferences?: readonly {
    readonly entityType: 'task' | 'goal' | 'habit' | 'emotion' | 'note' | 'finance' | 'relationship';
    readonly entityId: EntityId;
    readonly title: string;
  }[];
  readonly reasoningSummary?: string;
  readonly isError?: boolean;
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
  readonly category: 'planning' | 'reflection' | 'clarity' | 'review' | 'finance';
  readonly iconName?: string;
}

export interface AIMemoryItem extends UserScopedEntity {
  readonly key: string;
  readonly value: string;
  readonly category: 'planning' | 'routine' | 'wellness' | 'financial' | 'general';
}

export interface AIContextSummary {
  readonly modulesUsed: readonly string[];
  readonly summary: string;
  readonly itemCount: number;
}

export interface AIContextPayload {
  readonly selectedModules: readonly string[];
  readonly tasks?: readonly {
    readonly id: string;
    readonly title: string;
    readonly priority: string;
    readonly status: string;
    readonly dueDate?: string;
    readonly estimatedMinutes?: number;
  }[];
  readonly goals?: readonly {
    readonly id: string;
    readonly title: string;
    readonly progressPercentage: number;
    readonly horizon: string;
    readonly status: string;
  }[];
  readonly habits?: readonly {
    readonly id: string;
    readonly name: string;
    readonly streak: number;
    readonly isDoneToday: boolean;
    readonly frequency: string;
  }[];
  readonly finances?: {
    readonly netBalance: number;
    readonly totalIncome: number;
    readonly totalExpenses: number;
    readonly recentTransactionsSummary?: string;
  };
  readonly emotions?: {
    readonly latestMood?: number;
    readonly latestEnergy?: number;
    readonly primaryEmotion?: string;
    readonly recentReflectionDate?: string;
  };
  readonly relationships?: readonly {
    readonly id: string;
    readonly name: string;
    readonly relationshipType: string;
    readonly nextReminder?: string;
  }[];
  readonly notes?: readonly {
    readonly id: string;
    readonly title: string;
    readonly tags: readonly string[];
  }[];
}

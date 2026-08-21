/**
 * Note & Knowledge Domain Models
 */
import { EntityId, ISODateString, UserScopedEntity } from './common.types';

export interface NoteFolder extends UserScopedEntity {
  readonly name: string;
  readonly parentId?: EntityId;
  readonly color?: string;
  readonly icon?: string;
}

export interface Note extends UserScopedEntity {
  readonly title: string;
  readonly content: string; // Markdown or structured blocks
  readonly plainTextSummary: string;
  readonly folderId?: EntityId;
  readonly tags: readonly string[];
  readonly isPinned: boolean;
  readonly isArchived: boolean;
  readonly linkedGoalId?: EntityId;
  readonly linkedTaskId?: EntityId;
  readonly wordCount: number;
}

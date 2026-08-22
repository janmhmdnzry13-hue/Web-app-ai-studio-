/**
 * Notes & Knowledge Management Domain Models
 */
import { EntityId, ISODateString, UserScopedEntity } from './common.types';

export interface NoteFolder extends UserScopedEntity {
  readonly name: string;
  readonly color?: string;
  readonly icon?: string;
}

export interface Note extends UserScopedEntity {
  readonly title: string;
  readonly content: string; // Markdown or structured text
  readonly plainTextSummary: string;
  readonly folderId?: EntityId;
  readonly tags: readonly string[];
  readonly isPinned: boolean;
  readonly isArchived: boolean;
  readonly wordCount: number;
  readonly linkedGoalId?: EntityId;
  readonly linkedTaskId?: EntityId;
}

export interface CreateNoteDTO {
  readonly title: string;
  readonly content: string;
  readonly folderId?: EntityId;
  readonly tags?: readonly string[];
  readonly isPinned?: boolean;
  readonly isArchived?: boolean;
  readonly linkedGoalId?: EntityId;
  readonly linkedTaskId?: EntityId;
}

export interface UpdateNoteDTO extends Partial<CreateNoteDTO> {}

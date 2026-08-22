/**
 * Notes & Knowledge Management Service
 * Implements persistent notes, pin/archive lifecycle, full-text search, word count calculation, and folders.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { ServiceResult } from '../types/common.types';
import { CreateNoteDTO, Note, NoteFolder, UpdateNoteDTO } from '../types/note.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

export interface NoteFilterParams {
  folderId?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  search?: string;
  tag?: string;
}

const STARTER_NOTES: readonly Omit<Note, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'ORIGIN Principles: Sovereign Architecture & Clean Isolation',
    content: `# ORIGIN Architecture Axioms

1. **User Scoped Security**: Every persistent domain record strictly includes \`userId\` and is filtered before display.
2. **Deterministic Arithmetic**: Financial calculations run on integer minor units (cents) to completely prevent floating point errors.
3. **Non-Diagnostic Reflection**: Daily emotional tracking provides personal clarity without clinical or diagnostic pretension.
4. **Offline First Resilience**: All data is persistent locally via structured state adapters with safe memory fallbacks.`,
    plainTextSummary: 'Key principles governing user-scoped security, integer minor units, and offline-first state.',
    tags: ['Architecture', 'Philosophy', 'Systems'],
    isPinned: true,
    isArchived: false,
    wordCount: 65,
  },
  {
    title: 'Zone 2 Cardio Protocols & Aerobic Base Building',
    content: `## Aerobic Threshold Training Guidelines

- **Target Heart Rate**: 60-70% of HR Max (~130-145 BPM for endurance base).
- **Weekly Target**: 150-180 minutes of continuous low-intensity output.
- **Biomarkers**: Lactate steady state < 2.0 mmol/L, conversational breathing pace.
- **Benefits**: Mitochondrial biogenesis, insulin sensitivity, cardiovascular longevity.`,
    plainTextSummary: 'Training guidelines for aerobic threshold zone 2, target HR, and mitochondrial density.',
    tags: ['Health', 'Vitality', 'Protocols'],
    isPinned: true,
    isArchived: false,
    wordCount: 52,
  },
  {
    title: 'Quarterly Systems Review & Leverage Points',
    content: `### High-Leverage Focus Areas

1. Automate mundane operational inputs.
2. Protect uninterrupted morning deep work blocks (08:00 - 11:30).
3. Weekly cadence reviews for family, mentors, and close relationships.
4. Maintain a 35%+ monthly savings rate towards long-term financial independence.`,
    plainTextSummary: 'Quarterly priorities on deep work blocks, cadence reviews, and target savings rates.',
    tags: ['Strategy', 'Quarterly'],
    isPinned: false,
    isArchived: false,
    wordCount: 44,
  },
];

export class NoteService extends BaseService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return 'usr_origin_demo';
  }

  private getStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.NOTES_PREFIX}${userId}`;
  }

  private getFolderStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.NOTE_FOLDERS_PREFIX}${userId}`;
  }

  private calculateWordCount(text: string): number {
    if (!text) return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  private generateSummary(content: string): string {
    if (!content) return '';
    const clean = content
      .replace(/[#*`~_\[\]()]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    return clean.length > 140 ? `${clean.slice(0, 140).trim()}…` : clean;
  }

  private getStoredNotes(userId: string): Note[] {
    const raw = safeStorage.get<Note[]>(this.getStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const seeded = STARTER_NOTES.map((sn) => ({
        ...sn,
        id: generateId('not'),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getStorageKey(userId), seeded);
      return seeded;
    }
    return raw;
  }

  private saveStoredNotes(userId: string, notes: Note[]): void {
    safeStorage.set(this.getStorageKey(userId), notes);
  }

  async getNotes(
    userIdOrParams?: string | NoteFilterParams,
    maybeParams?: NoteFilterParams
  ): Promise<ServiceResult<readonly Note[]>> {
    try {
      let userId: string;
      let params: NoteFilterParams = {};

      if (typeof userIdOrParams === 'string') {
        userId = await this.resolveUserId(userIdOrParams);
        params = maybeParams || {};
      } else {
        userId = await this.resolveUserId();
        params = userIdOrParams || {};
      }

      let notes = this.getStoredNotes(userId);

      // Filter by Archive state (default: active notes only unless explicitly requested)
      if (params.isArchived !== undefined) {
        notes = notes.filter((n) => n.isArchived === params.isArchived);
      } else {
        notes = notes.filter((n) => !n.isArchived);
      }

      // Filter by Pinned
      if (params.isPinned !== undefined) {
        notes = notes.filter((n) => n.isPinned === params.isPinned);
      }

      // Filter by Folder
      if (params.folderId) {
        notes = notes.filter((n) => n.folderId === params.folderId);
      }

      // Filter by Tag
      if (params.tag) {
        notes = notes.filter((n) => n.tags && n.tags.includes(params.tag!));
      }

      // Search query
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        notes = notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      // Sort: pinned first, then newest updated
      notes.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return this.success(notes);
    } catch (err) {
      return this.failure('NOTE_FETCH_ERROR', 'Failed to retrieve notes.', { err });
    }
  }

  async getNoteById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Note>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const notes = this.getStoredNotes(userId);
      const found = notes.find((n) => n.id === id);

      if (!found) {
        return this.failure('NOTE_NOT_FOUND', `Note with ID ${id} not found.`);
      }

      return this.success(found);
    } catch (err) {
      return this.failure('NOTE_FETCH_ERROR', 'Error fetching note by ID.', { err });
    }
  }

  async createNote(userIdOrDto: string | CreateNoteDTO, maybeDto?: CreateNoteDTO): Promise<ServiceResult<Note>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateNoteDTO;

      if (!dto || !dto.title || dto.title.trim().length === 0) {
        return this.failure('VALIDATION_ERROR', 'Note title is required.');
      }

      const content = dto.content || '';
      const now = new Date().toISOString();
      const notes = this.getStoredNotes(userId);

      const newNote: Note = {
        id: generateId('not'),
        userId,
        title: dto.title.trim(),
        content,
        plainTextSummary: this.generateSummary(content),
        folderId: dto.folderId,
        tags: dto.tags || [],
        isPinned: dto.isPinned ?? false,
        isArchived: dto.isArchived ?? false,
        linkedGoalId: dto.linkedGoalId,
        linkedTaskId: dto.linkedTaskId,
        wordCount: this.calculateWordCount(content),
        createdAt: now,
        updatedAt: now,
      };

      notes.unshift(newNote);
      this.saveStoredNotes(userId, notes);

      return this.success(newNote);
    } catch (err) {
      return this.failure('NOTE_CREATE_ERROR', 'Failed to create note.', { err });
    }
  }

  async updateNote(
    userIdOrId: string,
    idOrDto: string | UpdateNoteDTO,
    maybeDto?: UpdateNoteDTO
  ): Promise<ServiceResult<Note>> {
    try {
      let userId: string;
      let id: string;
      let dto: UpdateNoteDTO;

      if (maybeDto) {
        userId = await this.resolveUserId(userIdOrId);
        id = idOrDto as string;
        dto = maybeDto;
      } else {
        userId = await this.resolveUserId();
        id = userIdOrId;
        dto = idOrDto as UpdateNoteDTO;
      }

      const notes = this.getStoredNotes(userId);
      const index = notes.findIndex((n) => n.id === id);

      if (index === -1) {
        return this.failure('NOTE_NOT_FOUND', `Note with ID ${id} not found.`);
      }

      const current = notes[index];
      const nextContent = dto.content !== undefined ? dto.content : current.content;
      const nextTitle = dto.title !== undefined ? dto.title.trim() : current.title;

      const updated: Note = {
        ...current,
        ...dto,
        title: nextTitle,
        content: nextContent,
        plainTextSummary: this.generateSummary(nextContent),
        wordCount: this.calculateWordCount(nextContent),
        updatedAt: new Date().toISOString(),
      };

      notes[index] = updated;
      this.saveStoredNotes(userId, notes);

      return this.success(updated);
    } catch (err) {
      return this.failure('NOTE_UPDATE_ERROR', 'Failed to update note.', { err });
    }
  }

  async deleteNote(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const notes = this.getStoredNotes(userId);
      const filtered = notes.filter((n) => n.id !== id);

      if (filtered.length === notes.length) {
        return this.failure('NOTE_NOT_FOUND', `Note with ID ${id} not found.`);
      }

      this.saveStoredNotes(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('NOTE_DELETE_ERROR', 'Failed to delete note.', { err });
    }
  }

  async togglePin(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Note>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const notes = this.getStoredNotes(userId);
      const index = notes.findIndex((n) => n.id === id);

      if (index === -1) {
        return this.failure('NOTE_NOT_FOUND', `Note with ID ${id} not found.`);
      }

      const current = notes[index];
      const updated: Note = {
        ...current,
        isPinned: !current.isPinned,
        updatedAt: new Date().toISOString(),
      };

      notes[index] = updated;
      this.saveStoredNotes(userId, notes);

      return this.success(updated);
    } catch (err) {
      return this.failure('NOTE_TOGGLE_ERROR', 'Failed to toggle pin state.', { err });
    }
  }

  async toggleArchive(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Note>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const notes = this.getStoredNotes(userId);
      const index = notes.findIndex((n) => n.id === id);

      if (index === -1) {
        return this.failure('NOTE_NOT_FOUND', `Note with ID ${id} not found.`);
      }

      const current = notes[index];
      const updated: Note = {
        ...current,
        isArchived: !current.isArchived,
        updatedAt: new Date().toISOString(),
      };

      notes[index] = updated;
      this.saveStoredNotes(userId, notes);

      return this.success(updated);
    } catch (err) {
      return this.failure('NOTE_TOGGLE_ERROR', 'Failed to toggle archive state.', { err });
    }
  }

  async searchNotes(userIdOrQuery: string, maybeQuery?: string): Promise<ServiceResult<readonly Note[]>> {
    try {
      const userId = maybeQuery ? await this.resolveUserId(userIdOrQuery) : await this.resolveUserId();
      const query = maybeQuery || userIdOrQuery;

      const notes = this.getStoredNotes(userId);
      if (!query || !query.trim()) {
        return this.success(notes.filter((n) => !n.isArchived));
      }

      const q = query.toLowerCase().trim();
      const matched = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );

      return this.success(matched);
    } catch (err) {
      return this.failure('NOTE_SEARCH_ERROR', 'Failed to search notes.', { err });
    }
  }
}

export const noteService = new NoteService();

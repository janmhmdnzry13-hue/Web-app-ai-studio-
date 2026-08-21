/**
 * Note Service Contract
 */
import { ServiceResult } from '../types/common.types';
import { Note, NoteFolder } from '../types/note.types';
import { BaseService } from './base.service';

export interface INoteService {
  getNotes(folderId?: string): Promise<ServiceResult<readonly Note[]>>;
  getFolders(): Promise<ServiceResult<readonly NoteFolder[]>>;
  getNoteById(id: string): Promise<ServiceResult<Note>>;
  searchNotes(query: string): Promise<ServiceResult<readonly Note[]>>;
}

export class NoteService extends BaseService implements INoteService {
  async getNotes(_folderId?: string): Promise<ServiceResult<readonly Note[]>> {
    return this.success([]);
  }

  async getFolders(): Promise<ServiceResult<readonly NoteFolder[]>> {
    return this.success([]);
  }

  async getNoteById(id: string): Promise<ServiceResult<Note>> {
    return this.failure('NOTE_NOT_FOUND', `Note with ID ${id} not found.`);
  }

  async searchNotes(_query: string): Promise<ServiceResult<readonly Note[]>> {
    return this.success([]);
  }
}

export const noteService = new NoteService();

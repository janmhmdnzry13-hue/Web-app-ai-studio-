import { db, NoteRecord } from '../../db';
import { INoteRepository, NoteFilterOptions } from '../interfaces';

export class JsonNoteRepository implements INoteRepository {
  async findByUserId(userId: string, filter?: NoteFilterOptions): Promise<NoteRecord[]> {
    let notes = db.schema.notes.filter((n) => n.userId === userId);

    if (filter) {
      if (filter.folderId !== undefined) {
        notes = notes.filter((n) => n.folderId === filter.folderId);
      }
      if (filter.isPinned !== undefined) {
        notes = notes.filter((n) => n.isPinned === filter.isPinned);
      }
      if (filter.isArchived !== undefined) {
        notes = notes.filter((n) => n.isArchived === filter.isArchived);
      }
    }

    return notes.map((n) => ({ ...n }));
  }

  async findById(id: string, userId?: string): Promise<NoteRecord | null> {
    const note = db.schema.notes.find((n) => n.id === id && (!userId || n.userId === userId));
    return note ? { ...note } : null;
  }

  async create(note: NoteRecord): Promise<NoteRecord> {
    db.schema.notes.unshift(note);
    await db.save();
    return { ...note };
  }

  async update(id: string, userId: string, updates: Partial<NoteRecord>): Promise<NoteRecord | null> {
    const note = db.schema.notes.find((n) => n.id === id && n.userId === userId);
    if (!note) return null;

    Object.assign(note, updates, {
      id: note.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...note };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.notes.length;
    db.schema.notes = db.schema.notes.filter((n) => !(n.id === id && n.userId === userId));

    if (db.schema.notes.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }
}

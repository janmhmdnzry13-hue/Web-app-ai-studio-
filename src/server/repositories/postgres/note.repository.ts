import { query } from '../../db/postgres';
import { db, NoteRecord } from '../../db';
import { INoteRepository, NoteFilterOptions } from '../interfaces';
import { mapNoteRow } from './mappers';

export class PostgresNoteRepository implements INoteRepository {
  async findByUserId(userId: string, filter?: NoteFilterOptions): Promise<NoteRecord[]> {
    let sql = 'SELECT * FROM notes WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.isPinned !== undefined) {
      params.push(filter.isPinned);
      sql += ` AND is_pinned = $${params.length}`;
    }
    if (filter?.isArchived !== undefined) {
      params.push(filter.isArchived);
      sql += ` AND is_archived = $${params.length}`;
    }
    if (filter?.folderId) {
      params.push(filter.folderId);
      sql += ` AND folder_id = $${params.length}`;
    }
    if (filter?.tag) {
      params.push(filter.tag);
      sql += ` AND $${params.length} = ANY(tags)`;
    }
    if (filter?.search) {
      params.push(`%${filter.search}%`);
      sql += ` AND (title ILIKE $${params.length} OR content ILIKE $${params.length})`;
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';

    const res = await query(sql, params);
    return res.rows.map((row) => {
      const record = mapNoteRow(row);
      if (record.isEncrypted && record.content) {
        record.content = db.decrypt(record.content);
      }
      return record;
    });
  }

  async findById(id: string, userId?: string): Promise<NoteRecord | null> {
    let sql = 'SELECT * FROM notes WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;

    const record = mapNoteRow(res.rows[0]);
    if (record.isEncrypted && record.content) {
      record.content = db.decrypt(record.content);
    }
    return record;
  }

  async create(note: NoteRecord): Promise<NoteRecord> {
    const rawContent = note.content || '';
    const encryptedContent = note.isEncrypted ? db.encrypt(rawContent) : rawContent;
    const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;

    const sql = `
      INSERT INTO notes (
        id, user_id, folder_id, title, content, tags,
        is_pinned, is_archived, word_count, linked_note_ids,
        is_encrypted, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13
      )
      RETURNING *
    `;

    const values = [
      note.id,
      note.userId,
      note.folderId || null,
      note.title || 'Untitled',
      encryptedContent,
      Array.isArray(note.tags) ? note.tags : [],
      Boolean(note.isPinned),
      Boolean(note.isArchived),
      wordCount,
      Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : [],
      Boolean(note.isEncrypted),
      note.createdAt ? new Date(note.createdAt) : new Date(),
      note.updatedAt ? new Date(note.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    const saved = mapNoteRow(res.rows[0]);
    saved.content = rawContent;
    return saved;
  }

  async update(id: string, userId: string, updates: Partial<NoteRecord>): Promise<NoteRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged: NoteRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const rawContent = merged.content || '';
    const encryptedContent = merged.isEncrypted ? db.encrypt(rawContent) : rawContent;
    const wordCount = rawContent.trim() ? rawContent.trim().split(/\s+/).length : 0;

    const sql = `
      UPDATE notes SET
        folder_id = $3,
        title = $4,
        content = $5,
        tags = $6,
        is_pinned = $7,
        is_archived = $8,
        word_count = $9,
        linked_note_ids = $10,
        is_encrypted = $11,
        updated_at = $12
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.folderId || null,
      merged.title || 'Untitled',
      encryptedContent,
      Array.isArray(merged.tags) ? merged.tags : [],
      Boolean(merged.isPinned),
      Boolean(merged.isArchived),
      wordCount,
      Array.isArray(merged.linkedNoteIds) ? merged.linkedNoteIds : [],
      Boolean(merged.isEncrypted),
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;

    const saved = mapNoteRow(res.rows[0]);
    saved.content = rawContent;
    return saved;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }
}

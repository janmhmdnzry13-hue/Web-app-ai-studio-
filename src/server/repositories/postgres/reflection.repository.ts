import { query } from '../../db/postgres';
import { db, ReflectionRecord } from '../../db';
import { IReflectionRepository } from '../interfaces';
import { mapReflectionRow } from './mappers';
import { generateCryptoToken } from '../../auth';

export class PostgresReflectionRepository implements IReflectionRepository {
  async findByUserId(userId: string): Promise<ReflectionRecord[]> {
    const res = await query(
      'SELECT * FROM reflections WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [userId]
    );

    return res.rows.map((row) => {
      let journal = row.journal_entry || '';
      if (row.is_encrypted && journal) {
        journal = db.decrypt(journal);
      }
      return mapReflectionRow(row, journal);
    });
  }

  async findByDate(userId: string, date: string): Promise<ReflectionRecord | null> {
    const res = await query(
      'SELECT * FROM reflections WHERE user_id = $1 AND date = $2',
      [userId, date]
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    let journal = row.journal_entry || '';
    if (row.is_encrypted && journal) {
      journal = db.decrypt(journal);
    }
    return mapReflectionRow(row, journal);
  }

  async findById(id: string, userId?: string): Promise<ReflectionRecord | null> {
    let sql = 'SELECT * FROM reflections WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    let journal = row.journal_entry || '';
    if (row.is_encrypted && journal) {
      journal = db.decrypt(journal);
    }
    return mapReflectionRow(row, journal);
  }

  async upsert(
    userId: string,
    date: string,
    data: {
      energyLevel?: number;
      clarityLevel?: number;
      stressLevel?: number;
      primaryEmotion?: string;
      journalEntry?: string;
      wins?: string[];
      gratitudes?: string[];
      learnings?: string[];
    }
  ): Promise<ReflectionRecord> {
    const existing = await this.findByDate(userId, date);

    const energyLevel = data.energyLevel !== undefined ? data.energyLevel : (existing?.energyLevel ?? 5);
    const clarityLevel = data.clarityLevel !== undefined ? data.clarityLevel : (existing?.clarityLevel ?? 5);
    const stressLevel = data.stressLevel !== undefined ? data.stressLevel : (existing?.stressLevel ?? 5);
    const primaryEmotion = data.primaryEmotion !== undefined ? data.primaryEmotion : (existing?.primaryEmotion ?? 'neutral');
    const journalEntry = data.journalEntry !== undefined ? data.journalEntry : (existing?.journalEntry ?? '');
    const wins = data.wins !== undefined ? data.wins : (existing?.wins ?? []);
    const gratitudes = data.gratitudes !== undefined ? data.gratitudes : (existing?.gratitudes ?? []);
    const learnings = data.learnings !== undefined ? data.learnings : (existing?.learnings ?? []);

    const encryptedJournal = journalEntry ? db.encrypt(journalEntry) : '';
    const newId = existing?.id || generateCryptoToken('ref');

    const sql = `
      INSERT INTO reflections (
        id, user_id, date, energy_level, clarity_level, stress_level,
        primary_emotion, journal_entry, wins, gratitudes, learnings,
        is_encrypted, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        energy_level = EXCLUDED.energy_level,
        clarity_level = EXCLUDED.clarity_level,
        stress_level = EXCLUDED.stress_level,
        primary_emotion = EXCLUDED.primary_emotion,
        journal_entry = EXCLUDED.journal_entry,
        wins = EXCLUDED.wins,
        gratitudes = EXCLUDED.gratitudes,
        learnings = EXCLUDED.learnings,
        is_encrypted = EXCLUDED.is_encrypted,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      newId,
      userId,
      date,
      energyLevel,
      clarityLevel,
      stressLevel,
      primaryEmotion,
      encryptedJournal,
      wins,
      gratitudes,
      learnings,
      true,
      existing?.createdAt ? new Date(existing.createdAt) : new Date(),
      new Date(),
    ];

    const res = await query(sql, values);
    return mapReflectionRow(res.rows[0], journalEntry);
  }

  async create(reflection: ReflectionRecord): Promise<ReflectionRecord> {
    const rawJournal = reflection.journalEntry || '';
    const encryptedJournal = reflection.isEncrypted ? db.encrypt(rawJournal) : rawJournal;

    const sql = `
      INSERT INTO reflections (
        id, user_id, date, energy_level, clarity_level, stress_level,
        primary_emotion, journal_entry, wins, gratitudes, learnings,
        is_encrypted, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        energy_level = EXCLUDED.energy_level,
        clarity_level = EXCLUDED.clarity_level,
        stress_level = EXCLUDED.stress_level,
        primary_emotion = EXCLUDED.primary_emotion,
        journal_entry = EXCLUDED.journal_entry,
        wins = EXCLUDED.wins,
        gratitudes = EXCLUDED.gratitudes,
        learnings = EXCLUDED.learnings,
        is_encrypted = EXCLUDED.is_encrypted,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      reflection.id,
      reflection.userId,
      reflection.date,
      reflection.energyLevel != null ? reflection.energyLevel : 5,
      reflection.clarityLevel != null ? reflection.clarityLevel : 5,
      reflection.stressLevel != null ? reflection.stressLevel : 5,
      reflection.primaryEmotion || 'neutral',
      encryptedJournal,
      Array.isArray(reflection.wins) ? reflection.wins : [],
      Array.isArray(reflection.gratitudes) ? reflection.gratitudes : [],
      Array.isArray(reflection.learnings) ? reflection.learnings : [],
      Boolean(reflection.isEncrypted),
      reflection.createdAt ? new Date(reflection.createdAt) : new Date(),
      reflection.updatedAt ? new Date(reflection.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapReflectionRow(res.rows[0], rawJournal);
  }

  async update(id: string, userId: string, updates: Partial<ReflectionRecord>): Promise<ReflectionRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged: ReflectionRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const rawJournal = merged.journalEntry || '';
    const encryptedJournal = merged.isEncrypted ? db.encrypt(rawJournal) : rawJournal;

    const sql = `
      UPDATE reflections SET
        date = $3,
        energy_level = $4,
        clarity_level = $5,
        stress_level = $6,
        primary_emotion = $7,
        journal_entry = $8,
        wins = $9,
        gratitudes = $10,
        learnings = $11,
        is_encrypted = $12,
        updated_at = $13
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.date,
      merged.energyLevel,
      merged.clarityLevel,
      merged.stressLevel,
      merged.primaryEmotion,
      encryptedJournal,
      Array.isArray(merged.wins) ? merged.wins : [],
      Array.isArray(merged.gratitudes) ? merged.gratitudes : [],
      Array.isArray(merged.learnings) ? merged.learnings : [],
      Boolean(merged.isEncrypted),
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapReflectionRow(res.rows[0], rawJournal);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM reflections WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }
}

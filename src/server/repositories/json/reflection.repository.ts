import { db, ReflectionRecord } from '../../db';
import { IReflectionRepository } from '../interfaces';
import { generateCryptoToken } from '../../auth';

export class JsonReflectionRepository implements IReflectionRepository {
  async findByUserId(userId: string): Promise<ReflectionRecord[]> {
    const refs = db.schema.reflections.filter((r) => r.userId === userId);
    return refs.map((r) => ({
      ...r,
      journalEntry: r.isEncrypted ? db.decrypt(r.journalEntry) : r.journalEntry,
    }));
  }

  async findByDate(userId: string, date: string): Promise<ReflectionRecord | null> {
    const ref = db.schema.reflections.find((r) => r.userId === userId && r.date === date);
    if (!ref) return null;
    return {
      ...ref,
      journalEntry: ref.isEncrypted ? db.decrypt(ref.journalEntry) : ref.journalEntry,
    };
  }

  async findById(id: string, userId?: string): Promise<ReflectionRecord | null> {
    const ref = db.schema.reflections.find((r) => r.id === id && (!userId || r.userId === userId));
    if (!ref) return null;
    return {
      ...ref,
      journalEntry: ref.isEncrypted ? db.decrypt(ref.journalEntry) : ref.journalEntry,
    };
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
    const existing = db.schema.reflections.find((r) => r.userId === userId && r.date === date);
    const encryptedJournal = data.journalEntry !== undefined ? (data.journalEntry ? db.encrypt(data.journalEntry) : '') : undefined;

    if (existing) {
      if (data.energyLevel !== undefined) existing.energyLevel = data.energyLevel;
      if (data.clarityLevel !== undefined) existing.clarityLevel = data.clarityLevel;
      if (data.stressLevel !== undefined) existing.stressLevel = data.stressLevel;
      if (data.primaryEmotion !== undefined) existing.primaryEmotion = data.primaryEmotion;
      if (encryptedJournal !== undefined) {
        existing.journalEntry = encryptedJournal;
        existing.isEncrypted = true;
      }
      if (data.wins !== undefined) existing.wins = data.wins;
      if (data.gratitudes !== undefined) existing.gratitudes = data.gratitudes;
      if (data.learnings !== undefined) existing.learnings = data.learnings;
      existing.updatedAt = new Date().toISOString();

      await db.save();
      return {
        ...existing,
        journalEntry: data.journalEntry !== undefined ? data.journalEntry : (existing.isEncrypted ? db.decrypt(existing.journalEntry) : existing.journalEntry),
      };
    }

    const newRef: ReflectionRecord = {
      id: generateCryptoToken('ref'),
      userId,
      date,
      energyLevel: data.energyLevel ?? 7,
      clarityLevel: data.clarityLevel ?? 7,
      stressLevel: data.stressLevel ?? 3,
      primaryEmotion: data.primaryEmotion || 'Calm & Grounded',
      journalEntry: encryptedJournal !== undefined ? encryptedJournal : '',
      wins: data.wins || [],
      gratitudes: data.gratitudes || [],
      learnings: data.learnings || [],
      isEncrypted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.reflections.unshift(newRef);
    await db.save();

    return {
      ...newRef,
      journalEntry: data.journalEntry || '',
    };
  }

  async create(reflection: ReflectionRecord): Promise<ReflectionRecord> {
    db.schema.reflections.unshift(reflection);
    await db.save();
    return { ...reflection };
  }

  async update(id: string, userId: string, updates: Partial<ReflectionRecord>): Promise<ReflectionRecord | null> {
    const ref = db.schema.reflections.find((r) => r.id === id && r.userId === userId);
    if (!ref) return null;

    Object.assign(ref, updates, {
      id: ref.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...ref };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.reflections.length;
    db.schema.reflections = db.schema.reflections.filter((r) => !(r.id === id && r.userId === userId));

    if (db.schema.reflections.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }
}

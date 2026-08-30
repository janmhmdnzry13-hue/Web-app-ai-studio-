import { db, AIMemoryRecord } from '../../db';
import { IAIMemoryRepository } from '../interfaces';

export class JsonAIMemoryRepository implements IAIMemoryRepository {
  async findByUserId(userId: string): Promise<AIMemoryRecord[]> {
    return db.schema.aiMemories.filter((m) => m.userId === userId).map((m) => ({ ...m }));
  }

  async findByKey(userId: string, key: string): Promise<AIMemoryRecord | null> {
    const memory = db.schema.aiMemories.find((m) => m.userId === userId && m.key === key);
    return memory ? { ...memory } : null;
  }

  async create(memory: AIMemoryRecord): Promise<AIMemoryRecord> {
    db.schema.aiMemories.unshift(memory);
    await db.save();
    return { ...memory };
  }

  async update(id: string, userId: string, updates: Partial<AIMemoryRecord>): Promise<AIMemoryRecord | null> {
    const memory = db.schema.aiMemories.find((m) => m.id === id && m.userId === userId);
    if (!memory) return null;

    Object.assign(memory, updates, {
      id: memory.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...memory };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.aiMemories.length;
    db.schema.aiMemories = db.schema.aiMemories.filter((m) => !(m.id === id && m.userId === userId));

    if (db.schema.aiMemories.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }
}

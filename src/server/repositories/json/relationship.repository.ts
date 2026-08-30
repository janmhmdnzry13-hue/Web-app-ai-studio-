import { db, RelationshipRecord } from '../../db';
import { IRelationshipRepository } from '../interfaces';

export class JsonRelationshipRepository implements IRelationshipRepository {
  async findByUserId(userId: string): Promise<RelationshipRecord[]> {
    return db.schema.relationships.filter((r) => r.userId === userId).map((r) => ({ ...r }));
  }

  async findById(id: string, userId?: string): Promise<RelationshipRecord | null> {
    const rel = db.schema.relationships.find((r) => r.id === id && (!userId || r.userId === userId));
    return rel ? { ...rel } : null;
  }

  async create(relationship: RelationshipRecord): Promise<RelationshipRecord> {
    db.schema.relationships.unshift(relationship);
    await db.save();
    return { ...relationship };
  }

  async update(id: string, userId: string, updates: Partial<RelationshipRecord>): Promise<RelationshipRecord | null> {
    const rel = db.schema.relationships.find((r) => r.id === id && r.userId === userId);
    if (!rel) return null;

    Object.assign(rel, updates, {
      id: rel.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...rel };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.relationships.length;
    db.schema.relationships = db.schema.relationships.filter((r) => !(r.id === id && r.userId === userId));

    if (db.schema.relationships.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }
}

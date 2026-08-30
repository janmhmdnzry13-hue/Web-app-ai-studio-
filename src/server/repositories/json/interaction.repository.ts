import { db, ContactInteractionRecord } from '../../db';
import { IInteractionRepository } from '../interfaces';

export class JsonInteractionRepository implements IInteractionRepository {
  async findByUserId(userId: string, contactId?: string): Promise<ContactInteractionRecord[]> {
    let interactions = db.schema.interactions.filter((i) => i.userId === userId);
    if (contactId) {
      interactions = interactions.filter((i) => i.contactId === contactId);
    }
    return interactions.map((i) => ({ ...i }));
  }

  async findById(id: string, userId?: string): Promise<ContactInteractionRecord | null> {
    const interaction = db.schema.interactions.find((i) => i.id === id && (!userId || i.userId === userId));
    return interaction ? { ...interaction } : null;
  }

  async create(interaction: ContactInteractionRecord): Promise<ContactInteractionRecord> {
    db.schema.interactions.unshift(interaction);
    await db.save();
    return { ...interaction };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.interactions.length;
    db.schema.interactions = db.schema.interactions.filter((i) => !(i.id === id && i.userId === userId));

    if (db.schema.interactions.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }
}

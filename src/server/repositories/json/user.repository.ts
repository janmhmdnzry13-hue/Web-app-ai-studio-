import { db, UserRecord } from '../../db';
import { IUserRepository } from '../interfaces';
import { toPublicUser } from '../../auth';

export class JsonUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    const user = db.schema.users.find((u) => u.id === id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const user = db.schema.users.find((u) => u.email.toLowerCase() === cleanEmail);
    return user ? { ...user } : null;
  }

  async findByVerificationToken(token: string): Promise<UserRecord | null> {
    const user = db.schema.users.find((u) => u.verificationToken === token);
    return user ? { ...user } : null;
  }

  async create(user: UserRecord): Promise<UserRecord> {
    db.schema.users.push(user);
    await db.save();
    return { ...user };
  }

  async update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    const user = db.schema.users.find((u) => u.id === id);
    if (!user) return null;

    Object.assign(user, updates, {
      id: user.id, // Immutable ID
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...user };
  }

  async updateProfile(id: string, profileUpdates: Partial<UserRecord['profile']>): Promise<UserRecord | null> {
    const user = db.schema.users.find((u) => u.id === id);
    if (!user) return null;

    user.profile = {
      ...user.profile,
      ...profileUpdates,
    };
    user.updatedAt = new Date().toISOString();

    await db.save();
    return { ...user };
  }

  async updatePreferences(id: string, preferenceUpdates: Partial<UserRecord['preferences']>): Promise<UserRecord | null> {
    const user = db.schema.users.find((u) => u.id === id);
    if (!user) return null;

    user.preferences = {
      ...user.preferences,
      ...preferenceUpdates,
    };
    user.updatedAt = new Date().toISOString();

    await db.save();
    return { ...user };
  }

  async delete(id: string): Promise<boolean> {
    const initialLen = db.schema.users.length;
    db.schema.users = db.schema.users.filter((u) => u.id !== id);
    if (db.schema.users.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }

  async seedStarterData(userId: string): Promise<void> {
    db.seedUserStarterData(userId);
    await db.save();
  }

  async purgeAllUserData(userId: string): Promise<void> {
    db.schema.users = db.schema.users.filter((u) => u.id !== userId);
    db.schema.tasks = db.schema.tasks.filter((t) => t.userId !== userId);
    db.schema.habits = db.schema.habits.filter((h) => h.userId !== userId);
    db.schema.habitLogs = db.schema.habitLogs.filter((hl) => hl.userId !== userId);
    db.schema.goals = db.schema.goals.filter((g) => g.userId !== userId);
    db.schema.transactions = db.schema.transactions.filter((tx) => tx.userId !== userId);
    db.schema.budgets = db.schema.budgets.filter((b) => b.userId !== userId);
    db.schema.reflections = db.schema.reflections.filter((r) => r.userId !== userId);
    db.schema.relationships = db.schema.relationships.filter((rel) => rel.userId !== userId);
    db.schema.interactions = db.schema.interactions.filter((i) => i.userId !== userId);
    db.schema.notes = db.schema.notes.filter((n) => n.userId !== userId);
    db.schema.aiMemories = db.schema.aiMemories.filter((m) => m.userId !== userId);
    db.schema.notifications = db.schema.notifications.filter((n) => n.userId !== userId);
    db.schema.scheduledNotifications = db.schema.scheduledNotifications.filter((sn) => sn.userId !== userId);

    await db.save();
  }

  async exportAllUserData(userId: string): Promise<Record<string, any>> {
    const user = db.schema.users.find((u) => u.id === userId);
    return {
      user: user ? toPublicUser(user) : null,
      tasks: db.schema.tasks.filter((t) => t.userId === userId),
      habits: db.schema.habits.filter((h) => h.userId === userId),
      habitLogs: db.schema.habitLogs.filter((hl) => hl.userId === userId),
      goals: db.schema.goals.filter((g) => g.userId === userId),
      transactions: db.schema.transactions.filter((tx) => tx.userId === userId),
      budgets: db.schema.budgets.filter((b) => b.userId === userId),
      reflections: db.schema.reflections.filter((r) => r.userId === userId),
      relationships: db.schema.relationships.filter((rel) => rel.userId === userId),
      interactions: db.schema.interactions.filter((i) => i.userId === userId),
      notes: db.schema.notes.filter((n) => n.userId === userId),
      exportedAt: new Date().toISOString(),
    };
  }
}

import { db, GoalRecord } from '../../db';
import { IGoalRepository } from '../interfaces';

export class JsonGoalRepository implements IGoalRepository {
  async findByUserId(userId: string, filter?: { status?: string }): Promise<GoalRecord[]> {
    let goals = db.schema.goals.filter((g) => g.userId === userId);
    if (filter?.status) {
      goals = goals.filter((g) => g.status === filter.status);
    }
    return goals.map((g) => ({ ...g }));
  }

  async findById(id: string, userId?: string): Promise<GoalRecord | null> {
    const goal = db.schema.goals.find((g) => g.id === id && (!userId || g.userId === userId));
    return goal ? { ...goal } : null;
  }

  async create(goal: GoalRecord): Promise<GoalRecord> {
    db.schema.goals.unshift(goal);
    await db.save();
    return { ...goal };
  }

  async update(id: string, userId: string, updates: Partial<GoalRecord>): Promise<GoalRecord | null> {
    const goal = db.schema.goals.find((g) => g.id === id && g.userId === userId);
    if (!goal) return null;

    Object.assign(goal, updates, {
      id: goal.id,
      userId, // Preserve ownership
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...goal };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.goals.length;
    db.schema.goals = db.schema.goals.filter((g) => !(g.id === id && g.userId === userId));

    if (db.schema.goals.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return db.schema.goals.filter((g) => g.userId === userId && g.status === 'active').length;
  }
}

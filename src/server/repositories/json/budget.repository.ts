import { db, BudgetRecord } from '../../db';
import { IBudgetRepository } from '../interfaces';

export class JsonBudgetRepository implements IBudgetRepository {
  async findByUserId(userId: string): Promise<BudgetRecord[]> {
    return db.schema.budgets.filter((b) => b.userId === userId).map((b) => ({ ...b }));
  }

  async findById(id: string, userId?: string): Promise<BudgetRecord | null> {
    const budget = db.schema.budgets.find((b) => b.id === id && (!userId || b.userId === userId));
    return budget ? { ...budget } : null;
  }

  async findByCategory(userId: string, category: string): Promise<BudgetRecord | null> {
    const budget = db.schema.budgets.find(
      (b) => b.userId === userId && b.category.toLowerCase() === category.toLowerCase()
    );
    return budget ? { ...budget } : null;
  }

  async create(budget: BudgetRecord): Promise<BudgetRecord> {
    db.schema.budgets.unshift(budget);
    await db.save();
    return { ...budget };
  }

  async update(id: string, userId: string, updates: Partial<BudgetRecord>): Promise<BudgetRecord | null> {
    const budget = db.schema.budgets.find((b) => b.id === id && b.userId === userId);
    if (!budget) return null;

    Object.assign(budget, updates, {
      id: budget.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...budget };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.budgets.length;
    db.schema.budgets = db.schema.budgets.filter((b) => !(b.id === id && b.userId === userId));

    if (db.schema.budgets.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }
}

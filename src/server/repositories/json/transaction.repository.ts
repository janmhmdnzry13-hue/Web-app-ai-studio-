import { db, TransactionRecord } from '../../db';
import { ITransactionRepository, TransactionFilterOptions, FinanceSummary } from '../interfaces';

export class JsonTransactionRepository implements ITransactionRepository {
  async findByUserId(userId: string, filter?: TransactionFilterOptions): Promise<TransactionRecord[]> {
    let txs = db.schema.transactions.filter((t) => t.userId === userId);

    if (filter) {
      if (filter.type) {
        txs = txs.filter((t) => t.type === filter.type);
      }
      if (filter.category) {
        txs = txs.filter((t) => t.category.toLowerCase() === filter.category!.toLowerCase());
      }
      if (filter.startDate) {
        txs = txs.filter((t) => t.date >= filter.startDate!);
      }
      if (filter.endDate) {
        txs = txs.filter((t) => t.date <= filter.endDate!);
      }
      if (filter.month) {
        txs = txs.filter((t) => t.date.startsWith(filter.month!));
      }
    }

    return txs.map((t) => ({ ...t }));
  }

  async findById(id: string, userId?: string): Promise<TransactionRecord | null> {
    const tx = db.schema.transactions.find((t) => t.id === id && (!userId || t.userId === userId));
    return tx ? { ...tx } : null;
  }

  async create(transaction: TransactionRecord): Promise<TransactionRecord> {
    db.schema.transactions.unshift(transaction);
    await db.save();
    return { ...transaction };
  }

  async update(id: string, userId: string, updates: Partial<TransactionRecord>): Promise<TransactionRecord | null> {
    const tx = db.schema.transactions.find((t) => t.id === id && t.userId === userId);
    if (!tx) return null;

    Object.assign(tx, updates, {
      id: tx.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...tx };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.transactions.length;
    db.schema.transactions = db.schema.transactions.filter((t) => !(t.id === id && t.userId === userId));

    if (db.schema.transactions.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }

  async getSummary(userId: string): Promise<FinanceSummary> {
    const txs = db.schema.transactions.filter((t) => t.userId === userId);
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of txs) {
      if (t.type === 'income') totalIncome += t.amount;
      else totalExpense += t.amount;
    }

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      savingsRatePercentage: totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
      transactionCount: txs.length,
    };
  }
}

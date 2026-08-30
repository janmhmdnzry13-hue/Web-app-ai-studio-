import { query } from '../../db/postgres';
import { TransactionRecord } from '../../db';
import { ITransactionRepository, TransactionFilterOptions, FinanceSummary } from '../interfaces';
import { mapTransactionRow } from './mappers';

export class PostgresTransactionRepository implements ITransactionRepository {
  async findByUserId(userId: string, filter?: TransactionFilterOptions): Promise<TransactionRecord[]> {
    let sql = 'SELECT * FROM financial_transactions WHERE user_id = $1';
    const params: any[] = [userId];

    if (filter?.type) {
      params.push(filter.type);
      sql += ` AND type = $${params.length}`;
    }
    if (filter?.category) {
      params.push(filter.category);
      sql += ` AND category = $${params.length}`;
    }
    if (filter?.startDate) {
      params.push(filter.startDate);
      sql += ` AND date >= $${params.length}`;
    }
    if (filter?.endDate) {
      params.push(filter.endDate);
      sql += ` AND date <= $${params.length}`;
    }
    if (filter?.minAmount !== undefined) {
      params.push(filter.minAmount);
      sql += ` AND amount >= $${params.length}`;
    }
    if (filter?.maxAmount !== undefined) {
      params.push(filter.maxAmount);
      sql += ` AND amount <= $${params.length}`;
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const res = await query(sql, params);
    return res.rows.map(mapTransactionRow);
  }

  async findById(id: string, userId?: string): Promise<TransactionRecord | null> {
    let sql = 'SELECT * FROM financial_transactions WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return mapTransactionRow(res.rows[0]);
  }

  async create(tx: TransactionRecord): Promise<TransactionRecord> {
    const amount = Number(tx.amount != null ? tx.amount : 0);
    const minorUnits =
      tx.minorUnits != null ? tx.minorUnits : Math.round(amount * 100);

    const sql = `
      INSERT INTO financial_transactions (
        id, user_id, title, amount, minor_units, currency,
        type, category, date, payment_method, is_recurring,
        merchant_or_source, notes, is_encrypted,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16
      )
      RETURNING *
    `;

    const values = [
      tx.id,
      tx.userId,
      tx.title,
      amount,
      minorUnits,
      'USD',
      tx.type,
      tx.category,
      tx.date,
      tx.paymentMethod || null,
      Boolean(tx.isRecurring),
      null,
      tx.notes || null,
      Boolean(tx.isEncrypted),
      tx.createdAt ? new Date(tx.createdAt) : new Date(),
      tx.updatedAt ? new Date(tx.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapTransactionRow(res.rows[0]);
  }

  async update(id: string, userId: string, updates: Partial<TransactionRecord>): Promise<TransactionRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged: TransactionRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const amount = Number(merged.amount != null ? merged.amount : 0);
    const minorUnits =
      merged.minorUnits != null ? merged.minorUnits : Math.round(amount * 100);

    const sql = `
      UPDATE financial_transactions SET
        title = $3,
        amount = $4,
        minor_units = $5,
        type = $6,
        category = $7,
        date = $8,
        payment_method = $9,
        is_recurring = $10,
        notes = $11,
        is_encrypted = $12,
        updated_at = $13
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.title,
      amount,
      minorUnits,
      merged.type,
      merged.category,
      merged.date,
      merged.paymentMethod || null,
      Boolean(merged.isRecurring),
      merged.notes || null,
      Boolean(merged.isEncrypted),
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapTransactionRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM financial_transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }

  async getSummary(userId: string): Promise<FinanceSummary> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const sql = `
      SELECT type, category, SUM(amount) as total
      FROM financial_transactions
      WHERE user_id = $1 AND date LIKE $2
      GROUP BY type, category
    `;

    const res = await query(sql, [userId, `${currentMonth}%`]);

    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const byCategory: Record<string, number> = {};

    for (const row of res.rows) {
      const total = Number(row.total || 0);
      if (row.type === 'income') {
        monthlyIncome += total;
      } else if (row.type === 'expense') {
        monthlyExpenses += total;
        byCategory[row.category] = (byCategory[row.category] || 0) + total;
      }
    }

    return {
      monthlyIncome: Math.round(monthlyIncome * 100) / 100,
      monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
      netBalance: Math.round((monthlyIncome - monthlyExpenses) * 100) / 100,
      byCategory,
    };
  }
}

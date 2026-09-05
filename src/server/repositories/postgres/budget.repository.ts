import { query } from '../../db/postgres';
import { BudgetRecord } from '../../db';
import { IBudgetRepository } from '../interfaces';
import { mapBudgetRow } from './mappers';

export class PostgresBudgetRepository implements IBudgetRepository {
  async findByUserId(userId: string): Promise<BudgetRecord[]> {
    const res = await query(
      'SELECT * FROM budgets WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    return res.rows.map(mapBudgetRow);
  }

  async findById(id: string, userId?: string): Promise<BudgetRecord | null> {
    let sql = 'SELECT * FROM budgets WHERE id = $1';
    const params: any[] = [id];

    if (userId) {
      sql += ' AND user_id = $2';
      params.push(userId);
    }

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return mapBudgetRow(res.rows[0]);
  }

  async findByCategory(userId: string, category: string): Promise<BudgetRecord | null> {
    const res = await query(
      'SELECT * FROM budgets WHERE user_id = $1 AND LOWER(category) = LOWER($2)',
      [userId, category]
    );
    if (res.rows.length === 0) return null;
    return mapBudgetRow(res.rows[0]);
  }

  async create(budget: BudgetRecord): Promise<BudgetRecord> {
    const limitAmount = Number(budget.limitAmount != null ? budget.limitAmount : (budget.amount != null ? budget.amount : 0));
    const limitMinorUnits =
      budget.limitMinorUnits != null
        ? budget.limitMinorUnits
        : budget.amountMinorUnits != null
        ? budget.amountMinorUnits
        : Math.round(limitAmount * 100);
    const monthYear = budget.monthYear || 'all';

    const sql = `
      INSERT INTO budgets (
        id, user_id, category, limit_amount, limit_minor_units,
        period, month_year, alert_threshold_percentage,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10
      )
      ON CONFLICT (id) DO UPDATE SET
        limit_amount = EXCLUDED.limit_amount,
        limit_minor_units = EXCLUDED.limit_minor_units,
        period = EXCLUDED.period,
        month_year = EXCLUDED.month_year,
        alert_threshold_percentage = EXCLUDED.alert_threshold_percentage,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const values = [
      budget.id,
      budget.userId,
      budget.category,
      limitAmount,
      limitMinorUnits,
      budget.period || 'monthly',
      monthYear,
      budget.alertThresholdPercentage != null ? budget.alertThresholdPercentage : 80,
      budget.createdAt ? new Date(budget.createdAt) : new Date(),
      budget.updatedAt ? new Date(budget.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapBudgetRow(res.rows[0]);
  }

  async update(id: string, userId: string, updates: Partial<BudgetRecord>): Promise<BudgetRecord | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const merged: BudgetRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    const limitAmount = Number(merged.limitAmount != null ? merged.limitAmount : (merged.amount != null ? merged.amount : 0));
    const limitMinorUnits =
      merged.limitMinorUnits != null
        ? merged.limitMinorUnits
        : merged.amountMinorUnits != null
        ? merged.amountMinorUnits
        : Math.round(limitAmount * 100);
    const monthYear = merged.monthYear || 'all';

    const sql = `
      UPDATE budgets SET
        category = $3,
        limit_amount = $4,
        limit_minor_units = $5,
        period = $6,
        month_year = $7,
        alert_threshold_percentage = $8,
        updated_at = $9
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [
      id,
      userId,
      merged.category,
      limitAmount,
      limitMinorUnits,
      merged.period || 'monthly',
      monthYear,
      merged.alertThresholdPercentage != null ? merged.alertThresholdPercentage : 80,
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapBudgetRow(res.rows[0]);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [id, userId]);
    return (res.rowCount || 0) > 0;
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { financeService, toMinorUnits, toMajorUnits } from '../finance.service';
import { safeStorage } from '../../lib/storage';

describe('FinanceService and Safe Financial Arithmetic', () => {
  const userId = 'user_test_finance_1';

  beforeEach(() => {
    safeStorage.clear();
  });

  describe('Minor / Major Unit Conversions (Floating-point safety)', () => {
    it('converts floating dollars safely to integer cents', () => {
      expect(toMinorUnits(19.99)).toBe(1999);
      expect(toMinorUnits(0.1 + 0.2)).toBe(30); // Tests IEEE 754 precision issue (0.30000000000000004)
      expect(toMinorUnits(100)).toBe(10000);
      expect(toMinorUnits(0)).toBe(0);
      expect(toMinorUnits('45.50')).toBe(4550);
    });

    it('converts integer cents back to major dollar floats safely', () => {
      expect(toMajorUnits(1999)).toBe(19.99);
      expect(toMajorUnits(30)).toBe(0.3);
      expect(toMajorUnits(10000)).toBe(100);
      expect(toMajorUnits(0)).toBe(0);
    });
  });

  describe('Transaction Operations and Aggregations', () => {
    it('creates, reads, and updates transactions with user isolation', async () => {
      const createRes = await financeService.createTransaction(userId, {
        type: 'income',
        amountMinor: 500000, // $5,000.00
        currency: 'USD',
        category: 'Consulting',
        date: '2026-08-01',
        description: 'Retainer payment',
      });

      expect(createRes.success).toBe(true);
      expect(createRes.data?.amountMinorUnits).toBe(500000);
      expect(createRes.data?.userId).toBe(userId);

      const txId = createRes.data!.id;

      // Update description and amount
      const updateRes = await financeService.updateTransaction(userId, txId, {
        amountMinor: 550000,
        description: 'Retainer payment + bonus',
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.amountMinorUnits).toBe(550000);
      expect(updateRes.data?.description).toBe('Retainer payment + bonus');

      // Verify listing
      const listRes = await financeService.getTransactions(userId);
      expect(listRes.success).toBe(true);
      expect(listRes.data?.length).toBe(1);
    });

    it('calculates monthly financial totals, category breakdown, and net balance correctly', async () => {
      // Add income
      await financeService.createTransaction(userId, {
        type: 'income',
        amountMinor: 400000, // $4,000
        category: 'Salary',
        date: '2026-08-05',
      });

      // Add expenses
      await financeService.createTransaction(userId, {
        type: 'expense',
        amountMinor: 150000, // $1,500
        category: 'Housing',
        date: '2026-08-10',
      });

      await financeService.createTransaction(userId, {
        type: 'expense',
        amountMinor: 50000, // $500
        category: 'Groceries',
        date: '2026-08-15',
      });

      const overviewRes = await financeService.getMonthlyOverview(userId, '2026-08');
      expect(overviewRes.success).toBe(true);
      expect(overviewRes.data?.totalIncome).toBe(400000);
      expect(overviewRes.data?.totalExpense).toBe(200000);
      expect(overviewRes.data?.netBalance).toBe(200000); // 400000 - 200000
      expect(overviewRes.data?.transactionCount).toBe(3);

      const categoryExpenses = overviewRes.data?.categoryBreakdown.expense;
      expect(categoryExpenses?.['Housing']).toBe(150000);
      expect(categoryExpenses?.['Groceries']).toBe(50000);
    });
  });

  describe('Budget Tracking and Calculations', () => {
    it('tracks budget limits and calculates spent amount and percentages accurately', async () => {
      const budgetRes = await financeService.createBudget(userId, {
        category: 'Food & Dining',
        amountMinor: 80000, // $800 limit
        period: 'monthly',
        month: '2026-08',
      });

      expect(budgetRes.success).toBe(true);
      const budgetId = budgetRes.data!.id;

      // Add expenses in that category
      await financeService.createTransaction(userId, {
        type: 'expense',
        amountMinor: 40000, // $400 spent
        category: 'Food & Dining',
        date: '2026-08-04',
      });

      const budgetsWithSpending = await financeService.getBudgets(userId, '2026-08');
      expect(budgetsWithSpending.success).toBe(true);
      const targetBudget = budgetsWithSpending.data?.find((b) => b.id === budgetId);

      expect(targetBudget?.spentMinor).toBe(40000);
      expect(targetBudget?.remainingMinor).toBe(40000);
      expect(targetBudget?.percentageUsed).toBe(50);
      expect(targetBudget?.isOverBudget).toBe(false);
    });
  });
});

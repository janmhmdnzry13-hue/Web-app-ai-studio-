import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { financeService, toMinorUnits, toMajorUnits } from '../finance.service';
import { apiClient } from '../../lib/api-client';
import { safeStorage } from '../../lib/storage';

describe('FinanceService and Safe Financial Arithmetic (API-backed)', () => {
  const userId = 'user_test_finance_1';

  // In-memory mock server state for apiClient spies
  let mockTransactions: any[] = [];
  let mockBudgets: any[] = [];

  beforeEach(() => {
    mockTransactions = [];
    mockBudgets = [];
    safeStorage.clear();

    // Mock apiClient.post
    vi.spyOn(apiClient, 'post').mockImplementation(async (endpoint: string, body?: any) => {
      if (endpoint === '/api/finances/transactions') {
        const newTx = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId,
          title: body.title || body.description,
          description: body.description || body.title,
          amount: body.amount,
          amountMinorUnits: body.amountMinorUnits || Math.round(body.amount * 100),
          minorUnits: body.minorUnits || Math.round(body.amount * 100),
          type: body.type || 'expense',
          category: body.category || 'other',
          date: body.date,
          currency: body.currency || 'USD',
          tags: body.tags || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockTransactions.push(newTx);
        return { success: true, data: newTx };
      }
      if (endpoint === '/api/finances/budgets') {
        const newBudget = {
          id: `bdg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId,
          category: body.category,
          amount: body.amount || body.limitAmount,
          limitAmount: body.limitAmount || body.amount,
          amountMinorUnits: body.amountMinorUnits || body.limitMinorUnits || Math.round((body.amount || body.limitAmount) * 100),
          limitMinorUnits: body.limitMinorUnits || body.amountMinorUnits || Math.round((body.amount || body.limitAmount) * 100),
          period: body.period || 'monthly',
          monthYear: body.monthYear || 'all',
          alertThresholdPercentage: body.alertThresholdPercentage ?? 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockBudgets.push(newBudget);
        return { success: true, data: newBudget };
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });

    // Mock apiClient.get
    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/api/finances/transactions')) {
        return { success: true, data: [...mockTransactions] };
      }
      if (endpoint.startsWith('/api/finances/budgets')) {
        return { success: true, data: [...mockBudgets] };
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });

    // Mock apiClient.put
    vi.spyOn(apiClient, 'put').mockImplementation(async (endpoint: string, body?: any) => {
      if (endpoint.startsWith('/api/finances/transactions/')) {
        const id = decodeURIComponent(endpoint.split('/').pop() || '');
        const idx = mockTransactions.findIndex((t) => t.id === id);
        if (idx !== -1) {
          mockTransactions[idx] = {
            ...mockTransactions[idx],
            ...body,
            updatedAt: new Date().toISOString(),
          };
          return { success: true, data: mockTransactions[idx] };
        }
      }
      if (endpoint.startsWith('/api/finances/budgets/')) {
        const id = decodeURIComponent(endpoint.split('/').pop() || '');
        const idx = mockBudgets.findIndex((b) => b.id === id);
        if (idx !== -1) {
          mockBudgets[idx] = {
            ...mockBudgets[idx],
            ...body,
            updatedAt: new Date().toISOString(),
          };
          return { success: true, data: mockBudgets[idx] };
        }
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });

    // Mock apiClient.delete
    vi.spyOn(apiClient, 'delete').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/api/finances/transactions/')) {
        const id = decodeURIComponent(endpoint.split('/').pop() || '');
        mockTransactions = mockTransactions.filter((t) => t.id !== id);
        return { success: true, data: undefined };
      }
      if (endpoint.startsWith('/api/finances/budgets/')) {
        const id = decodeURIComponent(endpoint.split('/').pop() || '');
        mockBudgets = mockBudgets.filter((b) => b.id !== id);
        return { success: true, data: undefined };
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    it('creates, reads, and updates transactions with user isolation via API client', async () => {
      const createRes = await financeService.createTransaction(userId, {
        type: 'income',
        amountMinor: 500000, // $5,000.00
        currency: 'USD',
        category: 'income_salary',
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

      // Verify safeStorage has NOT stored any finance transactions
      expect(safeStorage.get(`origin_txs_${userId}`, null)).toBeNull();
    });

    it('calculates monthly financial totals, category breakdown, and net balance correctly', async () => {
      // Add income
      await financeService.createTransaction(userId, {
        type: 'income',
        amountMinor: 400000, // $4,000
        category: 'income_salary',
        date: '2026-08-05',
      });

      // Add expenses
      await financeService.createTransaction(userId, {
        type: 'expense',
        amountMinor: 150000, // $1,500
        category: 'housing',
        date: '2026-08-10',
      });

      await financeService.createTransaction(userId, {
        type: 'expense',
        amountMinor: 50000, // $500
        category: 'food_groceries',
        date: '2026-08-15',
      });

      const overviewRes = await financeService.getMonthlyOverview(userId, '2026-08');
      expect(overviewRes.success).toBe(true);
      expect(overviewRes.data?.totalIncome).toBe(400000);
      expect(overviewRes.data?.totalExpense).toBe(200000);
      expect(overviewRes.data?.netBalance).toBe(200000); // 400000 - 200000
      expect(overviewRes.data?.transactionCount).toBe(3);

      const categoryExpenses = overviewRes.data?.categoryBreakdown.expense;
      expect(categoryExpenses?.['housing']).toBe(150000);
      expect(categoryExpenses?.['food_groceries']).toBe(50000);
    });
  });

  describe('Budget Tracking and Calculations', () => {
    it('tracks budget limits and calculates spent amount and percentages accurately', async () => {
      const budgetRes = await financeService.createBudget(userId, {
        category: 'dining_out',
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
        category: 'dining_out',
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

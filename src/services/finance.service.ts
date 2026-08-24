/**
 * Finance Service & Safe Minor-Unit Arithmetic Engine
 * Manages income, expenses, dynamic category budgets, and cashflow metrics with integer precision.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { ServiceResult } from '../types/common.types';
import {
  Budget,
  BudgetProgress,
  CategoryBreakdown,
  CategoryBreakdownItem,
  CreateBudgetDTO,
  CreateTransactionDTO,
  FinancialCategory,
  FinancialSummary,
  MonthlyOverview,
  Transaction,
  TransactionType,
  UpdateBudgetDTO,
  UpdateTransactionDTO,
} from '../types/finance.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';
import { getCurrentMonthString } from '../lib/dateUtils';

/**
 * Monetary Arithmetic Helper Functions (Integer Minor-Units)
 */
export function toMinorUnits(amount: number | string): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function toMajorUnits(minorUnits: number): number {
  if (isNaN(minorUnits) || !isFinite(minorUnits)) return 0;
  return minorUnits / 100;
}

export function safeAddMinorUnits(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

export function safeSubtractMinorUnits(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export interface TransactionFilterParams {
  type?: TransactionType | 'all';
  category?: FinancialCategory | string | 'all';
  search?: string;
  monthYear?: string; // "YYYY-MM"
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'amount' | 'createdAt' | 'description';
  sortDirection?: 'asc' | 'desc';
}

const STARTER_TRANSACTIONS: readonly Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: 'income',
    amount: 5400,
    amountMinorUnits: 540000,
    currency: 'USD',
    category: 'income_salary',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Primary Engineering Retainer / Salary',
    merchantOrSource: 'Principal Tech Corp',
    isRecurring: true,
    tags: ['Income', 'DirectDeposit'],
  },
  {
    type: 'income',
    amount: 750,
    amountMinorUnits: 75000,
    currency: 'USD',
    category: 'freelance_business',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Systems Architecture Consulting Milestone',
    merchantOrSource: 'Apex Digital Labs',
    isRecurring: false,
    tags: ['Freelance', 'Consulting'],
  },
  {
    type: 'expense',
    amount: 1650,
    amountMinorUnits: 165000,
    currency: 'USD',
    category: 'housing',
    date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Monthly Apartment Lease & Community Dues',
    merchantOrSource: 'Urban Crest Properties',
    isRecurring: true,
    tags: ['Fixed', 'Housing'],
  },
  {
    type: 'expense',
    amount: 145.8,
    amountMinorUnits: 14580,
    currency: 'USD',
    category: 'food_groceries',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Organic Groceries & Weekly Meal Prep Supplies',
    merchantOrSource: 'Whole Foods Market',
    isRecurring: false,
    tags: ['Groceries', 'Nutrition'],
  },
  {
    type: 'expense',
    amount: 68.5,
    amountMinorUnits: 6850,
    currency: 'USD',
    category: 'dining_out',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Dinner with Systems Design team',
    merchantOrSource: 'Bistro Lumina',
    isRecurring: false,
    tags: ['Social', 'Dining'],
  },
  {
    type: 'expense',
    amount: 120,
    amountMinorUnits: 12000,
    currency: 'USD',
    category: 'utilities',
    date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Gigabit Fiber Internet & Cloud Infrastructure Power',
    merchantOrSource: 'Metro Utility Services',
    isRecurring: true,
    tags: ['Utilities', 'Infrastructure'],
  },
  {
    type: 'expense',
    amount: 85,
    amountMinorUnits: 8500,
    currency: 'USD',
    category: 'health',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Athletic Gym Membership & Recovery Sauna',
    merchantOrSource: 'Equinox Athletic Club',
    isRecurring: true,
    tags: ['Health', 'Fitness'],
  },
  {
    type: 'expense',
    amount: 49.99,
    amountMinorUnits: 4999,
    currency: 'USD',
    category: 'education_learning',
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Advanced Distributed Systems Certification Course',
    merchantOrSource: 'O’Reilly Media',
    isRecurring: false,
    tags: ['Learning', 'Engineering'],
  },
];

const STARTER_BUDGETS: readonly Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    category: 'housing',
    amount: 1700,
    amountMinorUnits: 170000,
    period: 'monthly',
    monthYear: 'all',
    alertThresholdPercentage: 90,
  },
  {
    category: 'food_groceries',
    amount: 600,
    amountMinorUnits: 60000,
    period: 'monthly',
    monthYear: 'all',
    alertThresholdPercentage: 80,
  },
  {
    category: 'dining_out',
    amount: 300,
    amountMinorUnits: 30000,
    period: 'monthly',
    monthYear: 'all',
    alertThresholdPercentage: 75,
  },
  {
    category: 'health',
    amount: 200,
    amountMinorUnits: 20000,
    period: 'monthly',
    monthYear: 'all',
    alertThresholdPercentage: 85,
  },
  {
    category: 'education_learning',
    amount: 250,
    amountMinorUnits: 25000,
    period: 'monthly',
    monthYear: 'all',
    alertThresholdPercentage: 80,
  },
  {
    category: 'entertainment_leisure',
    amount: 200,
    amountMinorUnits: 20000,
    period: 'monthly',
    monthYear: 'all',
    alertThresholdPercentage: 80,
  },
];

export class FinanceService extends BaseService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return '';
  }

  private getTransactionStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`;
  }

  private getBudgetStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`;
  }

  private getStoredTransactions(userId: string): Transaction[] {
    if (!userId) return [];
    const raw = safeStorage.get<Transaction[]>(this.getTransactionStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const seeded = STARTER_TRANSACTIONS.map((st) => ({
        ...st,
        id: generateId('tx'),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getTransactionStorageKey(userId), seeded);
      return seeded;
    }
    return raw;
  }

  private saveStoredTransactions(userId: string, txs: Transaction[]): void {
    if (!userId) return;
    safeStorage.set(this.getTransactionStorageKey(userId), txs);
  }

  private getStoredBudgets(userId: string): Budget[] {
    if (!userId) return [];
    const raw = safeStorage.get<Budget[]>(this.getBudgetStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const seeded = STARTER_BUDGETS.map((b) => ({
        ...b,
        id: generateId('bdg'),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getBudgetStorageKey(userId), seeded);
      return seeded;
    }
    return raw;
  }

  private saveStoredBudgets(userId: string, budgets: Budget[]): void {
    if (!userId) return;
    safeStorage.set(this.getBudgetStorageKey(userId), budgets);
  }

  // --- Transactions API ---

  async getTransactions(
    userIdOrParams?: string | TransactionFilterParams,
    maybeParams?: TransactionFilterParams
  ): Promise<ServiceResult<readonly Transaction[]>> {
    try {
      let userId: string;
      let params: TransactionFilterParams = {};

      if (typeof userIdOrParams === 'string') {
        userId = await this.resolveUserId(userIdOrParams);
        params = maybeParams || {};
      } else {
        userId = await this.resolveUserId();
        params = userIdOrParams || {};
      }

      if (!userId) {
        return this.success([]);
      }

      let txs = this.getStoredTransactions(userId);

      // Filter by Type
      if (params.type && params.type !== 'all') {
        txs = txs.filter((t) => t.type === params.type);
      }

      // Filter by Category
      if (params.category && params.category !== 'all') {
        txs = txs.filter((t) => t.category === params.category);
      }

      // Filter by MonthYear (e.g. "2026-08")
      if (params.monthYear) {
        txs = txs.filter((t) => t.date.startsWith(params.monthYear!));
      }

      // Filter by Date range
      if (params.startDate) {
        txs = txs.filter((t) => t.date >= params.startDate!);
      }
      if (params.endDate) {
        txs = txs.filter((t) => t.date <= params.endDate!);
      }

      // Filter by Search Query
      if (params.search && params.search.trim()) {
        const query = params.search.toLowerCase().trim();
        txs = txs.filter(
          (t) =>
            t.description.toLowerCase().includes(query) ||
            t.merchantOrSource?.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query) ||
            (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(query)))
        );
      }

      // Sorting
      const sortBy = params.sortBy || 'date';
      const dir = params.sortDirection === 'asc' ? 1 : -1;

      txs.sort((a, b) => {
        if (sortBy === 'date') {
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
        }
        if (sortBy === 'amount') {
          return (a.amountMinorUnits - b.amountMinorUnits) * dir;
        }
        if (sortBy === 'description') {
          return a.description.localeCompare(b.description) * dir;
        }
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });

      return this.success(txs);
    } catch (err) {
      return this.failure('FINANCE_FETCH_ERROR', 'Failed to fetch transaction records.', { err });
    }
  }

  async getTransactionById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Transaction>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const txId = maybeId || userIdOrId;

      const txs = this.getStoredTransactions(userId);
      const found = txs.find((t) => t.id === txId);

      if (!found) {
        return this.failure('TRANSACTION_NOT_FOUND', `Transaction with ID ${txId} not found.`);
      }

      return this.success(found);
    } catch (err) {
      return this.failure('TRANSACTION_FETCH_ERROR', 'Error fetching transaction by ID', { err });
    }
  }

  async createTransaction(
    userIdOrDto: string | CreateTransactionDTO | any,
    maybeDto?: CreateTransactionDTO | any
  ): Promise<ServiceResult<Transaction>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as any;

      if (!dto) {
        return this.failure('VALIDATION_ERROR', 'Transaction payload is required.');
      }

      // Calculate minor units and major units safely from either amount or amountMinor/amountMinorUnits
      let minorUnits: number;
      let majorUnits: number;

      if (typeof dto.amountMinor === 'number' || typeof dto.amountMinorUnits === 'number') {
        minorUnits = Math.round(dto.amountMinor ?? dto.amountMinorUnits);
        majorUnits = toMajorUnits(minorUnits);
      } else if (typeof dto.amount === 'number' && !isNaN(dto.amount)) {
        minorUnits = toMinorUnits(dto.amount);
        majorUnits = toMajorUnits(minorUnits);
      } else {
        return this.failure('VALIDATION_ERROR', 'A valid positive amount is required.');
      }

      if (minorUnits <= 0) {
        return this.failure('VALIDATION_ERROR', 'Amount must be greater than 0.');
      }

      const txs = this.getStoredTransactions(userId);
      const description = (dto.description?.trim()) || `${dto.category || 'General'} transaction`;

      const newTx: Transaction = {
        id: generateId('tx'),
        userId,
        type: dto.type || 'expense',
        amount: majorUnits,
        amountMinorUnits: minorUnits,
        currency: dto.currency || 'USD',
        category: dto.category || 'other',
        date: dto.date || new Date().toISOString().split('T')[0],
        description,
        merchantOrSource: dto.merchantOrSource?.trim(),
        isRecurring: dto.isRecurring ?? false,
        tags: dto.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      txs.unshift(newTx);
      this.saveStoredTransactions(userId, txs);

      return this.success(newTx);
    } catch (err) {
      return this.failure('TRANSACTION_CREATE_ERROR', 'Failed to create transaction.', { err });
    }
  }

  async updateTransaction(
    userIdOrId: string,
    idOrDto: string | UpdateTransactionDTO | any,
    maybeDto?: UpdateTransactionDTO | any
  ): Promise<ServiceResult<Transaction>> {
    try {
      let userId: string;
      let txId: string;
      let dto: any;

      if (maybeDto) {
        userId = await this.resolveUserId(userIdOrId);
        txId = idOrDto as string;
        dto = maybeDto;
      } else {
        userId = await this.resolveUserId();
        txId = userIdOrId;
        dto = idOrDto;
      }

      const txs = this.getStoredTransactions(userId);
      const index = txs.findIndex((t) => t.id === txId);

      if (index === -1) {
        return this.failure('TRANSACTION_NOT_FOUND', `Transaction with ID ${txId} not found.`);
      }

      const current = txs[index];
      let minorUnits = current.amountMinorUnits;
      let majorUnits = current.amount;

      if (dto.amountMinor !== undefined || dto.amountMinorUnits !== undefined) {
        minorUnits = Math.round(dto.amountMinor ?? dto.amountMinorUnits);
        majorUnits = toMajorUnits(minorUnits);
      } else if (dto.amount !== undefined) {
        if (typeof dto.amount !== 'number' || dto.amount <= 0 || isNaN(dto.amount)) {
          return this.failure('VALIDATION_ERROR', 'A valid positive amount is required.');
        }
        minorUnits = toMinorUnits(dto.amount);
        majorUnits = toMajorUnits(minorUnits);
      }

      const updated: Transaction = {
        ...current,
        ...dto,
        amount: majorUnits,
        amountMinorUnits: minorUnits,
        description: dto.description !== undefined ? dto.description.trim() : current.description,
        updatedAt: new Date().toISOString(),
      };

      txs[index] = updated;
      this.saveStoredTransactions(userId, txs);

      return this.success(updated);
    } catch (err) {
      return this.failure('TRANSACTION_UPDATE_ERROR', 'Failed to update transaction.', { err });
    }
  }

  async deleteTransaction(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const txId = maybeId || userIdOrId;

      const txs = this.getStoredTransactions(userId);
      const filtered = txs.filter((t) => t.id !== txId);

      if (filtered.length === txs.length) {
        return this.failure('TRANSACTION_NOT_FOUND', `Transaction with ID ${txId} not found.`);
      }

      this.saveStoredTransactions(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('TRANSACTION_DELETE_ERROR', 'Failed to delete transaction.', { err });
    }
  }

  // --- Budgets API ---

  async getBudgets(
    userIdOrMonth?: string,
    maybeMonth?: string
  ): Promise<ServiceResult<readonly BudgetProgress[]>> {
    try {
      const userId = maybeMonth ? await this.resolveUserId(userIdOrMonth) : await this.resolveUserId();
      if (!userId) return this.success([]);

      const targetMonthYear =
        maybeMonth ||
        (typeof userIdOrMonth === 'string' && userIdOrMonth.includes('-')
          ? userIdOrMonth
          : getCurrentMonthString());

      const budgets = this.getStoredBudgets(userId);
      const txs = this.getStoredTransactions(userId);

      // Filter expenses for this target month
      const currentMonthExpenses = txs.filter(
        (t) => t.type === 'expense' && t.date.startsWith(targetMonthYear)
      );

      // Compute spent amounts per category using integer safe addition
      const spentByCategoryMinor: Record<string, number> = {};
      for (const t of currentMonthExpenses) {
        spentByCategoryMinor[t.category] = safeAddMinorUnits(
          spentByCategoryMinor[t.category] || 0,
          t.amountMinorUnits
        );
      }

      const budgetProgressList: BudgetProgress[] = budgets.map((b) => {
        const spentMinor = spentByCategoryMinor[b.category] || 0;
        const remainingMinor = safeSubtractMinorUnits(b.amountMinorUnits, spentMinor);
        const spent = toMajorUnits(spentMinor);
        const remaining = toMajorUnits(remainingMinor);
        const percentageUsed = b.amountMinorUnits > 0 ? Math.round((spentMinor / b.amountMinorUnits) * 100) : 0;
        const isOverBudget = spentMinor > b.amountMinorUnits;

        return {
          ...b,
          budget: b,
          actualSpend: spent,
          actualSpendMinorUnits: spentMinor,
          spent,
          spentMinor,
          spentMinorUnits: spentMinor,
          remaining,
          remainingMinor,
          remainingMinorUnits: remainingMinor,
          percentageUsed,
          isOverBudget,
        };
      });

      return this.success(budgetProgressList);
    } catch (err) {
      return this.failure('BUDGETS_FETCH_ERROR', 'Failed to retrieve budget metrics.', { err });
    }
  }

  async getBudgetProgress(
    userIdOrMonth?: string,
    maybeMonth?: string
  ): Promise<ServiceResult<readonly BudgetProgress[]>> {
    return this.getBudgets(userIdOrMonth, maybeMonth);
  }

  async getCategoryBreakdown(
    userIdOrMonth?: string,
    maybeMonth?: string
  ): Promise<ServiceResult<readonly CategoryBreakdownItem[]>> {
    const summaryRes = await this.getFinancialSummary(userIdOrMonth, maybeMonth);
    if (!summaryRes.success || !summaryRes.data) {
      return this.failure('BREAKDOWN_ERROR', 'Failed to calculate category breakdown');
    }
    const expenses = Object.values(summaryRes.data.categoryBreakdown.expense);
    return this.success(expenses);
  }

  async createBudget(userIdOrDto: string | CreateBudgetDTO | any, maybeDto?: CreateBudgetDTO | any): Promise<ServiceResult<Budget>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as any;

      if (!dto || !dto.category) {
        return this.failure('VALIDATION_ERROR', 'Budget category is required.');
      }

      let minorUnits: number;
      let majorUnits: number;

      if (typeof dto.amountMinor === 'number' || typeof dto.amountMinorUnits === 'number') {
        minorUnits = Math.round(dto.amountMinor ?? dto.amountMinorUnits);
        majorUnits = toMajorUnits(minorUnits);
      } else if (typeof dto.amount === 'number' && !isNaN(dto.amount)) {
        minorUnits = toMinorUnits(dto.amount);
        majorUnits = toMajorUnits(minorUnits);
      } else {
        return this.failure('VALIDATION_ERROR', 'A valid positive budget cap is required.');
      }

      if (minorUnits <= 0) {
        return this.failure('VALIDATION_ERROR', 'Budget cap must be greater than 0.');
      }

      const budgets = this.getStoredBudgets(userId);

      const newBudget: Budget = {
        id: generateId('bdg'),
        userId,
        category: dto.category,
        amount: majorUnits,
        amountMinorUnits: minorUnits,
        period: dto.period || 'monthly',
        monthYear: dto.monthYear || dto.month || 'all',
        alertThresholdPercentage: dto.alertThresholdPercentage || 80,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      budgets.push(newBudget);
      this.saveStoredBudgets(userId, budgets);

      return this.success(newBudget);
    } catch (err) {
      return this.failure('BUDGET_CREATE_ERROR', 'Failed to create budget.', { err });
    }
  }

  async updateBudget(
    userIdOrId: string,
    idOrDto: string | UpdateBudgetDTO,
    maybeDto?: UpdateBudgetDTO
  ): Promise<ServiceResult<Budget>> {
    try {
      let userId: string;
      let budgetId: string;
      let dto: UpdateBudgetDTO;

      if (maybeDto) {
        userId = await this.resolveUserId(userIdOrId);
        budgetId = idOrDto as string;
        dto = maybeDto;
      } else {
        userId = await this.resolveUserId();
        budgetId = userIdOrId;
        dto = idOrDto as UpdateBudgetDTO;
      }

      const budgets = this.getStoredBudgets(userId);
      const index = budgets.findIndex((b) => b.id === budgetId);

      if (index === -1) {
        return this.failure('BUDGET_NOT_FOUND', `Budget with ID ${budgetId} not found.`);
      }

      const current = budgets[index];
      let minorUnits = current.amountMinorUnits;
      let majorUnits = current.amount;

      if (dto.amount !== undefined) {
        if (typeof dto.amount !== 'number' || dto.amount <= 0 || isNaN(dto.amount)) {
          return this.failure('VALIDATION_ERROR', 'A valid positive budget cap is required.');
        }
        minorUnits = toMinorUnits(dto.amount);
        majorUnits = toMajorUnits(minorUnits);
      }

      const updated: Budget = {
        ...current,
        ...dto,
        amount: majorUnits,
        amountMinorUnits: minorUnits,
        updatedAt: new Date().toISOString(),
      };

      budgets[index] = updated;
      this.saveStoredBudgets(userId, budgets);

      return this.success(updated);
    } catch (err) {
      return this.failure('BUDGET_UPDATE_ERROR', 'Failed to update budget.', { err });
    }
  }

  async deleteBudget(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const budgetId = maybeId || userIdOrId;

      const budgets = this.getStoredBudgets(userId);
      const filtered = budgets.filter((b) => b.id !== budgetId);

      if (filtered.length === budgets.length) {
        return this.failure('BUDGET_NOT_FOUND', `Budget with ID ${budgetId} not found.`);
      }

      this.saveStoredBudgets(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('BUDGET_DELETE_ERROR', 'Failed to delete budget.', { err });
    }
  }

  // --- Financial Analytics & Reports ---

  async getMonthlyOverview(
    userIdOrMonthYear?: string,
    maybeMonthYear?: string
  ): Promise<ServiceResult<MonthlyOverview>> {
    const summaryRes = await this.getFinancialSummary(userIdOrMonthYear, maybeMonthYear);
    if (!summaryRes.success || !summaryRes.data) {
      return this.failure('MONTHLY_OVERVIEW_ERROR', 'Failed to compile monthly overview');
    }
    const data = summaryRes.data;
    return this.success({
      monthYear: data.monthYear,
      totalIncome: data.totalIncomeMinorUnits,
      totalExpense: data.totalExpenseMinorUnits,
      netBalance: data.netBalanceMinorUnits,
      incomeMajor: data.totalIncome,
      expenseMajor: data.totalExpense,
      netBalanceMajor: data.netBalance,
      savingsRate: data.savingsRate,
      transactionCount: data.transactionCount,
      categoryBreakdown: {
        income: Object.fromEntries(
          Object.entries(data.categoryBreakdown.income).map(([k, v]) => [k, v.amountMinorUnits])
        ),
        expense: Object.fromEntries(
          Object.entries(data.categoryBreakdown.expense).map(([k, v]) => [k, v.amountMinorUnits])
        ),
      },
    });
  }

  async getFinancialSummary(userIdOrMonthYear?: string, maybeMonthYear?: string): Promise<ServiceResult<FinancialSummary>> {
    try {
      const userId = maybeMonthYear ? await this.resolveUserId(userIdOrMonthYear) : await this.resolveUserId();
      const targetMonthYear =
        maybeMonthYear ||
        (typeof userIdOrMonthYear === 'string' && userIdOrMonthYear.includes('-')
          ? userIdOrMonthYear
          : getCurrentMonthString());

      if (!userId) {
        return this.success({
          monthYear: targetMonthYear,
          periodMonthYear: targetMonthYear,
          currency: 'USD',
          totalIncome: 0,
          totalIncomeMinorUnits: 0,
          totalExpense: 0,
          totalExpenseMinorUnits: 0,
          netBalance: 0,
          netBalanceMinorUnits: 0,
          savingsRate: 0,
          savingsRatePercentage: 0,
          transactionCount: 0,
          categoryBreakdown: { income: {}, expense: {} },
          topExpenses: [],
        });
      }

      const txs = this.getStoredTransactions(userId);
      const scopedTxs = txs.filter((t) => t.date.startsWith(targetMonthYear));

      let totalIncomeMinor = 0;
      let totalExpenseMinor = 0;

      for (const t of scopedTxs) {
        if (t.type === 'income') {
          totalIncomeMinor = safeAddMinorUnits(totalIncomeMinor, t.amountMinorUnits);
        } else if (t.type === 'expense') {
          totalExpenseMinor = safeAddMinorUnits(totalExpenseMinor, t.amountMinorUnits);
        }
      }

      const netBalanceMinor = safeSubtractMinorUnits(totalIncomeMinor, totalExpenseMinor);
      const totalIncome = toMajorUnits(totalIncomeMinor);
      const totalExpense = toMajorUnits(totalExpenseMinor);
      const netBalance = toMajorUnits(netBalanceMinor);

      const savingsRate =
        totalIncomeMinor > 0 && netBalanceMinor > 0
          ? Math.round((netBalanceMinor / totalIncomeMinor) * 100)
          : 0;

      // Category breakdown calculation
      const categoryBreakdown: CategoryBreakdown = { income: {}, expense: {} };

      for (const t of scopedTxs) {
        const targetGroup = t.type === 'income' ? categoryBreakdown.income : categoryBreakdown.expense;
        const existing = targetGroup[t.category] || {
          category: t.category,
          amount: 0,
          amountMinorUnits: 0,
          percentageOfTotal: 0,
          transactionCount: 0,
        };

        const updatedMinor = safeAddMinorUnits(existing.amountMinorUnits, t.amountMinorUnits);
        targetGroup[t.category] = {
          category: t.category,
          amount: toMajorUnits(updatedMinor),
          amountMinorUnits: updatedMinor,
          percentageOfTotal: 0,
          transactionCount: existing.transactionCount + 1,
        };
      }

      // Compute percentages
      for (const cat of Object.values(categoryBreakdown.income)) {
        cat.percentageOfTotal = totalIncomeMinor > 0 ? Math.round((cat.amountMinorUnits / totalIncomeMinor) * 100) : 0;
      }
      for (const cat of Object.values(categoryBreakdown.expense)) {
        cat.percentageOfTotal = totalExpenseMinor > 0 ? Math.round((cat.amountMinorUnits / totalExpenseMinor) * 100) : 0;
      }

      // Top expenses
      const topExpenses = Object.values(categoryBreakdown.expense)
        .sort((a, b) => b.amountMinorUnits - a.amountMinorUnits)
        .slice(0, 5);

      return this.success({
        totalIncome,
        totalExpense,
        netBalance,
        totalIncomeMinorUnits: totalIncomeMinor,
        totalExpenseMinorUnits: totalExpenseMinor,
        netBalanceMinorUnits: netBalanceMinor,
        savingsRate,
        savingsRatePercentage: savingsRate,
        currency: 'USD',
        transactionCount: scopedTxs.length,
        monthYear: targetMonthYear,
        periodMonthYear: targetMonthYear,
        categoryBreakdown,
        topExpenses,
      });
    } catch (err) {
      return this.failure('SUMMARY_ERROR', 'Failed to calculate financial summary.', { err });
    }
  }
}

export const financeService = new FinanceService();

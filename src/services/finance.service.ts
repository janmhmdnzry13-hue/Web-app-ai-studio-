/**
 * Finance Service & Safe Minor-Unit Arithmetic Engine
 * Authoritative persistence layer backed by authenticated backend API endpoints.
 * Manages income, expenses, dynamic category budgets, and cashflow metrics with integer precision.
 */
import { apiClient } from '../lib/api-client';
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
import { safeStorage } from '../lib/storage';
import { APP_CONSTANTS } from '../config/constants';

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

function normalizeTransaction(record: any): Transaction {
  const minor =
    typeof record.amountMinorUnits === 'number'
      ? record.amountMinorUnits
      : typeof record.minorUnits === 'number'
      ? record.minorUnits
      : typeof record.amountMinor === 'number'
      ? record.amountMinor
      : typeof record.amount === 'number'
      ? Math.round(Math.abs(record.amount) * 100)
      : 0;

  const major = typeof record.amount === 'number' ? record.amount : minor / 100;
  const desc = (record.description || record.title || 'Transaction').trim();

  return {
    id: record.id,
    userId: record.userId,
    type: record.type || 'expense',
    amount: major,
    amountMinorUnits: minor,
    currency: record.currency || 'USD',
    category: record.category || 'other',
    date: record.date || new Date().toISOString().slice(0, 10),
    description: desc,
    merchantOrSource: record.merchantOrSource,
    isRecurring: Boolean(record.isRecurring),
    tags: Array.isArray(record.tags) ? record.tags : [],
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

function normalizeBudget(record: any): Budget {
  const minor =
    typeof record.amountMinorUnits === 'number'
      ? record.amountMinorUnits
      : typeof record.limitMinorUnits === 'number'
      ? record.limitMinorUnits
      : typeof record.amountMinor === 'number'
      ? record.amountMinor
      : typeof record.limitAmount === 'number'
      ? Math.round(Math.abs(record.limitAmount) * 100)
      : typeof record.amount === 'number'
      ? Math.round(Math.abs(record.amount) * 100)
      : 0;

  const major =
    typeof record.limitAmount === 'number'
      ? record.limitAmount
      : typeof record.amount === 'number'
      ? record.amount
      : minor / 100;

  return {
    id: record.id,
    userId: record.userId,
    category: record.category,
    amount: major,
    amountMinorUnits: minor,
    period: record.period || 'monthly',
    monthYear: record.monthYear || 'all',
    alertThresholdPercentage: record.alertThresholdPercentage != null ? Number(record.alertThresholdPercentage) : 80,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

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

  // --- Transactions API (Backend Authoritative) ---

  async getTransactions(
    userIdOrParams?: string | TransactionFilterParams,
    maybeParams?: TransactionFilterParams
  ): Promise<ServiceResult<readonly Transaction[]>> {
    try {
      let params: TransactionFilterParams = {};
      if (typeof userIdOrParams === 'string') {
        params = maybeParams || {};
      } else {
        params = userIdOrParams || {};
      }

      const query = new URLSearchParams();
      if (params.monthYear) query.set('month', params.monthYear);
      if (params.type && params.type !== 'all') query.set('type', params.type);
      if (params.category && params.category !== 'all') query.set('category', params.category);
      if (params.startDate) query.set('startDate', params.startDate);
      if (params.endDate) query.set('endDate', params.endDate);
      if (params.search && params.search.trim()) query.set('search', params.search.trim());

      const qs = query.toString();
      const endpoint = qs ? `/api/finances/transactions?${qs}` : '/api/finances/transactions';

      const res = await apiClient.get<any[]>(endpoint);
      if (!res.success || !Array.isArray(res.data)) {
        const userId = typeof userIdOrParams === 'string' ? userIdOrParams : await this.resolveUserId();
        if (userId) {
          const stored = safeStorage.get<Transaction[]>(`${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`, []);
          return this.success(stored);
        }
        return this.failure(
          res.error?.code || 'FINANCE_FETCH_ERROR',
          res.error?.message || 'Failed to fetch transaction records.'
        );
      }

      let txs = res.data.map(normalizeTransaction);

      // Client-side filtering as safety fallback
      if (params.monthYear) {
        txs = txs.filter((t) => t.date.startsWith(params.monthYear!));
      }
      if (params.type && params.type !== 'all') {
        txs = txs.filter((t) => t.type === params.type);
      }
      if (params.category && params.category !== 'all') {
        txs = txs.filter((t) => t.category === params.category);
      }
      if (params.startDate) {
        txs = txs.filter((t) => t.date >= params.startDate!);
      }
      if (params.endDate) {
        txs = txs.filter((t) => t.date <= params.endDate!);
      }
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        txs = txs.filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            t.merchantOrSource?.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
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
    } catch (err: any) {
      const userId = typeof userIdOrParams === 'string' ? userIdOrParams : await this.resolveUserId();
      if (userId) {
        const stored = safeStorage.get<Transaction[]>(`${APP_CONSTANTS.STORAGE_KEYS.TRANSACTIONS_PREFIX}${userId}`, []);
        return this.success(stored);
      }
      return this.failure('FINANCE_FETCH_ERROR', 'Failed to fetch transaction records.', { err });
    }
  }

  async getTransactionById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Transaction>> {
    try {
      const txId = maybeId || userIdOrId;
      const res = await apiClient.get<any>(`/api/finances/transactions/${encodeURIComponent(txId)}`);
      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'TRANSACTION_NOT_FOUND',
          res.error?.message || `Transaction with ID ${txId} not found.`
        );
      }
      return this.success(normalizeTransaction(res.data));
    } catch (err: any) {
      return this.failure('TRANSACTION_FETCH_ERROR', 'Error fetching transaction by ID', { err });
    }
  }

  async createTransaction(
    userIdOrDto: string | CreateTransactionDTO | any,
    maybeDto?: CreateTransactionDTO | any
  ): Promise<ServiceResult<Transaction>> {
    try {
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as any;
      if (!dto) {
        return this.failure('VALIDATION_ERROR', 'Transaction payload is required.');
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
        return this.failure('VALIDATION_ERROR', 'A valid positive amount is required.');
      }

      if (minorUnits <= 0) {
        return this.failure('VALIDATION_ERROR', 'Amount must be greater than 0.');
      }

      const description = (dto.description?.trim()) || (dto.title?.trim()) || `${dto.category || 'General'} transaction`;

      const payload = {
        title: description,
        description,
        amount: majorUnits,
        amountMinor: minorUnits,
        amountMinorUnits: minorUnits,
        minorUnits,
        type: dto.type || 'expense',
        category: dto.category || 'other',
        date: dto.date || new Date().toISOString().split('T')[0],
        currency: dto.currency || 'USD',
        paymentMethod: dto.paymentMethod,
        isRecurring: Boolean(dto.isRecurring),
        merchantOrSource: dto.merchantOrSource?.trim(),
        tags: Array.isArray(dto.tags) ? dto.tags : [],
        notes: dto.notes?.trim(),
      };

      const res = await apiClient.post<any>('/api/finances/transactions', payload);
      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'TRANSACTION_CREATE_ERROR',
          res.error?.message || 'Failed to create transaction.'
        );
      }

      return this.success(normalizeTransaction(res.data));
    } catch (err: any) {
      return this.failure('TRANSACTION_CREATE_ERROR', 'Failed to create transaction.', { err });
    }
  }

  async updateTransaction(
    userIdOrId: string,
    idOrDto: string | UpdateTransactionDTO | any,
    maybeDto?: UpdateTransactionDTO | any
  ): Promise<ServiceResult<Transaction>> {
    try {
      let txId: string;
      let dto: any;

      if (maybeDto) {
        txId = idOrDto as string;
        dto = maybeDto;
      } else {
        txId = userIdOrId;
        dto = idOrDto;
      }

      const payload: any = {};
      if (dto.amountMinor !== undefined || dto.amountMinorUnits !== undefined) {
        const minor = Math.round(dto.amountMinor ?? dto.amountMinorUnits);
        payload.amountMinor = minor;
        payload.amountMinorUnits = minor;
        payload.minorUnits = minor;
        payload.amount = toMajorUnits(minor);
      } else if (dto.amount !== undefined) {
        if (typeof dto.amount !== 'number' || dto.amount <= 0 || isNaN(dto.amount)) {
          return this.failure('VALIDATION_ERROR', 'A valid positive amount is required.');
        }
        const minor = toMinorUnits(dto.amount);
        payload.amount = toMajorUnits(minor);
        payload.amountMinorUnits = minor;
        payload.minorUnits = minor;
        payload.amountMinor = minor;
      }

      if (dto.description !== undefined || dto.title !== undefined) {
        const desc = (dto.description !== undefined ? dto.description : dto.title)?.trim();
        payload.title = desc;
        payload.description = desc;
      }
      if (dto.type !== undefined) payload.type = dto.type;
      if (dto.category !== undefined) payload.category = dto.category;
      if (dto.date !== undefined) payload.date = dto.date;
      if (dto.currency !== undefined) payload.currency = dto.currency;
      if (dto.merchantOrSource !== undefined) payload.merchantOrSource = dto.merchantOrSource;
      if (dto.isRecurring !== undefined) payload.isRecurring = Boolean(dto.isRecurring);
      if (dto.tags !== undefined) payload.tags = dto.tags;
      if (dto.paymentMethod !== undefined) payload.paymentMethod = dto.paymentMethod;
      if (dto.notes !== undefined) payload.notes = dto.notes;

      const res = await apiClient.put<any>(`/api/finances/transactions/${encodeURIComponent(txId)}`, payload);
      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'TRANSACTION_UPDATE_ERROR',
          res.error?.message || 'Failed to update transaction.'
        );
      }

      return this.success(normalizeTransaction(res.data));
    } catch (err: any) {
      return this.failure('TRANSACTION_UPDATE_ERROR', 'Failed to update transaction.', { err });
    }
  }

  async deleteTransaction(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const txId = maybeId || userIdOrId;
      const res = await apiClient.delete(`/api/finances/transactions/${encodeURIComponent(txId)}`);
      if (!res.success) {
        return this.failure(
          res.error?.code || 'TRANSACTION_DELETE_ERROR',
          res.error?.message || 'Failed to delete transaction.'
        );
      }
      return this.success(undefined);
    } catch (err: any) {
      return this.failure('TRANSACTION_DELETE_ERROR', 'Failed to delete transaction.', { err });
    }
  }

  // --- Budgets API (Backend Authoritative) ---

  async getBudgets(
    userIdOrMonth?: string,
    maybeMonth?: string
  ): Promise<ServiceResult<readonly BudgetProgress[]>> {
    try {
      const targetMonthYear =
        maybeMonth ||
        (typeof userIdOrMonth === 'string' && userIdOrMonth.includes('-')
          ? userIdOrMonth
          : getCurrentMonthString());

      const [budgetsRes, txsRes] = await Promise.all([
        apiClient.get<any[]>('/api/finances/budgets'),
        apiClient.get<any[]>('/api/finances/transactions'),
      ]);

      if (!budgetsRes.success || !Array.isArray(budgetsRes.data)) {
        const userId =
          typeof userIdOrMonth === 'string' && !userIdOrMonth.includes('-')
            ? userIdOrMonth
            : await this.resolveUserId();
        if (userId) {
          const storedBudgets = safeStorage.get<Budget[]>(
            `${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`,
            []
          );
          const budgetProgressList: BudgetProgress[] = storedBudgets.map((b) => ({
            ...b,
            budget: b,
            actualSpend: 0,
            actualSpendMinorUnits: 0,
            spent: 0,
            spentMinor: 0,
            spentMinorUnits: 0,
            remaining: toMajorUnits(b.amountMinorUnits),
            remainingMinor: b.amountMinorUnits,
            remainingMinorUnits: b.amountMinorUnits,
            percentageUsed: 0,
            isOverBudget: false,
          }));
          return this.success(budgetProgressList);
        }
        return this.failure(
          budgetsRes.error?.code || 'BUDGETS_FETCH_ERROR',
          budgetsRes.error?.message || 'Failed to retrieve budget metrics.'
        );
      }

      const budgets = budgetsRes.data.map(normalizeBudget);
      const txs = Array.isArray(txsRes.data) ? txsRes.data.map(normalizeTransaction) : [];

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
    } catch (err: any) {
      const userId =
        typeof userIdOrMonth === 'string' && !userIdOrMonth.includes('-')
          ? userIdOrMonth
          : await this.resolveUserId();
      if (userId) {
        const storedBudgets = safeStorage.get<Budget[]>(
          `${APP_CONSTANTS.STORAGE_KEYS.BUDGETS_PREFIX}${userId}`,
          []
        );
        const budgetProgressList: BudgetProgress[] = storedBudgets.map((b) => ({
          ...b,
          budget: b,
          actualSpend: 0,
          actualSpendMinorUnits: 0,
          spent: 0,
          spentMinor: 0,
          spentMinorUnits: 0,
          remaining: toMajorUnits(b.amountMinorUnits),
          remainingMinor: b.amountMinorUnits,
          remainingMinorUnits: b.amountMinorUnits,
          percentageUsed: 0,
          isOverBudget: false,
        }));
        return this.success(budgetProgressList);
      }
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

  async createBudget(
    userIdOrDto: string | CreateBudgetDTO | any,
    maybeDto?: CreateBudgetDTO | any
  ): Promise<ServiceResult<Budget>> {
    try {
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

      const payload = {
        category: dto.category.trim(),
        amount: majorUnits,
        limitAmount: majorUnits,
        amountMinorUnits: minorUnits,
        limitMinorUnits: minorUnits,
        amountMinor: minorUnits,
        period: dto.period || 'monthly',
        monthYear: dto.monthYear || dto.month || 'all',
        alertThresholdPercentage: dto.alertThresholdPercentage != null ? Number(dto.alertThresholdPercentage) : 80,
      };

      const res = await apiClient.post<any>('/api/finances/budgets', payload);
      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'BUDGET_CREATE_ERROR',
          res.error?.message || 'Failed to create budget.'
        );
      }

      return this.success(normalizeBudget(res.data));
    } catch (err: any) {
      return this.failure('BUDGET_CREATE_ERROR', 'Failed to create budget.', { err });
    }
  }

  async updateBudget(
    userIdOrId: string,
    idOrDto: string | UpdateBudgetDTO | any,
    maybeDto?: UpdateBudgetDTO | any
  ): Promise<ServiceResult<Budget>> {
    try {
      let budgetId: string;
      let dto: any;

      if (maybeDto) {
        budgetId = idOrDto as string;
        dto = maybeDto;
      } else {
        budgetId = userIdOrId;
        dto = idOrDto;
      }

      const payload: any = {};
      if (dto.category !== undefined) payload.category = dto.category.trim();
      if (dto.amountMinor !== undefined || dto.amountMinorUnits !== undefined) {
        const minor = Math.round(dto.amountMinor ?? dto.amountMinorUnits);
        payload.amountMinor = minor;
        payload.amountMinorUnits = minor;
        payload.limitMinorUnits = minor;
        payload.amount = toMajorUnits(minor);
        payload.limitAmount = toMajorUnits(minor);
      } else if (dto.amount !== undefined) {
        if (typeof dto.amount !== 'number' || dto.amount <= 0 || isNaN(dto.amount)) {
          return this.failure('VALIDATION_ERROR', 'A valid positive budget cap is required.');
        }
        const minor = toMinorUnits(dto.amount);
        payload.amount = toMajorUnits(minor);
        payload.limitAmount = toMajorUnits(minor);
        payload.amountMinorUnits = minor;
        payload.limitMinorUnits = minor;
        payload.amountMinor = minor;
      }

      if (dto.period !== undefined) payload.period = dto.period;
      if (dto.monthYear !== undefined || dto.month !== undefined) payload.monthYear = dto.monthYear || dto.month;
      if (dto.alertThresholdPercentage !== undefined) payload.alertThresholdPercentage = Number(dto.alertThresholdPercentage);

      const res = await apiClient.put<any>(`/api/finances/budgets/${encodeURIComponent(budgetId)}`, payload);
      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'BUDGET_UPDATE_ERROR',
          res.error?.message || 'Failed to update budget.'
        );
      }

      return this.success(normalizeBudget(res.data));
    } catch (err: any) {
      return this.failure('BUDGET_UPDATE_ERROR', 'Failed to update budget.', { err });
    }
  }

  async deleteBudget(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const budgetId = maybeId || userIdOrId;
      const res = await apiClient.delete(`/api/finances/budgets/${encodeURIComponent(budgetId)}`);
      if (!res.success) {
        return this.failure(
          res.error?.code || 'BUDGET_DELETE_ERROR',
          res.error?.message || 'Failed to delete budget.'
        );
      }
      return this.success(undefined);
    } catch (err: any) {
      return this.failure('BUDGET_DELETE_ERROR', 'Failed to delete budget.', { err });
    }
  }

  // --- Financial Analytics & Reports (Derived from Backend API) ---

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

  async getFinancialSummary(
    userIdOrMonthYear?: string,
    maybeMonthYear?: string
  ): Promise<ServiceResult<FinancialSummary>> {
    try {
      const targetMonthYear =
        maybeMonthYear ||
        (typeof userIdOrMonthYear === 'string' && userIdOrMonthYear.includes('-')
          ? userIdOrMonthYear
          : getCurrentMonthString());

      const txRes = await apiClient.get<any[]>('/api/finances/transactions');
      if (!txRes.success || !Array.isArray(txRes.data)) {
        return this.failure(
          txRes.error?.code || 'SUMMARY_ERROR',
          txRes.error?.message || 'Failed to calculate financial summary.'
        );
      }

      const txs = txRes.data.map(normalizeTransaction);
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
    } catch (err: any) {
      return this.failure('SUMMARY_ERROR', 'Failed to calculate financial summary.', { err });
    }
  }
}

export const financeService = new FinanceService();

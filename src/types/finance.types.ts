/**
 * Financial & Budget Domain Models
 * Implements safe integer minor-unit arithmetic and robust CRUD types.
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type TransactionType = 'income' | 'expense';

export type FinancialCategory =
  | 'housing'
  | 'food_groceries'
  | 'dining_out'
  | 'transport'
  | 'utilities'
  | 'health'
  | 'education_learning'
  | 'entertainment_leisure'
  | 'savings_investments'
  | 'income_salary'
  | 'freelance_business'
  | 'personal_care'
  | 'gifts_donations'
  | 'other';

export type BudgetPeriod = 'monthly' | 'weekly' | 'quarterly' | 'yearly';

export interface Transaction extends UserScopedEntity {
  readonly amount: number; // Stored in major currency unit (e.g., 42.50) with safe minor-unit math internally
  readonly amountMinorUnits: number; // Stored as integer cents (e.g., 4250) to prevent floating-point errors
  readonly currency: string; // e.g. "USD", "EUR"
  readonly type: TransactionType;
  readonly category: FinancialCategory;
  readonly date: DateOnlyString; // "YYYY-MM-DD"
  readonly description: string;
  readonly merchantOrSource?: string;
  readonly isRecurring?: boolean;
  readonly tags?: readonly string[];
}

export interface Budget extends UserScopedEntity {
  readonly category: FinancialCategory;
  readonly amount: number; // Cap amount in major units (e.g. 500.00)
  readonly amountMinorUnits: number; // Cap amount in integer cents (e.g. 50000)
  readonly period: BudgetPeriod;
  readonly monthYear: string; // "YYYY-MM" or "all"
  readonly alertThresholdPercentage?: number; // e.g. 80 (alert at 80% usage)
}

export interface BudgetProgress extends Budget {
  readonly budget: Budget;
  readonly actualSpend: number;
  readonly actualSpendMinorUnits: number;
  readonly spent: number;
  readonly spentMinor: number;
  readonly spentMinorUnits: number;
  readonly remaining: number;
  readonly remainingMinor: number;
  readonly remainingMinorUnits: number;
  readonly percentageUsed: number;
  readonly isOverBudget: boolean;
}

export interface CategoryBreakdownItem {
  readonly category: FinancialCategory;
  amount: number;
  amountMinorUnits: number;
  percentageOfTotal: number;
  transactionCount: number;
  totalSpend?: number;
  totalSpendMinorUnits?: number;
}

export interface CategoryBreakdown {
  readonly income: Record<string, CategoryBreakdownItem>;
  readonly expense: Record<string, CategoryBreakdownItem>;
}

export interface FinancialSummary {
  readonly totalIncome: number;
  readonly totalIncomeMinorUnits: number;
  readonly totalExpense: number;
  readonly totalExpenseMinorUnits: number;
  readonly netBalance: number;
  readonly netBalanceMinorUnits: number;
  readonly savingsRate: number;
  readonly savingsRatePercentage: number;
  readonly transactionCount: number;
  readonly monthYear: string;
  readonly periodMonthYear: string;
  readonly currency: string;
  readonly categoryBreakdown: CategoryBreakdown;
  readonly topExpenses: readonly CategoryBreakdownItem[];
}

export interface MonthlyOverview {
  readonly monthYear: string;
  readonly totalIncome: number;
  readonly totalExpense: number;
  readonly netBalance: number;
  readonly incomeMajor: number;
  readonly expenseMajor: number;
  readonly netBalanceMajor: number;
  readonly savingsRate: number;
  readonly transactionCount: number;
  readonly categoryBreakdown: {
    readonly income: Record<string, number>;
    readonly expense: Record<string, number>;
  };
}

export interface CreateTransactionDTO {
  readonly type: TransactionType;
  readonly amount: number;
  readonly currency?: string;
  readonly category: FinancialCategory;
  readonly date: DateOnlyString;
  readonly description: string;
  readonly merchantOrSource?: string;
  readonly isRecurring?: boolean;
  readonly tags?: readonly string[];
}

export interface UpdateTransactionDTO extends Partial<CreateTransactionDTO> {}

export interface CreateBudgetDTO {
  readonly category: FinancialCategory;
  readonly amount: number;
  readonly period?: BudgetPeriod;
  readonly monthYear?: string;
  readonly alertThresholdPercentage?: number;
}

export interface UpdateBudgetDTO extends Partial<CreateBudgetDTO> {}

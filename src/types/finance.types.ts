/**
 * Financial & Budget Domain Models
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type TransactionType = 'income' | 'expense' | 'transfer';

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
  | 'other';

export interface Transaction extends UserScopedEntity {
  readonly amount: number; // Stored as positive float, interpreted based on type
  readonly currency: string; // e.g. "USD", "EUR"
  readonly type: TransactionType;
  readonly category: FinancialCategory;
  readonly date: DateOnlyString;
  readonly description: string;
  readonly merchantOrSource?: string;
  readonly accountId?: EntityId;
  readonly isRecurring: boolean;
  readonly tags: readonly string[];
}

export interface Budget extends UserScopedEntity {
  readonly category: FinancialCategory;
  readonly monthlyCap: number;
  readonly currentSpend: number;
  readonly monthYear: string; // "YYYY-MM"
  readonly alertThresholdPercentage: number; // e.g. 80 (alert at 80% usage)
}

export interface FinancialSummary {
  readonly totalIncomeMonth: number;
  readonly totalExpenseMonth: number;
  readonly netSavingsMonth: number;
  readonly savingsRatePercentage: number;
  readonly currency: string;
}

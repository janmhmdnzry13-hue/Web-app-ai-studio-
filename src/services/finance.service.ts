/**
 * Finance Service Contract & Architectural Abstraction
 */
import { ServiceResult } from '../types/common.types';
import { Budget, FinancialSummary, Transaction } from '../types/finance.types';
import { BaseService } from './base.service';

export interface IFinanceService {
  getTransactions(monthYear?: string): Promise<ServiceResult<readonly Transaction[]>>;
  getBudgets(monthYear?: string): Promise<ServiceResult<readonly Budget[]>>;
  getFinancialSummary(monthYear?: string): Promise<ServiceResult<FinancialSummary>>;
  addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<ServiceResult<Transaction>>;
}

export class FinanceService extends BaseService implements IFinanceService {
  async getTransactions(_monthYear?: string): Promise<ServiceResult<readonly Transaction[]>> {
    return this.success([]);
  }

  async getBudgets(_monthYear?: string): Promise<ServiceResult<readonly Budget[]>> {
    return this.success([]);
  }

  async getFinancialSummary(_monthYear?: string): Promise<ServiceResult<FinancialSummary>> {
    return this.success({
      totalIncomeMonth: 0,
      totalExpenseMonth: 0,
      netSavingsMonth: 0,
      savingsRatePercentage: 0,
      currency: 'USD',
    });
  }

  async addTransaction(_transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<ServiceResult<Transaction>> {
    return this.failure('UNIMPLEMENTED_MODULE', 'Finance logging scheduled for Phase 2.');
  }
}

export const financeService = new FinanceService();

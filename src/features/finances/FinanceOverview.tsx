import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { financeService } from '../../services/finance.service';
import {
  Budget,
  BudgetPeriod,
  BudgetProgress,
  CategoryBreakdown,
  CategoryBreakdownItem,
  CreateBudgetDTO,
  CreateTransactionDTO,
  FinancialCategory,
  FinancialSummary,
  Transaction,
  TransactionType,
} from '../../types/finance.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

const CATEGORY_LABELS: Record<FinancialCategory, string> = {
  housing: 'Housing & Rent',
  food_groceries: 'Food & Groceries',
  dining_out: 'Dining Out',
  transport: 'Transportation',
  utilities: 'Utilities & Bills',
  health: 'Health & Fitness',
  education_learning: 'Education & Learning',
  entertainment_leisure: 'Entertainment',
  savings_investments: 'Savings & Investments',
  income_salary: 'Salary & Retainer',
  freelance_business: 'Freelance & Business',
  personal_care: 'Personal Care',
  gifts_donations: 'Gifts & Donations',
  other: 'Other Discretionary',
};

export function FinanceOverview() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<FinancialCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txForm, setTxForm] = useState<{
    type: TransactionType;
    amount: string;
    category: FinancialCategory;
    description: string;
    merchantOrSource: string;
    date: string;
    isRecurring: boolean;
  }>({
    type: 'expense',
    amount: '',
    category: 'food_groceries',
    description: '',
    merchantOrSource: '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
  });

  // Budget Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [budgetForm, setBudgetForm] = useState<{
    category: FinancialCategory;
    amount: string;
    period: BudgetPeriod;
    alertThresholdPercentage: string;
  }>({
    category: 'dining_out',
    amount: '',
    period: 'monthly',
    alertThresholdPercentage: '80',
  });

  const loadFinanceData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [txRes, sumRes, bdgProgRes, brkRes, bdgRes] = await Promise.all([
        financeService.getTransactions(user.id, {
          monthYear: selectedMonth,
          type: typeFilter,
          category: categoryFilter,
          search: searchQuery,
        }),
        financeService.getFinancialSummary(user.id, selectedMonth),
        financeService.getBudgetProgress(user.id, selectedMonth),
        financeService.getCategoryBreakdown(user.id, selectedMonth),
        financeService.getBudgets(user.id, selectedMonth),
      ]);

      if (txRes.success && txRes.data) {
        setTransactions([...txRes.data]);
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (bdgProgRes.success && bdgProgRes.data) {
        setBudgetProgress([...bdgProgRes.data]);
      }
      if (brkRes.success && brkRes.data) {
        setBreakdown([...brkRes.data]);
      }
      if (bdgRes.success && bdgRes.data) {
        setBudgets([...bdgRes.data]);
      }
    } catch {
      error('Finance Error', 'Failed to load financial records.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, selectedMonth, typeFilter, categoryFilter, searchQuery, error]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // Handle Create/Edit Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const numAmount = parseFloat(txForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      error('Invalid Amount', 'Please enter a valid positive dollar amount.');
      return;
    }
    if (!txForm.description.trim()) {
      error('Required Field', 'Please enter a description for the transaction.');
      return;
    }

    try {
      if (editingTx) {
        const res = await financeService.updateTransaction(user.id, editingTx.id, {
          type: txForm.type,
          amount: numAmount,
          category: txForm.category,
          description: txForm.description,
          merchantOrSource: txForm.merchantOrSource || undefined,
          date: txForm.date,
          isRecurring: txForm.isRecurring,
        });
        if (res.success) {
          success('Transaction Updated', 'Record saved with integer-minor-unit precision.');
          setIsTxModalOpen(false);
          loadFinanceData();
        } else {
          error('Error', res.error?.message || 'Failed to update transaction.');
        }
      } else {
        const res = await financeService.createTransaction(user.id, {
          type: txForm.type,
          amount: numAmount,
          category: txForm.category,
          description: txForm.description,
          merchantOrSource: txForm.merchantOrSource || undefined,
          date: txForm.date,
          isRecurring: txForm.isRecurring,
        });
        if (res.success) {
          success('Transaction Created', 'New financial transaction recorded safely.');
          setIsTxModalOpen(false);
          loadFinanceData();
        } else {
          error('Error', res.error?.message || 'Failed to create transaction.');
        }
      }
    } catch {
      error('Save Error', 'An unexpected error occurred while saving.');
    }
  };

  // Handle Delete Transaction
  const handleDeleteTransaction = async (id: string, description: string) => {
    if (!user?.id) return;
    const res = await financeService.deleteTransaction(user.id, id);
    if (res.success) {
      info('Transaction Removed', `Deleted "${description}".`);
      loadFinanceData();
    }
  };

  // Open Create/Edit Transaction Modal
  const openCreateTxModal = (type: TransactionType = 'expense') => {
    setEditingTx(null);
    setTxForm({
      type,
      amount: '',
      category: type === 'income' ? 'income_salary' : 'food_groceries',
      description: '',
      merchantOrSource: '',
      date: new Date().toISOString().split('T')[0],
      isRecurring: false,
    });
    setIsTxModalOpen(true);
  };

  const openEditTxModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category,
      description: tx.description,
      merchantOrSource: tx.merchantOrSource || '',
      date: tx.date,
      isRecurring: tx.isRecurring ?? false,
    });
    setIsTxModalOpen(true);
  };

  // Handle Create/Edit Budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const numAmount = parseFloat(budgetForm.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      error('Invalid Amount', 'Please enter a valid positive budget limit.');
      return;
    }

    const threshold = parseInt(budgetForm.alertThresholdPercentage, 10) || 80;

    try {
      if (editingBudget) {
        const res = await financeService.updateBudget(user.id, editingBudget.id, {
          category: budgetForm.category,
          amount: numAmount,
          period: budgetForm.period,
          alertThresholdPercentage: threshold,
        });
        if (res.success) {
          success('Budget Updated', `Budget cap for ${CATEGORY_LABELS[budgetForm.category]} saved.`);
          setIsBudgetModalOpen(false);
          loadFinanceData();
        }
      } else {
        const res = await financeService.createBudget(user.id, {
          category: budgetForm.category,
          amount: numAmount,
          period: budgetForm.period,
          alertThresholdPercentage: threshold,
          monthYear: selectedMonth,
        });
        if (res.success) {
          success('Budget Created', `New budget cap established for ${CATEGORY_LABELS[budgetForm.category]}.`);
          setIsBudgetModalOpen(false);
          loadFinanceData();
        }
      }
    } catch {
      error('Save Error', 'Failed to save budget specification.');
    }
  };

  const openCreateBudgetModal = () => {
    setEditingBudget(null);
    setBudgetForm({
      category: 'dining_out',
      amount: '',
      period: 'monthly',
      alertThresholdPercentage: '80',
    });
    setIsBudgetModalOpen(true);
  };

  const openEditBudgetModal = (budget: Budget) => {
    setEditingBudget(budget);
    setBudgetForm({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      alertThresholdPercentage: (budget.alertThresholdPercentage || 80).toString(),
    });
    setIsBudgetModalOpen(true);
  };

  const handleDeleteBudget = async (id: string, category: FinancialCategory) => {
    if (!user?.id) return;
    const res = await financeService.deleteBudget(user.id, id);
    if (res.success) {
      info('Budget Removed', `Deleted budget for ${CATEGORY_LABELS[category]}.`);
      loadFinanceData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Personal Finance & Budgets"
        description="Deterministic integer-minor-unit cashflow tracking, category budget caps, and savings rates."
        badge={{ label: 'Decimal-Safe Math', variant: 'success' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Finances' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<PiggyBank className="h-4 w-4" />}
              onClick={openCreateBudgetModal}
            >
              New Budget
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
              onClick={() => openCreateTxModal('income')}
            >
              Add Income
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => openCreateTxModal('expense')}
            >
              Log Expense
            </Button>
          </div>
        }
      />

      {/* Month Selector & Precision Assurance */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-neutral-500" />
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Target Period:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Calculations protected against floating-point anomalies (stored in minor integer cents).</span>
        </div>
      </div>

      {/* Financial Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Income</span>
            <div className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {formatCurrency(summary?.totalIncome || 0)}
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Period inflow
          </p>
        </Card>

        {/* Total Expenses */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="h-7 w-7 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {formatCurrency(summary?.totalExpense || 0)}
          </p>
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">
            Category outflow
          </p>
        </Card>

        {/* Net Cashflow Balance */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Cashflow</span>
            <div className="h-7 w-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${
              (summary?.netBalance || 0) >= 0 ? 'text-neutral-900 dark:text-neutral-100' : 'text-rose-500'
            }`}
          >
            {formatCurrency(summary?.netBalance || 0)}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5 font-medium">
            {(summary?.netBalance || 0) >= 0 ? 'Surplus retained' : 'Deficit for period'}
          </p>
        </Card>

        {/* Savings Rate */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Savings Rate</span>
            <div className="h-7 w-7 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {summary?.savingsRatePercentage || 0}%
          </p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 font-medium">
            Target benchmark: 20%+
          </p>
        </Card>
      </div>

      {/* Dynamic Category Budgets & Actual Spend Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Category Budgets & Actual Spend
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Real-time spend tracking versus defined caps for {selectedMonth}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openCreateBudgetModal}>
            Add Budget Cap
          </Button>
        </div>

        {budgetProgress.length === 0 ? (
          <Card className="p-6 text-center text-xs text-neutral-500">
            No budget limits defined for this period. Create category budgets to prevent spending overruns.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetProgress.map((bp) => (
              <Card key={bp.budget.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {CATEGORY_LABELS[bp.budget.category] || bp.budget.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditBudgetModal(bp.budget)}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(bp.budget.id, bp.budget.category)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(bp.actualSpend)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    of {formatCurrency(bp.budget.amount)} cap
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      bp.isOverBudget
                        ? 'bg-rose-500'
                        : bp.percentageUsed >= (bp.budget.alertThresholdPercentage || 80)
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, bp.percentageUsed)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={`font-semibold ${
                      bp.isOverBudget
                        ? 'text-rose-500'
                        : bp.percentageUsed >= 80
                        ? 'text-amber-500'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {bp.percentageUsed}% used {bp.isOverBudget && '(Over budget)'}
                  </span>
                  <span className="text-neutral-400">
                    {bp.remaining >= 0 ? `${formatCurrency(bp.remaining)} left` : `${formatCurrency(Math.abs(bp.remaining))} over`}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Category Expense Breakdown */}
      {breakdown.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Monthly Expense Distribution
            </h3>
            <span className="text-xs text-neutral-500">
              {breakdown.reduce((acc, b) => acc + b.transactionCount, 0)} total logged expenses
            </span>
          </div>

          <div className="space-y-3">
            {breakdown.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  <span className="text-neutral-900 dark:text-neutral-100 font-semibold">
                    {formatCurrency(item.amount || item.totalSpend || 0)} ({item.percentageOfTotal}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-neutral-800 dark:bg-neutral-200 h-full rounded-full"
                    style={{ width: `${item.percentageOfTotal}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transactions Stream & Filter Controls */}
      <Card className="p-5 space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Transactions History
            </h3>
            <p className="text-xs text-neutral-500">
              Filterable ledger of all income and expenses for {selectedMonth}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            {/* Type Selector */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            >
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>

            {/* Category Selector */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FinancialCategory | 'all')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 max-w-[140px] truncate"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                <option key={catKey} value={catKey}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transactions Table / List */}
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
            <p>No transactions found matching the filter criteria.</p>
            <Button size="sm" variant="outline" onClick={() => openCreateTxModal('expense')}>
              Log New Transaction
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 overflow-x-auto">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'income';
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 px-1 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>

                    <div className="truncate">
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {tx.description}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                        <span>{CATEGORY_LABELS[tx.category] || tx.category}</span>
                        {tx.merchantOrSource && (
                          <>
                            <span>•</span>
                            <span className="truncate">{tx.merchantOrSource}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{tx.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-bold font-mono ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditTxModal(tx)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(tx.id, tx.description)}
                        className="p-1 rounded text-neutral-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Transaction Create/Edit Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title={editingTx ? 'Edit Transaction' : 'Record Transaction'}
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTxForm((prev) => ({ ...prev, type: 'expense' }))}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                txForm.type === 'expense'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setTxForm((prev) => ({ ...prev, type: 'income' }))}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                txForm.type === 'income'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Income
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Amount (USD) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={txForm.amount}
              onChange={(e) => setTxForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Description *
            </label>
            <Input
              type="text"
              placeholder="e.g. Organic grocery restock"
              value={txForm.description}
              onChange={(e) => setTxForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Category
              </label>
              <select
                value={txForm.category}
                onChange={(e) => setTxForm((prev) => ({ ...prev, category: e.target.value as FinancialCategory }))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Date
              </label>
              <Input
                type="date"
                value={txForm.date}
                onChange={(e) => setTxForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Merchant / Source (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Whole Foods, Employer Inc."
              value={txForm.merchantOrSource}
              onChange={(e) => setTxForm((prev) => ({ ...prev, merchantOrSource: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isRecurring"
              checked={txForm.isRecurring}
              onChange={(e) => setTxForm((prev) => ({ ...prev, isRecurring: e.target.checked }))}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
            />
            <label htmlFor="isRecurring" className="text-xs text-neutral-700 dark:text-neutral-300">
              Recurring transaction (Monthly cadence)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setIsTxModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingTx ? 'Save Changes' : 'Record Transaction'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Budget Create/Edit Modal */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title={editingBudget ? 'Edit Budget Cap' : 'Define Category Budget'}
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Category *
            </label>
            <select
              value={budgetForm.category}
              onChange={(e) => setBudgetForm((prev) => ({ ...prev, category: e.target.value as FinancialCategory }))}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            >
              {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                <option key={catKey} value={catKey}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Budget Cap Amount (USD) *
            </label>
            <Input
              type="number"
              step="1"
              min="1"
              placeholder="e.g. 500"
              value={budgetForm.amount}
              onChange={(e) => setBudgetForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Period
              </label>
              <select
                value={budgetForm.period}
                onChange={(e) => setBudgetForm((prev) => ({ ...prev, period: e.target.value as BudgetPeriod }))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Alert Threshold (%)
              </label>
              <Input
                type="number"
                min="50"
                max="100"
                value={budgetForm.alertThresholdPercentage}
                onChange={(e) => setBudgetForm((prev) => ({ ...prev, alertThresholdPercentage: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setIsBudgetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingBudget ? 'Update Budget' : 'Establish Budget'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

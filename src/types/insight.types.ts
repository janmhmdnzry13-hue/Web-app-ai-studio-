/**
 * Life Insights & Behavioral Intelligence Domain Models
 * Explicitly separates verified Observed Data from Interpretive Synthesis.
 */
import { EntityId, ISODateString, UserScopedEntity } from './common.types';

export type InsightDomain =
  | 'tasks_execution'
  | 'goals_momentum'
  | 'habits_consistency'
  | 'financial_health'
  | 'emotional_vitality'
  | 'cross_system';

export type InsightType = 'positive_trend' | 'growth_opportunity' | 'pattern_detected' | 'balance_milestone';

export interface ObservedDataMetric {
  readonly label: string;
  readonly value: string | number;
  readonly context?: string;
}

export interface LifeInsight extends UserScopedEntity {
  readonly title: string;
  readonly domain: InsightDomain;
  readonly type: InsightType;
  readonly observedData: readonly ObservedDataMetric[]; // Verified empirical data
  readonly interpretation: string; // Non-diagnostic behavioral interpretation
  readonly actionableStep?: string; // Optional gentle operational suggestion
  readonly confidenceScore: number; // 0.0 to 1.0 based on data points count
  readonly dataPointsCount: number;
  readonly generatedAt: ISODateString;
}

export interface SystemDataSummary {
  readonly totalTasksCompleted: number;
  readonly pendingTasksCount: number;
  readonly activeGoalsCount: number;
  readonly averageGoalProgress: number;
  readonly habitConsistencyRate: number;
  readonly activeHabitsCount: number;
  readonly monthlyExpenseTotal: number;
  readonly monthlyIncomeTotal: number;
  readonly netCashflow: number;
  readonly averageMood: number | null;
  readonly averageEnergy: number | null;
  readonly averageStress: number | null;
  readonly reflectionsCount: number;
  readonly relationshipsTracked: number;
  readonly hasSufficientData: boolean;
}

/**
 * Life Insights & Cross-Module Intelligence Models
 */
import { EntityId, ISODateString, UserScopedEntity } from './common.types';

export type InsightDomain =
  | 'focus_flow'
  | 'sleep_energy'
  | 'habit_consistency'
  | 'financial_alignment'
  | 'relationship_health'
  | 'goal_momentum';

export type InsightSignificance = 'info' | 'positive_trend' | 'cautionary_pattern' | 'breakthrough';

export interface LifeInsight extends UserScopedEntity {
  readonly title: string;
  readonly domain: InsightDomain;
  readonly significance: InsightSignificance;
  readonly observation: string;
  readonly recommendation?: string;
  readonly confidenceScore: number; // 0.0 to 1.0
  readonly relatedEntityIds: readonly EntityId[];
  readonly isDismissed: boolean;
  readonly generatedAt: ISODateString;
}

export interface LifeBalanceIndex {
  readonly overallScore: number; // 0 - 100
  readonly categoryScores: {
    readonly productivity: number;
    readonly wellness: number;
    readonly finance: number;
    readonly connection: number;
    readonly learning: number;
  };
  readonly trend: 'improving' | 'stable' | 'declining';
  readonly calculatedForDate: string;
}

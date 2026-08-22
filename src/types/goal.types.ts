/**
 * Goal & Milestone Domain Models
 */
import { EntityId, ISODateString, LifecycleStatus, UserScopedEntity } from './common.types';

export type GoalCategory =
  | 'health_vitality'
  | 'career_craft'
  | 'financial_freedom'
  | 'financial_growth'
  | 'mind_learning'
  | 'relationships_community'
  | 'creative_expression'
  | 'environment_home';

export type GoalTimeframe = 'quarterly' | 'annual' | 'multi_year' | 'lifetime';

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly targetDate?: ISODateString;
  readonly isCompleted: boolean;
  readonly completedAt?: ISODateString;
  readonly weight: number; // Percentage contribution (0-100)
}

export interface Goal extends UserScopedEntity {
  readonly title: string;
  readonly description?: string;
  readonly category: GoalCategory;
  readonly timeframe: GoalTimeframe;
  readonly status: LifecycleStatus;
  readonly targetDate: ISODateString;
  readonly progressPercentage: number; // 0 - 100
  readonly milestones: readonly Milestone[];
  readonly linkedHabitIds: readonly EntityId[];
  readonly successCriteria: readonly string[];
}

export interface CreateGoalDTO {
  readonly title: string;
  readonly description?: string;
  readonly category: GoalCategory;
  readonly timeframe: GoalTimeframe;
  readonly targetDate: ISODateString;
  readonly milestones?: readonly Omit<Milestone, 'id' | 'isCompleted'>[];
}

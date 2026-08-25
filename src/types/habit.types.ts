/**
 * Habit & HabitLog Domain Models
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'three_times_weekly' | 'custom';

export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface HabitStreak {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly totalCompletions: number;
  readonly lastCompletedDate?: DateOnlyString;
}

export interface Habit extends UserScopedEntity {
  readonly name: string;
  readonly cue?: string;
  readonly routine: string;
  readonly reward?: string;
  readonly category: string;
  readonly frequency: HabitFrequency;
  readonly customDaysOfWeek?: readonly number[]; // 0-6
  readonly timeOfDay: HabitTimeOfDay;
  readonly targetUnits: number; // e.g. 1 (times), 20 (minutes), 2000 (ml)
  readonly unitLabel: string; // e.g. 'mins', 'pages', 'glasses'
  readonly streak: HabitStreak;
  readonly isArchived: boolean;
  readonly goalId?: EntityId;
  readonly why?: string; // Meaning / Why it matters
  readonly icon?: string; // Optional emoji or icon tag
  readonly color?: string; // Accent color token
}

export interface HabitLog extends UserScopedEntity {
  readonly habitId: EntityId;
  readonly date: DateOnlyString; // YYYY-MM-DD
  readonly value: number;
  readonly targetMet: boolean;
  readonly notes?: string;
  readonly loggedAt: ISODateString;
}

export interface CreateHabitDTO {
  readonly name: string;
  readonly routine?: string;
  readonly cue?: string;
  readonly reward?: string;
  readonly frequency: HabitFrequency;
  readonly customDaysOfWeek?: readonly number[];
  readonly timeOfDay?: HabitTimeOfDay;
  readonly targetUnits?: number;
  readonly unitLabel?: string;
  readonly category?: string;
  readonly goalId?: EntityId;
  readonly why?: string;
  readonly icon?: string;
  readonly color?: string;
}

/**
 * Emotional Reflection & Energy Domain Models
 * Sovereign, private self-reflection with mood, energy, and stress tracking.
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type RatingScale1To5 = 1 | 2 | 3 | 4 | 5;

export type PrimaryEmotion =
  | 'calm'
  | 'focused'
  | 'energized'
  | 'grateful'
  | 'joyful'
  | 'neutral'
  | 'anxious'
  | 'fatigued'
  | 'frustrated'
  | 'overwhelmed'
  | 'reflective';

export interface EmotionReflectionEntry extends UserScopedEntity {
  readonly date: DateOnlyString; // YYYY-MM-DD
  readonly mood: RatingScale1To5; // 1 = Very Low / Distressed, 5 = High / Thriving
  readonly energy: RatingScale1To5; // 1 = Depleted, 5 = High Vitality
  readonly stress: RatingScale1To5; // 1 = Very Low / Calm, 5 = Very High Stress
  readonly primaryEmotion?: PrimaryEmotion;
  readonly reflection: string; // Core guided prompt or summary reflection
  readonly journalEntry: string; // Full freeform private journal entry
  readonly tags: readonly string[]; // e.g. ['deep_work', 'walk_in_nature', 'good_sleep']
  readonly loggedAt: ISODateString;
}

export type EmotionalReflection = EmotionReflectionEntry;

export interface ReflectionTrendSummary {
  readonly averageMood: number;
  readonly averageEnergy: number;
  readonly averageStress: number;
  readonly entryCount: number;
  readonly streakDays: number;
  readonly dominantEmotion?: PrimaryEmotion;
  readonly dateRange: {
    readonly start: DateOnlyString;
    readonly end: DateOnlyString;
  };
}

export interface CreateReflectionDTO {
  readonly date: DateOnlyString;
  readonly mood: RatingScale1To5;
  readonly energy: RatingScale1To5;
  readonly stress: RatingScale1To5;
  readonly primaryEmotion?: PrimaryEmotion;
  readonly reflection: string;
  readonly journalEntry?: string;
  readonly tags?: readonly string[];
}

export interface UpdateReflectionDTO extends Partial<CreateReflectionDTO> {}

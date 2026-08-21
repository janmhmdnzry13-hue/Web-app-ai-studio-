/**
 * Emotion, Energy & Daily Reflection Domain Models
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type MoodValence = 1 | 2 | 3 | 4 | 5; // 1 = Very Low, 5 = Peak / Thriving

export type EnergyLevel = 1 | 2 | 3 | 4 | 5; // 1 = Depleted, 5 = Energized

export type PrimaryEmotion =
  | 'joy'
  | 'calm'
  | 'gratitude'
  | 'focus'
  | 'curiosity'
  | 'fatigue'
  | 'anxiety'
  | 'frustration'
  | 'sadness'
  | 'overwhelm';

export interface EmotionEntry extends UserScopedEntity {
  readonly mood: MoodValence;
  readonly energy: EnergyLevel;
  readonly primaryEmotion: PrimaryEmotion;
  readonly tags: readonly string[]; // Context tags: e.g. ['deep_work', 'sleep_7h', 'exercise']
  readonly note?: string;
  readonly loggedAt: ISODateString;
}

export interface ReflectionPromptAnswer {
  readonly promptId: string;
  readonly question: string;
  readonly answer: string;
}

export interface DailyReflection extends UserScopedEntity {
  readonly date: DateOnlyString; // YYYY-MM-DD
  readonly morningIntent?: string;
  readonly eveningWins: readonly string[];
  readonly learnedLesson?: string;
  readonly gratitudeList: readonly string[];
  readonly overallRating: number; // 1-10
  readonly answers: readonly ReflectionPromptAnswer[];
  readonly completedAt: ISODateString;
}

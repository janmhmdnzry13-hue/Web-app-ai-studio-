/**
 * Relationship & Interaction Domain Models
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type RelationshipCircle = 'inner_core' | 'close_friend' | 'family' | 'mentor_colleague' | 'acquaintance';

export interface ImportantDate {
  readonly id: string;
  readonly label: string; // e.g. "Birthday", "Anniversary"
  readonly date: DateOnlyString;
  readonly recurringYearly: boolean;
}

export interface InteractionLog {
  readonly id: string;
  readonly date: DateOnlyString;
  readonly type: 'call' | 'in_person' | 'message' | 'letter_gift' | 'shared_activity';
  readonly notes?: string;
}

export interface Relationship extends UserScopedEntity {
  readonly fullName: string;
  readonly nickname?: string;
  readonly circle: RelationshipCircle;
  readonly desiredCadenceDays: number; // e.g. 14 (reach out every 2 weeks)
  readonly lastContactDate?: DateOnlyString;
  readonly notes?: string;
  readonly importantDates: readonly ImportantDate[];
  readonly interactions: readonly InteractionLog[];
  readonly tags: readonly string[];
}

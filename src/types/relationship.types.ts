/**
 * Relationship Management Domain Models
 * Sovereign, private relational CRM with cadence reminders and interaction logs.
 */
import { DateOnlyString, EntityId, ISODateString, UserScopedEntity } from './common.types';

export type RelationshipType =
  | 'family'
  | 'friend'
  | 'close_friend'
  | 'partner'
  | 'colleague'
  | 'mentor'
  | 'community'
  | 'other';

export interface ImportantDate {
  readonly id: string;
  readonly label: string; // e.g. "Birthday", "Anniversary", "Life Event"
  readonly date: DateOnlyString; // "YYYY-MM-DD" or "MM-DD"
  readonly recurringYearly: boolean;
}

export interface InteractionLog {
  readonly id: string;
  readonly date: DateOnlyString;
  readonly type: 'call' | 'in_person' | 'message' | 'letter_gift' | 'shared_activity' | 'video';
  readonly notes?: string;
  readonly createdAt: ISODateString;
}

export interface Relationship extends UserScopedEntity {
  readonly name: string;
  readonly relationshipType: RelationshipType;
  readonly notes?: string;
  readonly importantDates: readonly ImportantDate[];
  readonly lastInteraction?: DateOnlyString;
  readonly nextReminder?: DateOnlyString;
  readonly cadenceDays?: number; // e.g. 14 for bi-weekly check-in
  readonly interactions: readonly InteractionLog[];
  readonly tags: readonly string[];
}

export interface CreateRelationshipDTO {
  readonly name: string;
  readonly relationshipType: RelationshipType;
  readonly notes?: string;
  readonly importantDates?: readonly ImportantDate[];
  readonly lastInteraction?: DateOnlyString;
  readonly nextReminder?: DateOnlyString;
  readonly cadenceDays?: number;
  readonly tags?: readonly string[];
}

export interface UpdateRelationshipDTO extends Partial<CreateRelationshipDTO> {
  readonly interactions?: readonly InteractionLog[];
}

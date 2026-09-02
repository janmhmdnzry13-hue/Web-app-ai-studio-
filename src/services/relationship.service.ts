/**
 * Relationship & Relational CRM Service
 * Manages contacts, relationship circles, interaction logs, anniversaries, and cadence reminders.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { ServiceResult } from '../types/common.types';
import {
  CreateRelationshipDTO,
  ImportantDate,
  InteractionLog,
  Relationship,
  RelationshipType,
  UpdateRelationshipDTO,
} from '../types/relationship.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

const STARTER_RELATIONSHIPS: readonly Omit<Relationship, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Elena Rostova',
    relationshipType: 'partner',
    notes: 'Partner in life and creative endeavors. Enjoys architecture tours, botanical gardens, and pour-over coffee.',
    cadenceDays: 1,
    lastInteraction: new Date().toISOString().split('T')[0],
    nextReminder: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    importantDates: [
      { id: 'dt_1', label: 'Birthday', date: '1995-11-14', recurringYearly: true },
      { id: 'dt_2', label: 'Anniversary', date: '2021-06-20', recurringYearly: true },
    ],
    interactions: [
      {
        id: 'int_1',
        date: new Date().toISOString().split('T')[0],
        type: 'in_person',
        notes: 'Morning walk and shared breakfast discussion on long-term horizon goals.',
        createdAt: new Date().toISOString(),
      },
    ],
    tags: ['InnerCore', 'Family'],
  },
  {
    name: 'Marcus Chen',
    relationshipType: 'close_friend',
    notes: 'Former engineering co-founder. Excellent thought partner on distributed systems and startup strategy.',
    cadenceDays: 14,
    lastInteraction: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    nextReminder: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    importantDates: [
      { id: 'dt_3', label: 'Birthday', date: '1992-04-18', recurringYearly: true },
    ],
    interactions: [
      {
        id: 'int_2',
        date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'call',
        notes: '30-minute catch-up call on distributed consensus algorithms and career trajectory.',
        createdAt: new Date().toISOString(),
      },
    ],
    tags: ['Engineering', 'CloseFriend'],
  },
  {
    name: 'Dr. Sarah Vance',
    relationshipType: 'mentor',
    notes: 'Academic advisor and executive mentor on high-leverage decision making and organizational design.',
    cadenceDays: 30,
    lastInteraction: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    nextReminder: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    importantDates: [],
    interactions: [
      {
        id: 'int_3',
        date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'call',
        notes: 'Quarterly review on strategic priorities and advisory leadership.',
        createdAt: new Date().toISOString(),
      },
    ],
    tags: ['Mentor', 'Advisory'],
  },
  {
    name: 'Julian Hayes',
    relationshipType: 'colleague',
    notes: 'Principal Product Architect. Collaborating on system UI design and human-computer interfaces.',
    cadenceDays: 7,
    lastInteraction: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    nextReminder: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    importantDates: [],
    interactions: [
      {
        id: 'int_4',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'video',
        notes: 'Review of life OS modules and interaction contracts.',
        createdAt: new Date().toISOString(),
      },
    ],
    tags: ['Colleague', 'Design'],
  },
];

export class RelationshipService extends BaseService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return '';
  }

  private getStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.RELATIONSHIPS_PREFIX}${userId}`;
  }

  private getStoredRelationships(userId: string): Relationship[] {
    if (!userId) return [];
    return safeStorage.get<Relationship[]>(this.getStorageKey(userId), []);
  }

  private saveStoredRelationships(userId: string, relationships: Relationship[]): void {
    if (!userId) return;
    safeStorage.set(this.getStorageKey(userId), relationships);
  }

  async getRelationships(
    userIdOrType?: string | RelationshipType,
    maybeType?: RelationshipType
  ): Promise<ServiceResult<readonly Relationship[]>> {
    try {
      const knownTypes: readonly string[] = ['family', 'friend', 'close_friend', 'partner', 'colleague', 'mentor', 'community', 'other'];
      let userId: string;
      let filterType: RelationshipType | undefined;

      if (maybeType) {
        userId = await this.resolveUserId(userIdOrType);
        filterType = maybeType;
      } else if (userIdOrType && knownTypes.includes(userIdOrType)) {
        userId = await this.resolveUserId();
        filterType = userIdOrType as RelationshipType;
      } else {
        userId = await this.resolveUserId(userIdOrType);
        filterType = undefined;
      }

      let list = this.getStoredRelationships(userId);
      if (filterType && filterType !== 'other') {
        list = list.filter((r) => r.relationshipType === filterType);
      }

      list.sort((a, b) => a.name.localeCompare(b.name));
      return this.success(list);
    } catch (err) {
      return this.failure('RELATIONSHIP_FETCH_ERROR', 'Failed to retrieve relationships.', { err });
    }
  }

  async getRelationshipById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Relationship>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const list = this.getStoredRelationships(userId);
      const found = list.find((r) => r.id === id);

      if (!found) {
        return this.failure('RELATIONSHIP_NOT_FOUND', `Relationship with ID ${id} not found.`);
      }

      return this.success(found);
    } catch (err) {
      return this.failure('RELATIONSHIP_FETCH_ERROR', 'Error fetching relationship by ID.', { err });
    }
  }

  async createRelationship(
    userIdOrDto: string | CreateRelationshipDTO,
    maybeDto?: CreateRelationshipDTO
  ): Promise<ServiceResult<Relationship>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateRelationshipDTO;

      if (!dto || !dto.name || dto.name.trim().length === 0) {
        return this.failure('VALIDATION_ERROR', 'Contact name is required.');
      }

      const list = this.getStoredRelationships(userId);
      const now = new Date().toISOString();

      // Compute next reminder if cadence is specified and last interaction exists
      let nextReminder = dto.nextReminder;
      if (!nextReminder && dto.cadenceDays && dto.cadenceDays > 0) {
        const baseDate = dto.lastInteraction ? new Date(dto.lastInteraction) : new Date();
        nextReminder = new Date(baseDate.getTime() + dto.cadenceDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      }

      const newRel: Relationship = {
        id: generateId('rel'),
        userId,
        name: dto.name.trim(),
        relationshipType: dto.relationshipType || 'friend',
        notes: dto.notes?.trim() || '',
        importantDates: dto.importantDates || [],
        lastInteraction: dto.lastInteraction,
        nextReminder,
        cadenceDays: dto.cadenceDays,
        interactions: [],
        tags: dto.tags || [],
        createdAt: now,
        updatedAt: now,
      };

      list.push(newRel);
      this.saveStoredRelationships(userId, list);

      return this.success(newRel);
    } catch (err) {
      return this.failure('RELATIONSHIP_CREATE_ERROR', 'Failed to create relationship record.', { err });
    }
  }

  async updateRelationship(
    userIdOrId: string,
    idOrDto: string | UpdateRelationshipDTO,
    maybeDto?: UpdateRelationshipDTO
  ): Promise<ServiceResult<Relationship>> {
    try {
      let userId: string;
      let id: string;
      let dto: UpdateRelationshipDTO;

      if (maybeDto) {
        userId = await this.resolveUserId(userIdOrId);
        id = idOrDto as string;
        dto = maybeDto;
      } else {
        userId = await this.resolveUserId();
        id = userIdOrId;
        dto = idOrDto as UpdateRelationshipDTO;
      }

      const list = this.getStoredRelationships(userId);
      const index = list.findIndex((r) => r.id === id);

      if (index === -1) {
        return this.failure('RELATIONSHIP_NOT_FOUND', `Relationship with ID ${id} not found.`);
      }

      const current = list[index];
      const updated: Relationship = {
        ...current,
        ...dto,
        name: dto.name !== undefined ? dto.name.trim() : current.name,
        notes: dto.notes !== undefined ? dto.notes.trim() : current.notes,
        updatedAt: new Date().toISOString(),
      };

      list[index] = updated;
      this.saveStoredRelationships(userId, list);

      return this.success(updated);
    } catch (err) {
      return this.failure('RELATIONSHIP_UPDATE_ERROR', 'Failed to update relationship record.', { err });
    }
  }

  async deleteRelationship(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const list = this.getStoredRelationships(userId);
      const filtered = list.filter((r) => r.id !== id);

      if (filtered.length === list.length) {
        return this.failure('RELATIONSHIP_NOT_FOUND', `Relationship with ID ${id} not found.`);
      }

      this.saveStoredRelationships(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('RELATIONSHIP_DELETE_ERROR', 'Failed to delete relationship.', { err });
    }
  }

  async logInteraction(
    userIdOrId: string,
    idOrLog: string | Omit<InteractionLog, 'id' | 'createdAt'>,
    maybeLog?: Omit<InteractionLog, 'id' | 'createdAt'>
  ): Promise<ServiceResult<Relationship>> {
    try {
      let userId: string;
      let relId: string;
      let logData: Omit<InteractionLog, 'id' | 'createdAt'>;

      if (maybeLog) {
        userId = await this.resolveUserId(userIdOrId);
        relId = idOrLog as string;
        logData = maybeLog;
      } else {
        userId = await this.resolveUserId();
        relId = userIdOrId;
        logData = idOrLog as Omit<InteractionLog, 'id' | 'createdAt'>;
      }

      const list = this.getStoredRelationships(userId);
      const index = list.findIndex((r) => r.id === relId);

      if (index === -1) {
        return this.failure('RELATIONSHIP_NOT_FOUND', `Relationship with ID ${relId} not found.`);
      }

      const current = list[index];
      const now = new Date().toISOString();
      const newLog: InteractionLog = {
        id: generateId('int'),
        date: logData.date || now.split('T')[0],
        type: logData.type || 'message',
        notes: logData.notes?.trim() || '',
        createdAt: now,
      };

      const updatedInteractions = [newLog, ...current.interactions];
      const lastInteraction = newLog.date;

      // Advance next reminder based on cadence
      let nextReminder = current.nextReminder;
      if (current.cadenceDays && current.cadenceDays > 0) {
        const baseDate = new Date(lastInteraction);
        nextReminder = new Date(baseDate.getTime() + current.cadenceDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
      }

      const updated: Relationship = {
        ...current,
        lastInteraction,
        nextReminder,
        interactions: updatedInteractions,
        updatedAt: now,
      };

      list[index] = updated;
      this.saveStoredRelationships(userId, list);

      return this.success(updated);
    } catch (err) {
      return this.failure('INTERACTION_LOG_ERROR', 'Failed to record interaction log.', { err });
    }
  }
}

export const relationshipService = new RelationshipService();

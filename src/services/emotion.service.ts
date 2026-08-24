/**
 * Emotion & Private Reflection Service
 * Manages daily emotional check-ins, circadian energy, stress scores, and private journal entries.
 * Strictly non-diagnostic and private to the authenticated operator.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { DateOnlyString, ServiceResult } from '../types/common.types';
import {
  CreateReflectionDTO,
  EmotionReflectionEntry,
  PrimaryEmotion,
  RatingScale1To5,
  ReflectionTrendSummary,
  UpdateReflectionDTO,
} from '../types/emotion.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

const STARTER_REFLECTIONS: readonly Omit<EmotionReflectionEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'loggedAt'>[] = [
  {
    date: new Date().toISOString().split('T')[0],
    mood: 4,
    energy: 4,
    stress: 2,
    primaryEmotion: 'focused',
    reflection: 'Strong momentum in architectural design. Felt clear-headed and focused after aerobic cardio.',
    journalEntry:
      'The morning block was uninterrupted. Maintained deep focus on core specifications. Taking evening time to disengage and sleep soundly.',
    tags: ['deep_work', 'exercise', 'clarity'],
  },
  {
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    mood: 4,
    energy: 3,
    stress: 2,
    primaryEmotion: 'grateful',
    reflection: 'Grateful for steady progress on long-term horizons. Balanced workload without cognitive overload.',
    journalEntry:
      'Checked in with close friends in the afternoon. Restful walk in nature recharged mental energy before the evening review.',
    tags: ['gratitude', 'rest', 'social'],
  },
  {
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    mood: 5,
    energy: 5,
    stress: 1,
    primaryEmotion: 'energized',
    reflection: 'Peak vitality day. System execution was effortless and aligned with primary quarterly goals.',
    journalEntry:
      'Hit optimal sleep metrics (8 hours). Energy remained high across all work sessions. Celebrated milestone completions.',
    tags: ['vitality', 'peak_state', 'sleep_8h'],
  },
  {
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    mood: 3,
    energy: 3,
    stress: 3,
    primaryEmotion: 'reflective',
    reflection: 'Mid-week recalibration. Noticed slight fatigue; adjusted evening priorities to protect recovery.',
    journalEntry:
      'A slightly demanding afternoon required active pacing. Stepped away from screens for a 20-minute restorative break.',
    tags: ['pacing', 'mindfulness'],
  },
];

export class EmotionService extends BaseService {
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
    return `${APP_CONSTANTS.STORAGE_KEYS.REFLECTIONS_PREFIX}${userId}`;
  }

  private getStoredReflections(userId: string): EmotionReflectionEntry[] {
    if (!userId) return [];
    const raw = safeStorage.get<EmotionReflectionEntry[]>(this.getStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const seeded = STARTER_REFLECTIONS.map((sr) => ({
        ...sr,
        id: generateId('ref'),
        userId,
        loggedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getStorageKey(userId), seeded);
      return seeded;
    }
    return raw;
  }

  private saveStoredReflections(userId: string, entries: EmotionReflectionEntry[]): void {
    if (!userId) return;
    safeStorage.set(this.getStorageKey(userId), entries);
  }

  async getReflections(
    userIdOrLimitOrOptions?: string | number | { limit?: number; startDate?: string; endDate?: string },
    maybeLimitOrOptions?: number | { limit?: number; startDate?: string; endDate?: string }
  ): Promise<ServiceResult<readonly EmotionReflectionEntry[]>> {
    try {
      let userId: string;
      let limit: number | undefined;
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (typeof userIdOrLimitOrOptions === 'string') {
        userId = await this.resolveUserId(userIdOrLimitOrOptions);
        if (typeof maybeLimitOrOptions === 'number') {
          limit = maybeLimitOrOptions;
        } else if (typeof maybeLimitOrOptions === 'object') {
          limit = maybeLimitOrOptions.limit;
          startDate = maybeLimitOrOptions.startDate;
          endDate = maybeLimitOrOptions.endDate;
        }
      } else if (typeof userIdOrLimitOrOptions === 'number') {
        userId = await this.resolveUserId();
        limit = userIdOrLimitOrOptions;
      } else if (typeof userIdOrLimitOrOptions === 'object') {
        userId = await this.resolveUserId();
        limit = userIdOrLimitOrOptions.limit;
        startDate = userIdOrLimitOrOptions.startDate;
        endDate = userIdOrLimitOrOptions.endDate;
      } else {
        userId = await this.resolveUserId();
      }

      let entries = this.getStoredReflections(userId);
      if (startDate) {
        entries = entries.filter((e) => e.date >= startDate);
      }
      if (endDate) {
        entries = entries.filter((e) => e.date <= endDate);
      }

      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (limit && limit > 0) {
        return this.success(entries.slice(0, limit));
      }
      return this.success(entries);
    } catch (err) {
      return this.failure('REFLECTION_FETCH_ERROR', 'Failed to retrieve reflection entries.', { err });
    }
  }

  async getReflectionByDate(
    userIdOrDate: string,
    maybeDate?: DateOnlyString
  ): Promise<ServiceResult<EmotionReflectionEntry | null>> {
    try {
      const userId = maybeDate ? await this.resolveUserId(userIdOrDate) : await this.resolveUserId();
      const date = maybeDate || userIdOrDate;

      const entries = this.getStoredReflections(userId);
      const found = entries.find((e) => e.date === date);

      return this.success(found || null);
    } catch (err) {
      return this.failure('REFLECTION_FETCH_ERROR', 'Failed to find reflection for date.', { err });
    }
  }

  async logReflection(
    userIdOrDto: string | CreateReflectionDTO,
    maybeDto?: CreateReflectionDTO
  ): Promise<ServiceResult<EmotionReflectionEntry>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateReflectionDTO;

      if (!dto || !dto.reflection || dto.reflection.trim().length === 0) {
        return this.failure('VALIDATION_ERROR', 'A reflection note is required.');
      }
      if (!dto.date) {
        return this.failure('VALIDATION_ERROR', 'A valid entry date is required.');
      }

      const entries = this.getStoredReflections(userId);
      const existingIndex = entries.findIndex((e) => e.date === dto.date);

      const moodVal = Math.min(5, Math.max(1, dto.mood || 3)) as RatingScale1To5;
      const energyVal = Math.min(5, Math.max(1, dto.energy || 3)) as RatingScale1To5;
      const stressVal = Math.min(5, Math.max(1, dto.stress || 3)) as RatingScale1To5;

      const now = new Date().toISOString();

      if (existingIndex >= 0) {
        // Update existing for that date
        const existing = entries[existingIndex];
        const updated: EmotionReflectionEntry = {
          ...existing,
          mood: moodVal,
          energy: energyVal,
          stress: stressVal,
          primaryEmotion: dto.primaryEmotion || existing.primaryEmotion || 'reflective',
          reflection: dto.reflection.trim(),
          journalEntry: dto.journalEntry !== undefined ? dto.journalEntry.trim() : existing.journalEntry,
          tags: dto.tags || existing.tags,
          updatedAt: now,
        };
        entries[existingIndex] = updated;
        this.saveStoredReflections(userId, entries);
        return this.success(updated);
      } else {
        const newEntry: EmotionReflectionEntry = {
          id: generateId('ref'),
          userId,
          date: dto.date,
          mood: moodVal,
          energy: energyVal,
          stress: stressVal,
          primaryEmotion: dto.primaryEmotion || 'reflective',
          reflection: dto.reflection.trim(),
          journalEntry: dto.journalEntry?.trim() || '',
          tags: dto.tags || [],
          loggedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        entries.unshift(newEntry);
        this.saveStoredReflections(userId, entries);
        return this.success(newEntry);
      }
    } catch (err) {
      return this.failure('REFLECTION_SAVE_ERROR', 'Failed to save daily reflection.', { err });
    }
  }

  async createReflection(
    userIdOrDto: string | any,
    maybeDto?: any
  ): Promise<ServiceResult<any>> {
    const userId = typeof userIdOrDto === 'string' ? userIdOrDto : undefined;
    const dto = typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto;

    const mappedDto: CreateReflectionDTO = {
      date: dto.date || new Date().toISOString().split('T')[0],
      mood: dto.mood || dto.energyLevel || 3,
      energy: dto.energy || dto.energyLevel || 3,
      stress: dto.stress || 2,
      primaryEmotion: dto.primaryEmotion || dto.primaryMood || 'reflective',
      reflection: dto.reflection || dto.note || 'Daily check-in reflection',
      journalEntry: dto.journalEntry,
      tags: dto.tags || [],
    };

    const res = await this.logReflection(userId || 'usr_origin_demo', mappedDto);
    if (!res.success || !res.data) {
      return res;
    }
    return this.success({
      ...res.data,
      primaryMood: res.data.primaryEmotion,
      energyLevel: res.data.energy,
    });
  }

  async getReflectionSummary(userIdOrDays?: string | number, maybeDays = 30): Promise<ServiceResult<any>> {
    const trendsRes = await this.getReflectionTrends(userIdOrDays, maybeDays);
    if (!trendsRes.success || !trendsRes.data) {
      return trendsRes;
    }
    const data = trendsRes.data;
    const userId = typeof userIdOrDays === 'string' ? await this.resolveUserId(userIdOrDays) : await this.resolveUserId();
    const entries = this.getStoredReflections(userId);
    const moodDistribution: Record<string, number> = {};
    for (const e of entries) {
      const em = e.primaryEmotion || 'reflective';
      moodDistribution[em] = (moodDistribution[em] || 0) + 1;
    }

    return this.success({
      totalReflections: data.entryCount,
      averageMood: data.averageMood,
      averageEnergy: data.averageEnergy,
      averageStress: data.averageStress,
      moodDistribution,
      streakDays: data.streakDays,
    });
  }

  async deleteReflection(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const id = maybeId || userIdOrId;

      const entries = this.getStoredReflections(userId);
      const filtered = entries.filter((e) => e.id !== id && e.date !== id);

      if (filtered.length === entries.length) {
        return this.failure('REFLECTION_NOT_FOUND', `Reflection with identifier ${id} not found.`);
      }

      this.saveStoredReflections(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('REFLECTION_DELETE_ERROR', 'Failed to delete reflection entry.', { err });
    }
  }

  async getReflectionTrends(
    userIdOrDays?: string | number,
    maybeDays = 30
  ): Promise<ServiceResult<ReflectionTrendSummary>> {
    try {
      const userId = typeof userIdOrDays === 'string' ? await this.resolveUserId(userIdOrDays) : await this.resolveUserId();
      const days = typeof userIdOrDays === 'number' ? userIdOrDays : maybeDays;

      const entries = this.getStoredReflections(userId);
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const scopedEntries = entries.filter((e) => e.date >= cutoffDate);

      if (scopedEntries.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        return this.success({
          averageMood: 0,
          averageEnergy: 0,
          averageStress: 0,
          entryCount: 0,
          streakDays: 0,
          dateRange: { start: cutoffDate, end: today },
        });
      }

      const totalMood = scopedEntries.reduce((acc, e) => acc + e.mood, 0);
      const totalEnergy = scopedEntries.reduce((acc, e) => acc + e.energy, 0);
      const totalStress = scopedEntries.reduce((acc, e) => acc + e.stress, 0);

      // Emotion frequency count
      const emotionCounts = new Map<PrimaryEmotion, number>();
      for (const e of scopedEntries) {
        if (e.primaryEmotion) {
          emotionCounts.set(e.primaryEmotion, (emotionCounts.get(e.primaryEmotion) || 0) + 1);
        }
      }

      let dominantEmotion: PrimaryEmotion | undefined;
      let highestCount = 0;
      for (const [em, count] of emotionCounts.entries()) {
        if (count > highestCount) {
          highestCount = count;
          dominantEmotion = em;
        }
      }

      // Calculate recent consecutive streak
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const hasEntry = entries.some((e) => e.date === checkDate);
        if (hasEntry) {
          streak++;
        } else if (i > 0) {
          break; // Break if missed day
        }
      }

      return this.success({
        averageMood: Number((totalMood / scopedEntries.length).toFixed(1)),
        averageEnergy: Number((totalEnergy / scopedEntries.length).toFixed(1)),
        averageStress: Number((totalStress / scopedEntries.length).toFixed(1)),
        entryCount: scopedEntries.length,
        streakDays: streak,
        dominantEmotion,
        dateRange: {
          start: scopedEntries[0].date,
          end: scopedEntries[scopedEntries.length - 1].date,
        },
      });
    } catch (err) {
      return this.failure('TRENDS_ERROR', 'Failed to calculate reflection trends.', { err });
    }
  }
}

export const emotionService = new EmotionService();

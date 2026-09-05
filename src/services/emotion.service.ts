/**
 * Emotion & Private Reflection Service
 * Manages daily emotional check-ins, circadian energy, stress scores, and private journal entries.
 * Strictly non-diagnostic and private to the authenticated operator.
 *
 * Authoritative persistence is managed strictly by the authenticated backend API.
 */
import { apiClient } from '../lib/api-client';
import { DateOnlyString, ServiceResult } from '../types/common.types';
import {
  CreateReflectionDTO,
  EmotionReflectionEntry,
  PrimaryEmotion,
  RatingScale1To5,
  ReflectionTrendSummary,
} from '../types/emotion.types';
import { BaseService } from './base.service';

function mapBackendReflectionToEntry(record: any): EmotionReflectionEntry {
  let mood: RatingScale1To5 = 3;
  if (record.mood != null) {
    mood = Math.min(5, Math.max(1, Math.round(Number(record.mood)))) as RatingScale1To5;
  } else if (record.energyLevel != null) {
    mood = Math.min(5, Math.max(1, Math.round(Number(record.energyLevel) / 2))) as RatingScale1To5;
  }

  let energy: RatingScale1To5 = 3;
  if (record.energy != null) {
    energy = Math.min(5, Math.max(1, Math.round(Number(record.energy)))) as RatingScale1To5;
  } else if (record.energyLevel != null) {
    energy = Math.min(5, Math.max(1, Math.round(Number(record.energyLevel) / 2))) as RatingScale1To5;
  }

  let stress: RatingScale1To5 = 3;
  if (record.stress != null) {
    stress = Math.min(5, Math.max(1, Math.round(Number(record.stress)))) as RatingScale1To5;
  } else if (record.stressLevel != null) {
    stress = Math.min(5, Math.max(1, Math.round(Number(record.stressLevel) / 2))) as RatingScale1To5;
  }

  const rawEmotion = (record.primaryEmotion || 'reflective').toLowerCase();
  const validEmotions: PrimaryEmotion[] = [
    'calm',
    'focused',
    'energized',
    'grateful',
    'joyful',
    'neutral',
    'anxious',
    'fatigued',
    'frustrated',
    'overwhelmed',
    'reflective',
  ];
  const primaryEmotion: PrimaryEmotion = validEmotions.includes(rawEmotion as any)
    ? (rawEmotion as PrimaryEmotion)
    : 'reflective';

  const journalEntry = record.journalEntry || record.reflection || '';
  const reflection = record.reflection || record.journalEntry || '';

  return {
    id: record.id,
    userId: record.userId,
    date: typeof record.date === 'string' ? record.date.slice(0, 10) : new Date(record.date).toISOString().slice(0, 10),
    mood,
    energy,
    stress,
    primaryEmotion,
    reflection,
    journalEntry,
    tags: Array.isArray(record.tags) ? record.tags : [],
    loggedAt: record.loggedAt || record.createdAt || new Date().toISOString(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

export class EmotionService extends BaseService {
  async getReflections(
    userIdOrLimitOrOptions?: string | number | { limit?: number; startDate?: string; endDate?: string },
    maybeLimitOrOptions?: number | { limit?: number; startDate?: string; endDate?: string }
  ): Promise<ServiceResult<readonly EmotionReflectionEntry[]>> {
    try {
      let limit: number | undefined;
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (typeof userIdOrLimitOrOptions === 'string') {
        if (typeof maybeLimitOrOptions === 'number') {
          limit = maybeLimitOrOptions;
        } else if (typeof maybeLimitOrOptions === 'object') {
          limit = maybeLimitOrOptions.limit;
          startDate = maybeLimitOrOptions.startDate;
          endDate = maybeLimitOrOptions.endDate;
        }
      } else if (typeof userIdOrLimitOrOptions === 'number') {
        limit = userIdOrLimitOrOptions;
      } else if (typeof userIdOrLimitOrOptions === 'object') {
        limit = userIdOrLimitOrOptions.limit;
        startDate = userIdOrLimitOrOptions.startDate;
        endDate = userIdOrLimitOrOptions.endDate;
      }

      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (limit) params.set('limit', String(limit));

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await apiClient.get<any[]>(`/api/emotions/reflections${queryStr}`);

      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'REFLECTION_FETCH_ERROR',
          res.error?.message || 'Failed to retrieve reflection entries.'
        );
      }

      const entries = res.data.map(mapBackendReflectionToEntry);
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (limit && limit > 0) {
        return this.success(entries.slice(0, limit));
      }
      return this.success(entries);
    } catch (err: any) {
      return this.failure('REFLECTION_FETCH_ERROR', 'Failed to retrieve reflection entries.', { err: err?.message });
    }
  }

  async getReflectionByDate(
    userIdOrDate: string,
    maybeDate?: DateOnlyString
  ): Promise<ServiceResult<EmotionReflectionEntry | null>> {
    try {
      const date = maybeDate || userIdOrDate;
      const res = await apiClient.get<any>(`/api/emotions/reflections/${date}`);

      if (res.success && res.data) {
        return this.success(mapBackendReflectionToEntry(res.data));
      }

      if (res.error?.code === 'NOT_FOUND' || res.error?.code === 'HTTP_404') {
        const listRes = await this.getReflections({ limit: 50 });
        if (listRes.success && listRes.data) {
          const found = listRes.data.find((e) => e.date === date);
          return this.success(found || null);
        }
        return this.success(null);
      }

      return this.failure(
        res.error?.code || 'REFLECTION_FETCH_ERROR',
        res.error?.message || 'Failed to find reflection for date.'
      );
    } catch (err: any) {
      return this.failure('REFLECTION_FETCH_ERROR', 'Failed to find reflection for date.', { err: err?.message });
    }
  }

  async logReflection(
    userIdOrDto: string | CreateReflectionDTO,
    maybeDto?: CreateReflectionDTO
  ): Promise<ServiceResult<EmotionReflectionEntry>> {
    try {
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateReflectionDTO;

      if (!dto || !dto.reflection || dto.reflection.trim().length === 0) {
        return this.failure('VALIDATION_ERROR', 'A reflection note is required.');
      }
      if (!dto.date) {
        return this.failure('VALIDATION_ERROR', 'A valid entry date is required.');
      }

      const moodVal = Math.min(5, Math.max(1, dto.mood || 3)) as RatingScale1To5;
      const energyVal = Math.min(5, Math.max(1, dto.energy || 3)) as RatingScale1To5;
      const stressVal = Math.min(5, Math.max(1, dto.stress || 3)) as RatingScale1To5;

      const payload = {
        date: dto.date,
        mood: moodVal,
        energy: energyVal,
        stress: stressVal,
        energyLevel: energyVal * 2,
        stressLevel: stressVal * 2,
        clarityLevel: moodVal * 2,
        primaryEmotion: dto.primaryEmotion || 'reflective',
        reflection: dto.reflection.trim(),
        journalEntry: dto.journalEntry?.trim() || dto.reflection.trim(),
        tags: Array.isArray(dto.tags) ? [...dto.tags] : [],
      };

      const res = await apiClient.post<any>('/api/emotions/reflections', payload);

      if (!res.success || !res.data) {
        return this.failure(
          res.error?.code || 'REFLECTION_SAVE_ERROR',
          res.error?.message || 'Failed to save daily reflection.'
        );
      }

      const entry = mapBackendReflectionToEntry(res.data);
      return this.success(entry);
    } catch (err: any) {
      return this.failure('REFLECTION_SAVE_ERROR', 'Failed to save daily reflection.', { err: err?.message });
    }
  }

  async createReflection(
    userIdOrDto: string | any,
    maybeDto?: any
  ): Promise<ServiceResult<any>> {
    const dto = typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto;

    const normalizeTo1To5 = (val: any, defaultVal: number): RatingScale1To5 => {
      if (val === undefined || val === null) return defaultVal as RatingScale1To5;
      const num = Number(val);
      if (isNaN(num)) return defaultVal as RatingScale1To5;
      if (num > 5) {
        return Math.min(5, Math.max(1, Math.round(num / 2))) as RatingScale1To5;
      }
      return Math.min(5, Math.max(1, Math.round(num))) as RatingScale1To5;
    };

    const moodVal = normalizeTo1To5(dto.mood ?? dto.energyLevel, 3);
    const energyVal = normalizeTo1To5(dto.energy ?? dto.energyLevel, 3);
    const stressVal = normalizeTo1To5(dto.stress ?? dto.stressLevel, 2);

    const mappedDto: CreateReflectionDTO = {
      date: dto.date || new Date().toISOString().split('T')[0],
      mood: moodVal,
      energy: energyVal,
      stress: stressVal,
      primaryEmotion: dto.primaryEmotion || dto.primaryMood || 'reflective',
      reflection: dto.reflection || dto.note || dto.journalEntry || 'Daily check-in reflection',
      journalEntry: dto.journalEntry || dto.reflection,
      tags: dto.tags || [],
    };

    const res = await this.logReflection(mappedDto);
    if (!res.success || !res.data) {
      return res;
    }
    return this.success({
      ...res.data,
      primaryMood: res.data.primaryEmotion,
      energyLevel: res.data.energy,
    });
  }

  async deleteReflection(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const id = maybeId || userIdOrId;
      const res = await apiClient.delete<{ deleted: boolean }>(`/api/emotions/reflections/${id}`);

      if (!res.success) {
        if (res.error?.code === 'NOT_FOUND' || res.error?.code === 'HTTP_404') {
          return this.failure('REFLECTION_NOT_FOUND', `Reflection with identifier ${id} not found.`);
        }
        return this.failure(
          res.error?.code || 'REFLECTION_DELETE_ERROR',
          res.error?.message || 'Failed to delete reflection entry.'
        );
      }

      return this.success(undefined);
    } catch (err: any) {
      return this.failure('REFLECTION_DELETE_ERROR', 'Failed to delete reflection entry.', { err: err?.message });
    }
  }

  async getReflectionTrends(
    userIdOrDays?: string | number,
    maybeDays = 30
  ): Promise<ServiceResult<ReflectionTrendSummary>> {
    try {
      const days = typeof userIdOrDays === 'number' ? userIdOrDays : maybeDays;
      const listRes = await this.getReflections();

      if (!listRes.success || !listRes.data) {
        return this.failure(
          listRes.error?.code || 'TRENDS_ERROR',
          listRes.error?.message || 'Failed to calculate reflection trends.'
        );
      }

      const entries = [...listRes.data];
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

      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const hasEntry = entries.some((e) => e.date === checkDate);
        if (hasEntry) {
          streak++;
        } else if (i > 0) {
          break;
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
    } catch (err: any) {
      return this.failure('TRENDS_ERROR', 'Failed to calculate reflection trends.', { err: err?.message });
    }
  }

  async getReflectionSummary(userIdOrDays?: string | number, maybeDays = 30): Promise<ServiceResult<any>> {
    const trendsRes = await this.getReflectionTrends(userIdOrDays, maybeDays);
    if (!trendsRes.success || !trendsRes.data) {
      return trendsRes;
    }
    const data = trendsRes.data;

    const listRes = await this.getReflections();
    const entries = listRes.success && listRes.data ? listRes.data : [];
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
}

export const emotionService = new EmotionService();

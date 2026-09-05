import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { emotionService } from '../emotion.service';
import { apiClient } from '../../lib/api-client';
import { safeStorage } from '../../lib/storage';

describe('EmotionService (Authoritative API Persistence)', () => {
  const userId = 'user_test_emotion_1';
  let mockReflections: any[] = [];

  beforeEach(() => {
    mockReflections = [];
    safeStorage.clear();

    vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/api/emotions/reflections')) {
        const url = new URL(endpoint, 'http://localhost:3000');
        const pathParts = url.pathname.split('/');
        const idOrDate = pathParts[4]; // /api/emotions/reflections/:id

        if (idOrDate) {
          const found = mockReflections.find((r) => r.id === idOrDate || r.date === idOrDate);
          if (found) {
            return { success: true, data: found };
          }
          return { success: false, error: { code: 'NOT_FOUND', message: 'Reflection not found.' } };
        }

        let results = [...mockReflections];
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const limit = url.searchParams.get('limit');

        if (startDate) results = results.filter((r) => r.date >= startDate);
        if (endDate) results = results.filter((r) => r.date <= endDate);
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (limit) results = results.slice(0, Number(limit));

        return { success: true, data: results };
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });

    vi.spyOn(apiClient, 'post').mockImplementation(async (endpoint: string, body?: any) => {
      if (endpoint === '/api/emotions/reflections') {
        const existingIndex = mockReflections.findIndex((r) => r.date === body.date);
        const now = new Date().toISOString();
        const record = {
          id: existingIndex >= 0 ? mockReflections[existingIndex].id : `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId,
          date: body.date,
          energyLevel: body.energyLevel,
          clarityLevel: body.clarityLevel,
          stressLevel: body.stressLevel,
          mood: body.mood,
          energy: body.energy,
          stress: body.stress,
          primaryEmotion: body.primaryEmotion,
          reflection: body.reflection,
          journalEntry: body.journalEntry,
          tags: body.tags || [],
          loggedAt: now,
          createdAt: existingIndex >= 0 ? mockReflections[existingIndex].createdAt : now,
          updatedAt: now,
        };

        if (existingIndex >= 0) {
          mockReflections[existingIndex] = record;
        } else {
          mockReflections.unshift(record);
        }

        return { success: true, data: record };
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });

    vi.spyOn(apiClient, 'delete').mockImplementation(async (endpoint: string) => {
      if (endpoint.startsWith('/api/emotions/reflections/')) {
        const id = endpoint.split('/')[4];
        const initialLen = mockReflections.length;
        mockReflections = mockReflections.filter((r) => r.id !== id && r.date !== id);
        if (mockReflections.length < initialLen) {
          return { success: true, data: { deleted: true } };
        }
        return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
      }
      return { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records emotional reflections via apiClient.post and persists to backend', async () => {
    const res = await emotionService.createReflection(userId, {
      primaryMood: 'energized',
      secondaryEmotions: ['focused', 'calm'],
      energyLevel: 4,
      note: 'Deep architecture work on distributed consensus.',
      date: '2026-08-20',
      tags: ['deep_work', 'systems'],
    });

    expect(res.success).toBe(true);
    expect(res.data?.primaryMood).toBe('energized');
    expect(res.data?.date).toBe('2026-08-20');

    // Verify apiClient was called, safeStorage was NOT used
    expect(apiClient.post).toHaveBeenCalled();
    expect(safeStorage.get(`origin_reflections_${userId}`, null)).toBeNull();

    const listRes = await emotionService.getReflections(userId);
    expect(listRes.success).toBe(true);
    expect(listRes.data?.length).toBe(1);
    expect(listRes.data?.[0].reflection).toBe('Deep architecture work on distributed consensus.');
  });

  it('retrieves reflection by date via API', async () => {
    await emotionService.logReflection(userId, {
      date: '2026-08-21',
      mood: 4,
      energy: 4,
      stress: 2,
      primaryEmotion: 'focused',
      reflection: 'Steady execution throughout morning.',
      journalEntry: 'Great clarity.',
      tags: ['clarity'],
    });

    const res = await emotionService.getReflectionByDate(userId, '2026-08-21');
    expect(res.success).toBe(true);
    expect(res.data?.date).toBe('2026-08-21');
    expect(res.data?.primaryEmotion).toBe('focused');
  });

  it('deletes reflection via API', async () => {
    const created = await emotionService.logReflection(userId, {
      date: '2026-08-22',
      mood: 3,
      energy: 3,
      stress: 3,
      reflection: 'To be deleted',
    });

    const id = created.data!.id;
    const delRes = await emotionService.deleteReflection(userId, id);
    expect(delRes.success).toBe(true);

    const listRes = await emotionService.getReflections(userId);
    expect(listRes.data?.some((r) => r.id === id)).toBe(false);
  });

  it('calculates emotional patterns and mood distributions over time', async () => {
    await emotionService.createReflection(userId, {
      primaryMood: 'calm',
      energyLevel: 3,
      date: '2026-08-18',
    });

    await emotionService.createReflection(userId, {
      primaryMood: 'energized',
      energyLevel: 5,
      date: '2026-08-19',
    });

    await emotionService.createReflection(userId, {
      primaryMood: 'energized',
      energyLevel: 4,
      date: '2026-08-20',
    });

    const summaryRes = await emotionService.getReflectionSummary(userId, 30);
    expect(summaryRes.success).toBe(true);
    expect(summaryRes.data?.totalReflections).toBe(3);
    expect(summaryRes.data?.averageEnergy).toBe(4); // (3+5+4)/3 = 4
    expect(summaryRes.data?.moodDistribution['energized']).toBe(2);
    expect(summaryRes.data?.moodDistribution['calm']).toBe(1);
  });

  it('does NOT fallback to localStorage or mask failures when backend write fails', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Database connection failed.' },
    });

    const res = await emotionService.logReflection(userId, {
      date: '2026-08-23',
      mood: 5,
      energy: 5,
      stress: 1,
      reflection: 'Peak day',
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('SERVER_ERROR');
    // Ensure localStorage was not silently written with this reflection
    expect(safeStorage.get(`origin_reflections_${userId}`, null)).toBeNull();
  });
});


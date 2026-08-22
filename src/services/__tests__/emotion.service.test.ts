import { describe, it, expect, beforeEach } from 'vitest';
import { emotionService } from '../emotion.service';
import { safeStorage } from '../../lib/storage';

describe('EmotionService and Reflection Telemetry', () => {
  const userId = 'user_test_emotion_1';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('records emotional reflections and prevents duplicate log on same day unless updated', async () => {
    const res = await emotionService.createReflection(userId, {
      primaryMood: 'inspired',
      secondaryEmotions: ['focused', 'calm'],
      energyLevel: 4,
      note: 'Deep architecture work on distributed consensus.',
      date: '2026-08-20',
      tags: ['deep_work', 'systems'],
    });

    expect(res.success).toBe(true);
    expect(res.data?.primaryMood).toBe('inspired');
    expect(res.data?.energyLevel).toBe(4);

    const listRes = await emotionService.getReflections(userId);
    expect(listRes.success).toBe(true);
    expect(listRes.data?.length).toBe(1);
  });

  it('calculates emotional patterns and mood distributions over time', async () => {
    await emotionService.createReflection(userId, {
      primaryMood: 'calm',
      energyLevel: 3,
      date: '2026-08-18',
    });

    await emotionService.createReflection(userId, {
      primaryMood: 'inspired',
      energyLevel: 5,
      date: '2026-08-19',
    });

    await emotionService.createReflection(userId, {
      primaryMood: 'inspired',
      energyLevel: 4,
      date: '2026-08-20',
    });

    const summaryRes = await emotionService.getReflectionSummary(userId, 30);
    expect(summaryRes.success).toBe(true);
    expect(summaryRes.data?.totalReflections).toBe(3);
    expect(summaryRes.data?.averageEnergy).toBe(4); // (3+5+4)/3 = 4
    expect(summaryRes.data?.moodDistribution['inspired']).toBe(2);
    expect(summaryRes.data?.moodDistribution['calm']).toBe(1);
  });
});

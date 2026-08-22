import { describe, it, expect, beforeEach } from 'vitest';
import { insightService } from '../insight.service';
import { taskService } from '../task.service';
import { habitService, getTodayDateString } from '../habit.service';
import { financeService } from '../finance.service';
import { emotionService } from '../emotion.service';
import { safeStorage } from '../../lib/storage';

describe('InsightService and Empirical Epistemic Grounding', () => {
  const userId = 'user_test_insight_1';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('does not invent speculative insights when insufficient telemetry exists', async () => {
    // Zero data seeded
    const insightsRes = await insightService.generateLifeInsights(userId);
    expect(insightsRes.success).toBe(true);
    expect(insightsRes.data?.length).toBe(0); // Insufficient data threshold enforced
  });

  it('generates empirically grounded insights with distinct Observed Data and Interpretation', async () => {
    const today = getTodayDateString();

    // Seed tasks
    for (let i = 0; i < 4; i++) {
      const t = await taskService.createTask(userId, { title: `Task ${i}` });
      await taskService.updateTask(userId, t.data!.id, { status: 'completed' });
    }

    // Seed habit & logs
    const h = await habitService.createHabit(userId, {
      name: 'Deep Work Block',
      frequency: 'daily',
      targetUnits: 1,
      unitLabel: 'session',
    });
    if (h.data) {
      await habitService.logHabitCompletion(userId, h.data.id, today, 1);
    }

    // Seed finances
    await financeService.createTransaction(userId, {
      type: 'income',
      amountMinor: 500000,
      category: 'income_salary',
      date: today,
    });
    await financeService.createTransaction(userId, {
      type: 'expense',
      amountMinor: 100000,
      category: 'housing',
      date: today,
    });

    // Seed reflection
    await emotionService.createReflection(userId, {
      primaryMood: 'inspired',
      energyLevel: 5,
      date: today,
    });

    const insightsRes = await insightService.generateLifeInsights(userId);
    expect(insightsRes.success).toBe(true);
    expect(insightsRes.data?.length).toBeGreaterThan(0);

    const taskInsight = insightsRes.data?.find((i) => i.domain === 'tasks_execution');
    expect(taskInsight).toBeDefined();
    expect(taskInsight?.observedData).toBeDefined();
    expect(taskInsight?.observedData.length).toBeGreaterThan(0);
    expect(taskInsight?.interpretation).toBeDefined();
    expect(typeof taskInsight?.interpretation).toBe('string');
  });
});

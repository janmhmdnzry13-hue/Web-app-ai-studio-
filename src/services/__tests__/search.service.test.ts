import { describe, it, expect, beforeEach } from 'vitest';
import { searchService } from '../search.service';
import { taskService } from '../task.service';
import { goalService } from '../goal.service';
import { habitService } from '../habit.service';
import { noteService } from '../note.service';
import { financeService } from '../finance.service';
import { relationshipService } from '../relationship.service';
import { safeStorage } from '../../lib/storage';

describe('SearchService and Cross-Domain Universal Search', () => {
  const userId = 'user_test_search_1';

  beforeEach(async () => {
    safeStorage.clear();
    // Seed items across different domains
    await taskService.createTask(userId, {
      title: 'Review quarterly financial revenue numbers',
      priority: 'high',
    });

    await goalService.createGoal(userId, {
      title: 'Reach $100k Sovereign Financial Fund',
      category: 'financial_growth',
      timeframe: 'annual',
      targetDate: '2026-12-31',
    });

    await habitService.createHabit(userId, {
      name: 'Read financial reports',
      frequency: 'daily',
      targetUnits: 1,
      unitLabel: 'session',
    });

    await noteService.createNote(userId, {
      title: 'Financial modeling notes',
      content: 'DCF valuation methodologies',
      tags: ['finance'],
    });

    await financeService.createTransaction(userId, {
      type: 'income',
      amountMinor: 250000,
      category: 'income_salary',
      date: '2026-08-01',
      description: 'Q3 Financial retainer',
    });

    await relationshipService.createRelationship(userId, {
      name: 'Financial Advisor James',
      relationshipType: 'mentor',
      cadenceDays: 30,
    });
  });

  it('performs cross-domain parallel search returning results from all modules', async () => {
    const searchRes = await searchService.search({
      query: 'financial',
      userId,
    });

    expect(searchRes.success).toBe(true);
    expect(searchRes.data?.length).toBeGreaterThanOrEqual(4);

    const types = searchRes.data?.map((r) => r.type);
    expect(types).toContain('task');
    expect(types).toContain('goal');
    expect(types).toContain('habit');
    expect(types).toContain('note');
    expect(types).toContain('transaction');
    expect(types).toContain('relationship');
  });

  it('filters cross-domain search results by domain type', async () => {
    const searchRes = await searchService.search({
      query: 'financial',
      typeFilter: 'note',
      userId,
    });

    expect(searchRes.success).toBe(true);
    expect(searchRes.data?.length).toBe(1);
    expect(searchRes.data?.[0].type).toBe('note');
    expect(searchRes.data?.[0].title).toBe('Financial modeling notes');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { relationshipService } from '../relationship.service';
import { safeStorage } from '../../lib/storage';

describe('RelationshipService and Interaction Cadences', () => {
  const userId = 'user_test_rel_1';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('creates a relationship contact and computes next reminder based on cadence', async () => {
    const res = await relationshipService.createRelationship(userId, {
      name: 'Dr. Marcus Rivera',
      relationshipType: 'mentor',
      cadenceDays: 14,
      lastInteraction: '2026-08-01',
      notes: 'Advises on distributed algorithms.',
    });

    expect(res.success).toBe(true);
    expect(res.data?.name).toBe('Dr. Marcus Rivera');
    expect(res.data?.cadenceDays).toBe(14);
    expect(res.data?.nextReminder).toBe('2026-08-15'); // 2026-08-01 + 14 days
  });

  it('logs interactions and updates lastInteraction and nextReminder accordingly', async () => {
    const createRes = await relationshipService.createRelationship(userId, {
      name: 'Sofia Chen',
      relationshipType: 'close_friend',
      cadenceDays: 7,
      lastInteraction: '2026-08-01',
    });

    const relId = createRes.data!.id;

    // Log interaction on 2026-08-10
    const logRes = await relationshipService.logInteraction(userId, relId, {
      type: 'call',
      date: '2026-08-10',
      notes: 'Caught up about summer projects.',
    });

    expect(logRes.success).toBe(true);
    expect(logRes.data?.lastInteraction).toBe('2026-08-10');
    expect(logRes.data?.nextReminder).toBe('2026-08-17'); // 2026-08-10 + 7 days
    expect(logRes.data?.interactions.length).toBe(1);
  });
});

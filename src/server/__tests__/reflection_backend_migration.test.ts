import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter, resetRateLimitsForTesting } from '../routes';
import { generateToken, hashPassword } from '../auth';
import { userRepository, reflectionRepository } from '../repositories';
import { buildServerAuthorizedAIContext } from '../ai-context';
import { safeStorage } from '../../lib/storage';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiRouter);

describe('Reflections / Emotions Backend Authoritative Migration Suite', () => {
  let userA: { id: string; token: string; email: string };
  let userB: { id: string; token: string; email: string };

  beforeEach(async () => {
    resetRateLimitsForTesting();
    safeStorage.clear();

    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const passwordHash = hashPassword('ValidPass123!');

    const recordA = await userRepository.create({
      id: `usr_refl_a_${timestamp}`,
      email: `refl_a_${timestamp}@origin.test`,
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Operator Alice',
        headline: '',
        bio: '',
        primaryLifeFocus: 'Health & Vitality',
      },
      preferences: {
        theme: 'dark',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: false, dailyDigest: false },
      },
      subscription: {
        tier: 'pro',
        status: 'active',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const recordB = await userRepository.create({
      id: `usr_refl_b_${timestamp}`,
      email: `refl_b_${timestamp}@origin.test`,
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Operator Bob',
        headline: '',
        bio: '',
        primaryLifeFocus: 'Career & Craft',
      },
      preferences: {
        theme: 'light',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: false, dailyDigest: false },
      },
      subscription: {
        tier: 'pro',
        status: 'active',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    userA = {
      id: recordA.id,
      token: generateToken(recordA),
      email: recordA.email,
    };

    userB = {
      id: recordB.id,
      token: generateToken(recordB),
      email: recordB.email,
    };
  });

  it('creates and persists a reflection with rich schema in backend repository', async () => {
    const payload = {
      date: '2026-08-25',
      mood: 4,
      energy: 4,
      stress: 2,
      primaryEmotion: 'focused',
      reflection: 'Consistent mental rhythm during systems design session.',
      journalEntry: 'Protected deep work block in the morning. Zero notification distractions.',
      wins: ['Finished API specification', 'Cold plunge recovery'],
      tags: ['deep_work', 'vitality'],
    };

    const res = await request(app)
      .post('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userA.token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const created = res.body.data;
    expect(created.id).toBeDefined();
    expect(created.userId).toBe(userA.id);
    expect(created.date).toBe('2026-08-25');
    expect(created.energyLevel).toBe(8); // energy 4 * 2
    expect(created.stressLevel).toBe(4); // stress 2 * 2
    expect(created.mood).toBe(4);
    expect(created.primaryEmotion).toBe('focused');
    expect(created.reflection).toBe('Consistent mental rhythm during systems design session.');
    expect(created.tags).toEqual(['deep_work', 'vitality']);

    // Verify directly in backend repository
    const dbEntry = await reflectionRepository.findById(created.id, userA.id);
    expect(dbEntry).not.toBeNull();
    expect(dbEntry?.userId).toBe(userA.id);
    expect(dbEntry?.reflection).toBe('Consistent mental rhythm during systems design session.');
  });

  it('updates reflection atomically via PATCH /api/emotions/reflections/:id', async () => {
    const createRes = await request(app)
      .post('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-08-26',
        mood: 3,
        energy: 3,
        stress: 3,
        primaryEmotion: 'neutral',
        reflection: 'Initial check-in draft.',
      });

    expect(createRes.status).toBe(200);
    const reflectionId = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/api/emotions/reflections/${reflectionId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        mood: 5,
        energy: 5,
        stress: 1,
        primaryEmotion: 'energized',
        reflection: 'Updated evening clarity: achieved full breakthrough.',
        tags: ['breakthrough'],
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.mood).toBe(5);
    expect(patchRes.body.data.energyLevel).toBe(10);
    expect(patchRes.body.data.stressLevel).toBe(2);
    expect(patchRes.body.data.primaryEmotion).toBe('energized');
    expect(patchRes.body.data.reflection).toBe('Updated evening clarity: achieved full breakthrough.');
    expect(patchRes.body.data.tags).toEqual(['breakthrough']);

    // Verify in database repository
    const dbEntry = await reflectionRepository.findById(reflectionId, userA.id);
    expect(dbEntry?.mood).toBe(5);
    expect(dbEntry?.reflection).toBe('Updated evening clarity: achieved full breakthrough.');
  });

  it('strictly enforces multi-tenant isolation on backend reflection endpoints', async () => {
    // User A creates a highly private reflection
    const resA = await request(app)
      .post('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-08-27',
        mood: 2,
        energy: 2,
        stress: 4,
        primaryEmotion: 'overwhelmed',
        reflection: 'Private executive deliberation. Do not disclose.',
        journalEntry: 'Confidential strategy reflections regarding competitive repositioning.',
      });
    expect(resA.status).toBe(200);
    const reflectionIdA = resA.body.data.id;

    // User B tries to view reflections list - should NOT see User A's reflection
    const getResB = await request(app)
      .get('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(getResB.status).toBe(200);
    const reflectionsB = getResB.body.data;
    expect(reflectionsB.some((r: any) => r.id === reflectionIdA || r.userId === userA.id)).toBe(false);

    // User B tries to get User A's reflection by ID - should return 404
    const getByIdResB = await request(app)
      .get(`/api/emotions/reflections/${reflectionIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(getByIdResB.status).toBe(404);

    // User B tries to patch User A's reflection - should return 404
    const patchResB = await request(app)
      .patch(`/api/emotions/reflections/${reflectionIdA}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ reflection: 'Malicious modification' });
    expect(patchResB.status).toBe(404);

    // User B tries to delete User A's reflection - should return 404
    const deleteResB = await request(app)
      .delete(`/api/emotions/reflections/${reflectionIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteResB.status).toBe(404);

    // Verify User A's reflection is intact
    const verifyReflA = await reflectionRepository.findById(reflectionIdA, userA.id);
    expect(verifyReflA?.reflection).toBe('Private executive deliberation. Do not disclose.');
  });

  it('never trusts client-supplied userId in payload or parameters', async () => {
    // User B attempts to write a reflection on behalf of User A by sending userId: userA.id
    const spoofRes = await request(app)
      .post('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({
        userId: userA.id,
        date: '2026-08-28',
        mood: 1,
        energy: 1,
        stress: 5,
        primaryEmotion: 'anxious',
        reflection: 'Spoofed reflection record.',
      });

    expect(spoofRes.status).toBe(200);
    // The server MUST bind the record to userB.id from the token, NEVER userA.id
    expect(spoofRes.body.data.userId).toBe(userB.id);

    // Check User A's reflections - spoofed record must NOT exist for User A
    const listA = await reflectionRepository.findByUserId(userA.id);
    expect(listA.some((r) => r.reflection === 'Spoofed reflection record.')).toBe(false);
  });

  it('deletes reflection and removes it authoritatively from backend', async () => {
    const res = await request(app)
      .post('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-08-29',
        mood: 3,
        energy: 3,
        stress: 2,
        reflection: 'Temporary reflection to delete.',
      });
    const id = res.body.data.id;

    const delRes = await request(app)
      .delete(`/api/emotions/reflections/${id}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(delRes.status).toBe(200);

    const check = await reflectionRepository.findById(id, userA.id);
    expect(check).toBeNull();
  });

  it('ensures server-side AI context includes authoritative backend reflection data for user', async () => {
    await request(app)
      .post('/api/emotions/reflections')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        date: '2026-08-30',
        mood: 5,
        energyLevel: 9,
        clarityLevel: 9,
        stressLevel: 2,
        primaryEmotion: 'energized',
        wins: ['10k morning run', 'Closed partnership contract'],
        reflection: 'Authoritative telemetry reflected accurately in AI context.',
      });

    const aiContext = buildServerAuthorizedAIContext(userA.id);
    expect(aiContext.reflections).toBeDefined();
    expect(aiContext.reflections.length).toBeGreaterThan(0);
    const matched = aiContext.reflections.find((r) => r.date === '2026-08-30');
    expect(matched).toBeDefined();
    expect(matched?.primaryEmotion).toBe('energized');
    expect(matched?.energyLevel).toBe(9);
    expect(matched?.wins).toContain('10k morning run');
  });

  it('ensures new users have empty reflection history (no demo reflection leakage)', async () => {
    const newTimestamp = Date.now() + 8888;
    const newRecord = await userRepository.create({
      id: `usr_clean_${newTimestamp}`,
      email: `clean_${newTimestamp}@origin.test`,
      passwordHash: hashPassword('ValidPass123!'),
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'Clean User', headline: '', bio: '', primaryLifeFocus: '' },
      preferences: {
        theme: 'dark',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: false, dailyDigest: false },
      },
      subscription: { tier: 'free', status: 'active' },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const token = generateToken(newRecord);
    const listRes = await request(app)
      .get('/api/emotions/reflections')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);
  });
});

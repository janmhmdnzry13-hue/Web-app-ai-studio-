import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter, resetRateLimitsForTesting } from '../routes';
import { generateToken, hashPassword } from '../auth';
import { userRepository, goalRepository } from '../repositories';
import { buildServerAuthorizedAIContext } from '../ai-context';
import { goalService } from '../../services/goal.service';
import { safeStorage } from '../../lib/storage';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiRouter);

describe('Goals Backend Authoritative Migration Suite', () => {
  let userA: { id: string; token: string; email: string };
  let userB: { id: string; token: string; email: string };

  beforeEach(async () => {
    resetRateLimitsForTesting();
    safeStorage.clear();

    const timestamp = Date.now() + Math.floor(Math.random() * 100000);
    const passwordHash = hashPassword('ValidPass123!');

    const recordA = await userRepository.create({
      id: `usr_goal_a_${timestamp}`,
      email: `goala_${timestamp}@origin.test`,
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Goal Operator Alice',
        headline: '',
        bio: '',
        primaryLifeFocus: 'Health & Endurance',
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
      id: `usr_goal_b_${timestamp}`,
      email: `goalb_${timestamp}@origin.test`,
      passwordHash,
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Goal Operator Bob',
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

  it('creates and persists a goal with rich schema in Postgres backend', async () => {
    const payload = {
      title: 'Run a 100-Mile Ultramarathon',
      description: 'Endurance mastery and mental grit',
      category: 'health_vitality',
      timeframe: 'annual',
      targetDate: '2026-12-31T23:59:59.000Z',
      status: 'active',
      progressPercentage: 25,
      linkedHabitIds: ['hbt_daily_run'],
      successCriteria: ['Finish Western States in under 24 hours', 'Zero injury downtime'],
      milestones: [
        {
          title: '50K Training Run',
          targetDate: '2026-06-30T23:59:59.000Z',
          completed: true,
          completedAt: '2026-06-30T18:00:00.000Z',
          weight: 40,
        },
        {
          title: '100K Mountain Race Qualifier',
          targetDate: '2026-09-30T23:59:59.000Z',
          completed: false,
          weight: 60,
        },
      ],
    };

    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${userA.token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const created = res.body.data;
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Run a 100-Mile Ultramarathon');
    expect(created.status).toBe('active');
    expect(created.progressPercentage).toBe(25);
    expect(created.linkedHabitIds).toEqual(['hbt_daily_run']);
    expect(created.successCriteria).toHaveLength(2);
    expect(created.milestones).toHaveLength(2);
    expect(created.milestones[0].completed).toBe(true);
    expect(created.milestones[0].weight).toBe(40);
    expect(created.milestones[1].completed).toBe(false);
    expect(created.milestones[1].weight).toBe(60);

    // Verify direct Postgres persistence via repository
    const dbGoal = await goalRepository.findById(created.id, userA.id);
    expect(dbGoal).not.toBeNull();
    expect(dbGoal?.id).toBe(created.id);
    expect(dbGoal?.status).toBe('active');
    expect(dbGoal?.progressPercentage).toBe(25);
    expect(dbGoal?.milestones).toHaveLength(2);
  });

  it('updates goal progress, status, and milestones atomically via PATCH /api/goals/:id', async () => {
    // Create initial goal
    const createRes = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Launch SaaS Platform',
        category: 'career_craft',
        timeframe: 'quarterly',
        targetDate: '2026-10-31T23:59:59.000Z',
        milestones: [
          { title: 'MVP v1', completed: false, weight: 50 },
          { title: 'Beta 100 users', completed: false, weight: 50 },
        ],
      });

    expect(createRes.status).toBe(200);
    const goalId = createRes.body.data.id;

    // Update progress and complete first milestone
    const patchRes = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        progressPercentage: 50,
        milestones: [
          { title: 'MVP v1', completed: true, completedAt: new Date().toISOString(), weight: 50 },
          { title: 'Beta 100 users', completed: false, weight: 50 },
        ],
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.progressPercentage).toBe(50);
    expect(patchRes.body.data.milestones[0].completed).toBe(true);
    expect(patchRes.body.data.milestones[1].completed).toBe(false);

    // Verify in database
    const dbGoal = await goalRepository.findById(goalId, userA.id);
    expect(dbGoal?.progressPercentage).toBe(50);
    expect(dbGoal?.milestones.find((m) => m.title === 'MVP v1')?.completed).toBe(true);
  });

  it('strictly enforces multi-tenant isolation on backend goal endpoints', async () => {
    // User A creates a confidential goal
    const resA = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Secret Acquisition Roadmap',
        category: 'financial_freedom',
        timeframe: 'multi_year',
        targetDate: '2027-01-01T00:00:00.000Z',
      });
    expect(resA.status).toBe(200);
    const goalIdA = resA.body.data.id;

    // User B tries to view goals - should NOT see User A's goal
    const getResB = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(getResB.status).toBe(200);
    const goalsB = getResB.body.data;
    expect(goalsB.some((g: any) => g.id === goalIdA)).toBe(false);

    // User B tries to get User A's goal by ID - should return 404
    const getByIdResB = await request(app)
      .get(`/api/goals/${goalIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(getByIdResB.status).toBe(404);

    // User B tries to patch User A's goal - should return 404
    const patchResB = await request(app)
      .patch(`/api/goals/${goalIdA}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ title: 'Hacked Goal' });
    expect(patchResB.status).toBe(404);

    // User B tries to delete User A's goal - should return 404
    const deleteResB = await request(app)
      .delete(`/api/goals/${goalIdA}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteResB.status).toBe(404);

    // Verify User A's goal was untouched
    const verifyGoalA = await goalRepository.findById(goalIdA, userA.id);
    expect(verifyGoalA?.title).toBe('Secret Acquisition Roadmap');
  });

  it('deletes goal and cascades milestone deletion in Postgres', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Temporary Goal to Delete',
        category: 'personal',
        timeframe: 'quarterly',
        targetDate: '2026-12-31T00:00:00.000Z',
        milestones: [{ title: 'Milestone 1', weight: 100 }],
      });
    const goalId = res.body.data.id;

    const delRes = await request(app)
      .delete(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(delRes.status).toBe(200);

    // Verify gone from DB
    const dbGoal = await goalRepository.findById(goalId, userA.id);
    expect(dbGoal).toBeNull();
  });

  it('ensures server-side AI context includes backend goals data for the user', async () => {
    await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        title: 'Master Quantum Algorithms',
        description: 'Deep dive into Qiskit and variational quantum eigensolvers',
        category: 'career_craft',
        timeframe: 'annual',
        targetDate: '2026-12-31T00:00:00.000Z',
        progressPercentage: 45,
      });

    const aiContext = buildServerAuthorizedAIContext(userA.id);
    expect(aiContext.goals).toBeDefined();
    expect(aiContext.goals.length).toBeGreaterThan(0);
    const quantumGoal = aiContext.goals.find((g) => g.title === 'Master Quantum Algorithms');
    expect(quantumGoal).toBeDefined();
    expect(quantumGoal?.progressPercentage).toBe(45);
  });
});

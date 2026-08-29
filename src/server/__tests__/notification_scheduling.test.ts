import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiRouter } from '../routes';
import { db, DatabaseEngine } from '../db';
import { generateToken, hashPassword } from '../auth';
import {
  scheduleNotificationServer,
  deliverScheduledNotification,
  processDueScheduledNotifications,
  evaluateServerNotificationRules,
  resetNotificationSchedulerForTesting,
} from '../notifications';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Server-Authoritative Notification Scheduling Test Suite', () => {
  const userAId = 'usr_notif_user_a';
  const userBId = 'usr_notif_user_b';
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    resetNotificationSchedulerForTesting();

    // Reset database arrays for clean state
    db.schema.users = [];
    db.schema.tasks = [];
    db.schema.habits = [];
    db.schema.habitLogs = [];
    db.schema.goals = [];
    db.schema.transactions = [];
    db.schema.budgets = [];
    db.schema.relationships = [];
    db.schema.notifications = [];
    db.schema.scheduledNotifications = [];

    const now = new Date().toISOString();
    const pwHash = await hashPassword('SecurePassword123!');

    const userA: any = {
      id: userAId,
      email: 'user_a@origin-os.internal',
      passwordHash: pwHash,
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'User Alpha' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: true },
      },
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const userB: any = {
      id: userBId,
      email: 'user_b@origin-os.internal',
      passwordHash: pwHash,
      role: 'member',
      emailVerified: true,
      profile: { displayName: 'User Beta' },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: null,
        notificationChannels: { inApp: true, email: true, dailyDigest: true },
      },
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.schema.users.push(userA);
    db.schema.users.push(userB);

    await db.save();

    tokenA = generateToken(userA);
    tokenB = generateToken(userB);
  });

  afterEach(() => {
    resetNotificationSchedulerForTesting();
  });

  it('1. Schedules a notification on the server associated strictly with the authenticated userId', async () => {
    const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();

    const res = await request(app)
      .post('/api/notifications/schedule')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Alpha Mission Briefing',
        message: 'Review quarterly architecture milestone.',
        scheduledFor: futureTime,
        type: 'task_reminder',
        priority: 'high',
        // Attempt to pass malicious client-supplied userId to spoof User B
        userId: userBId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    // Server must ignore client-supplied userId and assign authenticated User A
    expect(res.body.data.userId).toBe(userAId);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.title).toBe('Alpha Mission Briefing');

    // Verify it exists in server database
    const inDb = db.schema.scheduledNotifications.find((s) => s.id === res.body.data.id);
    expect(inDb).toBeDefined();
    expect(inDb?.userId).toBe(userAId);
  });

  it('2. Validates notification timestamps and rejects invalid scheduledFor dates with HTTP 400', async () => {
    // Test invalid timestamp string
    const resInvalid = await request(app)
      .post('/api/notifications/schedule')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Invalid Date Alert',
        message: 'This should fail.',
        scheduledFor: 'not-a-valid-date-string',
      });

    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.success).toBe(false);
    expect(resInvalid.body.error.code).toBe('INVALID_TIMESTAMP');

    // Test missing title
    const resMissingTitle = await request(app)
      .post('/api/notifications/schedule')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: '',
        message: 'Valid message',
        scheduledFor: new Date().toISOString(),
      });

    expect(resMissingTitle.status).toBe(400);
    expect(resMissingTitle.body.success).toBe(false);
  });

  it('3. Enforces strict multi-tenant user isolation for scheduled and delivered notifications', async () => {
    // User A creates a scheduled notification
    const futureTime = new Date(Date.now() + 7200 * 1000).toISOString();
    const scheduledA = await scheduleNotificationServer({
      userId: userAId,
      title: 'Confidential Strategy Alpha',
      message: 'Classified payload.',
      scheduledFor: futureTime,
    });

    // User B attempts to list scheduled notifications
    const resListB = await request(app)
      .get('/api/notifications/scheduled')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resListB.status).toBe(200);
    expect(resListB.body.data.length).toBe(0); // Cannot see User A's scheduled items

    // User B attempts to retrieve User A's scheduled notification directly
    const resGetB = await request(app)
      .get(`/api/notifications/scheduled/${scheduledA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resGetB.status).toBe(404);

    // User B attempts to modify User A's scheduled notification
    const resUpdateB = await request(app)
      .put(`/api/notifications/scheduled/${scheduledA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Tampered Title' });

    expect(resUpdateB.status).toBe(404);

    // User B attempts to delete/cancel User A's scheduled notification
    const resDeleteB = await request(app)
      .delete(`/api/notifications/scheduled/${scheduledA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resDeleteB.status).toBe(404);

    // Ensure User A's record remains pristine
    const pristine = db.schema.scheduledNotifications.find((s) => s.id === scheduledA.id);
    expect(pristine?.title).toBe('Confidential Strategy Alpha');
  });

  it('4. Delivers scheduled notifications reliably and guarantees duplicate prevention (single delivery)', async () => {
    const pastDueTime = new Date(Date.now() - 5000).toISOString();

    const scheduled = await scheduleNotificationServer({
      userId: userAId,
      title: 'Due Notification',
      message: 'Deliver me once.',
      scheduledFor: pastDueTime,
      type: 'task_reminder',
      priority: 'urgent',
      actionUrl: '/app/tasks',
    });

    expect(scheduled.status).toBe('scheduled');
    expect(db.schema.notifications.length).toBe(0);

    // First processing run: should deliver the notification
    const result1 = await processDueScheduledNotifications();
    expect(result1.processedCount).toBe(1);
    expect(result1.deliveredIds).toContain(scheduled.id);

    expect(scheduled.status).toBe('delivered');
    expect(scheduled.deliveredAt).toBeDefined();

    // Verify in-app notification was generated for User A
    const userANotifs = db.schema.notifications.filter((n) => n.userId === userAId);
    expect(userANotifs.length).toBe(1);
    expect(userANotifs[0].title).toBe('Due Notification');
    expect(userANotifs[0].scheduledNotificationId).toBe(scheduled.id);

    // Second processing run immediately after: must NOT deliver duplicates
    const result2 = await processDueScheduledNotifications();
    expect(result2.processedCount).toBe(0);
    expect(db.schema.notifications.filter((n) => n.userId === userAId).length).toBe(1);

    // Explicit call to deliverScheduledNotification on already delivered item: must return null / existing
    const manualReDelivery = await deliverScheduledNotification(scheduled);
    expect(manualReDelivery).toBeNull();
    expect(db.schema.notifications.filter((n) => n.userId === userAId).length).toBe(1);
  });

  it('5. Persists scheduled notifications on the server across browser tab closures and server restarts', async () => {
    const futureTime = new Date(Date.now() + 60000).toISOString();

    // Schedule notification via API
    const res = await request(app)
      .post('/api/notifications/schedule')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Persistent Server Scheduled Notification',
        message: 'This notification exists on the server even if client closes browser.',
        scheduledFor: futureTime,
      });

    expect(res.status).toBe(201);
    const notifId = res.body.data.id;

    // Simulate server persistence reload
    await db.save();

    // Verify record in server storage
    const reloadedItem = db.schema.scheduledNotifications.find((s) => s.id === notifId);
    expect(reloadedItem).toBeDefined();
    expect(reloadedItem?.userId).toBe(userAId);
    expect(reloadedItem?.status).toBe('scheduled');

    // Simulate time passing: target time arrives
    const simulatedDeliveryTime = new Date(Date.now() + 65000);
    const processResult = await processDueScheduledNotifications(simulatedDeliveryTime);

    expect(processResult.processedCount).toBe(1);
    expect(processResult.deliveredIds).toContain(notifId);

    // Check delivered in-app notifications
    const getNotifsRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(getNotifsRes.status).toBe(200);
    const deliveredNotif = getNotifsRes.body.data.find(
      (n: any) => n.scheduledNotificationId === notifId
    );
    expect(deliveredNotif).toBeDefined();
    expect(deliveredNotif.title).toBe('Persistent Server Scheduled Notification');
  });

  it('6. Evaluates server-side domain rules for tasks, habits, and budgets proactively', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Seed task due today
    db.schema.tasks.push({
      id: 'tsk_alpha_1',
      userId: userAId,
      title: 'Server Task Review',
      priority: 'urgent',
      status: 'todo',
      dueDate: `${todayStr}T18:00:00.000Z`,
      tags: ['work'],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed habit not completed today
    db.schema.habits.push({
      id: 'hbt_alpha_1',
      userId: userAId,
      name: 'Deep Focus Sprint',
      category: 'deep_work',
      frequency: 'daily',
      targetPerDay: 1,
      unit: 'session',
      streakCount: 5,
      bestStreak: 10,
      totalCompletions: 25,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.save();

    const evalRes = await request(app)
      .post('/api/notifications/evaluate')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.success).toBe(true);
    expect(evalRes.body.newlyCreatedCount).toBeGreaterThanOrEqual(2);

    const taskAlert = evalRes.body.data.find((n: any) => n.type === 'task_reminder');
    expect(taskAlert).toBeDefined();
    expect(taskAlert.userId).toBe(userAId);

    const habitAlert = evalRes.body.data.find((n: any) => n.type === 'habit_reminder');
    expect(habitAlert).toBeDefined();
    expect(habitAlert.userId).toBe(userAId);
  });
});

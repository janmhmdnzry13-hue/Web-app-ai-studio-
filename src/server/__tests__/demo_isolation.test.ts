import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { apiRouter } from '../routes';
import { db } from '../db';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Demo Account Isolation and Security Suite', () => {
  beforeEach(() => {
    // Clear out user and domain records for pristine test isolation
    db.schema.users = [];
    db.schema.tasks = [];
    db.schema.habits = [];
    db.schema.goals = [];
    db.schema.transactions = [];
    db.schema.budgets = [];
    db.schema.relationships = [];
    db.schema.notes = [];
    db.schema.reflections = [];
  });

  // TEST 1: Visitor A receives a demo identity different from Visitor B
  it('1. Visitor A receives a demo identity different from Visitor B', async () => {
    const resA = await request(app).post('/api/auth/demo').send();
    expect(resA.status).toBe(200);
    const userA = resA.body.data.user;
    const tokenA = resA.body.data.token;

    const resB = await request(app).post('/api/auth/demo').send();
    expect(resB.status).toBe(200);
    const userB = resB.body.data.user;
    const tokenB = resB.body.data.token;

    expect(userA.id).toBeDefined();
    expect(userB.id).toBeDefined();
    expect(userA.id).not.toBe(userB.id);
    expect(tokenA).not.toBe(tokenB);
    expect(userA.email).not.toBe(userB.email);
  });

  // TEST 2: Visitor A cannot access Visitor B's demo data
  it("2. Visitor A cannot access Visitor B's demo data", async () => {
    const resA = await request(app).post('/api/auth/demo').send();
    const tokenA = resA.body.data.token;

    const resB = await request(app).post('/api/auth/demo').send();
    const userB = resB.body.data.user;
    const tokenB = resB.body.data.token;

    // Create a private task under Visitor B
    const createResB = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        title: "Visitor B's Confidential Architecture Blueprint",
        priority: 'urgent',
        tags: ['private_b'],
      });
    expect(createResB.status).toBe(200);
    const taskB = createResB.body.data;

    // Visitor A tries to read Visitor B's task list
    const listResA = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listResA.status).toBe(200);
    const tasksSeenByA = listResA.body.data;
    const hasBTask = tasksSeenByA.some((t: any) => t.id === taskB.id || t.title.includes("Visitor B"));
    expect(hasBTask).toBe(false);

    // Visitor A tries to fetch Visitor B's task directly by ID (if endpoint exists/filtering)
    const allTasksInDb = db.schema.tasks.filter((t) => t.id === taskB.id);
    expect(allTasksInDb.length).toBe(1);
    expect(allTasksInDb[0].userId).toBe(userB.id);
  });

  // TEST 3: Visitor A cannot modify Visitor B's demo data
  it("3. Visitor A cannot modify Visitor B's demo data", async () => {
    const resA = await request(app).post('/api/auth/demo').send();
    const tokenA = resA.body.data.token;

    const resB = await request(app).post('/api/auth/demo').send();
    const tokenB = resB.body.data.token;

    // Create a habit under Visitor B
    const createHabitResB = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: "Visitor B's Private Habit",
        frequency: 'daily',
        category: 'deep_work',
      });
    expect(createHabitResB.status).toBe(200);
    const habitB = createHabitResB.body.data;

    // Visitor A attempts to update Visitor B's habit
    const updateResA = await request(app)
      .put(`/api/habits/${habitB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Hacked by Visitor A',
      });
    // Should be 404 or 403 (unauthorized/not found for this tenant)
    expect([403, 404]).toContain(updateResA.status);

    // Confirm Visitor B's habit remains untouched
    const habitRecord = db.schema.habits.find((h) => h.id === habitB.id);
    expect(habitRecord?.name).toBe("Visitor B's Private Habit");

    // Visitor A attempts to delete Visitor B's habit
    const deleteResA = await request(app)
      .delete(`/api/habits/${habitB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([403, 404]).toContain(deleteResA.status);

    // Confirm Visitor B's habit still exists
    const habitStillExists = db.schema.habits.some((h) => h.id === habitB.id);
    expect(habitStillExists).toBe(true);
  });

  // TEST 4: Demo data is correctly initialized for a new isolated demo user
  it('4. Demo data is correctly initialized for a new isolated demo user', async () => {
    const res = await request(app).post('/api/auth/demo').send();
    expect(res.status).toBe(200);
    const user = res.body.data.user;
    const token = res.body.data.token;

    // Verify starter tasks for this specific demo user
    const tasks = db.schema.tasks.filter((t) => t.userId === user.id);
    expect(tasks.length).toBeGreaterThanOrEqual(2);

    // Verify starter habits for this specific demo user
    const habits = db.schema.habits.filter((h) => h.userId === user.id);
    expect(habits.length).toBeGreaterThanOrEqual(2);

    // Verify starter goals
    const goals = db.schema.goals.filter((g) => g.userId === user.id);
    expect(goals.length).toBeGreaterThanOrEqual(1);

    // Verify starter transactions and budgets
    const transactions = db.schema.transactions.filter((tx) => tx.userId === user.id);
    expect(transactions.length).toBeGreaterThanOrEqual(1);

    const budgets = db.schema.budgets.filter((b) => b.userId === user.id);
    expect(budgets.length).toBeGreaterThanOrEqual(1);

    // Verify starter relationships and notes
    const relationships = db.schema.relationships.filter((r) => r.userId === user.id);
    expect(relationships.length).toBeGreaterThanOrEqual(1);

    const notes = db.schema.notes.filter((n) => n.userId === user.id);
    expect(notes.length).toBeGreaterThanOrEqual(1);

    // Verify that retrieving via authenticated endpoint returns the seeded data
    const apiTasks = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(apiTasks.status).toBe(200);
    expect(apiTasks.body.data.length).toBe(tasks.length);
  });

  // TEST 5: Demo authentication cannot be used to impersonate another demo user
  it('5. Demo authentication cannot be used to impersonate another demo user', async () => {
    const resA = await request(app).post('/api/auth/demo').send();
    const userA = resA.body.data.user;

    const resB = await request(app).post('/api/auth/demo').send();
    const userB = resB.body.data.user;
    const tokenB = resB.body.data.token;

    // Visitor B sends request trying to claim userId of Visitor A in body
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        userId: userA.id, // Attempt spoofing
        title: 'Spoofed Task for User A',
      });
    expect(createRes.status).toBe(200);

    // The created task MUST be attached to authenticated User B, never spoofed User A
    const createdTask = createRes.body.data;
    expect(createdTask.userId).toBe(userB.id);
    expect(createdTask.userId).not.toBe(userA.id);

    // User A should not see this task
    const userATasks = db.schema.tasks.filter((t) => t.userId === userA.id && t.title === 'Spoofed Task for User A');
    expect(userATasks.length).toBe(0);
  });

  // TEST 6: Existing ownership checks continue to work
  it('6. Existing ownership checks continue to work across all resources', async () => {
    const resA = await request(app).post('/api/auth/demo').send();
    const userA = resA.body.data.user;
    const tokenA = resA.body.data.token;

    const resB = await request(app).post('/api/auth/demo').send();
    const tokenB = resB.body.data.token;

    // User A can update their own task
    const taskA = db.schema.tasks.find((t) => t.userId === userA.id);
    expect(taskA).toBeDefined();

    const updateOwnRes = await request(app)
      .put(`/api/tasks/${taskA!.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated Roadmap by User A' });
    expect(updateOwnRes.status).toBe(200);
    expect(updateOwnRes.body.data.title).toBe('Updated Roadmap by User A');

    // User B CANNOT update User A's task
    const updateOtherRes = await request(app)
      .put(`/api/tasks/${taskA!.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Malicious Update by User B' });
    expect([403, 404]).toContain(updateOtherRes.status);
    expect(db.schema.tasks.find((t) => t.id === taskA!.id)?.title).toBe('Updated Roadmap by User A');
  });
});

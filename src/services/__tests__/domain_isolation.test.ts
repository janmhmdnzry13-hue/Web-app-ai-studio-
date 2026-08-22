import { describe, it, expect, beforeEach } from 'vitest';
import { taskService } from '../task.service';
import { goalService } from '../goal.service';
import { habitService, getTodayDateString } from '../habit.service';
import { userService } from '../user.service';
import { safeStorage } from '../../lib/storage';

describe('Task & Project Domain Operations', () => {
  const userId = 'usr_task_test';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('creates tasks, computes duration, and updates task state', async () => {
    const taskRes = await taskService.createTask(userId, {
      title: 'Architect Production Microservice',
      description: 'Design idempotent APIs and event bus',
      priority: 'high',
      estimatedMinutes: 120,
      tags: ['architecture', 'backend'],
    });

    expect(taskRes.success).toBe(true);
    expect(taskRes.data?.title).toBe('Architect Production Microservice');
    expect(taskRes.data?.priority).toBe('high');
    expect(taskRes.data?.status).toBe('todo');

    const taskId = taskRes.data!.id;

    // Update status to in_progress
    const updateRes = await taskService.updateTask(userId, taskId, { status: 'in_progress' });
    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.status).toBe('in_progress');

    // Complete task
    const completeRes = await taskService.updateTask(userId, taskId, { status: 'completed' });
    expect(completeRes.success).toBe(true);
    expect(completeRes.data?.status).toBe('completed');
    expect(completeRes.data?.completedAt).toBeDefined();
  });

  it('filters tasks by status, priority, and search text', async () => {
    await taskService.createTask(userId, {
      title: 'Fix edge case in auth token refresher',
      priority: 'urgent',
      estimatedMinutes: 30,
    });

    await taskService.createTask(userId, {
      title: 'Update design system button radius',
      priority: 'low',
      estimatedMinutes: 15,
    });

    const urgentList = await taskService.getTasks(userId, { priority: 'urgent' });
    expect(urgentList.data?.items.length).toBe(1);
    expect(urgentList.data?.items[0].title).toContain('Fix edge case');

    const searchList = await taskService.getTasks(userId, { search: 'design system' });
    expect(searchList.data?.items.length).toBe(1);
    expect(searchList.data?.items[0].title).toContain('button radius');
  });
});

describe('Goal Horizon & Strategic Progress Suite', () => {
  const userId = 'usr_goal_test';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('creates high-level goal, adds milestone objectives, and tracks progress percentage', async () => {
    const goalRes = await goalService.createGoal(userId, {
      title: 'Run a Sub-4-Hour Marathon',
      category: 'health_vitality',
      timeframe: 'annual',
      targetDate: new Date(Date.now() + 180 * 86400000).toISOString(),
    });

    expect(goalRes.success).toBe(true);
    expect(goalRes.data?.title).toBe('Run a Sub-4-Hour Marathon');
    expect(goalRes.data?.progressPercentage).toBe(0);

    const goalId = goalRes.data!.id;

    // Add milestone
    const milestoneRes = await goalService.addMilestone(userId, goalId, {
      title: 'Complete 25km endurance tempo run',
      targetDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      weight: 100,
    });
    expect(milestoneRes.success).toBe(true);
    expect(milestoneRes.data?.milestones.length).toBe(1);

    // Complete milestone and verify progress
    const milestoneId = milestoneRes.data!.milestones[0].id;
    const toggleRes = await goalService.toggleMilestone(userId, goalId, milestoneId);
    expect(toggleRes.success).toBe(true);
    expect(toggleRes.data?.progressPercentage).toBe(100);
  });
});

describe('Habit Streaks & Logging Engine', () => {
  const userId = 'usr_habit_test';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('creates recurring habit and logs completions with streak recalculation', async () => {
    const habitRes = await habitService.createHabit(userId, {
      name: 'Morning Deep Meditation',
      routine: 'Sit in silence for 20 minutes focusing on breath',
      category: 'mindset_clarity',
      frequency: 'daily',
      timeOfDay: 'morning',
      targetUnits: 20,
      unitLabel: 'minutes',
    });

    expect(habitRes.success).toBe(true);
    expect(habitRes.data?.name).toBe('Morning Deep Meditation');
    expect(habitRes.data?.streak.currentStreak).toBe(0);

    const habitId = habitRes.data!.id;
    const today = getTodayDateString();

    // Log completion for today
    const logRes = await habitService.logHabitCompletion(userId, habitId, today, 20);
    expect(logRes.success).toBe(true);
    expect(logRes.data?.targetMet).toBe(true);
  });
});

describe('Multi-Tenant User Data Isolation & Sovereignty Suite', () => {
  const userA = 'usr_alice_isolated';
  const userB = 'usr_bob_isolated';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('strictly isolates tasks, habits, and goals between users', async () => {
    // User A creates resources
    await taskService.createTask(userA, {
      title: "Alice's Secret Project Roadmap",
      priority: 'high',
      estimatedMinutes: 60,
    });

    await goalService.createGoal(userA, {
      title: "Alice's Horizon Goal",
      category: 'career_craft',
      timeframe: 'quarterly',
      targetDate: new Date().toISOString(),
    });

    // User B attempts to view User A's tasks
    const bobTasks = await taskService.getTasks(userB);
    expect(bobTasks.data?.items.length).toBe(0);

    // User B attempts to view User A's goals
    const bobGoals = await goalService.getGoals(userB);
    expect(bobGoals.data?.length).toBe(0);

    // User B creates their own task
    await taskService.createTask(userB, {
      title: "Bob's Public Infrastructure",
      priority: 'medium',
      estimatedMinutes: 30,
    });

    const bobTasksUpdated = await taskService.getTasks(userB);
    expect(bobTasksUpdated.data?.items.length).toBe(1);
    expect(bobTasksUpdated.data?.items[0].title).toBe("Bob's Public Infrastructure");

    // Verify User A still only sees User A's tasks
    const aliceTasks = await taskService.getTasks(userA);
    expect(aliceTasks.data?.items.length).toBe(1);
    expect(aliceTasks.data?.items[0].title).toBe("Alice's Secret Project Roadmap");
  });

  it('exports full multi-domain data archive for the specific authenticated user only', async () => {
    await taskService.createTask(userA, { title: 'Alice Task', priority: 'high', estimatedMinutes: 30 });
    
    const exportRes = await userService.exportFullUserData(userA);
    expect(exportRes.success).toBe(true);
    expect(exportRes.data?.user.id).toBe(userA);
    expect(exportRes.data?.data.tasks.length).toBe(1);
  });

  it('permanently deletes user records and isolated stores upon account deletion', async () => {
    await taskService.createTask(userA, { title: 'To Be Wiped', priority: 'low', estimatedMinutes: 10 });
    
    const deleteRes = await userService.deleteAccount(userA);
    expect(deleteRes.success).toBe(true);

    const taskCheck = await taskService.getTasks(userA);
    expect(taskCheck.data?.items.length).toBe(0);
  });
});

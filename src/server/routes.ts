import express, { Request, Response } from 'express';
import { db, TaskRecord, HabitRecord, HabitLogRecord, GoalRecord, TransactionRecord, BudgetRecord, ReflectionRecord, RelationshipRecord, ContactInteractionRecord, NoteRecord, AIMemoryRecord, UserRecord } from './db';
import { requireAuth, AuthenticatedRequest, hashPassword, verifyPassword, generateToken, generateCryptoToken, toPublicUser } from './auth';
import { logAuditEvent } from './audit';
import { checkUserEntitlements, createStripeCheckoutSession, PLAN_TIERS } from './billing';
import { emailService } from './email';
import { checkRateLimit, resetRateLimitsForTesting, cleanupExpiredRateLimits, getRateLimitEntryCount, getClientIp, rateLimiter } from './rate-limiter';

export { checkRateLimit, resetRateLimitsForTesting, cleanupExpiredRateLimits, getRateLimitEntryCount, getClientIp, rateLimiter };

export const apiRouter = express.Router();

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

apiRouter.post('/auth/signup', async (req: Request, res: Response) => {
  try {
    // Enforce rate limiting on signup (max 10 attempts per 10 minutes per IP)
    const ip = getClientIp(req);
    if (!checkRateLimit(`signup_${ip}`, 10, 10 * 60 * 1000)) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many account creation attempts. Please wait a few minutes before trying again.' },
      });
      return;
    }

    const { email, password, displayName } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    const cleanName = displayName?.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'Valid email address is required.' } });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters.' } });
      return;
    }
    if (!cleanName) {
      res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: 'Display name is required.' } });
      return;
    }

    const existing = db.schema.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      res.status(409).json({ success: false, error: { code: 'AUTH_EMAIL_EXISTS', message: 'An account with this email already exists.' } });
      return;
    }

    const userId = generateCryptoToken('usr');
    const passwordHash = hashPassword(password);
    const verificationToken = generateCryptoToken('vtok');

    const newUser: UserRecord = {
      id: userId,
      email: cleanEmail,
      passwordHash,
      role: 'member',
      emailVerified: true, // Auto-verify in development/preview with token tracked
      verificationToken,
      profile: {
        displayName: cleanName,
        headline: 'Member',
        bio: '',
        primaryLifeFocus: 'Deep Work & Daily Focus',
      },
      preferences: {
        theme: 'system',
        timezone: 'UTC',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: '21:00',
        notificationChannels: {
          inApp: true,
          email: false,
          dailyDigest: true,
        },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals'],
      },
      subscription: {
        tier: 'free',
        status: 'active',
      },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.users.push(newUser);
    await db.save();

    await logAuditEvent(userId, 'USER_SIGNUP', 'auth', { email: cleanEmail });

    const token = generateToken(newUser);
    res.json({
      success: true,
      data: {
        user: toPublicUser(newUser),
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create account.' } });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail || !password) {
      res.status(400).json({ success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Email and password are required.' } });
      return;
    }

    // Rate limit login attempts (max 15 per minute per IP)
    const ip = getClientIp(req);
    if (!checkRateLimit(`login_${ip}`, 15, 60000)) {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait a minute.' } });
      return;
    }

    const user = db.schema.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      res.status(401).json({ success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
      return;
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
      return;
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await db.save();

    await logAuditEvent(user.id, 'USER_LOGIN', 'auth');

    const token = generateToken(user);
    res.json({
      success: true,
      data: {
        user: toPublicUser(user),
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to sign in.' } });
  }
});

apiRouter.get('/auth/session', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      user: toPublicUser(req.user!),
      token: req.headers.authorization?.substring(7),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

apiRouter.post('/auth/demo', async (req: Request, res: Response) => {
  try {
    // Generate an isolated demo guest session so different visitors don't leak or mutate shared user data
    const guestId = `usr_demo_${generateCryptoToken('gst')}`;
    const demoUser: UserRecord = {
      id: guestId,
      email: `guest.${guestId.slice(-8)}@origin-os.internal`,
      passwordHash: hashPassword(generateCryptoToken('pw')),
      role: 'member',
      emailVerified: true,
      profile: {
        displayName: 'Alex Vance',
        headline: 'Lead Architect (Demo)',
        bio: 'Designing deliberate personal operating systems in an isolated session.',
        primaryLifeFocus: 'Deep Work & Daily Focus',
      },
      preferences: {
        theme: 'system',
        timezone: 'America/New_York',
        locale: 'en-US',
        weekStartDay: 1,
        reducedMotion: false,
        compactDensity: false,
        dailyReflectionReminderTime: '21:30',
        notificationChannels: { inApp: true, email: false, dailyDigest: true },
        unlockedModules: ['tasks', 'habits', 'finances', 'goals', 'notes', 'emotions', 'relationships'],
      },
      subscription: { tier: 'pro', status: 'active' },
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.users.push(demoUser);
    // Seed isolated demo dataset for this guest
    db.seedUserStarterData(guestId);
    await db.save();

    await logAuditEvent(demoUser.id, 'DEMO_SESSION_STARTED', 'auth');

    const token = generateToken(demoUser);
    res.json({
      success: true,
      data: {
        user: toPublicUser(demoUser),
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Demo auth error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create demo session.' } });
  }
});

apiRouter.post('/auth/password-reset-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail) {
      res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'Email is required.' } });
      return;
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(`reset_${ip}`, 10, 60000)) {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Please wait a minute.' } });
      return;
    }

    const user = db.schema.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (user) {
      const resetToken = generateCryptoToken('rst');
      db.schema.passwordResetTokens.push({
        token: resetToken,
        email: cleanEmail,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        used: false,
        createdAt: new Date().toISOString(),
      });
      await db.save();
      await logAuditEvent(user.id, 'PASSWORD_RESET_REQUESTED', 'auth', { email: cleanEmail });

      // Dispatch reset email through configured email delivery abstraction
      const originHeader = (req.headers.origin || req.headers.host) as string | undefined;
      await emailService.sendPasswordResetEmail(cleanEmail, resetToken, originHeader).catch((mailErr) => {
        console.error('[Auth] Failed to dispatch password reset email:', mailErr?.message || mailErr);
      });
    }

    // Security: Never return resetToken in API response! Always return a generic success message to prevent user enumeration
    res.json({
      success: true,
      data: {
        success: true,
        message: 'If an account exists with this email address, password reset instructions have been issued.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Reset request failed.' } });
  }
});

apiRouter.post('/auth/password-reset-confirm', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Valid token and new password (min 6 chars) required.' } });
      return;
    }

    const record = db.schema.passwordResetTokens.find((r) => r.token === token && !r.used);
    if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Reset token has expired or is invalid.' } });
      return;
    }

    const user = db.schema.users.find((u) => u.email.toLowerCase() === record.email.toLowerCase());
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Account not found.' } });
      return;
    }

    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    record.used = true;
    await db.save();

    await logAuditEvent(user.id, 'PASSWORD_RESET_COMPLETED', 'auth');

    res.json({ success: true, data: { success: true, message: 'Password has been successfully updated. You can now sign in.' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Password reset confirmation failed.' } });
  }
});

apiRouter.post('/auth/export-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await logAuditEvent(userId, 'DATA_EXPORTED', 'user_data');

    const exportPayload = {
      user: toPublicUser(req.user!),
      tasks: db.schema.tasks.filter((t) => t.userId === userId),
      habits: db.schema.habits.filter((h) => h.userId === userId),
      habitLogs: db.schema.habitLogs.filter((hl) => hl.userId === userId),
      goals: db.schema.goals.filter((g) => g.userId === userId),
      transactions: db.schema.transactions.filter((tx) => tx.userId === userId),
      budgets: db.schema.budgets.filter((b) => b.userId === userId),
      reflections: db.schema.reflections.filter((r) => r.userId === userId),
      relationships: db.schema.relationships.filter((rel) => rel.userId === userId),
      interactions: db.schema.interactions.filter((i) => i.userId === userId),
      notes: db.schema.notes.filter((n) => n.userId === userId),
      exportedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: exportPayload });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to export data.' } });
  }
});

apiRouter.delete('/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await logAuditEvent(userId, 'ACCOUNT_DELETED', 'user_account');

    // Purge all user rows across all tables
    db.schema.users = db.schema.users.filter((u) => u.id !== userId);
    db.schema.tasks = db.schema.tasks.filter((t) => t.userId !== userId);
    db.schema.habits = db.schema.habits.filter((h) => h.userId !== userId);
    db.schema.habitLogs = db.schema.habitLogs.filter((hl) => hl.userId !== userId);
    db.schema.goals = db.schema.goals.filter((g) => g.userId !== userId);
    db.schema.transactions = db.schema.transactions.filter((tx) => tx.userId !== userId);
    db.schema.budgets = db.schema.budgets.filter((b) => b.userId !== userId);
    db.schema.reflections = db.schema.reflections.filter((r) => r.userId !== userId);
    db.schema.relationships = db.schema.relationships.filter((rel) => rel.userId !== userId);
    db.schema.interactions = db.schema.interactions.filter((i) => i.userId !== userId);
    db.schema.notes = db.schema.notes.filter((n) => n.userId !== userId);
    db.schema.aiMemories = db.schema.aiMemories.filter((m) => m.userId !== userId);

    await db.save();
    res.json({ success: true, data: { success: true, message: 'Account and associated records successfully deleted.' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete account.' } });
  }
});

// -------------------------------------------------------------
// TASKS ROUTES
// -------------------------------------------------------------

apiRouter.get('/tasks', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const tasks = db.schema.tasks.filter((t) => t.userId === req.userId);
  res.json({ success: true, data: tasks });
});

apiRouter.post('/tasks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const entitlements = checkUserEntitlements(req.user!);
    if (!entitlements.canCreateTask) {
      res.status(403).json({
        success: false,
        error: { code: 'PLAN_LIMIT_REACHED', message: `Free plan limit reached (${entitlements.plan.limits.maxTasks} tasks). Upgrade to Pro for unlimited tasks.` },
      });
      return;
    }

    const { title, description, priority, dueDate, scheduledTime, estimatedMinutes, tags, goalId, subtasks } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TITLE', message: 'Task title is required.' } });
      return;
    }

    const newTask: TaskRecord = {
      id: generateCryptoToken('tsk'),
      userId,
      title: title.trim(),
      description: description?.trim() || '',
      priority: priority || 'medium',
      status: 'todo',
      dueDate: dueDate || null,
      scheduledTime: scheduledTime || null,
      estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      actualMinutes: null,
      tags: Array.isArray(tags) ? tags : [],
      goalId: goalId || null,
      subtasks: Array.isArray(subtasks) ? subtasks : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.tasks.unshift(newTask);
    await db.save();

    res.json({ success: true, data: newTask });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create task.' } });
  }
});

apiRouter.put('/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = db.schema.tasks.find((t) => t.id === id && t.userId === req.userId);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
      return;
    }

    const updates = req.body;
    Object.assign(task, {
      ...updates,
      userId: req.userId, // Prevent tampering with ownership
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update task.' } });
  }
});

apiRouter.patch('/tasks/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const task = db.schema.tasks.find((t) => t.id === id && t.userId === req.userId);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
      return;
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    await db.save();

    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update task status.' } });
  }
});

apiRouter.delete('/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const initialLen = db.schema.tasks.length;
    db.schema.tasks = db.schema.tasks.filter((t) => !(t.id === id && t.userId === req.userId));

    if (db.schema.tasks.length === initialLen) {
      res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
      return;
    }

    await db.save();
    res.json({ success: true, data: { success: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete task.' } });
  }
});

// -------------------------------------------------------------
// HABITS ROUTES
// -------------------------------------------------------------

apiRouter.get('/habits', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const habits = db.schema.habits.filter((h) => h.userId === req.userId);
  res.json({ success: true, data: habits });
});

apiRouter.post('/habits', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const entitlements = checkUserEntitlements(req.user!);
    if (!entitlements.canCreateHabit) {
      res.status(403).json({
        success: false,
        error: { code: 'PLAN_LIMIT_REACHED', message: `Free tier allows up to ${entitlements.plan.limits.maxActiveHabits} habits. Upgrade to Pro for unlimited habits.` },
      });
      return;
    }

    const { name, description, category, frequency, targetDays, targetPerDay, reminderTime } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: 'Habit name is required.' } });
      return;
    }

    const newHabit: HabitRecord = {
      id: generateCryptoToken('hbt'),
      userId,
      name: name.trim(),
      description: description?.trim() || '',
      category: category || 'deep_work',
      frequency: frequency || 'daily',
      targetDays: targetDays || [],
      targetPerDay: targetPerDay ? Number(targetPerDay) : 1,
      reminderTime: reminderTime || null,
      streakCount: 0,
      bestStreak: 0,
      totalCompletions: 0,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.habits.unshift(newHabit);
    await db.save();

    res.json({ success: true, data: newHabit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create habit.' } });
  }
});

apiRouter.post('/habits/log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { habitId, date, completed, value, notes } = req.body;

    const habit = db.schema.habits.find((h) => h.id === habitId && h.userId === userId);
    if (!habit) {
      res.status(404).json({ success: false, error: { code: 'HABIT_NOT_FOUND', message: 'Habit not found.' } });
      return;
    }

    const logDate = date || new Date().toISOString().slice(0, 10);
    let existingLog = db.schema.habitLogs.find((l) => l.habitId === habitId && l.date === logDate && l.userId === userId);

    if (existingLog) {
      existingLog.completed = completed;
      existingLog.value = value ?? (completed ? 1 : 0);
      existingLog.notes = notes;
    } else {
      existingLog = {
        id: generateCryptoToken('hlg'),
        userId,
        habitId,
        date: logDate,
        completed: Boolean(completed),
        value: value ?? 1,
        notes,
        createdAt: new Date().toISOString(),
      };
      db.schema.habitLogs.push(existingLog);
    }

    // Recalculate streak
    const userLogs = db.schema.habitLogs.filter((l) => l.habitId === habitId && l.userId === userId && l.completed);
    habit.totalCompletions = userLogs.length;
    habit.streakCount = Math.min(userLogs.length, habit.streakCount + (completed ? 1 : 0));
    habit.bestStreak = Math.max(habit.bestStreak, habit.streakCount);
    habit.updatedAt = new Date().toISOString();

    await db.save();
    res.json({ success: true, data: { log: existingLog, habit } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to log habit.' } });
  }
});

apiRouter.get('/habits/logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { habitId, startDate, endDate } = req.query;
  let logs = db.schema.habitLogs.filter((l) => l.userId === req.userId);

  if (habitId) {
    logs = logs.filter((l) => l.habitId === habitId);
  }
  if (startDate) {
    logs = logs.filter((l) => l.date >= String(startDate));
  }
  if (endDate) {
    logs = logs.filter((l) => l.date <= String(endDate));
  }

  res.json({ success: true, data: logs });
});

// -------------------------------------------------------------
// GOALS ROUTES
// -------------------------------------------------------------

apiRouter.get('/goals', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const goals = db.schema.goals.filter((g) => g.userId === req.userId);
  res.json({ success: true, data: goals });
});

apiRouter.post('/goals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const entitlements = checkUserEntitlements(req.user!);
    if (!entitlements.canCreateGoal) {
      res.status(403).json({
        success: false,
        error: { code: 'PLAN_LIMIT_REACHED', message: `Free plan allows up to ${entitlements.plan.limits.maxActiveGoals} active goal. Upgrade to Pro for unlimited goals.` },
      });
      return;
    }

    const { title, description, category, horizon, targetDate, milestones } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TITLE', message: 'Goal title is required.' } });
      return;
    }

    const newGoal: GoalRecord = {
      id: generateCryptoToken('gol'),
      userId,
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'personal',
      horizon: horizon || 'quarterly',
      targetDate: targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      progressPercentage: 0,
      status: 'active',
      milestones: Array.isArray(milestones) ? milestones : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.goals.unshift(newGoal);
    await db.save();

    res.json({ success: true, data: newGoal });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create goal.' } });
  }
});

// -------------------------------------------------------------
// FINANCES ROUTES
// -------------------------------------------------------------

apiRouter.get('/finances/transactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const txs = db.schema.transactions.filter((t) => t.userId === req.userId);
  res.json({ success: true, data: txs });
});

apiRouter.post('/finances/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { title, amount, type, category, date, paymentMethod, isRecurring, notes } = req.body;

    if (!title?.trim() || amount == null || isNaN(Number(amount))) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Title and valid numerical amount are required.' } });
      return;
    }

    const parsedAmount = Math.abs(Number(amount));
    const minorUnits = Math.round(parsedAmount * 100);

    const newTx: TransactionRecord = {
      id: generateCryptoToken('tx'),
      userId,
      title: title.trim(),
      amount: parsedAmount,
      minorUnits,
      type: type === 'income' ? 'income' : 'expense',
      category: category || 'General',
      date: date || new Date().toISOString().slice(0, 10),
      paymentMethod,
      isRecurring: Boolean(isRecurring),
      notes: notes?.trim() ? db.encrypt(notes.trim()) : undefined,
      isEncrypted: Boolean(notes?.trim()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.transactions.unshift(newTx);
    await db.save();

    res.json({ success: true, data: newTx });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record transaction.' } });
  }
});

apiRouter.get('/finances/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const txs = db.schema.transactions.filter((t) => t.userId === req.userId);
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of txs) {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;
  }

  res.json({
    success: true,
    data: {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      savingsRatePercentage: totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
      transactionCount: txs.length,
    },
  });
});

// -------------------------------------------------------------
// EMOTIONS & REFLECTIONS
// -------------------------------------------------------------

apiRouter.get('/emotions/reflections', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const refs = db.schema.reflections.filter((r) => r.userId === req.userId);
  // Decrypt journal entries if encrypted
  const clean = refs.map((r) => ({
    ...r,
    journalEntry: r.isEncrypted ? db.decrypt(r.journalEntry) : r.journalEntry,
  }));
  res.json({ success: true, data: clean });
});

apiRouter.post('/emotions/reflections', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { date, energyLevel, clarityLevel, stressLevel, primaryEmotion, journalEntry, wins, gratitudes, learnings } = req.body;

    const refDate = date || new Date().toISOString().slice(0, 10);
    const existing = db.schema.reflections.find((r) => r.userId === userId && r.date === refDate);

    const encryptedJournal = journalEntry ? db.encrypt(journalEntry) : '';

    if (existing) {
      existing.energyLevel = energyLevel ?? existing.energyLevel;
      existing.clarityLevel = clarityLevel ?? existing.clarityLevel;
      existing.stressLevel = stressLevel ?? existing.stressLevel;
      existing.primaryEmotion = primaryEmotion || existing.primaryEmotion;
      existing.journalEntry = encryptedJournal;
      existing.wins = wins || existing.wins;
      existing.gratitudes = gratitudes || existing.gratitudes;
      existing.learnings = learnings || existing.learnings;
      existing.isEncrypted = true;
      existing.updatedAt = new Date().toISOString();
      await db.save();
      res.json({ success: true, data: { ...existing, journalEntry } });
      return;
    }

    const newRef: ReflectionRecord = {
      id: generateCryptoToken('ref'),
      userId,
      date: refDate,
      energyLevel: energyLevel ?? 7,
      clarityLevel: clarityLevel ?? 7,
      stressLevel: stressLevel ?? 3,
      primaryEmotion: primaryEmotion || 'Calm & Grounded',
      journalEntry: encryptedJournal,
      wins: wins || [],
      gratitudes: gratitudes || [],
      learnings: learnings || [],
      isEncrypted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.reflections.unshift(newRef);
    await db.save();

    res.json({ success: true, data: { ...newRef, journalEntry } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record reflection.' } });
  }
});

// -------------------------------------------------------------
// RELATIONSHIPS ROUTES
// -------------------------------------------------------------

apiRouter.get('/relationships', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const rels = db.schema.relationships.filter((r) => r.userId === req.userId);
  res.json({ success: true, data: rels });
});

apiRouter.post('/relationships', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, relationType, cadenceDays, lastInteractionDate, notes, anniversaries } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: 'Name is required.' } });
      return;
    }

    const newRel: RelationshipRecord = {
      id: generateCryptoToken('rel'),
      userId,
      name: name.trim(),
      relationType: relationType || 'friend',
      cadenceDays: cadenceDays ? Number(cadenceDays) : 14,
      lastInteractionDate: lastInteractionDate || null,
      nextDueReminderDate: null,
      notes: notes?.trim() || '',
      anniversaries: anniversaries || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.relationships.unshift(newRel);
    await db.save();

    res.json({ success: true, data: newRel });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to save contact.' } });
  }
});

// -------------------------------------------------------------
// NOTES ROUTES
// -------------------------------------------------------------

apiRouter.get('/notes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notes = db.schema.notes.filter((n) => n.userId === req.userId);
  res.json({ success: true, data: notes });
});

apiRouter.post('/notes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { title, content, folderId, tags, isPinned } = req.body;

    const newNote: NoteRecord = {
      id: generateCryptoToken('not'),
      userId,
      title: title?.trim() || 'Untitled Capture',
      content: content || '',
      folderId: folderId || null,
      tags: Array.isArray(tags) ? tags : [],
      isPinned: Boolean(isPinned),
      isArchived: false,
      linkedNoteIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.schema.notes.unshift(newNote);
    await db.save();

    res.json({ success: true, data: newNote });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create note.' } });
  }
});

// -------------------------------------------------------------
// USER PROFILE & PREFERENCES
// -------------------------------------------------------------

apiRouter.put('/users/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const updates = req.body;

    user.profile = {
      ...user.profile,
      ...updates,
    };
    user.updatedAt = new Date().toISOString();
    await db.save();

    res.json({ success: true, data: toPublicUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update profile.' } });
  }
});

apiRouter.put('/users/preferences', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const updates = req.body;

    user.preferences = {
      ...user.preferences,
      ...updates,
    };
    user.updatedAt = new Date().toISOString();
    await db.save();

    res.json({ success: true, data: toPublicUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update preferences.' } });
  }
});

// -------------------------------------------------------------
// BILLING & SUBSCRIPTION ROUTES
// -------------------------------------------------------------

apiRouter.get('/billing/subscription', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const entitlements = checkUserEntitlements(req.user!);
  res.json({
    success: true,
    data: {
      ...entitlements,
      subscription: req.user!.subscription,
      availablePlans: PLAN_TIERS,
    },
  });
});

apiRouter.post('/billing/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { interval } = req.body; // 'monthly' | 'annual'
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    const sessionResult = await createStripeCheckoutSession(user, interval || 'monthly', appUrl);
    res.json({ success: true, data: sessionResult });
  } catch (err: any) {
    console.error('Checkout error:', err);
    res.status(500).json({ success: false, error: { code: 'CHECKOUT_ERROR', message: 'Failed to initiate upgrade.' } });
  }
});

apiRouter.get('/audit/logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const logs = db.schema.auditLogs.filter((l) => l.userId === req.userId);
  res.json({ success: true, data: logs });
});

import express, { Request, Response } from 'express';
import {
  TaskRecord,
  HabitRecord,
  GoalRecord,
  TransactionRecord,
  RelationshipRecord,
  NoteRecord,
  UserRecord,
  NotificationRecord,
  db,
} from './db';
import {
  repositories,
  userRepository,
  taskRepository,
  habitRepository,
  habitLogRepository,
  goalRepository,
  transactionRepository,
  reflectionRepository,
  relationshipRepository,
  noteRepository,
  auditLogRepository,
  passwordResetRepository,
  notificationRepository,
  scheduledNotificationRepository,
} from './repositories';
import {
  requireAuth,
  optionalAuth,
  AuthenticatedRequest,
  hashPassword,
  verifyPassword,
  generateToken,
  generateCryptoToken,
  generatePasswordResetToken,
  hashResetToken,
  toPublicUser,
  toPublicSubscription,
} from './auth';
import { logAuditEvent } from './audit';
import {
  checkUserEntitlements,
  createStripeCheckoutSession,
  PLAN_TIERS,
  StripeConfigurationError,
  constructStripeWebhookEvent,
} from './billing';
import { emailService, sanitizeEmailError } from './email';
import {
  checkRateLimit,
  resetRateLimitsForTesting,
  cleanupExpiredRateLimits,
  getRateLimitEntryCount,
  getClientIp,
  rateLimiter,
  AI_RATE_LIMIT_CONFIG,
  SIGNUP_RATE_LIMIT_CONFIG,
} from './rate-limiter';
import {
  scheduleNotificationServer,
  processDueScheduledNotifications,
  evaluateServerNotificationRules,
} from './notifications';
import {
  validateBody,
  signupSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  createHabitSchema,
  updateHabitSchema,
  logHabitSchema,
  createGoalSchema,
  updateGoalSchema,
  createTransactionSchema,
  createReflectionSchema,
  createRelationshipSchema,
  updateRelationshipSchema,
  createNoteSchema,
  updateNoteSchema,
  updateProfileSchema,
  updatePreferencesSchema,
  billingCheckoutSchema,
  createNotificationSchema,
  scheduleNotificationSchema,
  updateScheduledNotificationSchema,
  aiChatSchema,
  aiInsightsSchema,
} from './validation';
import {
  handleAiChat,
  handleAiInsights,
  setGeminiClientForTesting,
  setMockGeminiCaller,
  setDisableLocalFallbackForTesting,
  setAITimeoutForTesting,
  AIProviderError,
  PRIMARY_GEMINI_MODEL,
  SECONDARY_GEMINI_MODEL,
  logAiDiagnostic,
  sanitizeAiLogMessage,
  SafeAIDiagnosticLog,
} from './ai-controller';
import {
  handleDatabaseError,
  isDatabaseError,
  centralErrorHandler,
  asyncHandler,
  sanitizeLogContent,
} from './db/error-handler';
import { isProductionEnvironment } from './db/postgres';

export {
  checkRateLimit,
  resetRateLimitsForTesting,
  cleanupExpiredRateLimits,
  getRateLimitEntryCount,
  getClientIp,
  rateLimiter,
  AI_RATE_LIMIT_CONFIG,
  SIGNUP_RATE_LIMIT_CONFIG,
  handleDatabaseError,
  isDatabaseError,
  centralErrorHandler,
  asyncHandler,
  sanitizeLogContent,
  handleAiChat,
  handleAiInsights,
  setGeminiClientForTesting,
  setMockGeminiCaller,
  setDisableLocalFallbackForTesting,
  setAITimeoutForTesting,
  AIProviderError,
  PRIMARY_GEMINI_MODEL,
  SECONDARY_GEMINI_MODEL,
  logAiDiagnostic,
  sanitizeAiLogMessage,
};
export type { SafeAIDiagnosticLog };

export const apiRouter = express.Router();

// -------------------------------------------------------------
// AI ENDPOINTS (Strictly Authenticated & Server-Authoritative)
// -------------------------------------------------------------

apiRouter.post(
  '/ai/chat',
  requireAuth,
  validateBody(aiChatSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  handleAiChat
);

apiRouter.post(
  '/ai/insights',
  requireAuth,
  validateBody(aiInsightsSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  handleAiInsights
);

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

apiRouter.post(
  '/auth/signup',
  validateBody(signupSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: Request, res: Response) => {
    try {
      // Enforce strict server-side rate limiting on signup
      const ip = getClientIp(req);
      const rateCheck = rateLimiter.consume(
        `signup_${ip}`,
        SIGNUP_RATE_LIMIT_CONFIG.limit,
        SIGNUP_RATE_LIMIT_CONFIG.windowMs
      );

      // Standard non-sensitive RateLimit headers
      res.setHeader('RateLimit-Limit', SIGNUP_RATE_LIMIT_CONFIG.limit.toString());
      res.setHeader('RateLimit-Remaining', rateCheck.remaining.toString());
      res.setHeader('RateLimit-Reset', Math.ceil(rateCheck.resetAt / 1000).toString());

      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', rateCheck.retryAfterSeconds.toString());
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many account creation attempts. Please wait a few minutes before trying again.',
          },
        });
        return;
      }

      const { email, password, displayName } = req.body;
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = displayName.trim();

      const existing = await userRepository.findByEmail(cleanEmail);
      if (existing) {
        res.status(409).json({
          success: false,
          error: { code: 'AUTH_EMAIL_EXISTS', message: 'An account with this email already exists.' },
        });
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

      await userRepository.create(newUser);

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
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Auth Signup');
      }
      console.error('Signup error:', err);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create account.' } });
    }
  }
);

apiRouter.post(
  '/auth/login',
  validateBody(loginSchema, {
    defaultErrorCode: 'AUTH_INVALID_CREDENTIALS',
    fieldCodeMap: { email: 'AUTH_INVALID_CREDENTIALS', password: 'AUTH_INVALID_CREDENTIALS' },
  }),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      // Rate limit login attempts (max 15 per minute per IP)
      const ip = getClientIp(req);
      if (!checkRateLimit(`login_${ip}`, 15, 60000)) {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait a minute.' },
        });
        return;
      }

      const user = await userRepository.findByEmail(cleanEmail);
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
        return;
      }

      const valid = verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
        return;
      }

      const updatedUser = await userRepository.update(user.id, {
        lastLoginAt: new Date().toISOString(),
      });

      await logAuditEvent(user.id, 'USER_LOGIN', 'auth');

      const userToTokenize = updatedUser || user;
      const token = generateToken(userToTokenize);
      res.json({
        success: true,
        data: {
          user: toPublicUser(userToTokenize),
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Auth Login');
      }
      console.error('Login error:', err);
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to sign in.' } });
    }
  }
);

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

apiRouter.post('/auth/logout', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.userId) {
      await logAuditEvent(req.userId, 'USER_LOGOUT', 'auth');
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Auth Logout');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process logout.' } });
  }
});

apiRouter.post('/auth/demo', async (req: Request, res: Response) => {
  try {
    if (isProductionEnvironment() && process.env.ALLOW_DEMO_IN_PRODUCTION !== 'true' && process.env.ENABLE_DEMO_ENVIRONMENT !== 'true') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEMO_DISABLED',
          message: 'Demo environment is disabled in production.',
        },
      });
    }

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

    await userRepository.create(demoUser);
    // Seed isolated demo dataset for this guest
    await userRepository.seedStarterData(guestId);

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
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Auth Demo');
    }
    console.error('Demo auth error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create demo session.' } });
  }
});

apiRouter.post(
  '/auth/password-reset-request',
  validateBody(passwordResetRequestSchema, {
    defaultErrorCode: 'INVALID_EMAIL',
    fieldCodeMap: { email: 'INVALID_EMAIL' },
  }),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const cleanEmail = email.trim().toLowerCase();

      const ip = getClientIp(req);
      if (!checkRateLimit(`reset_${ip}`, 10, 60000)) {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Please wait a minute.' },
        });
        return;
      }

      // Check if email delivery is configured in production
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction && !emailService.isConfigured()) {
        console.error('[Auth] Password reset request failed: No production email provider configured.');
        res.status(503).json({
          success: false,
          error: {
            code: 'EMAIL_SERVICE_UNCONFIGURED',
            message: 'Password reset service is temporarily unavailable. Please contact support.',
          },
        });
        return;
      }

      const user = await userRepository.findByEmail(cleanEmail);
      if (user) {
        const rawResetToken = generatePasswordResetToken();
        const tokenHash = hashResetToken(rawResetToken);
        const expiresAt = new Date(Date.now() + 3600000).toISOString(); // Strict 1-hour expiration

        await passwordResetRepository.create({
          token: tokenHash,
          email: cleanEmail,
          expiresAt,
          used: false,
          createdAt: new Date().toISOString(),
        });

        await logAuditEvent(user.id, 'PASSWORD_RESET_REQUESTED', 'auth', { email: cleanEmail });

        // Dispatch reset email through configured email delivery abstraction
        const originHeader = (req.headers.origin || req.headers.host) as string | undefined;
        let mailResult;
        try {
          mailResult = await emailService.sendPasswordResetEmail(cleanEmail, rawResetToken, originHeader);
        } catch (mailErr: any) {
          const safeErr = sanitizeEmailError(mailErr?.message);
          console.error('[Auth] Failed to dispatch password reset email (exception):', safeErr);
          mailResult = { success: false, error: safeErr };
        }

        if (!mailResult.success) {
          const safeErr = sanitizeEmailError(mailResult.error);
          console.error('[Auth] Failed to dispatch password reset email (delivery failure):', safeErr);
          res.status(503).json({
            success: false,
            error: {
              code: 'EMAIL_DELIVERY_FAILED',
              message: 'Unable to deliver password reset email. Please try again later or contact support.',
            },
          });
          return;
        }
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
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Password Reset Request');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Reset request failed.' } });
    }
  }
);

apiRouter.post(
  '/auth/password-reset-confirm',
  validateBody(passwordResetConfirmSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || typeof token !== 'string' || !token.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'Reset token is required.' },
        });
        return;
      }

      const cleanToken = token.trim();
      const tokenHash = hashResetToken(cleanToken);

      // Lookup by token hash first, with fallback to cleanToken for backward compatibility
      let record = await passwordResetRepository.findByToken(tokenHash);
      if (!record) {
        record = await passwordResetRepository.findByToken(cleanToken);
      }

      // Reject if record doesn't exist, is marked used, or has expired
      if (!record || record.used || new Date(record.expiresAt).getTime() <= Date.now()) {
        res.status(400).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Reset token has expired or is invalid.' },
        });
        return;
      }

      const user = await userRepository.findByEmail(record.email);
      if (!user) {
        // Uniform error response avoids leaking user existence
        res.status(400).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Reset token has expired or is invalid.' },
        });
        return;
      }

      // Immediately invalidate the token (single-use enforcement)
      await passwordResetRepository.markUsed(record.token);

      // Securely update password using existing bcrypt password hashing
      await userRepository.update(user.id, {
        passwordHash: hashPassword(newPassword),
      });

      await logAuditEvent(user.id, 'PASSWORD_RESET_COMPLETED', 'auth');

      res.json({
        success: true,
        data: { success: true, message: 'Password has been successfully updated. You can now sign in.' },
      });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Password Reset Confirm');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Password reset confirmation failed.' } });
    }
  }
);

apiRouter.post('/auth/export-data', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await logAuditEvent(userId, 'DATA_EXPORTED', 'user_data');

    const exportPayload = await userRepository.exportAllUserData(userId);
    res.json({ success: true, data: exportPayload });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Export Data');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to export data.' } });
  }
});

apiRouter.delete('/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await logAuditEvent(userId, 'ACCOUNT_DELETED', 'user_account');

    // Purge all user rows across all tables via repository
    await userRepository.purgeAllUserData(userId);

    res.json({
      success: true,
      data: { success: true, message: 'Account and associated records successfully deleted.' },
    });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Account');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete account.' } });
  }
});

// -------------------------------------------------------------
// TASKS ROUTES
// -------------------------------------------------------------

apiRouter.get('/tasks', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tasks = await taskRepository.findByUserId(req.userId!);
  res.json({ success: true, data: tasks });
}));

apiRouter.post(
  '/tasks',
  requireAuth,
  validateBody(createTaskSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: { title: 'INVALID_TITLE' },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const entitlements = checkUserEntitlements(req.user!);
      if (!entitlements.canCreateTask) {
        res.status(403).json({
          success: false,
          error: {
            code: 'PLAN_LIMIT_REACHED',
            message: `Free plan limit reached (${entitlements.plan.limits.maxTasks} tasks). Upgrade to Pro for unlimited tasks.`,
          },
        });
        return;
      }

      const { title, description, priority, dueDate, scheduledTime, estimatedMinutes, tags, goalId, subtasks } = req.body;

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

      const created = await taskRepository.create(newTask);
      res.json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Task');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create task.' } });
    }
  }
);

apiRouter.put(
  '/tasks/:id',
  requireAuth,
  validateBody(updateTaskSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updated = await taskRepository.update(id, req.userId!, updates);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Task');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update task.' } });
    }
  }
);

apiRouter.patch(
  '/tasks/:id/status',
  requireAuth,
  validateBody(updateTaskStatusSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const updated = await taskRepository.updateStatus(id, req.userId!, status);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Task Status');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update task status.' } });
    }
  }
);

apiRouter.delete('/tasks/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await taskRepository.delete(id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'Task not found.' } });
      return;
    }

    res.json({ success: true, data: { success: true } });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Task');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete task.' } });
  }
});

// -------------------------------------------------------------
// HABITS ROUTES
// -------------------------------------------------------------

apiRouter.get('/habits', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const habits = await habitRepository.findByUserId(req.userId!);
  res.json({ success: true, data: habits });
}));

apiRouter.post(
  '/habits',
  requireAuth,
  validateBody(createHabitSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: { name: 'INVALID_NAME' },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { name, description, category, frequency, targetDays, targetPerDay, reminderTime } = req.body;

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

      const created = await habitRepository.create(newHabit);
      res.json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Habit');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create habit.' } });
    }
  }
);

apiRouter.post(
  '/habits/log',
  requireAuth,
  validateBody(logHabitSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { habitId, date, completed, value, notes } = req.body;

      const result = await habitLogRepository.logHabit(userId, habitId, {
        date,
        completed,
        value,
        notes,
      });

      if (!result) {
        res.status(404).json({ success: false, error: { code: 'HABIT_NOT_FOUND', message: 'Habit not found.' } });
        return;
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Log Habit');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to log habit.' } });
    }
  }
);

apiRouter.get('/habits/logs', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { habitId, startDate, endDate } = req.query;
  const logs = await habitLogRepository.findByUserId(req.userId!, {
    habitId: habitId ? String(habitId) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
  });

  res.json({ success: true, data: logs });
}));

apiRouter.get('/habits/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const habit = await habitRepository.findById(req.params.id, req.userId!);
  if (!habit) {
    res.status(404).json({ success: false, error: { code: 'HABIT_NOT_FOUND', message: 'Habit not found.' } });
    return;
  }
  res.json({ success: true, data: habit });
}));

apiRouter.put(
  '/habits/:id',
  requireAuth,
  validateBody(updateHabitSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await habitRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'HABIT_NOT_FOUND', message: 'Habit not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Habit');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update habit.' } });
    }
  }
);

apiRouter.patch(
  '/habits/:id',
  requireAuth,
  validateBody(updateHabitSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await habitRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'HABIT_NOT_FOUND', message: 'Habit not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Habit');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update habit.' } });
    }
  }
);

apiRouter.delete('/habits/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await habitRepository.delete(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'HABIT_NOT_FOUND', message: 'Habit not found.' } });
      return;
    }
    res.json({ success: true, message: 'Habit deleted successfully.' });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Habit');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete habit.' } });
  }
});

// -------------------------------------------------------------
// GOALS ROUTES
// -------------------------------------------------------------

apiRouter.get('/goals', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goals = await goalRepository.findByUserId(req.userId!);
  res.json({ success: true, data: goals });
}));

apiRouter.get('/goals/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await goalRepository.findById(req.params.id, req.userId!);
  if (!goal) {
    res.status(404).json({ success: false, error: { code: 'GOAL_NOT_FOUND', message: 'Goal not found.' } });
    return;
  }
  res.json({ success: true, data: goal });
}));

apiRouter.put(
  '/goals/:id',
  requireAuth,
  validateBody(updateGoalSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await goalRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'GOAL_NOT_FOUND', message: 'Goal not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Goal');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update goal.' } });
    }
  }
);

apiRouter.patch(
  '/goals/:id',
  requireAuth,
  validateBody(updateGoalSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await goalRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'GOAL_NOT_FOUND', message: 'Goal not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Goal');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update goal.' } });
    }
  }
);

apiRouter.delete('/goals/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await goalRepository.delete(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'GOAL_NOT_FOUND', message: 'Goal not found.' } });
      return;
    }
    res.json({ success: true, message: 'Goal deleted successfully.' });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Goal');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete goal.' } });
  }
});

apiRouter.post(
  '/goals',
  requireAuth,
  validateBody(createGoalSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: { title: 'INVALID_TITLE' },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title, description, category, horizon, targetDate, milestones } = req.body;

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

      const created = await goalRepository.create(newGoal);
      res.json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Goal');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create goal.' } });
    }
  }
);

// -------------------------------------------------------------
// FINANCES ROUTES
// -------------------------------------------------------------

apiRouter.get('/finances/transactions', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const txs = await transactionRepository.findByUserId(req.userId!);
  res.json({ success: true, data: txs });
}));

apiRouter.post(
  '/finances/transactions',
  requireAuth,
  validateBody(createTransactionSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title, amount, type, category, date, paymentMethod, isRecurring, notes } = req.body;

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

      const created = await transactionRepository.create(newTx);
      res.json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Transaction');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record transaction.' } });
    }
  }
);

apiRouter.get('/finances/summary', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const summary = await transactionRepository.getSummary(req.userId!);
  res.json({ success: true, data: summary });
}));

apiRouter.get('/finances/transactions/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tx = await transactionRepository.findById(req.params.id, req.userId!);
  if (!tx) {
    res.status(404).json({ success: false, error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' } });
    return;
  }
  res.json({ success: true, data: tx });
}));

apiRouter.delete('/finances/transactions/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await transactionRepository.delete(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' } });
      return;
    }
    res.json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Transaction');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete transaction.' } });
  }
});

// -------------------------------------------------------------
// EMOTIONS & REFLECTIONS
// -------------------------------------------------------------

apiRouter.get('/emotions/reflections', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clean = await reflectionRepository.findByUserId(req.userId!);
  res.json({ success: true, data: clean });
}));

apiRouter.post(
  '/emotions/reflections',
  requireAuth,
  validateBody(createReflectionSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { date, energyLevel, clarityLevel, stressLevel, primaryEmotion, journalEntry, wins, gratitudes, learnings } = req.body;

      const refDate = date || new Date().toISOString().slice(0, 10);
      const saved = await reflectionRepository.upsert(userId, refDate, {
        energyLevel,
        clarityLevel,
        stressLevel,
        primaryEmotion,
        journalEntry,
        wins,
        gratitudes,
        learnings,
      });

      res.json({ success: true, data: saved });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Record Reflection');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record reflection.' } });
    }
  }
);

// -------------------------------------------------------------
// RELATIONSHIPS ROUTES
// -------------------------------------------------------------

apiRouter.get('/relationships', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rels = await relationshipRepository.findByUserId(req.userId!);
  res.json({ success: true, data: rels });
}));

apiRouter.post(
  '/relationships',
  requireAuth,
  validateBody(createRelationshipSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: { name: 'INVALID_NAME' },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { name, relationType, cadenceDays, lastInteractionDate, notes, anniversaries } = req.body;

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

      const created = await relationshipRepository.create(newRel);
      res.json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Contact');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to save contact.' } });
    }
  }
);

apiRouter.get('/relationships/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rel = await relationshipRepository.findById(req.params.id, req.userId!);
  if (!rel) {
    res.status(404).json({ success: false, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Contact not found.' } });
    return;
  }
  res.json({ success: true, data: rel });
}));

apiRouter.put(
  '/relationships/:id',
  requireAuth,
  validateBody(updateRelationshipSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await relationshipRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Contact not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Contact');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update contact.' } });
    }
  }
);

apiRouter.patch(
  '/relationships/:id',
  requireAuth,
  validateBody(updateRelationshipSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await relationshipRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Contact not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Contact');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update contact.' } });
    }
  }
);

apiRouter.delete('/relationships/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await relationshipRepository.delete(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'RELATIONSHIP_NOT_FOUND', message: 'Contact not found.' } });
      return;
    }
    res.json({ success: true, message: 'Contact deleted successfully.' });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Contact');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete contact.' } });
  }
});

// -------------------------------------------------------------
// NOTES ROUTES
// -------------------------------------------------------------

apiRouter.get('/notes', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notes = await noteRepository.findByUserId(req.userId!);
  res.json({ success: true, data: notes });
}));

apiRouter.get('/notes/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const note = await noteRepository.findById(req.params.id, req.userId!);
  if (!note) {
    res.status(404).json({ success: false, error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.' } });
    return;
  }
  res.json({ success: true, data: note });
}));

apiRouter.put(
  '/notes/:id',
  requireAuth,
  validateBody(updateNoteSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await noteRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Note');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update note.' } });
    }
  }
);

apiRouter.patch(
  '/notes/:id',
  requireAuth,
  validateBody(updateNoteSchema, { defaultErrorCode: 'INVALID_PAYLOAD' }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await noteRepository.update(req.params.id, req.userId!, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Note');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update note.' } });
    }
  }
);

apiRouter.delete('/notes/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await noteRepository.delete(req.params.id, req.userId!);
    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.' } });
      return;
    }
    res.json({ success: true, message: 'Note deleted successfully.' });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Delete Note');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete note.' } });
  }
});

apiRouter.post(
  '/notes',
  requireAuth,
  validateBody(createNoteSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
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

      const created = await noteRepository.create(newNote);
      res.json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Note');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create note.' } });
    }
  }
);

// -------------------------------------------------------------
// USER PROFILE & PREFERENCES
// -------------------------------------------------------------

apiRouter.get('/users/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: toPublicUser(req.user!) });
});

apiRouter.get('/users/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: toPublicUser(req.user!) });
});

apiRouter.put(
  '/users/profile',
  requireAuth,
  validateBody(updateProfileSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const updates = req.body;

      const updated = await userRepository.updateProfile(user.id, updates);
      res.json({ success: true, data: toPublicUser(updated || user) });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Profile');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update profile.' } });
    }
  }
);

apiRouter.get('/users/preferences', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: toPublicUser(req.user!) });
});

apiRouter.put(
  '/users/preferences',
  requireAuth,
  validateBody(updatePreferencesSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const updates = req.body;

      const updated = await userRepository.updatePreferences(user.id, updates);
      res.json({ success: true, data: toPublicUser(updated || user) });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Preferences');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update preferences.' } });
    }
  }
);

// -------------------------------------------------------------
// BILLING & SUBSCRIPTION ROUTES
// -------------------------------------------------------------

apiRouter.get('/billing/subscription', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const entitlements = checkUserEntitlements(req.user!);
  res.json({
    success: true,
    data: {
      ...entitlements,
      subscription: toPublicSubscription(req.user!.subscription),
      availablePlans: PLAN_TIERS,
    },
  });
});

apiRouter.post(
  '/billing/checkout',
  requireAuth,
  validateBody(billingCheckoutSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { interval } = req.body; // 'monthly' | 'annual'
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

      const sessionResult = await createStripeCheckoutSession(user, interval || 'monthly', appUrl);
      res.json({ success: true, data: sessionResult });
    } catch (err: any) {
      if (err instanceof StripeConfigurationError) {
        res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Stripe Checkout');
      }
      console.error('Checkout error:', err?.message || 'Unknown error');
      res.status(500).json({ success: false, error: { code: 'CHECKOUT_ERROR', message: 'Failed to initiate checkout.' } });
    }
  }
);

apiRouter.post('/billing/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  try {
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const event = constructStripeWebhookEvent(payload, sig);
    res.json({ success: true, received: true, eventType: event.type });
  } catch (err: any) {
    if (err instanceof StripeConfigurationError) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_FAILED',
        message: 'Webhook signature verification or processing failed.',
      },
    });
  }
});

apiRouter.get('/audit/logs', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const logs = await auditLogRepository.findByUserId(req.userId!);
  res.json({ success: true, data: logs });
}));

// -------------------------------------------------------------
// NOTIFICATIONS & SERVER-AUTHORITATIVE SCHEDULING ROUTES
// -------------------------------------------------------------

// List in-app notifications for authenticated user
apiRouter.get('/notifications', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userNotifs = await notificationRepository.findByUserId(req.userId!);
  res.json({ success: true, data: userNotifs });
}));

// Get unread notification count
apiRouter.get('/notifications/unread-count', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const unreadCount = await notificationRepository.countUnreadByUserId(req.userId!);
  res.json({ success: true, data: { count: unreadCount } });
}));

// Directly create an in-app notification for authenticated user
apiRouter.post(
  '/notifications',
  requireAuth,
  validateBody(createNotificationSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: { title: 'INVALID_TITLE' },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title, message, type, priority, actionUrl, entityReference } = req.body;

      const now = new Date().toISOString();
      const newNotif: NotificationRecord = {
        id: generateCryptoToken('notif'),
        userId,
        title: title.trim(),
        message: message.trim(),
        type: type || 'system_alert',
        priority: priority || 'medium',
        isRead: false,
        readAt: null,
        actionUrl: actionUrl || null,
        entityReference: entityReference || null,
        scheduledNotificationId: null,
        createdAt: now,
        updatedAt: now,
      };

      const created = await notificationRepository.create(newNotif);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Create Notification');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create notification.' } });
    }
  }
);

// Mark a single notification as read (Strict ownership verification)
apiRouter.put('/notifications/:id/read', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const updated = await notificationRepository.markAsRead(req.params.id, req.userId!);
  if (!updated) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
    return;
  }

  res.json({ success: true, data: updated });
}));

// Mark all notifications as read for authenticated user
apiRouter.post('/notifications/mark-all-read', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const updatedCount = await notificationRepository.markAllAsRead(req.userId!);
  res.json({ success: true, data: { updatedCount } });
}));

// Delete a single in-app notification (Strict ownership verification)
apiRouter.delete('/notifications/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await notificationRepository.delete(req.params.id, req.userId!);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
    return;
  }

  res.json({ success: true, message: 'Notification deleted successfully.' });
}));

// Clear all notifications for authenticated user
apiRouter.delete('/notifications', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await notificationRepository.deleteAllByUserId(req.userId!);
  res.json({ success: true, message: 'All notifications cleared.' });
}));

// Evaluate server-side notification rules for authenticated user
apiRouter.post('/notifications/evaluate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const created = await evaluateServerNotificationRules(req.userId!);
    const userNotifs = await notificationRepository.findByUserId(req.userId!);
    res.json({ success: true, data: userNotifs, newlyCreatedCount: created.length });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Evaluate Notifications');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to evaluate notifications.' } });
  }
});

// Schedule a future notification (Strict server-side scheduling & timestamp validation)
apiRouter.post(
  '/notifications/schedule',
  requireAuth,
  validateBody(scheduleNotificationSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: {
      scheduledFor: 'INVALID_TIMESTAMP',
      title: 'INVALID_TITLE',
    },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { title, message, scheduledFor, type, priority, actionUrl, entityReference, metadata } = req.body;

      const scheduledRecord = await scheduleNotificationServer({
        userId,
        title,
        message,
        scheduledFor,
        type,
        priority,
        actionUrl,
        entityReference,
        metadata,
      });

      res.status(201).json({ success: true, data: scheduledRecord });
    } catch (err: any) {
      if (err?.message?.includes('SCHEDULE_INVALID_TIMESTAMP')) {
        res.status(400).json({ success: false, error: { code: 'INVALID_TIMESTAMP', message: err.message } });
        return;
      }
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Schedule Notification');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to schedule notification.' } });
    }
  }
);

// List scheduled notifications for authenticated user
apiRouter.get('/notifications/scheduled', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const list = await scheduledNotificationRepository.findByUserId(req.userId!);
  res.json({ success: true, data: list });
}));

// Get a single scheduled notification (Strict ownership verification)
apiRouter.get('/notifications/scheduled/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const item = await scheduledNotificationRepository.findById(req.params.id, req.userId!);
  if (!item) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled notification not found.' } });
    return;
  }
  res.json({ success: true, data: item });
}));

// Update a scheduled notification (Strict ownership verification & timestamp validation)
apiRouter.put(
  '/notifications/scheduled/:id',
  requireAuth,
  validateBody(updateScheduledNotificationSchema, {
    defaultErrorCode: 'INVALID_PAYLOAD',
    fieldCodeMap: { scheduledFor: 'INVALID_TIMESTAMP' },
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const item = await scheduledNotificationRepository.findById(req.params.id, req.userId!);
      if (!item) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled notification not found.' } });
        return;
      }

      if (item.status === 'delivered') {
        res.status(400).json({
          success: false,
          error: { code: 'ALREADY_DELIVERED', message: 'Delivered notifications cannot be modified.' },
        });
        return;
      }

      const { title, message, scheduledFor, priority, actionUrl, metadata } = req.body;
      const updates: Partial<any> = {};

      if (title !== undefined) updates.title = title.trim();
      if (message !== undefined) updates.message = message.trim();
      if (scheduledFor !== undefined) updates.scheduledFor = new Date(scheduledFor).toISOString();
      if (priority !== undefined) updates.priority = priority;
      if (actionUrl !== undefined) updates.actionUrl = actionUrl;
      if (metadata !== undefined) updates.metadata = { ...item.metadata, ...metadata };

      const updated = await scheduledNotificationRepository.update(req.params.id, req.userId!, updates);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      if (isDatabaseError(err)) {
        return handleDatabaseError(res, err, 'Update Scheduled Notification');
      }
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update scheduled notification.' } });
    }
  }
);

// Cancel / delete a scheduled notification (Strict ownership verification)
apiRouter.delete('/notifications/scheduled/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const removed = await scheduledNotificationRepository.delete(req.params.id, req.userId!);
  if (!removed) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Scheduled notification not found.' } });
    return;
  }

  res.json({ success: true, message: 'Scheduled notification cancelled.', data: removed });
}));

// Trigger execution of due scheduled notifications (server-authoritative processor)
apiRouter.post('/notifications/scheduled/process', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await processDueScheduledNotifications();
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (isDatabaseError(err)) {
      return handleDatabaseError(res, err, 'Process Scheduled Notifications');
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process scheduled notifications.' } });
  }
});

// Central error handler fallback for any uncaught errors in apiRouter
apiRouter.use(centralErrorHandler);


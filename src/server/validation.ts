import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// -------------------------------------------------------------
// AUTHENTICATION SCHEMAS
// -------------------------------------------------------------

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Valid email address is required.')
    .email('Valid email address is required.')
    .max(255, 'Email is too long.'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password is too long.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required.')
    .max(100, 'Display name is too long.'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email and password are required.')
    .email('Valid email address is required.')
    .max(255, 'Email is too long.'),
  password: z
    .string()
    .min(1, 'Email and password are required.')
    .max(128, 'Password is too long.'),
});

export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Valid email address is required.')
    .max(255, 'Email is too long.'),
});

export const passwordResetConfirmSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Valid token and new password (min 6 chars) required.')
    .max(255, 'Token is too long.'),
  newPassword: z
    .string()
    .min(6, 'Valid token and new password (min 6 chars) required.')
    .max(128, 'Password is too long.'),
});

// -------------------------------------------------------------
// TASK SCHEMAS
// -------------------------------------------------------------

export const subtaskSchema = z.object({
  id: z.string().max(100).optional(),
  title: z
    .string()
    .trim()
    .min(1, 'Subtask title cannot be empty.')
    .max(300, 'Subtask title is too long.'),
  completed: z.boolean().optional(),
  completedAt: z.string().max(100).optional().nullable(),
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required.')
    .max(500, 'Task title is too long.'),
  description: z.string().max(5000, 'Description is too long.').optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().max(100).optional().nullable(),
  scheduledTime: z.string().max(50).optional().nullable(),
  estimatedMinutes: z
    .number()
    .nonnegative('Estimated minutes cannot be negative.')
    .max(10000, 'Estimated minutes exceeds allowable maximum.')
    .optional()
    .nullable(),
  tags: z.array(z.string().max(100, 'Tag exceeds maximum length.')).max(50, 'Too many tags.').optional(),
  goalId: z.string().max(100).optional().nullable(),
  subtasks: z.array(subtaskSchema).max(100, 'Too many subtasks.').optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty.').max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(),
  dueDate: z.string().max(100).optional().nullable(),
  scheduledTime: z.string().max(50).optional().nullable(),
  estimatedMinutes: z.number().nonnegative().max(10000).optional().nullable(),
  actualMinutes: z.number().nonnegative().max(10000).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  goalId: z.string().max(100).optional().nullable(),
  subtasks: z.array(subtaskSchema).max(100).optional(),
  completedAt: z.string().max(100).optional().nullable(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'blocked', 'completed', 'cancelled']),
});

// -------------------------------------------------------------
// HABIT SCHEMAS
// -------------------------------------------------------------

export const createHabitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Habit name is required.')
    .max(300, 'Habit name is too long.'),
  description: z.string().max(2000).optional().nullable(),
  routine: z.string().max(2000).optional().nullable(),
  cue: z.string().max(1000).optional().nullable(),
  reward: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional(),
  frequency: z.enum(['daily', 'weekly', 'custom', 'custom_days', 'weekdays', 'weekends', 'three_times_weekly']).optional(),
  targetDays: z.array(z.union([z.number().int().min(0).max(6), z.string().max(20)])).max(7).optional(),
  customDaysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  targetPerDay: z.number().int().positive().max(1000).optional(),
  reminderTime: z.string().max(50).optional().nullable(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']).optional(),
  targetUnits: z.number().nonnegative().max(100000).optional(),
  unit: z.string().max(50).optional(),
  unitLabel: z.string().max(50).optional(),
  goalId: z.string().max(100).optional().nullable(),
  why: z.string().max(1000).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  archived: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const updateHabitSchema = createHabitSchema.partial();

export const logHabitSchema = z.object({
  habitId: z
    .string()
    .trim()
    .min(1, 'Habit ID cannot be empty.')
    .max(100, 'Habit ID is too long.'),
  date: z.string().max(50).optional(),
  completed: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
  value: z.number().nonnegative().max(100000).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

// -------------------------------------------------------------
// GOAL SCHEMAS
// -------------------------------------------------------------

export const milestoneSchema = z.object({
  id: z.string().max(100).optional(),
  title: z
    .string()
    .trim()
    .min(1, 'Milestone title cannot be empty.')
    .max(300, 'Milestone title is too long.'),
  completed: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  order: z.number().int().optional(),
  targetDate: z.string().max(100).optional().nullable(),
  dueDate: z.string().max(100).optional().nullable(),
  completedAt: z.string().max(100).optional().nullable(),
  weight: z.number().min(0).max(100).optional(),
});

export const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Goal title is required.')
    .max(300, 'Goal title is too long.'),
  description: z.string().max(3000).optional().nullable(),
  category: z
    .enum([
      'career',
      'health',
      'finance',
      'relationships',
      'personal',
      'creativity',
      'lifestyle',
      'learning',
      'health_vitality',
      'career_craft',
      'financial_freedom',
      'financial_growth',
      'mind_learning',
      'relationships_community',
      'creative_expression',
      'environment_home',
    ])
    .optional(),
  horizon: z.enum(['quarterly', 'annual', 'multi_year', 'lifetime', 'monthly']).optional(),
  timeframe: z.enum(['quarterly', 'annual', 'multi_year', 'lifetime', 'monthly']).optional(),
  targetDate: z.string().max(100).optional(),
  status: z.enum(['active', 'achieved', 'completed', 'paused', 'archived', 'cancelled']).optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
  linkedHabitIds: z.array(z.string().max(100)).max(50).optional(),
  successCriteria: z.array(z.string().max(500)).max(50).optional(),
  milestones: z.array(milestoneSchema).max(50, 'Too many milestones.').optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

// -------------------------------------------------------------
// FINANCE SCHEMAS
// -------------------------------------------------------------

export const createTransactionSchema = z
  .object({
    title: z.string().trim().max(300, 'Title is too long.').optional(),
    description: z.string().trim().max(300, 'Description is too long.').optional(),
    amount: z
      .number()
      .positive('Amount must be a positive number.')
      .max(1000000000, 'Amount exceeds maximum allowable threshold.')
      .optional(),
    amountMinor: z.number().int().positive().optional(),
    amountMinorUnits: z.number().int().positive().optional(),
    minorUnits: z.number().int().positive().optional(),
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().max(100).optional(),
    date: z.string().max(50).optional(),
    currency: z.string().max(10).optional(),
    paymentMethod: z.string().max(100).optional().nullable(),
    isRecurring: z.boolean().optional(),
    notes: z.string().max(5000, 'Notes too long.').optional().nullable(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    merchantOrSource: z.string().max(200).optional().nullable(),
  })
  .refine(
    (data) => Boolean((data.title && data.title.trim().length > 0) || (data.description && data.description.trim().length > 0)),
    { message: 'Title and valid numerical amount are required.', path: ['title'] }
  )
  .refine(
    (data) =>
      typeof data.amount === 'number' ||
      typeof data.amountMinor === 'number' ||
      typeof data.amountMinorUnits === 'number' ||
      typeof data.minorUnits === 'number',
    { message: 'Amount must be a positive number.', path: ['amount'] }
  );

export const updateTransactionSchema = z.object({
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(300).optional(),
  amount: z.number().positive().max(1000000000).optional(),
  amountMinor: z.number().int().positive().optional(),
  amountMinorUnits: z.number().int().positive().optional(),
  minorUnits: z.number().int().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().max(100).optional(),
  date: z.string().max(50).optional(),
  currency: z.string().max(10).optional(),
  paymentMethod: z.string().max(100).optional().nullable(),
  isRecurring: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  merchantOrSource: z.string().max(200).optional().nullable(),
});

export const createBudgetSchema = z
  .object({
    category: z.string().trim().min(1, 'Budget category is required.').max(100),
    amount: z.number().positive('Budget cap must be greater than 0.').max(1000000000).optional(),
    limitAmount: z.number().positive().max(1000000000).optional(),
    amountMinor: z.number().int().positive().optional(),
    amountMinorUnits: z.number().int().positive().optional(),
    limitMinorUnits: z.number().int().positive().optional(),
    period: z.enum(['monthly', 'weekly', 'quarterly', 'annual', 'yearly']).optional(),
    monthYear: z.string().max(50).optional(),
    alertThresholdPercentage: z.number().min(1).max(100).optional(),
  })
  .refine(
    (data) =>
      typeof data.amount === 'number' ||
      typeof data.limitAmount === 'number' ||
      typeof data.amountMinor === 'number' ||
      typeof data.amountMinorUnits === 'number' ||
      typeof data.limitMinorUnits === 'number',
    { message: 'A valid positive budget cap is required.', path: ['amount'] }
  );

export const updateBudgetSchema = z.object({
  category: z.string().trim().max(100).optional(),
  amount: z.number().positive('Budget cap must be greater than 0.').max(1000000000).optional(),
  limitAmount: z.number().positive().max(1000000000).optional(),
  amountMinor: z.number().int().positive().optional(),
  amountMinorUnits: z.number().int().positive().optional(),
  limitMinorUnits: z.number().int().positive().optional(),
  period: z.enum(['monthly', 'weekly', 'quarterly', 'annual', 'yearly']).optional(),
  monthYear: z.string().max(50).optional(),
  alertThresholdPercentage: z.number().min(1).max(100).optional(),
});

// -------------------------------------------------------------
// REFLECTION / EMOTION SCHEMAS
// -------------------------------------------------------------

export const createReflectionSchema = z.object({
  date: z.string().max(50).optional(),
  energyLevel: z.number().min(1).max(10).optional(),
  clarityLevel: z.number().min(1).max(10).optional(),
  stressLevel: z.number().min(1).max(10).optional(),
  mood: z.number().min(1).max(10).optional(),
  energy: z.number().min(1).max(10).optional(),
  stress: z.number().min(1).max(10).optional(),
  primaryEmotion: z.string().max(100).optional(),
  journalEntry: z.string().max(50000).optional().nullable(),
  reflection: z.string().max(50000).optional().nullable(),
  wins: z.array(z.string().max(500)).max(50).optional(),
  gratitudes: z.array(z.string().max(500)).max(50).optional(),
  learnings: z.array(z.string().max(500)).max(50).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

export const updateReflectionSchema = createReflectionSchema.partial();

// -------------------------------------------------------------
// RELATIONSHIP SCHEMAS
// -------------------------------------------------------------

export const importantDateSchema = z.object({
  id: z.string().max(100).optional(),
  label: z.string().max(100),
  date: z.string().max(50),
  recurringYearly: z.boolean().optional(),
});

export const createRelationshipSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(200, 'Name is too long.'),
  relationType: z.enum(['friend', 'family', 'close_friend', 'colleague', 'mentor', 'client', 'partner', 'community', 'other']).optional(),
  relationshipType: z.enum(['friend', 'family', 'close_friend', 'colleague', 'mentor', 'client', 'partner', 'community', 'other']).optional(),
  cadenceDays: z.number().int().positive().max(3650).optional(),
  lastInteractionDate: z.string().max(50).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  anniversaries: z.array(z.any()).max(50).optional(),
  importantDates: z.array(importantDateSchema).max(50).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});

export const updateRelationshipSchema = createRelationshipSchema.partial();

// -------------------------------------------------------------
// NOTE SCHEMAS
// -------------------------------------------------------------

export const createNoteSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  content: z.string().max(500000, 'Note content exceeds allowable maximum.').optional().nullable(),
  folderId: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  linkedGoalId: z.string().max(100).optional().nullable(),
  linkedTaskId: z.string().max(100).optional().nullable(),
});

export const updateNoteSchema = createNoteSchema.partial();

// -------------------------------------------------------------
// USER PROFILE & PREFERENCES SCHEMAS
// -------------------------------------------------------------

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name cannot be empty.').max(100).optional(),
  headline: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  avatarUrl: z.string().max(2000).optional().nullable(),
  primaryLifeFocus: z.string().max(200).optional().nullable(),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  timezone: z.string().max(100).optional(),
  locale: z.string().max(50).optional(),
  weekStartDay: z.union([z.literal(0), z.literal(1), z.literal(6)]).optional(),
  reducedMotion: z.boolean().optional(),
  compactDensity: z.boolean().optional(),
  dailyReflectionReminderTime: z.string().max(20).optional().nullable(),
  notificationChannels: z
    .object({
      inApp: z.boolean().optional(),
      email: z.boolean().optional(),
      dailyDigest: z.boolean().optional(),
    })
    .optional(),
  unlockedModules: z.array(z.string().max(50)).max(50).optional(),
});

// -------------------------------------------------------------
// BILLING CHECKOUT SCHEMA
// -------------------------------------------------------------

export const billingCheckoutSchema = z.object({
  interval: z.enum(['monthly', 'annual']).optional(),
});

// -------------------------------------------------------------
// NOTIFICATION SCHEMAS
// -------------------------------------------------------------

export const createNotificationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Notification title is required.')
    .max(500, 'Notification title is too long.'),
  message: z
    .string()
    .trim()
    .min(1, 'Notification message is required.')
    .max(5000, 'Notification message is too long.'),
  type: z
    .enum([
      'task_reminder',
      'habit_reminder',
      'goal_deadline',
      'relationship_reminder',
      'budget_alert',
      'system_update',
      'system_alert',
      'custom_reminder',
    ])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  actionUrl: z.string().max(500).optional().nullable(),
  entityReference: z
    .object({
      type: z.enum(['task', 'habit', 'goal', 'relationship', 'budget', 'system']),
      id: z.string().max(100),
    })
    .optional()
    .nullable(),
});

export const scheduleNotificationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Notification title is required.')
    .max(500, 'Notification title is too long.'),
  message: z
    .string()
    .trim()
    .min(1, 'Notification message is required.')
    .max(5000, 'Notification message is too long.'),
  scheduledFor: z
    .string()
    .trim()
    .min(1, 'scheduledFor timestamp is required.')
    .refine((val) => {
      const parsed = Date.parse(val);
      return !Number.isNaN(parsed) && !Number.isNaN(new Date(parsed).getTime());
    }, { message: 'scheduledFor must be a valid ISO 8601 timestamp.' }),
  type: z
    .enum([
      'task_reminder',
      'habit_reminder',
      'goal_deadline',
      'relationship_reminder',
      'budget_alert',
      'system_update',
      'system_alert',
      'custom_reminder',
    ])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  actionUrl: z.string().max(500).optional().nullable(),
  entityReference: z
    .object({
      type: z.enum(['task', 'habit', 'goal', 'relationship', 'budget', 'system']),
      id: z.string().max(100),
    })
    .optional()
    .nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateScheduledNotificationSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty.').max(500).optional(),
  message: z.string().trim().min(1, 'Message cannot be empty.').max(5000).optional(),
  scheduledFor: z
    .string()
    .trim()
    .min(1, 'scheduledFor cannot be empty.')
    .refine((val) => {
      const parsed = Date.parse(val);
      return !Number.isNaN(parsed) && !Number.isNaN(new Date(parsed).getTime());
    }, { message: 'scheduledFor must be a valid ISO 8601 timestamp.' })
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  actionUrl: z.string().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// -------------------------------------------------------------
// AI SCHEMAS
// -------------------------------------------------------------

export const aiChatSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, 'Missing or invalid message string.')
      .max(10000, 'Message is too long.'),
    conversationHistory: z
      .array(
        z.object({
          role: z.string().max(50),
          content: z.string().max(10000),
        })
      )
      .max(100)
      .optional(),
    moduleContext: z.string().max(100).optional(),
  })
  .passthrough();

export const aiInsightsSchema = z
  .object({
    focusArea: z.string().max(100).optional(),
  })
  .passthrough();

// -------------------------------------------------------------
// VALIDATION MIDDLEWARE GENERATOR
// -------------------------------------------------------------

export interface ValidationOptions {
  defaultErrorCode?: string;
  fieldCodeMap?: Record<string, string>;
}

export function validateBody<T>(schema: z.ZodType<T>, options: ValidationOptions = {}) {
  const { defaultErrorCode = 'INVALID_PAYLOAD', fieldCodeMap = {} } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // If body is not an object or is missing, reject
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({
        success: false,
        error: {
          code: defaultErrorCode,
          message: 'Request body must be a valid JSON object.',
        },
      });
      return;
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue.path.join('.');
      const issueMessage = firstIssue.message;

      // Select appropriate error code
      let errorCode = defaultErrorCode;
      if (fieldCodeMap[fieldPath]) {
        errorCode = fieldCodeMap[fieldPath];
      } else if (fieldPath === 'email') {
        errorCode = 'INVALID_EMAIL';
      } else if (fieldPath === 'password') {
        errorCode = 'INVALID_PASSWORD';
      } else if (fieldPath === 'displayName' || fieldPath === 'name') {
        errorCode = 'INVALID_NAME';
      } else if (fieldPath === 'title') {
        errorCode = 'INVALID_TITLE';
      } else if (fieldPath === 'scheduledFor') {
        errorCode = 'INVALID_TIMESTAMP';
      }

      res.status(400).json({
        success: false,
        error: {
          code: errorCode,
          message: issueMessage,
          details: result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
      });
      return;
    }

    // Assign sanitized and validated data to req.body
    req.body = result.data;
    next();
  };
}

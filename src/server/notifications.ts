import { db, NotificationRecord, ScheduledNotificationRecord } from './db';
import { generateCryptoToken } from './auth';

export type NotificationType =
  | 'task_reminder'
  | 'habit_reminder'
  | 'goal_deadline'
  | 'relationship_reminder'
  | 'budget_alert'
  | 'system_update'
  | 'system_alert'
  | 'custom_reminder';

export interface ScheduleNotificationInput {
  userId: string;
  title: string;
  message: string;
  scheduledFor: string;
  type?: NotificationType;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string | null;
  entityReference?: {
    type: 'task' | 'habit' | 'goal' | 'relationship' | 'budget' | 'system';
    id: string;
  } | null;
  metadata?: Record<string, any>;
}

export interface UpdateScheduledNotificationInput {
  title?: string;
  message?: string;
  scheduledFor?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Strictly validates an ISO 8601 or standard datetime timestamp.
 * Returns true if valid and finite timestamp, false otherwise.
 */
export function isValidTimestamp(timestamp: unknown): boolean {
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return false;
  }
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return false;
  }
  const date = new Date(parsed);
  return !Number.isNaN(date.getTime());
}

/**
 * Server-authoritative scheduler state and background interval handle.
 */
let schedulerIntervalHandle: NodeJS.Timeout | null = null;
let isProcessingScheduledNotifications = false;

/**
 * Schedules a notification in the persistent server database.
 * The notification is associated strictly with the authenticated userId.
 */
export async function scheduleNotificationServer(
  input: ScheduleNotificationInput
): Promise<ScheduledNotificationRecord> {
  const { userId, title, message, scheduledFor, type, priority, actionUrl, entityReference, metadata } = input;

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('SCHEDULE_USER_REQUIRED: Valid authenticated userId is required.');
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('SCHEDULE_TITLE_REQUIRED: Notification title cannot be empty.');
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('SCHEDULE_MESSAGE_REQUIRED: Notification message cannot be empty.');
  }

  if (!isValidTimestamp(scheduledFor)) {
    throw new Error('SCHEDULE_INVALID_TIMESTAMP: scheduledFor must be a valid ISO 8601 timestamp.');
  }

  const now = new Date().toISOString();
  const id = generateCryptoToken('snotif');

  const record: ScheduledNotificationRecord = {
    id,
    userId: userId.trim(),
    title: title.trim(),
    message: message.trim(),
    type: type || 'custom_reminder',
    priority: priority || 'medium',
    scheduledFor: new Date(scheduledFor).toISOString(),
    status: 'scheduled',
    deliveredAt: null,
    actionUrl: actionUrl || null,
    entityReference: entityReference || null,
    metadata: metadata || {},
    createdAt: now,
    updatedAt: now,
  };

  db.schema.scheduledNotifications.unshift(record);
  await db.save();

  return record;
}

/**
 * Atomically transitions a scheduled notification to 'delivered' and inserts the in-app notification record.
 * Guarantees that duplicate deliveries cannot occur even with multiple simultaneous scheduler runs.
 */
export async function deliverScheduledNotification(
  scheduledRecord: ScheduledNotificationRecord,
  deliveryTime?: Date
): Promise<NotificationRecord | null> {
  // Idempotency check: only 'scheduled' notifications can be delivered
  if (scheduledRecord.status !== 'scheduled') {
    return null;
  }

  const now = (deliveryTime || new Date()).toISOString();

  // Mark status as delivered immediately to prevent race conditions
  scheduledRecord.status = 'delivered';
  scheduledRecord.deliveredAt = now;
  scheduledRecord.updatedAt = now;

  // Secondary deduplication guard against duplicate in-app notification entries
  const existingDelivery = db.schema.notifications.find(
    (n) => n.scheduledNotificationId === scheduledRecord.id
  );

  if (existingDelivery) {
    await db.save();
    return existingDelivery;
  }

  const inAppNotif: NotificationRecord = {
    id: generateCryptoToken('notif'),
    userId: scheduledRecord.userId,
    type: scheduledRecord.type,
    title: scheduledRecord.title,
    message: scheduledRecord.message,
    priority: scheduledRecord.priority,
    isRead: false,
    readAt: null,
    actionUrl: scheduledRecord.actionUrl,
    entityReference: scheduledRecord.entityReference,
    scheduledNotificationId: scheduledRecord.id,
    createdAt: now,
    updatedAt: now,
  };

  db.schema.notifications.unshift(inAppNotif);
  await db.save();

  return inAppNotif;
}

/**
 * Processes all scheduled notifications that are due as of the target time.
 * Server-authoritative and completely independent of any client/browser process.
 */
export async function processDueScheduledNotifications(
  asOfDate?: Date
): Promise<{ processedCount: number; deliveredIds: string[] }> {
  if (isProcessingScheduledNotifications) {
    return { processedCount: 0, deliveredIds: [] };
  }

  isProcessingScheduledNotifications = true;
  const deliveredIds: string[] = [];

  try {
    const targetTime = asOfDate ? asOfDate.getTime() : Date.now();
    const scheduledList = db.schema.scheduledNotifications;

    for (const item of scheduledList) {
      if (item.status === 'scheduled') {
        const scheduledTime = new Date(item.scheduledFor).getTime();
        if (!Number.isNaN(scheduledTime) && scheduledTime <= targetTime) {
          const delivered = await deliverScheduledNotification(item, asOfDate || new Date(targetTime));
          if (delivered) {
            deliveredIds.push(item.id);
          }
        }
      }
    }

    return { processedCount: deliveredIds.length, deliveredIds };
  } finally {
    isProcessingScheduledNotifications = false;
  }
}

/**
 * Evaluates active server-side domain entities (tasks, habits, goals, relationships, budgets)
 * and generates proactive in-app notifications if due, avoiding duplicate daily alerts.
 */
export async function evaluateServerNotificationRules(
  userId: string,
  currentDate?: Date
): Promise<NotificationRecord[]> {
  const now = currentDate || new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowIso = now.toISOString();

  const existingNotifs = db.schema.notifications.filter((n) => n.userId === userId);
  const newlyCreated: NotificationRecord[] = [];

  const hasRecentAlert = (refType: string, refId: string) =>
    existingNotifs.some(
      (n) =>
        n.entityReference?.type === refType &&
        n.entityReference?.id === refId &&
        n.createdAt.slice(0, 10) === todayStr
    ) ||
    newlyCreated.some(
      (n) =>
        n.entityReference?.type === refType &&
        n.entityReference?.id === refId &&
        n.createdAt.slice(0, 10) === todayStr
    );

  // 1. Task Reminders (Due Today or Overdue)
  const userTasks = db.schema.tasks.filter(
    (t) => t.userId === userId && (t.status === 'todo' || t.status === 'in_progress')
  );
  for (const t of userTasks) {
    if (t.dueDate) {
      const dueDay = t.dueDate.split('T')[0];
      const isOverdue = dueDay < todayStr;
      const isDueToday = dueDay === todayStr;

      if ((isOverdue || isDueToday) && !hasRecentAlert('task', t.id)) {
        const notif: NotificationRecord = {
          id: generateCryptoToken('notif'),
          userId,
          title: isOverdue ? `Overdue Task: ${t.title}` : `Task Due Today: ${t.title}`,
          message: isOverdue
            ? `Task was due on ${dueDay}. Priority: ${t.priority}.`
            : `Scheduled for completion today. Priority: ${t.priority}.`,
          type: 'task_reminder',
          priority: isOverdue || t.priority === 'urgent' ? 'urgent' : 'high',
          isRead: false,
          readAt: null,
          actionUrl: '/app/tasks',
          entityReference: { type: 'task', id: t.id },
          scheduledNotificationId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        newlyCreated.push(notif);
      }
    }
  }

  // 2. Habit Reminders (Pending Today)
  const userHabits = db.schema.habits.filter((h) => h.userId === userId && !h.archived);
  const userLogs = db.schema.habitLogs.filter((l) => l.userId === userId && l.date === todayStr);

  for (const h of userHabits) {
    const isCompleted = userLogs.some((l) => l.habitId === h.id && l.completed);
    if (!isCompleted && !hasRecentAlert('habit', h.id)) {
      const notif: NotificationRecord = {
        id: generateCryptoToken('notif'),
        userId,
        title: `Daily Cadence: ${h.name}`,
        message: `Maintain your ${h.streakCount}-day streak. Target: ${h.targetPerDay} ${h.unit || 'session'}.`,
        type: 'habit_reminder',
        priority: 'medium',
        isRead: false,
        readAt: null,
        actionUrl: '/app/habits',
        entityReference: { type: 'habit', id: h.id },
        scheduledNotificationId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      newlyCreated.push(notif);
    }
  }

  // 3. Goal Deadlines (Approaching within 7 days)
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const userGoals = db.schema.goals.filter((g) => g.userId === userId && g.status === 'active');

  for (const g of userGoals) {
    if (g.targetDate && g.targetDate <= sevenDaysAhead && !hasRecentAlert('goal', g.id)) {
      const notif: NotificationRecord = {
        id: generateCryptoToken('notif'),
        userId,
        title: `Horizon Deadline: ${g.title}`,
        message: `Target milestone date is ${g.targetDate}. Current progress: ${g.progressPercentage}%.`,
        type: 'goal_deadline',
        priority: 'high',
        isRead: false,
        readAt: null,
        actionUrl: '/app/goals',
        entityReference: { type: 'goal', id: g.id },
        scheduledNotificationId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      newlyCreated.push(notif);
    }
  }

  // 4. Relationship Cadence Reminders
  const userRels = db.schema.relationships.filter((r) => r.userId === userId);
  for (const r of userRels) {
    if (r.nextDueReminderDate && r.nextDueReminderDate <= todayStr && !hasRecentAlert('relationship', r.id)) {
      const notif: NotificationRecord = {
        id: generateCryptoToken('notif'),
        userId,
        title: `Reach Out: ${r.name}`,
        message: `Relational check-in due (${r.relationType}). Cadence: every ${r.cadenceDays || 14} days.`,
        type: 'relationship_reminder',
        priority: 'medium',
        isRead: false,
        readAt: null,
        actionUrl: '/app/relationships',
        entityReference: { type: 'relationship', id: r.id },
        scheduledNotificationId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      newlyCreated.push(notif);
    }
  }

  // 5. Budget Threshold Alerts
  const userBudgets = db.schema.budgets.filter((b) => b.userId === userId);
  const userTransactions = db.schema.transactions.filter(
    (tx) => tx.userId === userId && tx.type === 'expense' && tx.date.slice(0, 7) === todayStr.slice(0, 7)
  );

  for (const b of userBudgets) {
    const spent = userTransactions
      .filter((tx) => tx.category.toLowerCase() === b.category.toLowerCase())
      .reduce((sum, tx) => sum + tx.amount, 0);

    const pct = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
    const threshold = b.alertThresholdPercentage || 80;

    if (pct >= threshold && !hasRecentAlert('budget', b.id)) {
      const isOver = pct >= 100;
      const notif: NotificationRecord = {
        id: generateCryptoToken('notif'),
        userId,
        title: isOver ? `Budget Exceeded: ${b.category}` : `Budget Alert: ${b.category}`,
        message: isOver
          ? `Spent $${spent.toFixed(2)} of $${b.limitAmount.toFixed(2)} budget (${Math.round(pct)}%).`
          : `Spent $${spent.toFixed(2)} (${Math.round(pct)}% of $${b.limitAmount.toFixed(2)} limit).`,
        type: 'budget_alert',
        priority: isOver ? 'urgent' : 'high',
        isRead: false,
        readAt: null,
        actionUrl: '/app/finances',
        entityReference: { type: 'budget', id: b.id },
        scheduledNotificationId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      newlyCreated.push(notif);
    }
  }

  if (newlyCreated.length > 0) {
    db.schema.notifications.unshift(...newlyCreated);
    await db.save();
  }

  return newlyCreated;
}

/**
 * Starts the server-authoritative notification scheduler loop.
 */
export function startNotificationScheduler(intervalMs = 5000): void {
  if (schedulerIntervalHandle) {
    return;
  }
  // Process immediately on start
  processDueScheduledNotifications().catch((err) => {
    console.error('Error during initial notification schedule run:', err);
  });

  schedulerIntervalHandle = setInterval(() => {
    processDueScheduledNotifications().catch((err) => {
      console.error('Error during scheduled notification execution cycle:', err);
    });
  }, intervalMs);

  // Prevent keeping Node process alive if exiting
  if (schedulerIntervalHandle && typeof schedulerIntervalHandle.unref === 'function') {
    schedulerIntervalHandle.unref();
  }
}

/**
 * Stops the server-authoritative notification scheduler loop.
 */
export function stopNotificationScheduler(): void {
  if (schedulerIntervalHandle) {
    clearInterval(schedulerIntervalHandle);
    schedulerIntervalHandle = null;
  }
}

/**
 * Clears scheduler state for testing.
 */
export function resetNotificationSchedulerForTesting(): void {
  stopNotificationScheduler();
  isProcessingScheduledNotifications = false;
}

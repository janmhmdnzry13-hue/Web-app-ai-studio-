/**
 * Row Mappers: Convert PostgreSQL database rows to TypeScript Entity Records
 */

import {
  UserRecord,
  TaskRecord,
  HabitRecord,
  HabitLogRecord,
  GoalRecord,
  TransactionRecord,
  BudgetRecord,
  ReflectionRecord,
  RelationshipRecord,
  ContactInteractionRecord,
  NoteRecord,
  AIMemoryRecord,
  AuditLogRecord,
  PasswordResetRecord,
  NotificationRecord,
  ScheduledNotificationRecord,
} from '../../db';

export function mapUserRow(row: any): UserRecord {
  const notifChannels =
    typeof row.notification_channels === 'string'
      ? JSON.parse(row.notification_channels)
      : row.notification_channels || { inApp: true, email: true, dailyDigest: false };

  const unlockedModules =
    typeof row.unlocked_modules === 'string'
      ? JSON.parse(row.unlocked_modules)
      : row.unlocked_modules || [];

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role || 'member',
    emailVerified: Boolean(row.email_verified),
    verificationToken: row.verification_token || null,
    profile: {
      displayName: row.display_name || '',
      headline: row.headline || undefined,
      bio: row.bio || undefined,
      avatarUrl: row.avatar_url || undefined,
      primaryLifeFocus: row.primary_life_focus || undefined,
    },
    preferences: {
      theme: row.theme || 'system',
      timezone: row.timezone || 'UTC',
      locale: row.locale || 'en-US',
      weekStartDay: row.week_start_day !== undefined ? Number(row.week_start_day) as 0 | 1 | 6 : 1,
      reducedMotion: Boolean(row.reduced_motion),
      compactDensity: Boolean(row.compact_density),
      dailyReflectionReminderTime: row.daily_reflection_reminder_time || null,
      notificationChannels: notifChannels,
      unlockedModules,
    },
    subscription: {
      tier: row.subscription_tier || 'free',
      status: row.subscription_status || 'active',
      currentPeriodEnd: row.subscription_current_period_end
        ? new Date(row.subscription_current_period_end).toISOString()
        : undefined,
      cancelAtPeriodEnd: Boolean(row.subscription_cancel_at_period_end),
      stripeCustomerId: row.stripe_customer_id || undefined,
      stripeSubscriptionId: row.stripe_subscription_id || undefined,
    },
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapTaskRow(row: any, subtasks: any[] = []): TaskRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    priority: row.priority || 'medium',
    status: row.status || 'todo',
    dueDate: row.due_date
      ? typeof row.due_date === 'string'
        ? row.due_date.slice(0, 10)
        : new Date(row.due_date).toISOString().slice(0, 10)
      : null,
    scheduledTime: row.scheduled_time || null,
    estimatedMinutes: row.estimated_minutes != null ? Number(row.estimated_minutes) : null,
    actualMinutes: row.actual_minutes != null ? Number(row.actual_minutes) : null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    goalId: row.goal_id || null,
    subtasks: subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      completed: Boolean(s.completed),
    })),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapHabitRow(row: any): HabitRecord {
  return {
    id: row.id,
    userId: row.user_id,
    goalId: row.goal_id || undefined,
    name: row.name,
    description: row.description || undefined,
    routine: row.routine || undefined,
    cue: row.cue || undefined,
    reward: row.reward || undefined,
    category: row.category || 'Health & Vitality',
    frequency: row.frequency || 'daily',
    targetDays: Array.isArray(row.target_days) ? row.target_days : undefined,
    customDaysOfWeek: Array.isArray(row.target_days) ? row.target_days : undefined,
    targetPerDay: Number(row.target_per_day || 1),
    targetUnits: Number(row.target_units != null ? row.target_units : (row.target_per_day || 1)),
    unit: row.unit || undefined,
    unitLabel: row.unit_label || row.unit || undefined,
    timeOfDay: row.time_of_day || 'morning',
    reminderTime: row.reminder_time || null,
    why: row.why || undefined,
    icon: row.icon || undefined,
    color: row.color || undefined,
    streakCount: Number(row.streak_count || 0),
    bestStreak: Number(row.best_streak || 0),
    totalCompletions: Number(row.total_completions || 0),
    archived: Boolean(row.archived),
    isArchived: Boolean(row.archived),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapHabitLogRow(row: any): HabitLogRecord {
  return {
    id: row.id,
    userId: row.user_id,
    habitId: row.habit_id,
    date:
      typeof row.date === 'string'
        ? row.date.slice(0, 10)
        : new Date(row.date).toISOString().slice(0, 10),
    completed: Boolean(row.completed),
    targetMet: Boolean(row.completed),
    value: Number(row.value != null ? row.value : 1),
    notes: row.notes || undefined,
    loggedAt: new Date(row.created_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapGoalRow(row: any, milestones: any[] = []): GoalRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    category: row.category || 'personal',
    horizon: row.horizon || 'annual',
    targetDate:
      typeof row.target_date === 'string'
        ? row.target_date.slice(0, 10)
        : new Date(row.target_date).toISOString().slice(0, 10),
    progressPercentage: Number(row.progress_percentage || 0),
    status: row.status || 'active',
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      completed: Boolean(m.completed),
      isCompleted: Boolean(m.completed),
      targetDate: m.target_date
        ? typeof m.target_date === 'string'
          ? m.target_date.slice(0, 10)
          : new Date(m.target_date).toISOString().slice(0, 10)
        : undefined,
      dueDate: m.target_date
        ? typeof m.target_date === 'string'
          ? m.target_date.slice(0, 10)
          : new Date(m.target_date).toISOString().slice(0, 10)
        : undefined,
      completedAt: m.completed_at ? new Date(m.completed_at).toISOString() : undefined,
      weight: Number(m.weight || 0),
      order: Number(m.order_index || 0),
    })),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapTransactionRow(row: any): TransactionRecord {
  const amount = Number(row.amount != null ? row.amount : 0);
  const minorUnits =
    row.minor_units != null
      ? Number(row.minor_units)
      : Math.round(amount * 100);

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || row.title,
    amount,
    minorUnits,
    amountMinorUnits: minorUnits,
    type: row.type,
    category: row.category,
    date:
      typeof row.date === 'string'
        ? row.date.slice(0, 10)
        : new Date(row.date).toISOString().slice(0, 10),
    paymentMethod: row.payment_method || undefined,
    isRecurring: Boolean(row.is_recurring),
    merchantOrSource: row.merchant_or_source || undefined,
    notes: row.notes || undefined,
    currency: row.currency || 'USD',
    isEncrypted: Boolean(row.is_encrypted),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapBudgetRow(row: any): BudgetRecord {
  const limitAmount = Number(row.limit_amount != null ? row.limit_amount : 0);
  const limitMinorUnits =
    row.limit_minor_units != null
      ? Number(row.limit_minor_units)
      : Math.round(limitAmount * 100);

  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    limitAmount,
    limitMinorUnits,
    amount: limitAmount,
    amountMinorUnits: limitMinorUnits,
    period: row.period || 'monthly',
    monthYear: row.month_year || 'all',
    alertThresholdPercentage: Number(row.alert_threshold_percentage || 80),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapReflectionRow(row: any, decryptedJournal?: string): ReflectionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    date:
      typeof row.date === 'string'
        ? row.date.slice(0, 10)
        : new Date(row.date).toISOString().slice(0, 10),
    energyLevel: Number(row.energy_level || 5),
    clarityLevel: Number(row.clarity_level || 5),
    stressLevel: Number(row.stress_level || 5),
    mood: row.mood !== null && row.mood !== undefined ? Number(row.mood) : undefined,
    energy: row.energy !== null && row.energy !== undefined ? Number(row.energy) : (row.energy_level ? Math.round(Number(row.energy_level) / 2) : undefined),
    stress: row.stress !== null && row.stress !== undefined ? Number(row.stress) : (row.stress_level ? Math.round(Number(row.stress_level) / 2) : undefined),
    primaryEmotion: row.primary_emotion || 'neutral',
    journalEntry:
      decryptedJournal !== undefined
        ? decryptedJournal
        : row.journal_entry || '',
    reflection: row.reflection || '',
    wins: Array.isArray(row.wins) ? row.wins : [],
    gratitudes: Array.isArray(row.gratitudes) ? row.gratitudes : [],
    learnings: Array.isArray(row.learnings) ? row.learnings : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    isEncrypted: Boolean(row.is_encrypted),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapRelationshipRow(row: any, anniversaries: any[] = []): RelationshipRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    relationType: row.relation_type || 'friend',
    cadenceDays: Number(row.cadence_days || 30),
    lastInteractionDate: row.last_interaction_date
      ? typeof row.last_interaction_date === 'string'
        ? row.last_interaction_date.slice(0, 10)
        : new Date(row.last_interaction_date).toISOString().slice(0, 10)
      : null,
    nextDueReminderDate: row.next_due_reminder_date
      ? typeof row.next_due_reminder_date === 'string'
        ? row.next_due_reminder_date.slice(0, 10)
        : new Date(row.next_due_reminder_date).toISOString().slice(0, 10)
      : null,
    notes: row.notes || undefined,
    anniversaries: anniversaries.map((a) => ({
      label: a.label,
      date: a.date,
    })),
    isEncrypted: Boolean(row.is_encrypted),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapInteractionRow(row: any): ContactInteractionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id,
    date:
      typeof row.date === 'string'
        ? row.date.slice(0, 10)
        : new Date(row.date).toISOString().slice(0, 10),
    channel: row.channel,
    notes: row.notes || undefined,
    energyImpact: row.energy_impact || undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapNoteRow(row: any): NoteRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || '',
    content: row.content || '',
    folderId: row.folder_id || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    linkedNoteIds: Array.isArray(row.linked_note_ids) ? row.linked_note_ids : [],
    isEncrypted: Boolean(row.is_encrypted),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapAIMemoryRow(row: any): AIMemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    value: row.value,
    category: row.category || 'preference',
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapAuditLogRow(row: any): AuditLogRecord {
  const metadata =
    typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || undefined;

  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    resource: row.resource,
    ipAddress: row.ip_address || undefined,
    userAgent: row.user_agent || undefined,
    metadata,
    timestamp: new Date(row.timestamp).toISOString(),
  };
}

export function mapPasswordResetRow(row: any): PasswordResetRecord {
  return {
    token: row.token,
    email: row.email,
    expiresAt: new Date(row.expires_at).toISOString(),
    used: Boolean(row.used),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapNotificationRow(row: any): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || 'system_alert',
    title: row.title,
    message: row.message,
    priority: row.priority || 'medium',
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    actionUrl: row.action_url || null,
    entityReference:
      row.entity_type && row.entity_id
        ? {
            type: row.entity_type,
            id: row.entity_id,
          }
        : null,
    scheduledNotificationId: row.scheduled_notification_id || null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function mapScheduledNotificationRow(row: any): ScheduledNotificationRecord {
  const metadata =
    typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || undefined;

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || 'custom_reminder',
    title: row.title,
    message: row.message,
    priority: row.priority || 'medium',
    scheduledFor: new Date(row.scheduled_for).toISOString(),
    status: row.status || 'scheduled',
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    actionUrl: row.action_url || null,
    entityReference:
      row.entity_type && row.entity_id
        ? {
            type: row.entity_type,
            id: row.entity_id,
          }
        : null,
    metadata,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

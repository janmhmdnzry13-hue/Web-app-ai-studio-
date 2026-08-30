import { query, withTransaction } from '../../db/postgres';
import { UserRecord } from '../../db';
import { IUserRepository } from '../interfaces';
import { mapUserRow } from './mappers';
import { toPublicUser } from '../../auth';

export class PostgresUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  async findByVerificationToken(token: string): Promise<UserRecord | null> {
    const res = await query('SELECT * FROM users WHERE verification_token = $1', [token]);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  async create(user: UserRecord): Promise<UserRecord> {
    const sql = `
      INSERT INTO users (
        id, email, password_hash, role, email_verified, verification_token,
        display_name, headline, bio, avatar_url, primary_life_focus,
        theme, timezone, locale, week_start_day, reduced_motion, compact_density,
        daily_reflection_reminder_time, notification_channels, unlocked_modules,
        subscription_tier, subscription_status, subscription_current_period_end,
        subscription_cancel_at_period_end, stripe_customer_id, stripe_subscription_id,
        last_login_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29
      )
      RETURNING *
    `;

    const values = [
      user.id,
      user.email.toLowerCase(),
      user.passwordHash,
      user.role || 'member',
      Boolean(user.emailVerified),
      user.verificationToken || null,
      user.profile.displayName || 'Member',
      user.profile.headline || null,
      user.profile.bio || null,
      user.profile.avatarUrl || null,
      user.profile.primaryLifeFocus || null,
      user.preferences.theme || 'system',
      user.preferences.timezone || 'UTC',
      user.preferences.locale || 'en-US',
      user.preferences.weekStartDay !== undefined ? user.preferences.weekStartDay : 1,
      Boolean(user.preferences.reducedMotion),
      Boolean(user.preferences.compactDensity),
      user.preferences.dailyReflectionReminderTime || null,
      JSON.stringify(user.preferences.notificationChannels || { inApp: true, email: true, dailyDigest: false }),
      JSON.stringify(user.preferences.unlockedModules || []),
      user.subscription?.tier || 'free',
      user.subscription?.status || 'active',
      user.subscription?.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd) : null,
      Boolean(user.subscription?.cancelAtPeriodEnd),
      user.subscription?.stripeCustomerId || null,
      user.subscription?.stripeSubscriptionId || null,
      user.lastLoginAt ? new Date(user.lastLoginAt) : null,
      user.createdAt ? new Date(user.createdAt) : new Date(),
      user.updatedAt ? new Date(user.updatedAt) : new Date(),
    ];

    const res = await query(sql, values);
    return mapUserRow(res.rows[0]);
  }

  async update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const merged: UserRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      profile: {
        ...existing.profile,
        ...(updates.profile || {}),
      },
      preferences: {
        ...existing.preferences,
        ...(updates.preferences || {}),
      },
      subscription: updates.subscription !== undefined ? updates.subscription : existing.subscription,
      updatedAt: new Date().toISOString(),
    };

    const sql = `
      UPDATE users SET
        email = $2,
        password_hash = $3,
        role = $4,
        email_verified = $5,
        verification_token = $6,
        display_name = $7,
        headline = $8,
        bio = $9,
        avatar_url = $10,
        primary_life_focus = $11,
        theme = $12,
        timezone = $13,
        locale = $14,
        week_start_day = $15,
        reduced_motion = $16,
        compact_density = $17,
        daily_reflection_reminder_time = $18,
        notification_channels = $19,
        unlocked_modules = $20,
        subscription_tier = $21,
        subscription_status = $22,
        subscription_current_period_end = $23,
        subscription_cancel_at_period_end = $24,
        stripe_customer_id = $25,
        stripe_subscription_id = $26,
        last_login_at = $27,
        updated_at = $28
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      merged.email.toLowerCase(),
      merged.passwordHash,
      merged.role,
      Boolean(merged.emailVerified),
      merged.verificationToken || null,
      merged.profile.displayName,
      merged.profile.headline || null,
      merged.profile.bio || null,
      merged.profile.avatarUrl || null,
      merged.profile.primaryLifeFocus || null,
      merged.preferences.theme,
      merged.preferences.timezone,
      merged.preferences.locale,
      merged.preferences.weekStartDay,
      Boolean(merged.preferences.reducedMotion),
      Boolean(merged.preferences.compactDensity),
      merged.preferences.dailyReflectionReminderTime || null,
      JSON.stringify(merged.preferences.notificationChannels),
      JSON.stringify(merged.preferences.unlockedModules || []),
      merged.subscription?.tier || 'free',
      merged.subscription?.status || 'active',
      merged.subscription?.currentPeriodEnd ? new Date(merged.subscription.currentPeriodEnd) : null,
      Boolean(merged.subscription?.cancelAtPeriodEnd),
      merged.subscription?.stripeCustomerId || null,
      merged.subscription?.stripeSubscriptionId || null,
      merged.lastLoginAt ? new Date(merged.lastLoginAt) : null,
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  async updateProfile(id: string, profileUpdates: Partial<UserRecord['profile']>): Promise<UserRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const mergedProfile = { ...existing.profile, ...profileUpdates };
    const sql = `
      UPDATE users SET
        display_name = $2,
        headline = $3,
        bio = $4,
        avatar_url = $5,
        primary_life_focus = $6,
        updated_at = $7
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      mergedProfile.displayName || existing.profile.displayName,
      mergedProfile.headline !== undefined ? mergedProfile.headline : existing.profile.headline || null,
      mergedProfile.bio !== undefined ? mergedProfile.bio : existing.profile.bio || null,
      mergedProfile.avatarUrl !== undefined ? mergedProfile.avatarUrl : existing.profile.avatarUrl || null,
      mergedProfile.primaryLifeFocus !== undefined ? mergedProfile.primaryLifeFocus : existing.profile.primaryLifeFocus || null,
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  async updatePreferences(id: string, preferenceUpdates: Partial<UserRecord['preferences']>): Promise<UserRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const mergedPrefs = { ...existing.preferences, ...preferenceUpdates };
    const sql = `
      UPDATE users SET
        theme = $2,
        timezone = $3,
        locale = $4,
        week_start_day = $5,
        reduced_motion = $6,
        compact_density = $7,
        daily_reflection_reminder_time = $8,
        notification_channels = $9,
        unlocked_modules = $10,
        updated_at = $11
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      mergedPrefs.theme || 'system',
      mergedPrefs.timezone || 'UTC',
      mergedPrefs.locale || 'en-US',
      mergedPrefs.weekStartDay !== undefined ? mergedPrefs.weekStartDay : 1,
      Boolean(mergedPrefs.reducedMotion),
      Boolean(mergedPrefs.compactDensity),
      mergedPrefs.dailyReflectionReminderTime || null,
      JSON.stringify(mergedPrefs.notificationChannels || { inApp: true, email: true, dailyDigest: false }),
      JSON.stringify(mergedPrefs.unlockedModules || []),
      new Date(),
    ];

    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return mapUserRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }

  async seedStarterData(userId: string): Promise<void> {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    await withTransaction(async (client) => {
      // 1. Seed tasks
      await client.query(
        `INSERT INTO tasks (
          id, user_id, title, description, priority, status, due_date, estimated_minutes, actual_minutes, tags, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12),
        ($13, $2, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (id) DO NOTHING`,
        [
          `task_${userId}_1`,
          userId,
          'Review quarterly architecture roadmap',
          'Synthesize engineering priorities and key milestone deliverables.',
          'high',
          'todo',
          today,
          60,
          null,
          ['strategy', 'deep_work'],
          now,
          now,
          `task_${userId}_2`,
          'Publish weekly product synthesis',
          'Share cross-domain insights and key progress updates with the team.',
          'medium',
          'completed',
          today,
          45,
          40,
          ['communication'],
          now,
          now,
        ]
      );

      // Subtasks
      await client.query(
        `INSERT INTO task_subtasks (id, task_id, user_id, title, completed, order_index, created_at, updated_at) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $2, $3, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING`,
        [
          `sub_${userId}_1`,
          `task_${userId}_1`,
          userId,
          'Outline core milestones',
          true,
          1,
          now,
          now,
          `sub_${userId}_2`,
          'Align resource capacity',
          false,
          2,
          now,
          now,
        ]
      );

      // 2. Seed habits
      await client.query(
        `INSERT INTO habits (
          id, user_id, name, description, category, frequency, target_per_day, streak_count, best_streak, total_completions, archived, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13),
        ($14, $2, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        ON CONFLICT (id) DO NOTHING`,
        [
          `habit_${userId}_1`,
          userId,
          'Morning Deep Work Block',
          '90 minutes of focused, distraction-free execution.',
          'deep_work',
          'daily',
          1,
          5,
          14,
          28,
          false,
          now,
          now,
          `habit_${userId}_2`,
          'Mindful Movement & Walk',
          '30 minutes outdoors to recharge cognitive energy.',
          'health',
          'daily',
          1,
          12,
          21,
          42,
          false,
          now,
          now,
        ]
      );

      // 3. Seed goals
      const targetDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await client.query(
        `INSERT INTO goals (
          id, user_id, title, description, category, horizon, target_date, progress_percentage, status, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING`,
        [
          `goal_${userId}_1`,
          userId,
          'Architect Enterprise Co-Pilot OS',
          'Ship high-fidelity personal operating system architecture with sub-second resilience.',
          'career',
          'quarterly',
          targetDate,
          65,
          'active',
          now,
          now,
        ]
      );

      // Goal milestones
      await client.query(
        `INSERT INTO goal_milestones (id, goal_id, user_id, title, completed, order_index, created_at, updated_at) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $2, $3, $10, $11, $12, $13, $14),
        ($15, $2, $3, $16, $17, $18, $19, $20)
        ON CONFLICT (id) DO NOTHING`,
        [
          `mil_${userId}_1`,
          `goal_${userId}_1`,
          userId,
          'Security audit & JWT hardening',
          true,
          1,
          now,
          now,
          `mil_${userId}_2`,
          `goal_${userId}_1`,
          userId,
          'Offline-ready data synchronization',
          true,
          2,
          now,
          now,
          `mil_${userId}_3`,
          `goal_${userId}_1`,
          userId,
          'Enterprise RBAC verification',
          false,
          3,
          now,
          now,
        ]
      );

      // 4. Seed finances
      await client.query(
        `INSERT INTO financial_transactions (
          id, user_id, title, amount, minor_units, type, category, date, is_recurring, notes, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING`,
        [
          `tx_${userId}_1`,
          userId,
          'Cloud Infrastructure & Dedicated Servers',
          45.0,
          4500,
          'expense',
          'Software & Tools',
          today,
          true,
          'Monthly isolated container hosting',
          now,
          now,
        ]
      );

      await client.query(
        `INSERT INTO budgets (
          id, user_id, category, limit_amount, limit_minor_units, period, alert_threshold_percentage, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          `b_${userId}_1`,
          userId,
          'Software & Tools',
          150.0,
          15000,
          'monthly',
          80,
          now,
          now,
        ]
      );

      // 5. Seed relationship
      await client.query(
        `INSERT INTO relationships (
          id, user_id, name, relation_type, cadence_days, last_interaction_date, next_due_reminder_date, notes, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING`,
        [
          `rel_${userId}_1`,
          userId,
          'Sarah Chen',
          'friend',
          14,
          new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          'Great conversation about deliberate life engineering.',
          now,
          now,
        ]
      );

      // 6. Seed note
      await client.query(
        `INSERT INTO notes (
          id, user_id, title, content, tags, is_pinned, is_archived, created_at, updated_at
        ) VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          `note_${userId}_1`,
          userId,
          'Principles for Deliberate Living',
          '1. Focus on inputs over outcomes.\n2. Protect deep work blocks.\n3. Keep your commitments high-signal and low-friction.',
          ['principles', 'philosophy'],
          true,
          false,
          now,
          now,
        ]
      );
    });
  }

  async purgeAllUserData(userId: string): Promise<void> {
    // ON DELETE CASCADE removes all child entities
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }

  async exportAllUserData(userId: string): Promise<Record<string, any>> {
    const user = await this.findById(userId);
    if (!user) return {};

    const [
      tasksRes,
      habitsRes,
      habitLogsRes,
      goalsRes,
      txRes,
      budgetsRes,
      reflectionsRes,
      relsRes,
      notesRes,
      memoriesRes,
      notifsRes,
    ] = await Promise.all([
      query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT * FROM habits WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT * FROM habit_logs WHERE user_id = $1 ORDER BY date DESC', [userId]),
      query('SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      query('SELECT * FROM financial_transactions WHERE user_id = $1 ORDER BY date DESC', [userId]),
      query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
      query('SELECT * FROM reflections WHERE user_id = $1 ORDER BY date DESC', [userId]),
      query('SELECT * FROM relationships WHERE user_id = $1', [userId]),
      query('SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC', [userId]),
      query('SELECT * FROM ai_memories WHERE user_id = $1', [userId]),
      query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    ]);

    return {
      user: toPublicUser(user),
      exportedAt: new Date().toISOString(),
      tasks: tasksRes.rows,
      habits: habitsRes.rows,
      habitLogs: habitLogsRes.rows,
      goals: goalsRes.rows,
      transactions: txRes.rows,
      budgets: budgetsRes.rows,
      reflections: reflectionsRes.rows,
      relationships: relsRes.rows,
      notes: notesRes.rows,
      aiMemories: memoriesRes.rows,
      notifications: notifsRes.rows,
    };
  }
}

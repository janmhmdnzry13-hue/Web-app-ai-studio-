-- ============================================================================
-- Migration: 0001_initial_schema.sql
-- Description: Initial PostgreSQL schema migration for ORIGIN sovereign life OS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & PREFERENCES
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'guest')),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(255) NULL,
    display_name VARCHAR(100) NOT NULL,
    headline VARCHAR(200) NULL,
    bio TEXT NULL,
    avatar_url TEXT NULL,
    primary_life_focus VARCHAR(200) NULL,
    theme VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    locale VARCHAR(50) NOT NULL DEFAULT 'en-US',
    week_start_day SMALLINT NOT NULL DEFAULT 1 CHECK (week_start_day IN (0, 1, 6)),
    reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    compact_density BOOLEAN NOT NULL DEFAULT FALSE,
    daily_reflection_reminder_time VARCHAR(20) NULL,
    notification_channels JSONB NOT NULL DEFAULT '{"inApp": true, "email": true, "dailyDigest": false}'::jsonb,
    unlocked_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'lifetime')),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'trialing', 'canceled', 'past_due')),
    subscription_current_period_end TIMESTAMPTZ NULL,
    subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_customer_id VARCHAR(255) NULL,
    stripe_subscription_id VARCHAR(255) NULL,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- 2. NOTE FOLDERS
CREATE TABLE IF NOT EXISTS note_folders (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(50) NULL,
    icon VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_note_folders_user_id ON note_folders(user_id);

-- 3. GOALS
CREATE TABLE IF NOT EXISTS goals (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'personal',
    horizon VARCHAR(30) NOT NULL DEFAULT 'annual' CHECK (horizon IN ('quarterly', 'annual', 'multi_year', 'lifetime', 'monthly')),
    target_date DATE NOT NULL,
    progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused', 'archived', 'completed', 'cancelled')),
    success_criteria TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_user_target_date ON goals(user_id, target_date);

-- 4. GOAL MILESTONES
CREATE TABLE IF NOT EXISTS goal_milestones (
    id VARCHAR(100) PRIMARY KEY,
    goal_id VARCHAR(100) NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    target_date DATE NULL,
    completed_at TIMESTAMPTZ NULL,
    weight NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_user_id ON goal_milestones(user_id);

-- 5. TASKS
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id VARCHAR(100) NULL REFERENCES goals(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'blocked', 'completed', 'canceled', 'cancelled')),
    due_date TIMESTAMPTZ NULL,
    scheduled_time VARCHAR(50) NULL,
    estimated_minutes INTEGER NULL CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
    actual_minutes INTEGER NULL CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
    tags TEXT[] NOT NULL DEFAULT '{}',
    completed_at TIMESTAMPTZ NULL,
    recurrence JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id) WHERE goal_id IS NOT NULL;

-- 6. TASK SUBTASKS
CREATE TABLE IF NOT EXISTS task_subtasks (
    id VARCHAR(100) PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_user_id ON task_subtasks(user_id);

-- 7. HABITS
CREATE TABLE IF NOT EXISTS habits (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id VARCHAR(100) NULL REFERENCES goals(id) ON DELETE SET NULL,
    name VARCHAR(300) NOT NULL,
    description TEXT NULL,
    cue TEXT NULL,
    routine TEXT NULL,
    reward TEXT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'health',
    frequency VARCHAR(30) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekends', 'three_times_weekly', 'custom', 'custom_days', 'weekly')),
    target_days INTEGER[] NOT NULL DEFAULT '{}',
    target_per_day INTEGER NOT NULL DEFAULT 1 CHECK (target_per_day > 0),
    target_units NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit VARCHAR(50) NULL DEFAULT 'times',
    unit_label VARCHAR(50) NULL,
    time_of_day VARCHAR(30) NOT NULL DEFAULT 'anytime' CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'anytime')),
    reminder_time VARCHAR(50) NULL,
    streak_count INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    total_completions INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    why TEXT NULL,
    icon VARCHAR(50) NULL,
    color VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_archived ON habits(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_habits_goal_id ON habits(goal_id) WHERE goal_id IS NOT NULL;

-- 8. HABIT LOGS
CREATE TABLE IF NOT EXISTS habit_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    habit_id VARCHAR(100) NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    value NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_habit_logs_user_habit_date UNIQUE (user_id, habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, date);

-- 9. FINANCIAL TRANSACTIONS
CREATE TABLE IF NOT EXISTS financial_transactions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    minor_units BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    payment_method VARCHAR(100) NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    merchant_or_source VARCHAR(200) NULL,
    notes TEXT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_id ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_date ON financial_transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_type ON financial_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_category ON financial_transactions(user_id, category);

-- 10. BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(12, 2) NOT NULL,
    limit_minor_units BIGINT NOT NULL,
    period VARCHAR(30) NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'weekly', 'quarterly', 'annual', 'yearly')),
    month_year VARCHAR(20) NOT NULL DEFAULT 'all',
    alert_threshold_percentage NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_budgets_user_cat_period_month UNIQUE (user_id, category, period, month_year)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets(user_id, category);

-- 11. REFLECTIONS & EMOTIONS
CREATE TABLE IF NOT EXISTS reflections (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    energy_level SMALLINT NOT NULL DEFAULT 5 CHECK (energy_level >= 1 AND energy_level <= 10),
    clarity_level SMALLINT NOT NULL DEFAULT 5 CHECK (clarity_level >= 1 AND clarity_level <= 10),
    stress_level SMALLINT NOT NULL DEFAULT 5 CHECK (stress_level >= 1 AND stress_level <= 10),
    mood SMALLINT NULL CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
    primary_emotion VARCHAR(100) NOT NULL DEFAULT 'neutral',
    journal_entry TEXT NULL,
    reflection TEXT NULL,
    wins TEXT[] NOT NULL DEFAULT '{}',
    gratitudes TEXT[] NOT NULL DEFAULT '{}',
    learnings TEXT[] NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reflections_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user_date ON reflections(user_id, date);

-- 12. RELATIONSHIPS & CRM CONTACTS
CREATE TABLE IF NOT EXISTS relationships (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'friend' CHECK (relation_type IN ('family', 'friend', 'close_friend', 'mentor', 'colleague', 'partner', 'community', 'network', 'client', 'other')),
    cadence_days INTEGER NOT NULL DEFAULT 30 CHECK (cadence_days > 0),
    last_interaction_date DATE NULL,
    next_due_reminder_date DATE NULL,
    notes TEXT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_user_next_reminder ON relationships(user_id, next_due_reminder_date);

-- 13. RELATIONSHIP IMPORTANT DATES
CREATE TABLE IF NOT EXISTS relationship_important_dates (
    id VARCHAR(100) PRIMARY KEY,
    relationship_id VARCHAR(100) NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    date VARCHAR(50) NOT NULL,
    recurring_yearly BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_dates_relationship_id ON relationship_important_dates(relationship_id);
CREATE INDEX IF NOT EXISTS idx_rel_dates_user_id ON relationship_important_dates(user_id);

-- 14. CONTACT INTERACTIONS
CREATE TABLE IF NOT EXISTS contact_interactions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id VARCHAR(100) NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('in_person', 'call', 'video', 'message', 'email', 'letter_gift', 'shared_activity')),
    notes TEXT NULL,
    energy_impact VARCHAR(30) NULL CHECK (energy_impact IS NULL OR energy_impact IN ('energizing', 'neutral', 'draining')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_user_id ON contact_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_id ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_user_date ON contact_interactions(user_id, date);

-- 15. NOTES & KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS notes (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id VARCHAR(100) NULL REFERENCES note_folders(id) ON DELETE SET NULL,
    linked_goal_id VARCHAR(100) NULL REFERENCES goals(id) ON DELETE SET NULL,
    linked_task_id VARCHAR(100) NULL REFERENCES tasks(id) ON DELETE SET NULL,
    title VARCHAR(300) NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    plain_text_summary TEXT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    word_count INTEGER NOT NULL DEFAULT 0,
    linked_note_ids TEXT[] NOT NULL DEFAULT '{}',
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_folder ON notes(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_user_archived ON notes(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_notes_linked_goal_id ON notes(linked_goal_id) WHERE linked_goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_linked_task_id ON notes(linked_task_id) WHERE linked_task_id IS NOT NULL;

-- 16. AI MEMORIES
CREATE TABLE IF NOT EXISTS ai_memories (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(200) NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'preference' CHECK (category IN ('preference', 'routine', 'goal_focus', 'constraint', 'wellness', 'financial', 'planning', 'general')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_memories_user_key UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user_id ON ai_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_category ON ai_memories(user_id, category);

-- 17. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    ip_address VARCHAR(100) NULL,
    user_agent TEXT NULL,
    metadata JSONB NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);

-- 18. PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pwd_resets_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_pwd_resets_expires_at ON password_reset_tokens(expires_at);

-- 19. SCHEDULED NOTIFICATIONS
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'custom_reminder' CHECK (type IN ('task_reminder', 'habit_reminder', 'goal_deadline', 'relationship_reminder', 'budget_alert', 'system_update', 'system_alert', 'custom_reminder')),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'delivered', 'canceled', 'failed')),
    delivered_at TIMESTAMPTZ NULL,
    action_url VARCHAR(500) NULL,
    entity_type VARCHAR(50) NULL CHECK (entity_type IS NULL OR entity_type IN ('task', 'habit', 'goal', 'relationship', 'budget', 'system')),
    entity_id VARCHAR(100) NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sched_notifs_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_notifs_status_due ON scheduled_notifications(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_sched_notifs_user_status ON scheduled_notifications(user_id, status);

-- 20. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_notification_id VARCHAR(100) NULL REFERENCES scheduled_notifications(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'system_alert' CHECK (type IN ('task_reminder', 'habit_reminder', 'goal_deadline', 'relationship_reminder', 'budget_alert', 'system_update', 'system_alert', 'custom_reminder')),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    action_url VARCHAR(500) NULL,
    entity_type VARCHAR(50) NULL CHECK (entity_type IS NULL OR entity_type IN ('task', 'habit', 'goal', 'relationship', 'budget', 'system')),
    entity_id VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sched_id ON notifications(scheduled_notification_id) WHERE scheduled_notification_id IS NOT NULL;

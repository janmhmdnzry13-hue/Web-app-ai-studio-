/**
 * ORIGIN System Constants & Module Definitions
 * Defines the planned architecture modules for the Personal Life OS
 */

export interface SystemModuleInfo {
  readonly id: string;
  readonly name: string;
  readonly category: 'core' | 'productivity' | 'wellness' | 'intelligence';
  readonly description: string;
  readonly iconName: string;
  readonly path: string;
  readonly phase: number;
  readonly status: 'foundation_ready' | 'phase_2_planned' | 'phase_3_planned';
}

export const APP_CONSTANTS = Object.freeze({
  NAME: 'ORIGIN',
  TAGLINE: 'Personal Life Operating System',
  VERSION: '0.2.0',
  RELEASE_PHASE: 'Phase 2: Core Domain Implementations',
  STORAGE_KEYS: {
    THEME: 'origin_theme_pref',
    AUTH_TOKEN: 'origin_auth_token',
    USER_SESSION: 'origin_user_session',
    USERS_DB: 'origin_users_registry',
    PASSWORD_RESET_TOKENS: 'origin_pwd_reset_tokens',
    TASKS_PREFIX: 'origin_tasks_',
    GOALS_PREFIX: 'origin_goals_',
    HABITS_PREFIX: 'origin_habits_',
    HABIT_LOGS_PREFIX: 'origin_habit_logs_',
    SIDEBAR_COLLAPSED: 'origin_sidebar_collapsed',
    CONTEXT_PANEL_OPEN: 'origin_context_panel_open',
    ACCESSIBILITY_PREFS: 'origin_a11y_prefs',
  },
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE_SIZE: 20,
});

export const SYSTEM_MODULES: readonly SystemModuleInfo[] = Object.freeze([
  {
    id: 'overview',
    name: 'Overview',
    category: 'core',
    description: 'System dashboard, life balance index, and daily pulse.',
    iconName: 'LayoutDashboard',
    path: '/app',
    phase: 1,
    status: 'foundation_ready',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    category: 'productivity',
    description: 'Contextual task management, priorities, subtasks, and scheduling.',
    iconName: 'CheckSquare',
    path: '/app/tasks',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'goals',
    name: 'Goals',
    category: 'productivity',
    description: 'Hierarchical life objectives, key milestones, and timeline tracking.',
    iconName: 'Target',
    path: '/app/goals',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'habits',
    name: 'Habits',
    category: 'wellness',
    description: 'Atomic habit routines, streaks, completion heatmaps, and frequency cycles.',
    iconName: 'Repeat',
    path: '/app/habits',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'finances',
    name: 'Finances',
    category: 'productivity',
    description: 'Income, expenses, dynamic category budgets, and net cashflow monitoring.',
    iconName: 'Wallet',
    path: '/app/finances',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'emotions',
    name: 'Emotions & Reflections',
    category: 'wellness',
    description: 'Mood logging, circadian energy tracking, and guided evening reflections.',
    iconName: 'HeartHandshake',
    path: '/app/emotions',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'relationships',
    name: 'Relationships',
    category: 'wellness',
    description: 'Personal CRM, cadence reminders, key anniversaries, and interaction notes.',
    iconName: 'Users',
    path: '/app/relationships',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'notes',
    name: 'Notes & Knowledge',
    category: 'productivity',
    description: 'Markdown knowledge base, quick captures, and bidirectional link graph.',
    iconName: 'FileText',
    path: '/app/notes',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'ai',
    name: 'AI Co-Pilot',
    category: 'intelligence',
    description: 'Personalized intelligence, reflection synthesis, and proactive guidance.',
    iconName: 'Sparkles',
    path: '/app/ai',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'insights',
    name: 'Life Insights',
    category: 'intelligence',
    description: 'Cross-module analytics, behavioral patterns, and life momentum scores.',
    iconName: 'Compass',
    path: '/app/insights',
    phase: 2,
    status: 'foundation_ready',
  },
  {
    id: 'architecture',
    name: 'Architecture & Contracts',
    category: 'core',
    description: 'Interactive contract inspector, domain schemas, and foundation status.',
    iconName: 'Code2',
    path: '/app/architecture',
    phase: 1,
    status: 'foundation_ready',
  },
  {
    id: 'settings',
    name: 'Settings & Privacy',
    category: 'core',
    description: 'Theme preferences, accessibility, security, and local data export.',
    iconName: 'Settings',
    path: '/app/settings',
    phase: 1,
    status: 'foundation_ready',
  },
]);

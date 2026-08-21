/**
 * ORIGIN Route Definitions
 * Central route map ensuring strict type safety and consistent navigation paths across the application.
 */

export const ROUTES = Object.freeze({
  PUBLIC: {
    LANDING: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
  },
  PROTECTED: {
    ROOT: '/app',
    DASHBOARD: '/app',
    TASKS: '/app/tasks',
    GOALS: '/app/goals',
    HABITS: '/app/habits',
    FINANCES: '/app/finances',
    EMOTIONS: '/app/emotions',
    RELATIONSHIPS: '/app/relationships',
    NOTES: '/app/notes',
    AI: '/app/ai',
    INSIGHTS: '/app/insights',
    ARCHITECTURE: '/app/architecture',
    SETTINGS: '/app/settings',
  },
  ERRORS: {
    NOT_FOUND: '/404',
    SERVER_ERROR: '/500',
  },
});

export type AppRouteKey = keyof typeof ROUTES.PROTECTED | keyof typeof ROUTES.PUBLIC;

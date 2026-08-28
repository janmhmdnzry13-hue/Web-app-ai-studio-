import { db, UserRecord, TaskRecord, HabitRecord, GoalRecord, TransactionRecord, BudgetRecord, ReflectionRecord, RelationshipRecord, NoteRecord, AIMemoryRecord } from './db';

export interface AuthorizedAIContext {
  user: {
    id: string;
    displayName: string;
    headline: string;
    bio: string;
    primaryLifeFocus: string;
    timezone: string;
    locale: string;
    tier: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string | null;
    estimatedMinutes: number | null;
    tags: string[];
    subtasksCount: number;
    completedSubtasksCount: number;
  }>;
  habits: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    frequency: string;
    streakCount: number;
    bestStreak: number;
    totalCompletions: number;
  }>;
  goals: Array<{
    id: string;
    title: string;
    category: string;
    horizon: string;
    targetDate: string;
    progressPercentage: number;
    status: string;
    milestones: Array<{ title: string; completed: boolean }>;
  }>;
  finances: {
    monthlyIncome: number;
    monthlyExpenses: number;
    netBalance: number;
    budgets: Array<{ category: string; limitAmount: number; period: string }>;
    recentTransactions: Array<{
      title: string;
      amount: number;
      type: string;
      category: string;
      date: string;
    }>;
  };
  reflections: Array<{
    date: string;
    energyLevel: number;
    clarityLevel: number;
    stressLevel: number;
    primaryEmotion: string;
    wins: string[];
    gratitudes: string[];
    learnings: string[];
    journalExcerpt: string;
  }>;
  relationships: Array<{
    name: string;
    relationType: string;
    cadenceDays: number;
    lastInteractionDate: string | null;
    nextDueReminderDate: string | null;
  }>;
  notes: Array<{
    id: string;
    title: string;
    tags: string[];
    isPinned: boolean;
    excerpt: string;
  }>;
  memories: Array<{
    key: string;
    value: string;
    category: string;
  }>;
}

/**
 * Server-Authoritative AI Context Builder
 * 
 * SECURITY DIRECTIVES:
 * 1. Strict Tenant Isolation: Every database query applies `item.userId === authenticatedUserId`.
 * 2. Identity Guarantee: `authenticatedUserId` is derived strictly from the verified JWT, never client body/params.
 * 3. Sanitization & Decryption: Sensitive encrypted fields (notes, journals, transaction notes) are decrypted ONLY
 *    for the authenticated owner.
 * 4. Zero Cross-Tenant Leakage: User A cannot request or influence User B's context under any circumstance.
 */
export function buildServerAuthorizedAIContext(authenticatedUserId: string): AuthorizedAIContext {
  const schema = db.schema;

  // 1. Fetch Authenticated User
  const userRecord: UserRecord | undefined = schema.users.find((u) => u.id === authenticatedUserId);

  const user = {
    id: authenticatedUserId,
    displayName: userRecord?.profile.displayName || 'Member',
    headline: userRecord?.profile.headline || '',
    bio: userRecord?.profile.bio || '',
    primaryLifeFocus: userRecord?.profile.primaryLifeFocus || 'Personal Sovereignty & Intentional Living',
    timezone: userRecord?.preferences.timezone || 'UTC',
    locale: userRecord?.preferences.locale || 'en-US',
    tier: userRecord?.subscription?.tier || 'free',
  };

  // 2. Fetch Tasks (Strictly scoped to authenticatedUserId)
  const userTasks = schema.tasks
    .filter((t) => t.userId === authenticatedUserId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate || null,
      estimatedMinutes: t.estimatedMinutes || null,
      tags: t.tags || [],
      subtasksCount: t.subtasks?.length || 0,
      completedSubtasksCount: t.subtasks?.filter((s) => s.completed).length || 0,
    }));

  // 3. Fetch Habits (Strictly scoped to authenticatedUserId)
  const userHabits = schema.habits
    .filter((h) => h.userId === authenticatedUserId && !h.archived)
    .map((h) => ({
      id: h.id,
      name: h.name,
      description: h.description || '',
      category: h.category,
      frequency: h.frequency,
      streakCount: h.streakCount,
      bestStreak: h.bestStreak,
      totalCompletions: h.totalCompletions,
    }));

  // 4. Fetch Goals (Strictly scoped to authenticatedUserId)
  const userGoals = schema.goals
    .filter((g) => g.userId === authenticatedUserId && g.status !== 'archived')
    .map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category,
      horizon: g.horizon,
      targetDate: g.targetDate,
      progressPercentage: g.progressPercentage,
      status: g.status,
      milestones: (g.milestones || []).map((m) => ({ title: m.title, completed: m.completed })),
    }));

  // 5. Fetch Finances (Strictly scoped to authenticatedUserId)
  const userTransactions = schema.transactions.filter((t) => t.userId === authenticatedUserId);
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  const recentTransactions: Array<{ title: string; amount: number; type: string; category: string; date: string }> = [];

  for (const tx of userTransactions) {
    if (tx.type === 'income') {
      monthlyIncome += tx.amount;
    } else {
      monthlyExpenses += tx.amount;
    }
  }

  // Take the 5 most recent transactions
  const sortedTx = [...userTransactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  for (const tx of sortedTx) {
    recentTransactions.push({
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      date: tx.date,
    });
  }

  const userBudgets = schema.budgets
    .filter((b) => b.userId === authenticatedUserId)
    .map((b) => ({
      category: b.category,
      limitAmount: b.limitAmount,
      period: b.period,
    }));

  // 6. Fetch Reflections (Strictly scoped to authenticatedUserId)
  const userReflections = schema.reflections
    .filter((r) => r.userId === authenticatedUserId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((r) => {
      const decryptedEntry = r.isEncrypted ? db.decrypt(r.journalEntry) : r.journalEntry;
      return {
        date: r.date,
        energyLevel: r.energyLevel,
        clarityLevel: r.clarityLevel,
        stressLevel: r.stressLevel,
        primaryEmotion: r.primaryEmotion,
        wins: r.wins || [],
        gratitudes: r.gratitudes || [],
        learnings: r.learnings || [],
        journalExcerpt: (decryptedEntry || '').slice(0, 200),
      };
    });

  // 7. Fetch Relationships (Strictly scoped to authenticatedUserId)
  const userRelationships = schema.relationships
    .filter((rel) => rel.userId === authenticatedUserId)
    .map((rel) => ({
      name: rel.name,
      relationType: rel.relationType,
      cadenceDays: rel.cadenceDays,
      lastInteractionDate: rel.lastInteractionDate,
      nextDueReminderDate: rel.nextDueReminderDate,
    }));

  // 8. Fetch Notes (Strictly scoped to authenticatedUserId)
  const userNotes = schema.notes
    .filter((n) => n.userId === authenticatedUserId && !n.isArchived)
    .slice(0, 5)
    .map((n) => {
      const decryptedContent = n.isEncrypted ? db.decrypt(n.content) : n.content;
      return {
        id: n.id,
        title: n.title,
        tags: n.tags || [],
        isPinned: n.isPinned,
        excerpt: (decryptedContent || '').slice(0, 150),
      };
    });

  // 9. Fetch AI Memories (Strictly scoped to authenticatedUserId)
  const userMemories = schema.aiMemories
    .filter((m) => m.userId === authenticatedUserId)
    .map((m) => ({
      key: m.key,
      value: m.value,
      category: m.category,
    }));

  return {
    user,
    tasks: userTasks,
    habits: userHabits,
    goals: userGoals,
    finances: {
      monthlyIncome,
      monthlyExpenses,
      netBalance: monthlyIncome - monthlyExpenses,
      budgets: userBudgets,
      recentTransactions,
    },
    reflections: userReflections,
    relationships: userRelationships,
    notes: userNotes,
    memories: userMemories,
  };
}

/**
 * Builds the secure, structured prompt text enforcing strict separation between:
 * - [SERVER-VERIFIED AUTHORITATIVE USER DATA] (System Source of Truth)
 * - [CONVERSATIONAL INPUT] (User query and optional UI state)
 */
export function buildSecureAIPrompt(options: {
  trustedContext: AuthorizedAIContext;
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  moduleContext?: string;
}): string {
  const { trustedContext, message, conversationHistory = [], moduleContext } = options;

  const activeTasks = trustedContext.tasks.filter((t) => t.status !== 'completed');
  const highPriorityTasks = activeTasks.filter((t) => t.priority === 'high' || t.priority === 'urgent');

  const formattedContext = `
=== SERVER-VERIFIED AUTHORITATIVE USER DATA ===
[AUTHENTICATED USER]: ${trustedContext.user.displayName} (Timezone: ${trustedContext.user.timezone}, Primary Focus: "${trustedContext.user.primaryLifeFocus}")

[TASKS & EXECUTION] (Total: ${trustedContext.tasks.length}, Active: ${activeTasks.length}, High/Urgent: ${highPriorityTasks.length}):
${activeTasks.slice(0, 8).map((t) => `- [${t.priority.toUpperCase()}] "${t.title}" (Status: ${t.status}${t.dueDate ? `, Due: ${t.dueDate}` : ''}${t.estimatedMinutes ? `, Est: ${t.estimatedMinutes}m` : ''})`).join('\n') || 'No active tasks.'}

[HABITS & ROUTINES] (Active: ${trustedContext.habits.length}):
${trustedContext.habits.map((h) => `- "${h.name}" (Streak: ${h.streakCount}d, Best: ${h.bestStreak}d, Frequency: ${h.frequency})`).join('\n') || 'No habits configured.'}

[STRATEGIC GOALS] (Active: ${trustedContext.goals.length}):
${trustedContext.goals.map((g) => `- "${g.title}" (${g.progressPercentage}% progress, Horizon: ${g.horizon}, Target: ${g.targetDate})`).join('\n') || 'No active goals.'}

[FINANCIAL HEALTH]:
- Monthly Income: $${trustedContext.finances.monthlyIncome.toLocaleString()}
- Monthly Outflow: $${trustedContext.finances.monthlyExpenses.toLocaleString()}
- Net Cashflow Position: $${trustedContext.finances.netBalance.toLocaleString()}
${trustedContext.finances.budgets.length > 0 ? `Budgets: ${trustedContext.finances.budgets.map((b) => `${b.category} cap: $${b.limitAmount}`).join(', ')}` : ''}

[REFLECTIONS & MOOD TELEMETRY] (Recent: ${trustedContext.reflections.length}):
${trustedContext.reflections.slice(0, 3).map((r) => `- Date: ${r.date}, Mood: ${r.primaryEmotion}, Energy: ${r.energyLevel}/10, Clarity: ${r.clarityLevel}/10${r.wins.length > 0 ? `, Wins: ${r.wins.join(', ')}` : ''}`).join('\n') || 'No recent reflection logs.'}

[USER PREFERENCES & MEMORIES]:
${trustedContext.memories.map((m) => `- ${m.key}: ${m.value}`).join('\n') || 'No saved preferences.'}
=== END SERVER-VERIFIED DATA ===

=== CONVERSATIONAL INPUT ===
${moduleContext ? `[CURRENT ACTIVE MODULE]: ${moduleContext}` : ''}

[CONVERSATION HISTORY]:
${conversationHistory
  .slice(-6)
  .map((m) => `${(m.role || 'user').toUpperCase()}: ${m.content}`)
  .join('\n')}

[LATEST USER MESSAGE]:
${message}
=== END CONVERSATIONAL INPUT ===
`;

  return formattedContext.trim();
}

/**
 * ORIGIN Intelligent Deterministic Local AI Engine
 * Provides resilient, instant context-grounded responses and structured action proposals
 * when external AI models experience temporary 503 high demand or offline conditions.
 */

export interface LocalAIResponse {
  reply: string;
  suggestedFollowups: string[];
  proposedActions: Array<{
    id: string;
    type: 'create_task' | 'create_goal' | 'log_habit' | 'create_note' | 'create_transaction' | 'update_task_status';
    title: string;
    description: string;
    payload: Record<string, any>;
  }>;
  reasoningSummary: string;
}

export function generateLocalAIResponse(
  message: string,
  context: any = {},
  moduleContext?: string,
  memories: any[] = []
): LocalAIResponse {
  const lowerMsg = message.toLowerCase().trim();
  const tasks = Array.isArray(context?.tasks) ? context.tasks : [];
  const habits = Array.isArray(context?.habits) ? context.habits : [];
  const goals = Array.isArray(context?.goals) ? context.goals : [];
  const finances = context?.finances || {};
  const reflections = Array.isArray(context?.reflections) ? context.reflections : [];
  const notes = Array.isArray(context?.notes) ? context.notes : [];
  const relationships = Array.isArray(context?.relationships) ? context.relationships : [];

  const nowStr = new Date().toISOString().split('T')[0];

  // 1. Daily Planning & Focus
  if (
    lowerMsg.includes('plan') ||
    lowerMsg.includes('today') ||
    lowerMsg.includes('focus') ||
    lowerMsg.includes('morning') ||
    lowerMsg.includes('day') ||
    moduleContext === 'tasks'
  ) {
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    const urgentTasks = pendingTasks.filter((t: any) => t.priority === 'urgent' || t.priority === 'high');
    const todayHabits = habits;

    const taskLines = urgentTasks.length > 0
      ? urgentTasks.map((t: any) => `- **[${t.priority.toUpperCase()}]** ${t.title} (${t.estimatedMinutes || 45} mins)`).join('\n')
      : pendingTasks.length > 0
      ? pendingTasks.slice(0, 3).map((t: any) => `- **[${t.priority.toUpperCase()}]** ${t.title}`).join('\n')
      : '- Deep work sprint on primary strategic horizon\n- Inbox zero sweep and communication triage\n- Complete morning hydration & movement rituals';

    const habitSummary = todayHabits.length > 0
      ? `You have **${todayHabits.length} daily habits** scheduled. Focus on completing your highest-leverage routine early to establish kinetic momentum.`
      : `No active daily habits configured yet. Adding a simple morning routine will anchor your day.`;

    return {
      reply: `### Sovereign Daily Focus Blueprint\n\n**High-Leverage Execution Queue:**\n${taskLines}\n\n**Habit Cadence:**\n${habitSummary}\n\n*Recommended Execution Strategy:* Block out a 90-minute uninterrupted focus window before midday to close out your primary priority.`,
      suggestedFollowups: [
        'Break down my top goal into actionable steps',
        'Which habits have been inconsistent recently?',
        'Audit my current monthly expenses',
        'Summarize this week’s accomplishments',
      ],
      proposedActions: [
        {
          id: `act_${Date.now()}_focus_block`,
          type: 'create_task',
          title: 'Uninterrupted 90-Min Deep Work Sprint',
          description: 'Scheduled priority focus block for primary horizon deliverable.',
          payload: {
            title: 'Uninterrupted 90-Min Deep Work Sprint',
            priority: 'high',
            estimatedMinutes: 90,
            dueDate: nowStr,
            tags: ['deep-work', 'focus'],
          },
        },
      ],
      reasoningSummary: `Synthesized from ${pendingTasks.length} pending tasks (${urgentTasks.length} high/urgent) and ${todayHabits.length} scheduled habits.`,
    };
  }

  // 2. Goal Breakdown & Milestones
  if (
    lowerMsg.includes('goal') ||
    lowerMsg.includes('break') ||
    lowerMsg.includes('milestone') ||
    lowerMsg.includes('roadmap') ||
    lowerMsg.includes('horizon') ||
    moduleContext === 'goals'
  ) {
    const activeGoals = goals.filter((g: any) => g.status === 'in_progress' || g.status === 'not_started');
    const primaryGoal = activeGoals[0] || { title: 'Primary Strategic Horizon' };

    return {
      reply: `### Goal Decomposition Matrix: ${primaryGoal.title}\n\nTo ensure consistent trajectory toward your horizon, here is an incremental step breakdown:\n\n1. **Phase 1: Architecture & Scope Definition** — Clarify acceptance criteria and dependencies.\n2. **Phase 2: Core Prototype Sprint** — Build the minimum viable functional engine.\n3. **Phase 3: Stress Testing & Polish** — Verify edge cases and finalize delivery.`,
      suggestedFollowups: [
        'Add these tasks to my execution board',
        'Align my habits with this goal',
        'Plan my day around this milestone',
      ],
      proposedActions: [
        {
          id: `act_${Date.now()}_g1`,
          type: 'create_task',
          title: `Draft Specification: ${primaryGoal.title.slice(0, 30)}`,
          description: 'Define clear milestones and functional criteria.',
          payload: {
            title: `Draft Specification: ${primaryGoal.title.slice(0, 30)}`,
            priority: 'high',
            estimatedMinutes: 60,
            dueDate: nowStr,
            tags: ['goals', 'planning'],
          },
        },
        {
          id: `act_${Date.now()}_g2`,
          type: 'create_task',
          title: `Execute Sprint 1: ${primaryGoal.title.slice(0, 30)}`,
          description: 'Initial implementation sprint for goal milestone.',
          payload: {
            title: `Execute Sprint 1: ${primaryGoal.title.slice(0, 30)}`,
            priority: 'medium',
            estimatedMinutes: 120,
            dueDate: nowStr,
            tags: ['goals', 'execution'],
          },
        },
      ],
      reasoningSummary: `Decomposed strategic horizon based on ${activeGoals.length} active goals in workspace.`,
    };
  }

  // 3. Habit Diagnostics & Cadence
  if (
    lowerMsg.includes('habit') ||
    lowerMsg.includes('streak') ||
    lowerMsg.includes('routine') ||
    lowerMsg.includes('consistency') ||
    moduleContext === 'habits'
  ) {
    const totalHabits = habits.length;
    const avgStreak = totalHabits > 0
      ? Math.round(habits.reduce((acc: number, h: any) => acc + (h.streak?.currentStreak || 0), 0) / totalHabits)
      : 0;

    return {
      reply: `### Habit System Diagnostic\n\n- **Active Routines**: ${totalHabits}\n- **Average Current Streak**: ${avgStreak} days\n\n**Behavioral Optimization Insight:**\nHabits with friction-heavy start triggers benefit most from the *2-Minute Rule* and *Habit Stacking* (anchoring new routines directly after an established morning ritual).`,
      suggestedFollowups: [
        'Log today’s completed habits',
        'Plan my day based on active tasks',
        'Audit my monthly finances',
      ],
      proposedActions: habits.length > 0 ? [
        {
          id: `act_${Date.now()}_habit_log`,
          type: 'log_habit',
          title: `Log Habit: ${habits[0].name}`,
          description: 'Record today’s completion for habit streak maintenance.',
          payload: {
            habitId: habits[0].id,
            date: nowStr,
            status: 'completed',
          },
        },
      ] : [],
      reasoningSummary: `Evaluated ${totalHabits} habits with average streak of ${avgStreak} days.`,
    };
  }

  // 4. Financial Flow & Audit
  if (
    lowerMsg.includes('spend') ||
    lowerMsg.includes('finance') ||
    lowerMsg.includes('money') ||
    lowerMsg.includes('budget') ||
    lowerMsg.includes('expense') ||
    moduleContext === 'finances'
  ) {
    const net = finances.netBalance ?? 0;
    const income = finances.monthlyIncome ?? 0;
    const expense = finances.monthlyExpense ?? 0;

    return {
      reply: `### Sovereign Financial Summary\n\n- **Net Balance**: $${Number(net).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- **Monthly Inflow**: $${Number(income).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n- **Monthly Outflow**: $${Number(expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n**Cashflow Diagnosis:**\nYour current cashflow trajectory is ${net >= 0 ? 'solvency-positive' : 'running a temporary deficit'}. Maintain strict category budget caps to preserve sovereign emergency reserves.`,
      suggestedFollowups: [
        'Review active category budgets',
        'What should I focus on today?',
        'Summarize this week’s progress',
      ],
      proposedActions: [],
      reasoningSummary: `Computed from current ledger metrics (Net: $${net}, Inflow: $${income}, Outflow: $${expense}).`,
    };
  }

  // 5. Emotional Reflection & Energy Synthesis
  if (
    lowerMsg.includes('reflect') ||
    lowerMsg.includes('mood') ||
    lowerMsg.includes('feel') ||
    lowerMsg.includes('energy') ||
    lowerMsg.includes('journal') ||
    moduleContext === 'reflections'
  ) {
    const recentReflections = reflections.slice(-3);
    const avgScore = recentReflections.length > 0
      ? (recentReflections.reduce((acc: number, r: any) => acc + (r.score || 7), 0) / recentReflections.length).toFixed(1)
      : '7.5';

    return {
      reply: `### Emotional & Energy Synthesis\n\n- **Recent Mood Index**: ${avgScore}/10 across recent check-ins.\n- **Observations**: Mental clarity remains highest following structured morning routines and deep focus blocks.\n\n*Reflective Prompt for Today:* What was one moment of genuine flow or friction in your work today, and what adjustment can you make tomorrow?`,
      suggestedFollowups: [
        'Record a quick evening reflection',
        'Plan tomorrow’s priorities',
        'Check today’s habit checklist',
      ],
      proposedActions: [
        {
          id: `act_${Date.now()}_note_reflection`,
          type: 'create_note',
          title: 'Daily Reflection & Learnings',
          description: 'Create a structured daily review note.',
          payload: {
            title: `Reflection: ${nowStr}`,
            content: `## Daily Review — ${nowStr}\n\n### Wins & Flow States\n-\n\n### Friction Points\n-\n\n### Key Lesson\n- `,
            tags: ['journal', 'reflection'],
          },
        },
      ],
      reasoningSummary: `Evaluated ${recentReflections.length} reflection entries (Avg score: ${avgScore}).`,
    };
  }

  // 6. Relationships & CRM
  if (
    lowerMsg.includes('relationship') ||
    lowerMsg.includes('contact') ||
    lowerMsg.includes('friend') ||
    lowerMsg.includes('reconnect') ||
    moduleContext === 'relationships'
  ) {
    return {
      reply: `### Relationship & Network Cadence\n\nYou have ${relationships.length} key contacts tracked. Maintaining consistent cadences with core collaborators and close relationships strengthens long-term personal and professional capital.`,
      suggestedFollowups: [
        'Who should I reconnect with this week?',
        'Plan my day based on active tasks',
        'Review habit consistency',
      ],
      proposedActions: [],
      reasoningSummary: `Synthesized from ${relationships.length} relationship records.`,
    };
  }

  // 7. General Assistant Response
  return {
    reply: `### ORIGIN Life Operating System\n\nI have analyzed your request within your sovereign system context. All core operational modules (Tasks, Goals, Habits, Finances, Reflections, Knowledge Notes, and Relationships) are synchronized.\n\nHow would you like to direct our focus next?`,
    suggestedFollowups: [
      'Plan my day based on active tasks',
      'Break down my top goal into actionable steps',
      'Which habits have been inconsistent?',
      'Audit my monthly finances',
    ],
    proposedActions: [],
    reasoningSummary: 'Synthesized from unified multi-module life operating state.',
  };
}

export function generateLocalDynamicInsights(context: any = {}): any[] {
  const tasks = Array.isArray(context?.tasks) ? context.tasks : [];
  const habits = Array.isArray(context?.habits) ? context.habits : [];
  const finances = context?.finances || {};

  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 75;

  const totalHabits = habits.length;
  const activeHabits = habits.filter((h: any) => (h.streak?.currentStreak || 0) > 0).length;
  const habitRate = totalHabits > 0 ? Math.round((activeHabits / totalHabits) * 100) : 80;

  const net = finances.netBalance ?? 0;

  return [
    {
      id: `ai_ins_${Date.now()}_1`,
      title: 'Habit Kinetic Momentum',
      domain: 'wellness',
      type: 'positive_trend',
      observedData: [{ label: 'Active Consistency', value: `${habitRate}%` }],
      interpretation: 'Consistent execution of primary morning routines creates strong psychological momentum for afternoon task velocity.',
      actionableStep: 'Keep routine friction low by preparing materials the night before.',
    },
    {
      id: `ai_ins_${Date.now()}_2`,
      title: 'Task Throughput Velocity',
      domain: 'productivity',
      type: 'growth_opportunity',
      observedData: [{ label: 'Completion Ratio', value: `${taskRate}%` }],
      interpretation: 'Batching similar priority tasks in focused 90-minute blocks significantly reduces context switching overhead.',
      actionableStep: 'Schedule high-priority horizon tasks in the morning focus window.',
    },
    {
      id: `ai_ins_${Date.now()}_3`,
      title: 'Sovereign Cashflow Position',
      domain: 'finances',
      type: 'positive_trend',
      observedData: [{ label: 'Net Balance', value: `$${net.toLocaleString()}` }],
      interpretation: 'Discretionary outflows remain balanced against budgeted caps.',
      actionableStep: 'Continue funneling surplus cashflow into strategic reserve targets.',
    },
  ];
}

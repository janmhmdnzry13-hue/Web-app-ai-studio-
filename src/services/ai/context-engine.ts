/**
 * ORIGIN AI Context Engine
 * Selects only the necessary, minimized domain data based on user intent
 */
import { AIContextPayload, AIContextSummary } from '../../types/ai.types';
import { taskService } from '../task.service';
import { goalService } from '../goal.service';
import { habitService, getTodayDateString } from '../habit.service';
import { financeService } from '../finance.service';
import { emotionService } from '../emotion.service';
import { relationshipService } from '../relationship.service';
import { noteService } from '../note.service';

export interface IntentMatch {
  readonly relevantModules: string[];
  readonly reason: string;
}

export class AIContextEngine {
  /**
   * Intelligently determine which ORIGIN modules are relevant to the query
   */
  classifyIntent(message: string, currentModule?: string): IntentMatch {
    const text = message.toLowerCase();
    const modules = new Set<string>();

    // 1. Daily Planning Intent
    if (
      text.includes('plan') ||
      text.includes('today') ||
      text.includes('day') ||
      text.includes('focus') ||
      text.includes('morning') ||
      text.includes('priorit') ||
      text.includes('what should i do')
    ) {
      modules.add('tasks');
      modules.add('habits');
      modules.add('goals');
    }

    // 2. Goal & Milestone Intent
    if (text.includes('goal') || text.includes('milestone') || text.includes('horizon') || text.includes('breakdown') || text.includes('break down') || text.includes('smaller steps')) {
      modules.add('goals');
      modules.add('tasks');
    }

    // 3. Habit & Routine Intent
    if (text.includes('habit') || text.includes('routine') || text.includes('streak') || text.includes('consistent') || text.includes('inconsistent') || text.includes('ritual')) {
      modules.add('habits');
    }

    // 4. Financial Intent
    if (
      text.includes('spend') ||
      text.includes('spent') ||
      text.includes('finance') ||
      text.includes('money') ||
      text.includes('budget') ||
      text.includes('expense') ||
      text.includes('cashflow') ||
      text.includes('cost') ||
      text.includes('transaction')
    ) {
      modules.add('finances');
    }

    // 5. Emotional & Reflection Intent
    if (text.includes('mood') || text.includes('energy') || text.includes('feel') || text.includes('reflect') || text.includes('journal') || text.includes('stress') || text.includes('week summary') || text.includes('summarize my week')) {
      modules.add('emotions');
      modules.add('habits');
      modules.add('tasks');
    }

    // 6. Relationship Intent
    if (text.includes('friend') || text.includes('contact') || text.includes('relationship') || text.includes('call') || text.includes('meet') || text.includes('family') || text.includes('network') || text.includes('crm')) {
      modules.add('relationships');
    }

    // 7. Notes & Knowledge Intent
    if (text.includes('note') || text.includes('knowledge') || text.includes('summarize note') || text.includes('doc') || text.includes('idea')) {
      modules.add('notes');
    }

    // If context is still empty or general query, incorporate active module context or lightweight default
    if (modules.size === 0) {
      if (currentModule && currentModule !== 'general' && currentModule !== 'overview') {
        modules.add(currentModule);
      } else {
        // Lightweight baseline for broad queries
        modules.add('tasks');
        modules.add('habits');
      }
    }

    return {
      relevantModules: Array.from(modules),
      reason: `Selected relevant domains: ${Array.from(modules).join(', ')}`,
    };
  }

  /**
   * Build a strictly minimized, privacy-conscious context payload
   */
  async buildContext(userId: string, message: string, currentModule?: string): Promise<{
    payload: AIContextPayload;
    summary: AIContextSummary;
  }> {
    const { relevantModules } = this.classifyIntent(message, currentModule);
    const todayStr = getTodayDateString();
    const currentMonthStr = new Date().toISOString().substring(0, 7);

    let tasksData: any[] | undefined;
    let goalsData: any[] | undefined;
    let habitsData: any[] | undefined;
    let financesData: any | undefined;
    let emotionsData: any | undefined;
    let relationshipsData: any[] | undefined;
    let notesData: any[] | undefined;

    let itemCount = 0;

    const fetches: Promise<any>[] = [];

    if (relevantModules.includes('tasks')) {
      fetches.push(
        taskService.getTasks(userId).then((res) => {
          if (res.success && res.data) {
            // Keep only non-completed and urgent/high items, max 10 to minimize context size
            const filtered = res.data.items
              .filter((t) => t.status !== 'completed' || t.priority === 'urgent')
              .slice(0, 8)
              .map((t) => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                status: t.status,
                dueDate: t.dueDate,
                estimatedMinutes: t.estimatedMinutes,
              }));
            tasksData = filtered;
            itemCount += filtered.length;
          }
        })
      );
    }

    if (relevantModules.includes('goals')) {
      fetches.push(
        goalService.getGoals(userId).then((res) => {
          if (res.success && res.data) {
            const filtered = res.data
              .filter((g) => g.status === 'active')
              .slice(0, 5)
              .map((g) => ({
                id: g.id,
                title: g.title,
                progressPercentage: g.progressPercentage,
                timeframe: g.timeframe,
                status: g.status,
              }));
            goalsData = filtered;
            itemCount += filtered.length;
          }
        })
      );
    }

    if (relevantModules.includes('habits')) {
      fetches.push(
        Promise.all([habitService.getHabits(userId), habitService.getHabitLogs(userId)]).then(([hRes, lRes]) => {
          if (hRes.success && hRes.data) {
            const logs = lRes.success && lRes.data ? lRes.data : [];
            const filtered = hRes.data
              .filter((h) => !h.isArchived)
              .slice(0, 8)
              .map((h) => ({
                id: h.id,
                name: h.name,
                streak: h.streak.currentStreak,
                isDoneToday: logs.some((l) => l.habitId === h.id && l.date === todayStr && l.targetMet),
                frequency: h.frequency,
              }));
            habitsData = filtered;
            itemCount += filtered.length;
          }
        })
      );
    }

    if (relevantModules.includes('finances')) {
      fetches.push(
        financeService.getMonthlyOverview(userId, currentMonthStr).then((res) => {
          if (res.success && res.data) {
            financesData = {
              netBalance: res.data.netBalance,
              totalIncome: res.data.totalIncome,
              totalExpenses: res.data.totalExpense,
              recentTransactionsSummary: `${res.data.transactionCount} transactions logged in ${currentMonthStr}`,
            };
            itemCount += 1;
          }
        })
      );
    }

    if (relevantModules.includes('emotions')) {
      fetches.push(
        emotionService.getReflections(userId, { limit: 1 }).then((res) => {
          if (res.success && res.data && res.data.length > 0) {
            const latest = res.data[0];
            emotionsData = {
              latestMood: latest.mood,
              latestEnergy: latest.energy,
              primaryEmotion: latest.primaryEmotion,
              recentReflectionDate: latest.date,
            };
            itemCount += 1;
          }
        })
      );
    }

    if (relevantModules.includes('relationships')) {
      fetches.push(
        relationshipService.getRelationships(userId).then((res) => {
          if (res.success && res.data) {
            const filtered = res.data.slice(0, 5).map((r) => ({
              id: r.id,
              name: r.name,
              relationshipType: r.relationshipType,
              nextReminder: r.nextReminder,
            }));
            relationshipsData = filtered;
            itemCount += filtered.length;
          }
        })
      );
    }

    if (relevantModules.includes('notes')) {
      fetches.push(
        noteService.getNotes(userId, { isArchived: false }).then((res) => {
          if (res.success && res.data) {
            const filtered = res.data.slice(0, 5).map((n) => ({
              id: n.id,
              title: n.title,
              tags: n.tags,
            }));
            notesData = filtered;
            itemCount += filtered.length;
          }
        })
      );
    }

    await Promise.all(fetches);

    const payload: AIContextPayload = {
      selectedModules: relevantModules,
      tasks: tasksData,
      goals: goalsData,
      habits: habitsData,
      finances: financesData,
      emotions: emotionsData,
      relationships: relationshipsData,
      notes: notesData,
    };

    const summary: AIContextSummary = {
      modulesUsed: relevantModules,
      summary: `Grounding in ${relevantModules.join(', ')} (${itemCount} active data points minimized)`,
      itemCount,
    };

    return { payload, summary };
  }
}

export const aiContextEngine = new AIContextEngine();

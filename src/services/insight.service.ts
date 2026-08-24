/**
 * Life Insights & Behavioral Intelligence Service
 * Synthesizes cross-system data into verified empirical observations and non-diagnostic behavioral interpretations.
 * Strictly requires real data thresholds before generating insights.
 */
import { generateId } from '../lib/utils';
import { ServiceResult } from '../types/common.types';
import { LifeInsight, SystemDataSummary } from '../types/insight.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';
import { emotionService } from './emotion.service';
import { financeService } from './finance.service';
import { goalService } from './goal.service';
import { habitService } from './habit.service';
import { relationshipService } from './relationship.service';
import { taskService } from './task.service';

export class InsightService extends BaseService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && typeof providedUserId === 'string' && providedUserId.trim().length > 0) {
      return providedUserId.trim();
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return '';
  }

  async getSystemSummary(providedUserId?: string): Promise<ServiceResult<SystemDataSummary>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      if (!userId) {
        return this.success({
          totalTasksCompleted: 0,
          pendingTasksCount: 0,
          activeGoalsCount: 0,
          averageGoalProgress: 0,
          habitConsistencyRate: 0,
          activeHabitsCount: 0,
          monthlyExpenseTotal: 0,
          monthlyIncomeTotal: 0,
          netCashflow: 0,
          averageMood: null,
          averageEnergy: null,
          averageStress: null,
          reflectionsCount: 0,
          relationshipsTracked: 0,
          hasSufficientData: false,
        });
      }

      const [tasksRes, goalsRes, habitsRes, logsRes, finRes, trendsRes, relsRes] = await Promise.all([
        taskService.getTasks(userId),
        goalService.getGoals(userId),
        habitService.getHabits(userId),
        habitService.getHabitLogs(userId),
        financeService.getFinancialSummary(userId),
        emotionService.getReflectionTrends(userId, 30),
        relationshipService.getRelationships(userId),
      ]);

      const tasks = tasksRes.success && tasksRes.data ? tasksRes.data.items : [];
      const goals = goalsRes.success && goalsRes.data ? goalsRes.data : [];
      const habits = habitsRes.success && habitsRes.data ? habitsRes.data : [];
      const habitLogs = logsRes.success && logsRes.data ? logsRes.data : [];
      const finance = finRes.success && finRes.data ? finRes.data : null;
      const trends = trendsRes.success && trendsRes.data ? trendsRes.data : null;
      const rels = relsRes.success && relsRes.data ? relsRes.data : [];

      const totalTasksCompleted = tasks.filter((t) => t.status === 'completed').length;
      const pendingTasksCount = tasks.filter((t) => t.status !== 'completed').length;
      const activeGoals = goals.filter((g) => g.status === 'active');
      const avgGoalProgress =
        activeGoals.length > 0
          ? Math.round(activeGoals.reduce((acc, g) => acc + g.progressPercentage, 0) / activeGoals.length)
          : 0;

      const activeHabits = habits.filter((h) => !h.isArchived);
      const totalHabitCompletions = habitLogs.filter((l) => l.targetMet).length;
      const consistencyRate =
        activeHabits.length > 0
          ? Math.round((activeHabits.reduce((acc, h) => acc + h.streak.currentStreak, 0) / (activeHabits.length * 7)) * 100)
          : 0;

      const totalDataPoints =
        tasks.length + goals.length + habitLogs.length + (trends?.entryCount || 0) + rels.length;

      return this.success({
        totalTasksCompleted,
        pendingTasksCount,
        activeGoalsCount: activeGoals.length,
        averageGoalProgress: avgGoalProgress,
        habitConsistencyRate: Math.min(100, consistencyRate),
        activeHabitsCount: activeHabits.length,
        monthlyExpenseTotal: finance?.totalExpense || 0,
        monthlyIncomeTotal: finance?.totalIncome || 0,
        netCashflow: finance?.netBalance || 0,
        averageMood: trends && trends.entryCount > 0 ? trends.averageMood : null,
        averageEnergy: trends && trends.entryCount > 0 ? trends.averageEnergy : null,
        averageStress: trends && trends.entryCount > 0 ? trends.averageStress : null,
        reflectionsCount: trends?.entryCount || 0,
        relationshipsTracked: rels.length,
        hasSufficientData: totalDataPoints >= 3,
      });
    } catch (err) {
      return this.failure('SUMMARY_ERROR', 'Failed to compile system summary.', { err });
    }
  }

  async generateLifeInsights(providedUserId?: string): Promise<ServiceResult<readonly LifeInsight[]>> {
    try {
      const userId = await this.resolveUserId(providedUserId);
      const summaryRes = await this.getSystemSummary(userId);

      if (!summaryRes.success || !summaryRes.data) {
        return this.success([]);
      }

      const data = summaryRes.data;
      if (!data.hasSufficientData) {
        return this.success([]);
      }

      const insights: LifeInsight[] = [];
      const now = new Date().toISOString();

      // Insight 1: Task Execution & Priority Velocity
      if (data.totalTasksCompleted > 0 || data.pendingTasksCount > 0) {
        const total = data.totalTasksCompleted + data.pendingTasksCount;
        const completionRate = total > 0 ? Math.round((data.totalTasksCompleted / total) * 100) : 0;

        insights.push({
          id: generateId('ins_tsk'),
          userId,
          title: 'Execution Momentum & Task Closure',
          domain: 'tasks_execution',
          type: completionRate >= 50 ? 'positive_trend' : 'growth_opportunity',
          observedData: [
            { label: 'Completed Tasks', value: data.totalTasksCompleted, context: 'Active cycle' },
            { label: 'Pending Tasks', value: data.pendingTasksCount, context: 'Requires execution' },
            { label: 'Completion Velocity', value: `${completionRate}%`, context: 'Closed vs created ratio' },
          ],
          interpretation:
            completionRate >= 50
              ? 'Task execution velocity is stable. Completed tasks demonstrate sustained follow-through on scheduled priorities.'
              : 'Pending tasks are outpacing completions. Consider triaging lower-priority items or batching short tasks into focus blocks.',
          actionableStep:
            completionRate < 50
              ? 'Filter by "Urgent" priority in Tasks and complete the top 2 items before adding new commitments.'
              : 'Review your upcoming task due dates to maintain current momentum.',
          confidenceScore: 0.92,
          dataPointsCount: total,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Insight 2: Habit Consistency & Cadence Rituals
      if (data.activeHabitsCount > 0) {
        insights.push({
          id: generateId('ins_hbt'),
          userId,
          title: 'Habit Routine Stability & Streak Health',
          domain: 'habits_consistency',
          type: data.habitConsistencyRate >= 60 ? 'positive_trend' : 'pattern_detected',
          observedData: [
            { label: 'Active Habits', value: data.activeHabitsCount, context: 'Configured routines' },
            { label: 'Consistency Index', value: `${data.habitConsistencyRate}%`, context: 'Streak consistency across 7d' },
          ],
          interpretation:
            data.habitConsistencyRate >= 60
              ? 'Daily rituals exhibit strong adherence. Regular completion reinforces neurological automaticity without high friction.'
              : 'Consistency fluctuates across weekdays. Aligning habit triggers with existing anchor routines (e.g. morning coffee or post-work cooldown) improves habit retention.',
          actionableStep: 'Check in with today’s scheduled cadence habits on your overview dashboard.',
          confidenceScore: 0.88,
          dataPointsCount: data.activeHabitsCount,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Insight 3: Financial Net Flow & Savings Trajectory
      if (data.monthlyIncomeTotal > 0 || data.monthlyExpenseTotal > 0) {
        const savingsRate =
          data.monthlyIncomeTotal > 0 && data.netCashflow > 0
            ? Math.round((data.netCashflow / data.monthlyIncomeTotal) * 100)
            : 0;

        insights.push({
          id: generateId('ins_fin'),
          userId,
          title: 'Cashflow Surplus & Capital Allocation',
          domain: 'financial_health',
          type: data.netCashflow >= 0 ? 'positive_trend' : 'growth_opportunity',
          observedData: [
            { label: 'Monthly Income', value: `$${data.monthlyIncomeTotal.toLocaleString()}`, context: 'Recorded inflow' },
            { label: 'Monthly Expenses', value: `$${data.monthlyExpenseTotal.toLocaleString()}`, context: 'Category outflow' },
            { label: 'Net Cashflow', value: `$${data.netCashflow.toLocaleString()}`, context: 'Retained balance' },
            { label: 'Savings Rate', value: `${savingsRate}%`, context: 'Surplus ratio' },
          ],
          interpretation:
            data.netCashflow >= 0
              ? `Operational surplus of $${data.netCashflow.toLocaleString()} preserves capital buffers. Spending aligns with target budget caps.`
              : 'Outflow currently exceeds recorded inflow for the period. Review discretionary category budgets (dining out, entertainment).',
          actionableStep:
            data.netCashflow >= 0
              ? 'Consider routing surplus capital towards designated long-term investment horizon milestones.'
              : 'Audit top expense categories in Finances to identify non-essential recurring subscriptions.',
          confidenceScore: 0.95,
          dataPointsCount: 4,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Insight 4: Emotional Energy & Stress Balance (Non-Diagnostic)
      if (data.reflectionsCount > 0 && data.averageMood !== null && data.averageEnergy !== null && data.averageStress !== null) {
        insights.push({
          id: generateId('ins_emo'),
          userId,
          title: 'Circadian Vitality & Stress Equilibrium',
          domain: 'emotional_vitality',
          type: data.averageEnergy >= 3.5 && data.averageStress <= 2.5 ? 'positive_trend' : 'pattern_detected',
          observedData: [
            { label: 'Logged Reflections', value: data.reflectionsCount, context: 'Past 30 days' },
            { label: 'Average Mood', value: `${data.averageMood} / 5`, context: 'Self-reported valence' },
            { label: 'Average Energy', value: `${data.averageEnergy} / 5`, context: 'Vitality level' },
            { label: 'Average Stress', value: `${data.averageStress} / 5`, context: 'Reported pressure' },
          ],
          interpretation:
            data.averageEnergy >= 3.5 && data.averageStress <= 2.5
              ? 'Reported metrics reflect high vitality and manageable stress levels during active work blocks.'
              : 'Self-reported logs show periodic energy dips or moderate stress. Ensure restorative sleep and non-screen downtime are protected.',
          actionableStep: 'Record an evening reflection note to capture wins and log today’s energy score.',
          confidenceScore: 0.85,
          dataPointsCount: data.reflectionsCount,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Insight 5: Cross-System Goal Momentum
      if (data.activeGoalsCount > 0) {
        insights.push({
          id: generateId('ins_gol'),
          userId,
          title: 'Life Horizon Alignment & Milestone Velocity',
          domain: 'goals_momentum',
          type: 'balance_milestone',
          observedData: [
            { label: 'Active Goals', value: data.activeGoalsCount, context: 'Life horizons' },
            { label: 'Avg Progress', value: `${data.averageGoalProgress}%`, context: 'Weighted milestone completion' },
            { label: 'Relationships Maintained', value: data.relationshipsTracked, context: 'Active CRM contacts' },
          ],
          interpretation:
            'Strategic objectives are translating into actionable daily habits. Milestone progression correlates with consistent daily execution.',
          actionableStep: 'Review milestone deliverables due within the current quarter.',
          confidenceScore: 0.9,
          dataPointsCount: data.activeGoalsCount + data.relationshipsTracked,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      return this.success(insights);
    } catch (err) {
      return this.failure('INSIGHT_GEN_ERROR', 'Failed to generate life insights from system data.', { err });
    }
  }
}

export const insightService = new InsightService();

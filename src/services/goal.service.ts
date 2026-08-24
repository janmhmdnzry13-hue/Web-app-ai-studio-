/**
 * Goal Service Contract & Persistent Implementation
 * Manages hierarchical life objectives, milestone progression, weighted completion math, and user isolation.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { ServiceResult } from '../types/common.types';
import { CreateGoalDTO, Goal, Milestone } from '../types/goal.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

export interface IGoalService {
  getGoals(userId?: string): Promise<ServiceResult<readonly Goal[]>>;
  getGoalById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Goal>>;
  createGoal(userIdOrDto: string | CreateGoalDTO, maybeDto?: CreateGoalDTO): Promise<ServiceResult<Goal>>;
  updateGoal(userIdOrId: string, idOrUpdates: string | Partial<Goal>, maybeUpdates?: Partial<Goal>): Promise<ServiceResult<Goal>>;
  updateGoalProgress(userIdOrId: string, idOrProgress: string | number, maybeProgress?: number): Promise<ServiceResult<Goal>>;
  toggleMilestone(userIdOrGoalId: string, goalIdOrMilestoneId: string, maybeMilestoneId?: string): Promise<ServiceResult<Goal>>;
  addMilestone(userIdOrGoalId: string, goalIdOrMilestone: string | Omit<Milestone, 'id' | 'isCompleted'>, maybeMilestone?: Omit<Milestone, 'id' | 'isCompleted'>): Promise<ServiceResult<Goal>>;
  deleteGoal(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>>;
  seedStarterGoals(userId: string): Promise<ServiceResult<Goal[]>>;
}

const STARTER_GOALS: readonly Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Achieve Peak Aerobic Capacity & Vitality Baseline',
    description: 'Build sustainable cardiovascular endurance, Zone 2 mitochondrial density, and biological resilience.',
    category: 'health_vitality',
    timeframe: 'annual',
    status: 'active',
    targetDate: '2026-12-31T23:59:59.000Z',
    progressPercentage: 65,
    milestones: [
      {
        id: 'ms_1',
        title: 'Establish 4x weekly 45-minute Zone 2 baseline for 90 consecutive days',
        isCompleted: true,
        completedAt: '2026-06-15T10:00:00.000Z',
        weight: 35,
      },
      {
        id: 'ms_2',
        title: 'Achieve sub-22 minute 5K threshold aerobic pace test',
        isCompleted: true,
        completedAt: '2026-07-20T09:00:00.000Z',
        weight: 35,
      },
      {
        id: 'ms_3',
        title: 'Sustain resting heart rate below 52 BPM with optimal HRV balance',
        isCompleted: false,
        weight: 30,
      },
    ],
    linkedHabitIds: [],
    successCriteria: ['Resting HR < 52 bpm', 'Zone 2 test > 45 mins at 135 bpm'],
  },
  {
    title: 'Architect & Ship ORIGIN Life OS to 1,000 Early Adopters',
    description: 'Construct a unified, high-craft personal life operating system empowering deliberate human agency.',
    category: 'career_craft',
    timeframe: 'quarterly',
    status: 'active',
    targetDate: '2026-10-31T23:59:59.000Z',
    progressPercentage: 70,
    milestones: [
      {
        id: 'ms_4',
        title: 'Complete System Architecture and Core Domain Foundations',
        isCompleted: true,
        completedAt: '2026-08-01T12:00:00.000Z',
        weight: 30,
      },
      {
        id: 'ms_5',
        title: 'Deploy Production Core Engine (Tasks, Habits, Goals, Finances)',
        isCompleted: true,
        completedAt: '2026-08-21T08:00:00.000Z',
        weight: 40,
      },
      {
        id: 'ms_6',
        title: 'Launch Closed Beta cohort with 1,000 telemetry-free active operators',
        isCompleted: false,
        weight: 30,
      },
    ],
    linkedHabitIds: [],
    successCriteria: ['Zero production crash reports', 'Sub-50ms interaction response time'],
  },
  {
    title: 'Build $100k Liquid Emergency & Tactical Opportunity Vault',
    description: 'Ensure complete sovereign antifragility against macroeconomic shocks and fund high-leverage opportunities.',
    category: 'financial_freedom',
    timeframe: 'multi_year',
    status: 'active',
    targetDate: '2027-06-30T23:59:59.000Z',
    progressPercentage: 80,
    milestones: [
      {
        id: 'ms_7',
        title: 'Automate 35% monthly net income allocation to compounding treasury',
        isCompleted: true,
        completedAt: '2026-03-01T12:00:00.000Z',
        weight: 40,
      },
      {
        id: 'ms_8',
        title: 'Maintain 6 months essential living expenses in high-yield reserve',
        isCompleted: true,
        completedAt: '2026-05-15T12:00:00.000Z',
        weight: 40,
      },
      {
        id: 'ms_9',
        title: 'Cross $100,000 milestone threshold in liquid instruments',
        isCompleted: false,
        weight: 20,
      },
    ],
    linkedHabitIds: [],
    successCriteria: ['Debt-to-income ratio: 0%', 'Liquid runway > 18 months'],
  },
];

export class GoalService extends BaseService implements IGoalService {
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

  private getStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.GOALS_PREFIX}${userId}`;
  }

  private getStoredGoals(userId: string): Goal[] {
    if (!userId) return [];
    const raw = safeStorage.get<Goal[]>(this.getStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      const seeded = STARTER_GOALS.map((sg) => ({
        ...sg,
        id: generateId('gol'),
        userId,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getStorageKey(userId), seeded);
      return seeded;
    }
    return raw;
  }

  private saveStoredGoals(userId: string, goals: Goal[]): void {
    if (!userId) return;
    safeStorage.set(this.getStorageKey(userId), goals);
  }

  async getGoals(userId?: string): Promise<ServiceResult<readonly Goal[]>> {
    try {
      const uid = await this.resolveUserId(userId);
      if (!uid) return this.success([]);
      const goals = this.getStoredGoals(uid);
      return this.success(goals);
    } catch (err) {
      return this.failure('GOAL_FETCH_ERROR', 'Failed to retrieve goals.', { err });
    }
  }

  async getGoalById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Goal>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const goalId = maybeId || userIdOrId;

      const goals = this.getStoredGoals(userId);
      const found = goals.find((g) => g.id === goalId);

      if (!found) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      return this.success(found);
    } catch (err) {
      return this.failure('GOAL_FETCH_ERROR', 'Failed to retrieve goal by ID', { err });
    }
  }

  async createGoal(userIdOrDto: string | CreateGoalDTO, maybeDto?: CreateGoalDTO): Promise<ServiceResult<Goal>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateGoalDTO;

      if (!dto || !dto.title || dto.title.trim().length === 0) {
        return this.failure('GOAL_VALIDATION_ERROR', 'Goal title is required.');
      }
      if (!dto.category) {
        return this.failure('GOAL_VALIDATION_ERROR', 'Goal category is required.');
      }
      if (!dto.targetDate) {
        return this.failure('GOAL_VALIDATION_ERROR', 'Goal target date is required.');
      }

      const goals = this.getStoredGoals(userId);

      const milestones: Milestone[] = (dto.milestones || []).map((m, idx) => ({
        id: generateId('ms'),
        title: m.title.trim(),
        targetDate: m.targetDate,
        isCompleted: false,
        weight: m.weight > 0 ? m.weight : Math.round(100 / Math.max(1, dto.milestones?.length || 1)),
      }));

      const newGoal: Goal = {
        id: generateId('gol'),
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || '',
        category: dto.category,
        timeframe: dto.timeframe || 'quarterly',
        status: 'active',
        targetDate: dto.targetDate,
        progressPercentage: 0,
        milestones,
        linkedHabitIds: [],
        successCriteria: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      goals.unshift(newGoal);
      this.saveStoredGoals(userId, goals);

      return this.success(newGoal);
    } catch (err) {
      return this.failure('GOAL_CREATE_ERROR', 'Failed to create goal.', { err });
    }
  }

  async updateGoal(
    userIdOrId: string,
    idOrUpdates: string | Partial<Goal>,
    maybeUpdates?: Partial<Goal>
  ): Promise<ServiceResult<Goal>> {
    try {
      let userId: string;
      let goalId: string;
      let updates: Partial<Goal>;

      if (maybeUpdates) {
        userId = await this.resolveUserId(userIdOrId);
        goalId = idOrUpdates as string;
        updates = maybeUpdates;
      } else {
        userId = await this.resolveUserId();
        goalId = userIdOrId;
        updates = idOrUpdates as Partial<Goal>;
      }

      const goals = this.getStoredGoals(userId);
      const index = goals.findIndex((g) => g.id === goalId);

      if (index === -1) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const current = goals[index];
      const updatedGoal: Goal = {
        ...current,
        ...updates,
        title: updates.title !== undefined ? updates.title.trim() : current.title,
        updatedAt: new Date().toISOString(),
      };

      goals[index] = updatedGoal;
      this.saveStoredGoals(userId, goals);

      return this.success(updatedGoal);
    } catch (err) {
      return this.failure('GOAL_UPDATE_ERROR', 'Failed to update goal.', { err });
    }
  }

  async updateGoalProgress(
    userIdOrId: string,
    idOrProgress: string | number,
    maybeProgress?: number
  ): Promise<ServiceResult<Goal>> {
    try {
      let userId: string;
      let goalId: string;
      let progress: number;

      if (typeof maybeProgress === 'number') {
        userId = await this.resolveUserId(userIdOrId);
        goalId = idOrProgress as string;
        progress = maybeProgress;
      } else {
        userId = await this.resolveUserId();
        goalId = userIdOrId;
        progress = idOrProgress as number;
      }

      // Strict boundary check: 0 <= progress <= 100
      const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

      const goals = this.getStoredGoals(userId);
      const index = goals.findIndex((g) => g.id === goalId);

      if (index === -1) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const current = goals[index];
      const nextStatus = clampedProgress >= 100 ? 'completed' : current.status === 'completed' ? 'active' : current.status;

      const updatedGoal: Goal = {
        ...current,
        progressPercentage: clampedProgress,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      goals[index] = updatedGoal;
      this.saveStoredGoals(userId, goals);

      return this.success(updatedGoal);
    } catch (err) {
      return this.failure('GOAL_PROGRESS_ERROR', 'Failed to update goal progress.', { err });
    }
  }

  async toggleMilestone(
    userIdOrGoalId: string,
    goalIdOrMilestoneId: string,
    maybeMilestoneId?: string
  ): Promise<ServiceResult<Goal>> {
    try {
      let userId: string;
      let goalId: string;
      let milestoneId: string;

      if (maybeMilestoneId) {
        userId = await this.resolveUserId(userIdOrGoalId);
        goalId = goalIdOrMilestoneId;
        milestoneId = maybeMilestoneId;
      } else {
        userId = await this.resolveUserId();
        goalId = userIdOrGoalId;
        milestoneId = goalIdOrMilestoneId;
      }

      const goals = this.getStoredGoals(userId);
      const goalIndex = goals.findIndex((g) => g.id === goalId);

      if (goalIndex === -1) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const goal = goals[goalIndex];
      const updatedMilestones = goal.milestones.map((m) => {
        if (m.id === milestoneId) {
          const nextCompleted = !m.isCompleted;
          return {
            ...m,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return m;
      });

      // Recalculate progress based on milestone weights
      let totalWeight = 0;
      let completedWeight = 0;

      for (const m of updatedMilestones) {
        totalWeight += m.weight;
        if (m.isCompleted) {
          completedWeight += m.weight;
        }
      }

      const calculatedProgress = totalWeight > 0 ? Math.min(100, Math.round((completedWeight / totalWeight) * 100)) : goal.progressPercentage;
      const nextStatus = calculatedProgress >= 100 ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;

      const updatedGoal: Goal = {
        ...goal,
        milestones: updatedMilestones,
        progressPercentage: calculatedProgress,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      goals[goalIndex] = updatedGoal;
      this.saveStoredGoals(userId, goals);

      return this.success(updatedGoal);
    } catch (err) {
      return this.failure('MILESTONE_TOGGLE_ERROR', 'Failed to toggle milestone.', { err });
    }
  }

  async addMilestone(
    userIdOrGoalId: string,
    goalIdOrMilestone: string | Omit<Milestone, 'id' | 'isCompleted'>,
    maybeMilestone?: Omit<Milestone, 'id' | 'isCompleted'>
  ): Promise<ServiceResult<Goal>> {
    try {
      let userId: string;
      let goalId: string;
      let milestoneData: Omit<Milestone, 'id' | 'isCompleted'>;

      if (maybeMilestone) {
        userId = await this.resolveUserId(userIdOrGoalId);
        goalId = goalIdOrMilestone as string;
        milestoneData = maybeMilestone;
      } else {
        userId = await this.resolveUserId();
        goalId = userIdOrGoalId;
        milestoneData = goalIdOrMilestone as Omit<Milestone, 'id' | 'isCompleted'>;
      }

      const goals = this.getStoredGoals(userId);
      const goalIndex = goals.findIndex((g) => g.id === goalId);

      if (goalIndex === -1) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const goal = goals[goalIndex];
      const newMilestone: Milestone = {
        id: generateId('ms'),
        title: milestoneData.title.trim(),
        targetDate: milestoneData.targetDate,
        weight: milestoneData.weight || 20,
        isCompleted: false,
      };

      const updatedMilestones = [...goal.milestones, newMilestone];

      const updatedGoal: Goal = {
        ...goal,
        milestones: updatedMilestones,
        updatedAt: new Date().toISOString(),
      };

      goals[goalIndex] = updatedGoal;
      this.saveStoredGoals(userId, goals);

      return this.success(updatedGoal);
    } catch (err) {
      return this.failure('MILESTONE_ADD_ERROR', 'Failed to add milestone.', { err });
    }
  }

  async deleteGoal(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const goalId = maybeId || userIdOrId;

      const goals = this.getStoredGoals(userId);
      const filtered = goals.filter((g) => g.id !== goalId);

      if (filtered.length === goals.length) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      this.saveStoredGoals(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('GOAL_DELETE_ERROR', 'Failed to delete goal.', { err });
    }
  }

  async seedStarterGoals(userId: string): Promise<ServiceResult<Goal[]>> {
    try {
      const seeded = STARTER_GOALS.map((sg) => ({
        ...sg,
        id: generateId('gol'),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      this.saveStoredGoals(userId, seeded);
      return this.success(seeded);
    } catch (err) {
      return this.failure('GOAL_SEED_ERROR', 'Failed to seed starter goals.', { err });
    }
  }
}

export const goalService = new GoalService();

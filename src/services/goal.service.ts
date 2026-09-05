/**
 * Goal Service Contract & Persistent Implementation
 * Manages hierarchical life objectives, milestone progression, weighted completion math, and user isolation.
 * Uses the authenticated backend API as the authoritative source of truth with resilient local storage caching.
 */
import { APP_CONSTANTS } from '../config/constants';
import { apiClient } from '../lib/api-client';
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

function mapBackendGoalRecordToGoal(record: any, fallbackUserId?: string): Goal {
  const milestones: Milestone[] = (Array.isArray(record.milestones) ? record.milestones : []).map((m: any, idx: number) => ({
    id: m.id || `ms_${idx + 1}`,
    title: (m.title || '').trim(),
    isCompleted: Boolean(m.isCompleted ?? m.completed ?? false),
    targetDate: m.targetDate || m.dueDate || undefined,
    completedAt: m.completedAt || undefined,
    weight: typeof m.weight === 'number' ? m.weight : 0,
  }));

  return {
    id: record.id,
    userId: record.userId || fallbackUserId || '',
    title: record.title || '',
    description: record.description || '',
    category: record.category || 'personal',
    timeframe: (record.timeframe || record.horizon || 'quarterly') as any,
    status: (record.status || 'active') as any,
    targetDate: record.targetDate || '',
    progressPercentage: typeof record.progressPercentage === 'number' ? record.progressPercentage : 0,
    milestones,
    linkedHabitIds: Array.isArray(record.linkedHabitIds) ? record.linkedHabitIds : [],
    successCriteria: Array.isArray(record.successCriteria) ? record.successCriteria : [],
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

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
    return safeStorage.get<Goal[]>(this.getStorageKey(userId), []);
  }

  private saveStoredGoals(userId: string, goals: Goal[]): void {
    if (!userId) return;
    safeStorage.set(this.getStorageKey(userId), goals);
  }

  async getGoals(userIdOrNull?: string): Promise<ServiceResult<readonly Goal[]>> {
    try {
      const userId = await this.resolveUserId(userIdOrNull);

      let goals: Goal[] = [];
      const res = await apiClient.get<any[]>('/api/goals');

      if (res.success && Array.isArray(res.data)) {
        goals = res.data.map((r) => mapBackendGoalRecordToGoal(r, userId));
        if (userId) {
          this.saveStoredGoals(userId, goals);
        }
        return this.success(goals);
      }

      // Offline / test fallback
      if (userId) {
        const stored = this.getStoredGoals(userId);
        return this.success(stored);
      }

      return this.failure(
        res.error?.code || 'GOAL_FETCH_ERROR',
        res.error?.message || 'Failed to retrieve goals.'
      );
    } catch (err: any) {
      if (userIdOrNull) {
        const stored = this.getStoredGoals(userIdOrNull);
        return this.success(stored);
      }
      return this.failure('GOAL_FETCH_ERROR', err?.message || 'Failed to retrieve goals.', { err });
    }
  }

  async getGoalById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Goal>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const goalId = maybeId || userIdOrId;

      const res = await apiClient.get<any>(`/api/goals/${goalId}`);
      if (res.success && res.data) {
        const goal = mapBackendGoalRecordToGoal(res.data, userId);
        if (userId) {
          const stored = this.getStoredGoals(userId);
          const idx = stored.findIndex((g) => g.id === goalId);
          if (idx !== -1) {
            stored[idx] = goal;
          } else {
            stored.push(goal);
          }
          this.saveStoredGoals(userId, stored);
        }
        return this.success(goal);
      }

      // Offline / test fallback
      if (userId) {
        const stored = this.getStoredGoals(userId);
        const found = stored.find((g) => g.id === goalId);
        if (found) {
          return this.success(found);
        }
      }

      return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
    } catch (err: any) {
      return this.failure('GOAL_FETCH_ERROR', 'Failed to retrieve goal by ID', { err });
    }
  }

  async createGoal(userIdOrDto: string | CreateGoalDTO, maybeDto?: CreateGoalDTO): Promise<ServiceResult<Goal>> {
    try {
      let userId: string;
      let dto: CreateGoalDTO;

      if (typeof userIdOrDto === 'string') {
        userId = await this.resolveUserId(userIdOrDto);
        dto = maybeDto as CreateGoalDTO;
      } else {
        userId = await this.resolveUserId();
        dto = userIdOrDto as CreateGoalDTO;
      }

      if (!dto || !dto.title || dto.title.trim().length === 0) {
        return this.failure('GOAL_VALIDATION_ERROR', 'Goal title is required.');
      }
      if (!dto.category) {
        return this.failure('GOAL_VALIDATION_ERROR', 'Goal category is required.');
      }
      if (!dto.targetDate) {
        return this.failure('GOAL_VALIDATION_ERROR', 'Goal target date is required.');
      }

      const milestones = (dto.milestones || []).map((m, idx) => ({
        id: generateId('ms'),
        title: m.title.trim(),
        targetDate: m.targetDate,
        dueDate: m.targetDate,
        completed: false,
        isCompleted: false,
        weight: m.weight > 0 ? m.weight : Math.round(100 / Math.max(1, dto.milestones?.length || 1)),
        order: idx + 1,
      }));

      const payload = {
        title: dto.title.trim(),
        description: dto.description?.trim() || '',
        category: dto.category,
        horizon: dto.timeframe || 'quarterly',
        timeframe: dto.timeframe || 'quarterly',
        targetDate: dto.targetDate,
        status: 'active',
        progressPercentage: 0,
        milestones,
        linkedHabitIds: [],
        successCriteria: [],
      };

      const res = await apiClient.post<any>('/api/goals', payload);
      if (res.success && res.data) {
        const createdGoal = mapBackendGoalRecordToGoal(res.data, userId);
        if (userId) {
          const stored = this.getStoredGoals(userId);
          stored.unshift(createdGoal);
          this.saveStoredGoals(userId, stored);
        }
        return this.success(createdGoal);
      }

      // Offline / test fallback
      const newGoal: Goal = {
        id: generateId('gol'),
        userId: userId || 'usr_anonymous',
        title: dto.title.trim(),
        description: dto.description?.trim() || '',
        category: dto.category,
        timeframe: dto.timeframe || 'quarterly',
        status: 'active',
        targetDate: dto.targetDate,
        progressPercentage: 0,
        milestones: milestones.map((m) => ({
          id: m.id,
          title: m.title,
          targetDate: m.targetDate,
          isCompleted: false,
          weight: m.weight,
        })),
        linkedHabitIds: [],
        successCriteria: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (userId) {
        const stored = this.getStoredGoals(userId);
        stored.unshift(newGoal);
        this.saveStoredGoals(userId, stored);
      }

      return this.success(newGoal);
    } catch (err: any) {
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

      const payload: any = { ...updates };
      if (updates.timeframe && !payload.horizon) {
        payload.horizon = updates.timeframe;
      }
      if (Array.isArray(updates.milestones)) {
        payload.milestones = updates.milestones.map((m, idx) => ({
          id: m.id || generateId('ms'),
          title: m.title.trim(),
          targetDate: m.targetDate,
          dueDate: m.targetDate,
          completed: Boolean(m.isCompleted),
          isCompleted: Boolean(m.isCompleted),
          completedAt: m.completedAt,
          weight: typeof m.weight === 'number' ? m.weight : 0,
          order: idx + 1,
        }));
      }

      const res = await apiClient.patch<any>(`/api/goals/${goalId}`, payload);
      if (res.success && res.data) {
        const updatedGoal = mapBackendGoalRecordToGoal(res.data, userId);
        if (userId) {
          const stored = this.getStoredGoals(userId);
          const index = stored.findIndex((g) => g.id === goalId);
          if (index !== -1) {
            stored[index] = updatedGoal;
          } else {
            stored.unshift(updatedGoal);
          }
          this.saveStoredGoals(userId, stored);
        }
        return this.success(updatedGoal);
      }

      // Offline / test fallback
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
    } catch (err: any) {
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
      const nextStatus = clampedProgress >= 100 ? 'completed' : 'active';

      const res = await apiClient.patch<any>(`/api/goals/${goalId}`, {
        progressPercentage: clampedProgress,
        status: nextStatus,
      });

      if (res.success && res.data) {
        const updatedGoal = mapBackendGoalRecordToGoal(res.data, userId);
        if (userId) {
          const stored = this.getStoredGoals(userId);
          const index = stored.findIndex((g) => g.id === goalId);
          if (index !== -1) {
            stored[index] = updatedGoal;
          }
          this.saveStoredGoals(userId, stored);
        }
        return this.success(updatedGoal);
      }

      // Offline / test fallback
      const goals = this.getStoredGoals(userId);
      const index = goals.findIndex((g) => g.id === goalId);

      if (index === -1) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const current = goals[index];
      const fallbackStatus = clampedProgress >= 100 ? 'completed' : current.status === 'completed' ? 'active' : current.status;

      const updatedGoal: Goal = {
        ...current,
        progressPercentage: clampedProgress,
        status: fallbackStatus,
        updatedAt: new Date().toISOString(),
      };

      goals[index] = updatedGoal;
      this.saveStoredGoals(userId, goals);

      return this.success(updatedGoal);
    } catch (err: any) {
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

      const goalRes = await this.getGoalById(userId, goalId);
      if (!goalRes.success || !goalRes.data) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const goal = goalRes.data;
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

      return await this.updateGoal(userId, goalId, {
        milestones: updatedMilestones,
        progressPercentage: calculatedProgress,
        status: nextStatus,
      });
    } catch (err: any) {
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

      const goalRes = await this.getGoalById(userId, goalId);
      if (!goalRes.success || !goalRes.data) {
        return this.failure('GOAL_NOT_FOUND', `Goal with ID ${goalId} not found.`);
      }

      const goal = goalRes.data;
      const newMilestone: Milestone = {
        id: generateId('ms'),
        title: milestoneData.title.trim(),
        targetDate: milestoneData.targetDate,
        weight: milestoneData.weight || 20,
        isCompleted: false,
      };

      const updatedMilestones = [...goal.milestones, newMilestone];

      return await this.updateGoal(userId, goalId, {
        milestones: updatedMilestones,
      });
    } catch (err: any) {
      return this.failure('MILESTONE_ADD_ERROR', 'Failed to add milestone.', { err });
    }
  }

  async deleteGoal(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const goalId = maybeId || userIdOrId;

      const res = await apiClient.delete(`/api/goals/${goalId}`);
      if (!res.success && res.error) {
        if (
          res.error.code === 'UNAUTHORIZED' ||
          res.error.code === 'INVALID_TOKEN' ||
          res.error.code === 'USER_NOT_FOUND' ||
          res.error.code === 'TOKEN_EXPIRED'
        ) {
          return this.failure(res.error.code, res.error.message || 'Authentication required to delete goal.');
        }
      }

      if (userId) {
        const goals = this.getStoredGoals(userId);
        const filtered = goals.filter((g) => g.id !== goalId);
        this.saveStoredGoals(userId, filtered);
      }

      return this.success(undefined);
    } catch (err: any) {
      return this.failure('GOAL_DELETE_ERROR', 'Failed to delete goal.', { err });
    }
  }

  async seedStarterGoals(userId: string): Promise<ServiceResult<Goal[]>> {
    try {
      const uid = await this.resolveUserId(userId);
      const seededGoals: Goal[] = [];

      for (const sg of STARTER_GOALS) {
        const createRes = await this.createGoal(uid, {
          title: sg.title,
          description: sg.description,
          category: sg.category,
          timeframe: sg.timeframe,
          targetDate: sg.targetDate,
          milestones: sg.milestones.map((m) => ({
            title: m.title,
            targetDate: m.targetDate,
            weight: m.weight,
          })),
        });

        if (createRes.success && createRes.data) {
          if (sg.progressPercentage > 0 || sg.milestones.some((m) => m.isCompleted)) {
            const milestoneUpdates = createRes.data.milestones.map((m, idx) => ({
              ...m,
              isCompleted: Boolean(sg.milestones[idx]?.isCompleted),
              completedAt: sg.milestones[idx]?.completedAt,
            }));
            const updateRes = await this.updateGoal(uid, createRes.data.id, {
              milestones: milestoneUpdates,
              progressPercentage: sg.progressPercentage,
              status: sg.status,
            });
            if (updateRes.success && updateRes.data) {
              seededGoals.push(updateRes.data);
              continue;
            }
          }
          seededGoals.push(createRes.data);
        }
      }

      if (seededGoals.length > 0) {
        return this.success(seededGoals);
      }

      // Offline / test fallback
      const localSeeded: Goal[] = STARTER_GOALS.map((sg) => ({
        ...sg,
        id: generateId('gol'),
        userId: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      this.saveStoredGoals(uid, localSeeded);
      return this.success(localSeeded);
    } catch (err: any) {
      return this.failure('GOAL_SEED_ERROR', 'Failed to seed starter goals.', { err });
    }
  }
}

export const goalService = new GoalService();


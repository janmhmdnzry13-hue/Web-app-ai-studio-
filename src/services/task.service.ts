/**
 * Task Service Contract & Persistent Implementation
 * Provides robust CRUD, user-data isolation, status transitions, subtasks, search, and filtering.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { generateId } from '../lib/utils';
import { PaginatedResult, PaginationParams, PriorityLevel, ServiceResult } from '../types/common.types';
import { CreateTaskDTO, Subtask, Task, TaskStatus, UpdateTaskDTO } from '../types/task.types';
import { authService } from './auth.service';
import { BaseService } from './base.service';

export interface TaskFilterParams extends Partial<PaginationParams> {
  status?: TaskStatus | 'all';
  priority?: PriorityLevel | 'all';
  search?: string;
  goalId?: string;
  sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'title';
  sortDirection?: 'asc' | 'desc';
}

export interface ITaskService {
  getTasks(userIdOrParams?: string | TaskFilterParams, maybeParams?: TaskFilterParams): Promise<ServiceResult<PaginatedResult<Task>>>;
  getTaskById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Task>>;
  createTask(userIdOrDto: string | CreateTaskDTO, maybeDto?: CreateTaskDTO): Promise<ServiceResult<Task>>;
  updateTask(userIdOrId: string, idOrDto: string | UpdateTaskDTO, maybeDto?: UpdateTaskDTO): Promise<ServiceResult<Task>>;
  deleteTask(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>>;
  toggleSubtask(userIdOrTaskId: string, taskIdOrSubtaskId: string, maybeSubtaskId?: string): Promise<ServiceResult<Task>>;
  seedStarterTasks(userId: string): Promise<ServiceResult<Task[]>>;
}

const STARTER_TASKS: readonly Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'Review System Architecture & Domain Specifications',
    description: 'Verify all 10 domain contracts, user-scoped security, and persistence models.',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    estimatedMinutes: 45,
    actualMinutes: 20,
    tags: ['Architecture', 'Core'],
    subtasks: [
      { id: 'sub_1', title: 'Verify authentication and session token expiry', completed: true, completedAt: new Date().toISOString() },
      { id: 'sub_2', title: 'Validate goal milestone boundary mathematics', completed: true, completedAt: new Date().toISOString() },
      { id: 'sub_3', title: 'Implement habit streak calculation algorithm', completed: false },
    ],
  },
  {
    title: 'Daily 30-Minute Aerobic Zone 2 Cardio',
    description: 'Maintain cardiovascular base and aerobic mitochondrial efficiency.',
    status: 'todo',
    priority: 'high',
    dueDate: new Date().toISOString(),
    estimatedMinutes: 30,
    tags: ['Health', 'Vitality'],
    subtasks: [
      { id: 'sub_4', title: 'Warmup and dynamic mobility stretch', completed: false },
      { id: 'sub_5', title: 'Maintain 130-145 BPM heart rate for 30 minutes', completed: false },
    ],
  },
  {
    title: 'Conduct Monthly Financial Trajectory & Expense Audit',
    description: 'Evaluate category cashflow against target savings and investment allocation.',
    status: 'todo',
    priority: 'medium',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedMinutes: 60,
    tags: ['Finances', 'Quarterly'],
    subtasks: [
      { id: 'sub_6', title: 'Export bank statement CSV', completed: false },
      { id: 'sub_7', title: 'Categorize recurring subscription costs', completed: false },
    ],
  },
  {
    title: 'Read 20 pages of Systems Thinking handbook',
    description: 'Continuous synthesis of feedback loops and emergent behaviors.',
    status: 'completed',
    priority: 'low',
    dueDate: new Date().toISOString(),
    estimatedMinutes: 25,
    actualMinutes: 25,
    completedAt: new Date().toISOString(),
    tags: ['Mind', 'Reading'],
    subtasks: [
      { id: 'sub_8', title: 'Read Chapter 4 on Feedback Delays', completed: true, completedAt: new Date().toISOString() },
      { id: 'sub_9', title: 'Capture key insights into knowledge graph', completed: true, completedAt: new Date().toISOString() },
    ],
  },
];

export class TaskService extends BaseService implements ITaskService {
  private async resolveUserId(providedUserId?: string): Promise<string> {
    if (providedUserId && !providedUserId.includes('@') && providedUserId.startsWith('usr_')) {
      return providedUserId;
    }
    const sessionRes = await authService.getCurrentSession();
    if (sessionRes.data?.user?.id) {
      return sessionRes.data.user.id;
    }
    return 'usr_origin_demo';
  }

  private getStorageKey(userId: string): string {
    return `${APP_CONSTANTS.STORAGE_KEYS.TASKS_PREFIX}${userId}`;
  }

  private getStoredTasks(userId: string): Task[] {
    const raw = safeStorage.get<Task[]>(this.getStorageKey(userId), []);
    if (raw.length === 0 && userId === 'usr_origin_demo') {
      // Auto-seed demo tasks
      const seeded = STARTER_TASKS.map((st) => ({
        ...st,
        id: generateId('tsk'),
        userId,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      safeStorage.set(this.getStorageKey(userId), seeded);
      return seeded;
    }
    return raw;
  }

  private saveStoredTasks(userId: string, tasks: Task[]): void {
    safeStorage.set(this.getStorageKey(userId), tasks);
  }

  async getTasks(
    userIdOrParams?: string | TaskFilterParams,
    maybeParams?: TaskFilterParams
  ): Promise<ServiceResult<PaginatedResult<Task>>> {
    try {
      let userId: string;
      let params: TaskFilterParams = {};

      if (typeof userIdOrParams === 'string') {
        userId = await this.resolveUserId(userIdOrParams);
        params = maybeParams || {};
      } else {
        userId = await this.resolveUserId();
        params = userIdOrParams || {};
      }

      let tasks = this.getStoredTasks(userId);

      // Filter by Status
      if (params.status && params.status !== 'all') {
        tasks = tasks.filter((t) => t.status === params.status);
      }

      // Filter by Priority
      if (params.priority && params.priority !== 'all') {
        tasks = tasks.filter((t) => t.priority === params.priority);
      }

      // Filter by Goal ID
      if (params.goalId) {
        tasks = tasks.filter((t) => t.goalId === params.goalId);
      }

      // Filter by Search text
      if (params.search && params.search.trim()) {
        const query = params.search.toLowerCase().trim();
        tasks = tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query) ||
            t.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      }

      // Sorting
      const sortBy = params.sortBy || 'createdAt';
      const dir = params.sortDirection === 'asc' ? 1 : -1;

      tasks.sort((a, b) => {
        if (sortBy === 'dueDate') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * dir;
        }
        if (sortBy === 'priority') {
          const priorityWeight: Record<PriorityLevel, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
          return (priorityWeight[a.priority] - priorityWeight[b.priority]) * dir;
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title) * dir;
        }
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });

      const total = tasks.length;
      const page = Math.max(1, params.page || 1);
      const limit = params.limit || APP_CONSTANTS.MAX_PAGE_SIZE;
      const startIndex = (page - 1) * limit;
      const paginatedItems = tasks.slice(startIndex, startIndex + limit);

      return this.success({
        items: paginatedItems,
        total,
        page,
        limit,
        hasMore: startIndex + limit < total,
      });
    } catch (err) {
      return this.failure('TASK_FETCH_ERROR', 'Failed to retrieve task records.', { err });
    }
  }

  async getTaskById(userIdOrId: string, maybeId?: string): Promise<ServiceResult<Task>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const taskId = maybeId || userIdOrId;

      const tasks = this.getStoredTasks(userId);
      const found = tasks.find((t) => t.id === taskId);

      if (!found) {
        return this.failure('TASK_NOT_FOUND', `Task with ID ${taskId} not found.`);
      }

      return this.success(found);
    } catch (err) {
      return this.failure('TASK_FETCH_ERROR', 'Error fetching task by ID', { err });
    }
  }

  async createTask(userIdOrDto: string | CreateTaskDTO, maybeDto?: CreateTaskDTO): Promise<ServiceResult<Task>> {
    try {
      const userId = typeof userIdOrDto === 'string' ? await this.resolveUserId(userIdOrDto) : await this.resolveUserId();
      const dto = (typeof userIdOrDto === 'object' ? userIdOrDto : maybeDto) as CreateTaskDTO;

      if (!dto || !dto.title || dto.title.trim().length === 0) {
        return this.failure('TASK_VALIDATION_ERROR', 'Task title is required.');
      }

      const tasks = this.getStoredTasks(userId);
      const newTask: Task = {
        id: generateId('tsk'),
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || '',
        status: 'todo',
        priority: dto.priority || 'medium',
        dueDate: dto.dueDate,
        estimatedMinutes: dto.estimatedMinutes,
        goalId: dto.goalId,
        tags: dto.tags || [],
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      tasks.unshift(newTask);
      this.saveStoredTasks(userId, tasks);

      return this.success(newTask);
    } catch (err) {
      return this.failure('TASK_CREATE_ERROR', 'Failed to create task.', { err });
    }
  }

  async updateTask(
    userIdOrId: string,
    idOrDto: string | UpdateTaskDTO,
    maybeDto?: UpdateTaskDTO
  ): Promise<ServiceResult<Task>> {
    try {
      let userId: string;
      let taskId: string;
      let dto: UpdateTaskDTO;

      if (maybeDto) {
        userId = await this.resolveUserId(userIdOrId);
        taskId = idOrDto as string;
        dto = maybeDto;
      } else {
        userId = await this.resolveUserId();
        taskId = userIdOrId;
        dto = idOrDto as UpdateTaskDTO;
      }

      const tasks = this.getStoredTasks(userId);
      const index = tasks.findIndex((t) => t.id === taskId);

      if (index === -1) {
        return this.failure('TASK_NOT_FOUND', `Task with ID ${taskId} not found.`);
      }

      const current = tasks[index];
      const nextStatus = dto.status || current.status;
      const isNewlyCompleted = nextStatus === 'completed' && current.status !== 'completed';

      const updatedTask: Task = {
        ...current,
        ...dto,
        title: dto.title !== undefined ? dto.title.trim() : current.title,
        status: nextStatus,
        completedAt: isNewlyCompleted ? new Date().toISOString() : nextStatus === 'completed' ? current.completedAt : undefined,
        updatedAt: new Date().toISOString(),
      };

      tasks[index] = updatedTask;
      this.saveStoredTasks(userId, tasks);

      return this.success(updatedTask);
    } catch (err) {
      return this.failure('TASK_UPDATE_ERROR', 'Failed to update task.', { err });
    }
  }

  async deleteTask(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const taskId = maybeId || userIdOrId;

      const tasks = this.getStoredTasks(userId);
      const filtered = tasks.filter((t) => t.id !== taskId);

      if (filtered.length === tasks.length) {
        return this.failure('TASK_NOT_FOUND', `Task with ID ${taskId} not found.`);
      }

      this.saveStoredTasks(userId, filtered);
      return this.success(undefined);
    } catch (err) {
      return this.failure('TASK_DELETE_ERROR', 'Failed to delete task.', { err });
    }
  }

  async toggleSubtask(
    userIdOrTaskId: string,
    taskIdOrSubtaskId: string,
    maybeSubtaskId?: string
  ): Promise<ServiceResult<Task>> {
    try {
      let userId: string;
      let taskId: string;
      let subtaskId: string;

      if (maybeSubtaskId) {
        userId = await this.resolveUserId(userIdOrTaskId);
        taskId = taskIdOrSubtaskId;
        subtaskId = maybeSubtaskId;
      } else {
        userId = await this.resolveUserId();
        taskId = userIdOrTaskId;
        subtaskId = taskIdOrSubtaskId;
      }

      const tasks = this.getStoredTasks(userId);
      const taskIndex = tasks.findIndex((t) => t.id === taskId);

      if (taskIndex === -1) {
        return this.failure('TASK_NOT_FOUND', `Task with ID ${taskId} not found.`);
      }

      const task = tasks[taskIndex];
      const subtasks = task.subtasks.map((s) => {
        if (s.id === subtaskId) {
          const nextCompleted = !s.completed;
          return {
            ...s,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return s;
      });

      const updatedTask: Task = {
        ...task,
        subtasks,
        updatedAt: new Date().toISOString(),
      };

      tasks[taskIndex] = updatedTask;
      this.saveStoredTasks(userId, tasks);

      return this.success(updatedTask);
    } catch (err) {
      return this.failure('SUBTASK_TOGGLE_ERROR', 'Failed to toggle subtask.', { err });
    }
  }

  async seedStarterTasks(userId: string): Promise<ServiceResult<Task[]>> {
    try {
      const seeded = STARTER_TASKS.map((st) => ({
        ...st,
        id: generateId('tsk'),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      this.saveStoredTasks(userId, seeded);
      return this.success(seeded);
    } catch (err) {
      return this.failure('TASK_SEED_ERROR', 'Failed to seed starter tasks.', { err });
    }
  }
}

export const taskService = new TaskService();

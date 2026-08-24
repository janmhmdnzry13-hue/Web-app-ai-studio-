/**
 * Task Service Implementation
 * Communicates with the real server database (/api/tasks) with client-side cache and offline resilience.
 */
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';
import { apiClient } from '../lib/api-client';
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

export class TaskService extends BaseService implements ITaskService {
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
    return `${APP_CONSTANTS.STORAGE_KEYS.TASKS_PREFIX}${userId}`;
  }

  private getStoredTasks(userId: string): Task[] {
    if (!userId) return [];
    return safeStorage.get<Task[]>(this.getStorageKey(userId), []);
  }

  private saveStoredTasks(userId: string, tasks: Task[]): void {
    if (!userId) return;
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

      if (!userId) {
        return this.success({ items: [], total: 0, page: 1, limit: 50, hasMore: false });
      }

      // Try fetching live records from server backend
      let tasks: Task[] = [];
      const res = await apiClient.get<Task[]>('/api/tasks');
      if (res.success && Array.isArray(res.data)) {
        tasks = res.data;
        this.saveStoredTasks(userId, tasks);
      } else {
        tasks = this.getStoredTasks(userId);
      }

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
            t.tags?.some((tag) => tag.toLowerCase().includes(query))
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

      const res = await apiClient.post<Task>('/api/tasks', dto);
      if (res.success && res.data) {
        const tasks = this.getStoredTasks(userId);
        tasks.unshift(res.data);
        this.saveStoredTasks(userId, tasks);
        return this.success(res.data);
      }

      // Offline / error handling fallback
      if (res.error?.code === 'PLAN_LIMIT_REACHED') {
        return this.failure('PLAN_LIMIT_REACHED', res.error.message);
      }

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

      const tasks = this.getStoredTasks(userId);
      tasks.unshift(newTask);
      this.saveStoredTasks(userId, tasks);
      return this.success(newTask);
    } catch (err: any) {
      return this.failure('TASK_CREATE_ERROR', 'Failed to create task record.', { err });
    }
  }

  async updateTask(userIdOrId: string, idOrDto: string | UpdateTaskDTO, maybeDto?: UpdateTaskDTO): Promise<ServiceResult<Task>> {
    try {
      const userId = maybeDto ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const taskId = maybeDto ? (idOrDto as string) : userIdOrId;
      const dto = (maybeDto || idOrDto) as UpdateTaskDTO;

      const res = await apiClient.put<Task>(`/api/tasks/${taskId}`, dto);
      if (res.success && res.data) {
        const tasks = this.getStoredTasks(userId);
        const index = tasks.findIndex((t) => t.id === taskId);
        if (index !== -1) {
          tasks[index] = res.data;
          this.saveStoredTasks(userId, tasks);
        }
        return this.success(res.data);
      }

      // Local fallback
      const tasks = this.getStoredTasks(userId);
      const index = tasks.findIndex((t) => t.id === taskId);
      if (index === -1) {
        return this.failure('TASK_NOT_FOUND', `Task with ID ${taskId} not found.`);
      }

      const updatedTask: Task = {
        ...tasks[index],
        ...dto,
        updatedAt: new Date().toISOString(),
      };

      tasks[index] = updatedTask;
      this.saveStoredTasks(userId, tasks);
      return this.success(updatedTask);
    } catch (err) {
      return this.failure('TASK_UPDATE_ERROR', 'Failed to update task record.', { err });
    }
  }

  async deleteTask(userIdOrId: string, maybeId?: string): Promise<ServiceResult<void>> {
    try {
      const userId = maybeId ? await this.resolveUserId(userIdOrId) : await this.resolveUserId();
      const taskId = maybeId || userIdOrId;

      await apiClient.delete(`/api/tasks/${taskId}`);

      const tasks = this.getStoredTasks(userId);
      const filtered = tasks.filter((t) => t.id !== taskId);
      this.saveStoredTasks(userId, filtered);

      return this.success(undefined);
    } catch (err) {
      return this.failure('TASK_DELETE_ERROR', 'Failed to delete task.', { err });
    }
  }

  async toggleSubtask(userIdOrTaskId: string, taskIdOrSubtaskId: string, maybeSubtaskId?: string): Promise<ServiceResult<Task>> {
    try {
      const userId = maybeSubtaskId ? await this.resolveUserId(userIdOrTaskId) : await this.resolveUserId();
      const taskId = maybeSubtaskId ? taskIdOrSubtaskId : userIdOrTaskId;
      const subtaskId = maybeSubtaskId || taskIdOrSubtaskId;

      const tasks = this.getStoredTasks(userId);
      const task = tasks.find((t) => t.id === taskId);
      if (!task) {
        return this.failure('TASK_NOT_FOUND', `Task with ID ${taskId} not found.`);
      }

      const updatedSubtasks = (task.subtasks || []).map((sub) => {
        if (sub.id === subtaskId) {
          const nextCompleted = !sub.completed;
          return {
            ...sub,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return sub;
      });

      return this.updateTask(userId, taskId, { subtasks: updatedSubtasks });
    } catch (err) {
      return this.failure('TASK_SUBTASK_ERROR', 'Failed to toggle subtask.', { err });
    }
  }

  async seedStarterTasks(userId: string): Promise<ServiceResult<Task[]>> {
    const tasks = this.getStoredTasks(userId);
    return this.success(tasks);
  }
}

export const taskService = new TaskService();

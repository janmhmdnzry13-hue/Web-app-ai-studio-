/**
 * Task Domain Models
 */
import { EntityId, ISODateString, PriorityLevel, UserScopedEntity } from './common.types';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export interface Subtask {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly completedAt?: ISODateString;
}

export interface TaskRecurrence {
  readonly frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  readonly interval: number; // e.g. every 2 weeks
  readonly daysOfWeek?: readonly number[]; // 0-6
  readonly endDate?: ISODateString;
}

export interface Task extends UserScopedEntity {
  readonly title: string;
  readonly description?: string;
  readonly status: TaskStatus;
  readonly priority: PriorityLevel;
  readonly dueDate?: ISODateString;
  readonly estimatedMinutes?: number;
  readonly actualMinutes?: number;
  readonly goalId?: EntityId; // Optional link to a Goal
  readonly tags: readonly string[];
  readonly subtasks: readonly Subtask[];
  readonly recurrence?: TaskRecurrence;
  readonly completedAt?: ISODateString;
}

export interface CreateTaskDTO {
  readonly title: string;
  readonly description?: string;
  readonly priority?: PriorityLevel;
  readonly dueDate?: ISODateString;
  readonly estimatedMinutes?: number;
  readonly goalId?: EntityId;
  readonly tags?: readonly string[];
}

export interface UpdateTaskDTO extends Partial<CreateTaskDTO> {
  readonly status?: TaskStatus;
  readonly actualMinutes?: number;
  readonly subtasks?: readonly Subtask[];
}

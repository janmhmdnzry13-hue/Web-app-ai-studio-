/**
 * ORIGIN AI Action Executor
 * Safely validates and applies proposed mutations to application domain services
 */
import { AIProposedAction } from '../../types/ai.types';
import { ServiceResult } from '../../types/common.types';
import { taskService } from '../task.service';
import { goalService } from '../goal.service';
import { habitService, getTodayDateString } from '../habit.service';
import { noteService } from '../note.service';
import { financeService } from '../finance.service';
import { CreateTaskDTO } from '../../types/task.types';
import { CreateGoalDTO } from '../../types/goal.types';
import { CreateNoteDTO } from '../../types/note.types';
import { CreateTransactionDTO } from '../../types/finance.types';
import { BaseService } from '../base.service';

export class AIActionExecutor extends BaseService {
  /**
   * Validate that the action payload contains required attributes and no dangerous parameters
   */
  validateAction(action: AIProposedAction): { isValid: boolean; error?: string } {
    if (!action || !action.type || !action.payload) {
      return { isValid: false, error: 'Malformed action payload structure.' };
    }

    switch (action.type) {
      case 'create_task': {
        const title = action.payload.title;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return { isValid: false, error: 'Task title is required.' };
        }
        return { isValid: true };
      }

      case 'create_goal': {
        const title = action.payload.title;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return { isValid: false, error: 'Goal title is required.' };
        }
        return { isValid: true };
      }

      case 'log_habit': {
        const habitId = action.payload.habitId;
        if (!habitId || typeof habitId !== 'string') {
          return { isValid: false, error: 'Valid habit ID is required to log completion.' };
        }
        return { isValid: true };
      }

      case 'create_note': {
        const title = action.payload.title;
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return { isValid: false, error: 'Note title is required.' };
        }
        return { isValid: true };
      }

      case 'create_transaction': {
        const amount = action.payload.amount;
        const description = action.payload.description;
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
          return { isValid: false, error: 'Positive transaction amount is required.' };
        }
        if (!description || typeof description !== 'string') {
          return { isValid: false, error: 'Transaction description is required.' };
        }
        return { isValid: true };
      }

      case 'update_task_status': {
        const taskId = action.payload.taskId;
        const status = action.payload.status;
        if (!taskId || typeof taskId !== 'string') {
          return { isValid: false, error: 'Valid task ID is required.' };
        }
        if (!['todo', 'in_progress', 'completed', 'blocked'].includes(status)) {
          return { isValid: false, error: 'Valid task status is required.' };
        }
        return { isValid: true };
      }

      default:
        return { isValid: false, error: `Unsupported action type: ${(action as any).type}` };
    }
  }

  /**
   * Execute an explicitly user-confirmed action against real domain services
   */
  async executeAction(userId: string, action: AIProposedAction): Promise<ServiceResult<{ entityId: string; summary: string }>> {
    const validation = this.validateAction(action);
    if (!validation.isValid) {
      return this.failure('VALIDATION_ERROR', validation.error || 'Action validation failed.');
    }

    try {
      switch (action.type) {
        case 'create_task': {
          const dto: CreateTaskDTO = {
            title: action.payload.title.trim(),
            description: action.payload.description || '',
            priority: action.payload.priority || 'medium',
            estimatedMinutes: action.payload.estimatedMinutes || 30,
            dueDate: action.payload.dueDate,
          };
          const res = await taskService.createTask(userId, dto);
          if (res.success && res.data) {
            return this.success({ entityId: res.data.id, summary: `Created task "${res.data.title}"` });
          }
          return res.error ? this.failure(res.error.code, res.error.message) : this.failure('TASK_CREATE_FAILED', 'Failed to create task.');
        }

        case 'create_goal': {
          const dto: CreateGoalDTO = {
            title: action.payload.title.trim(),
            description: action.payload.description || '',
            category: action.payload.category || 'career_craft',
            timeframe: action.payload.timeframe || 'quarterly',
            targetDate: action.payload.targetDate || new Date(Date.now() + 90 * 86400000).toISOString(),
          };
          const res = await goalService.createGoal(userId, dto);
          if (res.success && res.data) {
            return this.success({ entityId: res.data.id, summary: `Created goal horizon "${res.data.title}"` });
          }
          return res.error ? this.failure(res.error.code, res.error.message) : this.failure('GOAL_CREATE_FAILED', 'Failed to create goal.');
        }

        case 'log_habit': {
          const date = action.payload.date || getTodayDateString();
          const units = action.payload.units || 1;
          const res = await habitService.logHabitCompletion(userId, action.payload.habitId, date, units);
          if (res.success && res.data) {
            return this.success({ entityId: res.data.id, summary: `Logged habit completion for ${date}` });
          }
          return res.error ? this.failure(res.error.code, res.error.message) : this.failure('HABIT_LOG_FAILED', 'Failed to log habit.');
        }

        case 'create_note': {
          const dto: CreateNoteDTO = {
            title: action.payload.title.trim(),
            content: action.payload.content || '',
            tags: Array.isArray(action.payload.tags) ? action.payload.tags : ['ai-generated'],
          };
          const res = await noteService.createNote(userId, dto);
          if (res.success && res.data) {
            return this.success({ entityId: res.data.id, summary: `Created note "${res.data.title}"` });
          }
          return res.error ? this.failure(res.error.code, res.error.message) : this.failure('NOTE_CREATE_FAILED', 'Failed to create note.');
        }

        case 'create_transaction': {
          const dto: CreateTransactionDTO = {
            type: action.payload.type || 'expense',
            amount: action.payload.amount,
            category: action.payload.category || 'other',
            description: action.payload.description.trim(),
            date: action.payload.date || getTodayDateString(),
          };
          const res = await financeService.createTransaction(userId, dto);
          if (res.success && res.data) {
            return this.success({ entityId: res.data.id, summary: `Created ${dto.type} of $${(dto.amount).toLocaleString()}` });
          }
          return res.error ? this.failure(res.error.code, res.error.message) : this.failure('TRANSACTION_CREATE_FAILED', 'Failed to create transaction.');
        }

        case 'update_task_status': {
          const res = await taskService.updateTask(userId, action.payload.taskId, {
            status: action.payload.status,
          });
          if (res.success && res.data) {
            return this.success({ entityId: res.data.id, summary: `Updated task status to "${action.payload.status}"` });
          }
          return res.error ? this.failure(res.error.code, res.error.message) : this.failure('TASK_UPDATE_FAILED', 'Failed to update task status.');
        }

        default:
          return this.failure('UNSUPPORTED_ACTION', 'Unsupported action type.');
      }
    } catch (err: any) {
      return this.failure('EXECUTION_ERROR', err.message || 'Error occurred while executing action.');
    }
  }
}

export const aiActionExecutor = new AIActionExecutor();

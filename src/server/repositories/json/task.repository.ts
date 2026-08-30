import { db, TaskRecord } from '../../db';
import { ITaskRepository, TaskFilterOptions } from '../interfaces';

export class JsonTaskRepository implements ITaskRepository {
  async findByUserId(userId: string, filter?: TaskFilterOptions): Promise<TaskRecord[]> {
    let tasks = db.schema.tasks.filter((t) => t.userId === userId);

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
      if (filter.priority && filter.priority !== 'all') {
        tasks = tasks.filter((t) => t.priority === filter.priority);
      }
      if (filter.goalId) {
        tasks = tasks.filter((t) => t.goalId === filter.goalId);
      }
      if (filter.excludeCanceled) {
        tasks = tasks.filter((t) => t.status !== 'canceled');
      }
      if (filter.search) {
        const query = filter.search.toLowerCase();
        tasks = tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            (t.description && t.description.toLowerCase().includes(query)) ||
            t.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      }
    }

    return tasks.map((t) => ({ ...t }));
  }

  async findById(id: string, userId?: string): Promise<TaskRecord | null> {
    const task = db.schema.tasks.find((t) => t.id === id && (!userId || t.userId === userId));
    return task ? { ...task } : null;
  }

  async create(task: TaskRecord): Promise<TaskRecord> {
    db.schema.tasks.unshift(task);
    await db.save();
    return { ...task };
  }

  async update(id: string, userId: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> {
    const task = db.schema.tasks.find((t) => t.id === id && t.userId === userId);
    if (!task) return null;

    Object.assign(task, updates, {
      id: task.id,
      userId, // Strictly preserve user ownership
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...task };
  }

  async updateStatus(id: string, userId: string, status: TaskRecord['status']): Promise<TaskRecord | null> {
    const task = db.schema.tasks.find((t) => t.id === id && t.userId === userId);
    if (!task) return null;

    task.status = status;
    task.updatedAt = new Date().toISOString();

    await db.save();
    return { ...task };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const initialLen = db.schema.tasks.length;
    db.schema.tasks = db.schema.tasks.filter((t) => !(t.id === id && t.userId === userId));

    if (db.schema.tasks.length !== initialLen) {
      await db.save();
      return true;
    }
    return false;
  }

  async countByUserId(userId: string, filter?: { excludeCanceled?: boolean }): Promise<number> {
    return db.schema.tasks.filter(
      (t) => t.userId === userId && (!filter?.excludeCanceled || t.status !== 'canceled')
    ).length;
  }
}

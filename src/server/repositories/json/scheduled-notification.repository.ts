import { db, ScheduledNotificationRecord } from '../../db';
import { IScheduledNotificationRepository } from '../interfaces';

export class JsonScheduledNotificationRepository implements IScheduledNotificationRepository {
  async findByUserId(userId: string): Promise<ScheduledNotificationRecord[]> {
    return db.schema.scheduledNotifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .map((n) => ({ ...n }));
  }

  async findById(id: string, userId: string): Promise<ScheduledNotificationRecord | null> {
    const item = db.schema.scheduledNotifications.find((n) => n.id === id && n.userId === userId);
    return item ? { ...item } : null;
  }

  async findDue(targetTimeMs: number): Promise<ScheduledNotificationRecord[]> {
    const list = db.schema.scheduledNotifications.filter((item) => {
      if (item.status !== 'scheduled') return false;
      const scheduledTime = new Date(item.scheduledFor).getTime();
      return !Number.isNaN(scheduledTime) && scheduledTime <= targetTimeMs;
    });
    return list;
  }

  async create(record: ScheduledNotificationRecord): Promise<ScheduledNotificationRecord> {
    db.schema.scheduledNotifications.unshift(record);
    await db.save();
    return { ...record };
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<ScheduledNotificationRecord>
  ): Promise<ScheduledNotificationRecord | null> {
    const item = db.schema.scheduledNotifications.find((n) => n.id === id && n.userId === userId);
    if (!item) return null;

    Object.assign(item, updates, {
      id: item.id,
      userId,
      updatedAt: new Date().toISOString(),
    });

    await db.save();
    return { ...item };
  }

  async delete(id: string, userId: string): Promise<ScheduledNotificationRecord | null> {
    const index = db.schema.scheduledNotifications.findIndex((n) => n.id === id && n.userId === userId);
    if (index === -1) return null;

    const [removed] = db.schema.scheduledNotifications.splice(index, 1);
    await db.save();
    return { ...removed };
  }
}

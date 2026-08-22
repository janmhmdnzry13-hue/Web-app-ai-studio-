import { describe, it, expect, beforeEach } from 'vitest';
import { notificationService } from '../notification.service';
import { taskService } from '../task.service';
import { safeStorage } from '../../lib/storage';

describe('NotificationService and System Alerts Evaluation', () => {
  const userId = 'user_test_notif_1';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('evaluates system rules and creates overdue/due task notifications', async () => {
    // Create an overdue urgent task
    await taskService.createTask(userId, {
      title: 'Submit compliance documentation',
      priority: 'urgent',
      dueDate: '2026-08-01',
    });

    const notifsRes = await notificationService.syncAndEvaluateNotifications(userId);
    expect(notifsRes.success).toBe(true);
    expect(notifsRes.data?.length).toBeGreaterThan(0);

    const taskAlert = notifsRes.data?.find((n) => n.type === 'task_reminder');
    expect(taskAlert).toBeDefined();
    expect(taskAlert?.isRead).toBe(false);
  });

  it('manages unread counts, mark as read, and batch mark all read', async () => {
    // Seed notifications
    await notificationService.createNotification(userId, {
      type: 'system_alert',
      title: 'Welcome to Phase 3',
      message: 'Finance and reflection modules unlocked.',
    });

    await notificationService.createNotification(userId, {
      type: 'system_alert',
      title: 'Security Notice',
      message: 'Isolated user session active.',
    });

    const countRes = await notificationService.getUnreadCount(userId);
    expect(countRes.data).toBe(2);

    await notificationService.markAllAsRead(userId);

    const countAfter = await notificationService.getUnreadCount(userId);
    expect(countAfter.data).toBe(0);
  });
});

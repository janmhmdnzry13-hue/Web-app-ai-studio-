/**
 * Notification Service Contract
 */
import { ServiceResult } from '../types/common.types';
import { Notification } from '../types/notification.types';
import { BaseService } from './base.service';

export interface INotificationService {
  getNotifications(): Promise<ServiceResult<readonly Notification[]>>;
  markAsRead(id: string): Promise<ServiceResult<void>>;
  markAllAsRead(): Promise<ServiceResult<void>>;
  getUnreadCount(): Promise<ServiceResult<number>>;
}

export class NotificationService extends BaseService implements INotificationService {
  async getNotifications(): Promise<ServiceResult<readonly Notification[]>> {
    const notifications: readonly Notification[] = [
      {
        id: 'notif_welcome',
        userId: 'usr_origin_demo',
        title: 'ORIGIN Foundation Initialized',
        message: 'Welcome to ORIGIN Phase 1. Clean architecture contracts and system shell are active.',
        type: 'system_update',
        priority: 'medium',
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    return this.success(notifications);
  }

  async markAsRead(_id: string): Promise<ServiceResult<void>> {
    return this.success(undefined);
  }

  async markAllAsRead(): Promise<ServiceResult<void>> {
    return this.success(undefined);
  }

  async getUnreadCount(): Promise<ServiceResult<number>> {
    return this.success(1);
  }
}

export const notificationService = new NotificationService();

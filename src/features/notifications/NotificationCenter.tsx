import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { notificationService } from '../../services/notification.service';
import { Notification, NotificationRuleSettings } from '../../types/notification.types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCheck,
  AlertTriangle,
  Clock,
  Repeat,
  Target,
  Users,
  Wallet,
} from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationRuleSettings>(() =>
    notificationService.getNotificationSettings(user?.id)
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await notificationService.syncAndEvaluateNotifications(user.id);
      if (res.success && res.data) {
        setNotifications([...res.data]);
      }
      setSettings(notificationService.getNotificationSettings(user.id));
    } catch {
      // Silently handle error in notification load
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    if (!user?.id) return;
    await notificationService.markAsRead(user.id, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    await notificationService.markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    success('Cleared Unread', 'All notifications marked as read.');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user?.id) return;
    await notificationService.deleteNotification(user.id, id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleActionClick = (actionUrl?: string, id?: string) => {
    if (id) {
      handleMarkAsRead(id);
    }
    if (actionUrl) {
      onClose();
      navigate(actionUrl);
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (!user?.id) return;
    const res = await notificationService.requestBrowserPermission(user.id);
    if (res.success) {
      if (res.data === 'granted') {
        success('Permission Granted', 'Desktop alert notifications enabled.');
      } else if (res.data === 'denied') {
        info('Permission Denied', 'Browser notifications blocked in browser settings.');
      } else if (res.data === 'unsupported') {
        info('Unsupported', 'Browser notifications not supported in this frame environment.');
      }
      setSettings(notificationService.getNotificationSettings(user.id));
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'task_reminder':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'habit_reminder':
        return <Repeat className="h-4 w-4 text-amber-500" />;
      case 'goal_deadline':
        return <Target className="h-4 w-4 text-purple-500" />;
      case 'relationship_reminder':
        return <Users className="h-4 w-4 text-emerald-500" />;
      case 'budget_alert':
        return <Wallet className="h-4 w-4 text-rose-500" />;
      default:
        return <Bell className="h-4 w-4 text-neutral-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notification & Reminders Center">
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {unreadCount} unread alerts
            </span>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs py-1 h-7"
                leftIcon={<CheckCheck className="h-3 w-3" />}
                onClick={handleMarkAllAsRead}
              >
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Browser Permission Explanatory Banner (User Action Opt-In) */}
        {!settings.browserNotificationsEnabled && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
            <div className="flex items-center gap-2.5">
              <BellRing className="h-4 w-4 text-neutral-500 shrink-0" />
              <span className="text-neutral-600 dark:text-neutral-400">
                Receive browser alerts for urgent tasks & cadence reminders?
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 shrink-0"
              onClick={handleRequestBrowserPermission}
            >
              Enable
            </Button>
          </div>
        )}

        {/* Notifications Stream */}
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400 space-y-2">
            <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-500/60" />
            <p className="font-semibold text-neutral-700 dark:text-neutral-300">All systems up to date</p>
            <p>No pending reminders or threshold alerts.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleActionClick(notif.actionUrl, notif.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  notif.isRead
                    ? 'bg-white dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/60 opacity-80'
                    : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-300 dark:border-neutral-700 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 shadow-xs shrink-0 mt-0.5">
                    {getIconForType(notif.type)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-xs font-bold truncate ${
                          notif.isRead ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5 text-[10px] text-neutral-400">
                      <span className="capitalize">{notif.type.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="p-1 rounded text-neutral-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

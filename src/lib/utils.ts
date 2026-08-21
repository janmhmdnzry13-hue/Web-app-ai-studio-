import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge tailwind classes with conflict resolution and conditional support
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Generate a cryptographically random or timestamp-prefixed ID
 */
export function generateId(prefix = 'orig'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Format ISO date string into human-readable format
 */
export function formatDate(
  isoDate: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
): string {
  if (!isoDate) return '—';
  try {
    const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch {
    return '—';
  }
}

/**
 * Format relative time (e.g. "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(isoDate: string | Date | undefined | null): string {
  if (!isoDate) return '—';
  try {
    const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
    if (isNaN(date.getTime())) return '—';
    
    const diffMs = date.getTime() - Date.now();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (Math.abs(diffDay) >= 1) return rtf.format(diffDay, 'day');
    if (Math.abs(diffHour) >= 1) return rtf.format(diffHour, 'hour');
    if (Math.abs(diffMin) >= 1) return rtf.format(diffMin, 'minute');
    return 'just now';
  } catch {
    return '—';
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Safely truncate text
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

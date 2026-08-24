/**
 * Centralized Timezone-Aware Date & Time Utilities
 * Prevents UTC midnight date-shifting anomalies across timezones.
 */

export type DateOnlyString = string; // YYYY-MM-DD format

/**
 * Returns YYYY-MM-DD formatted string in the specified timezone (or user local timezone)
 */
export function getLocalDateString(date: Date = new Date(), timeZone?: string): DateOnlyString {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's local timezone
 */
export function getTodayDateString(timeZone?: string): DateOnlyString {
  return getLocalDateString(new Date(), timeZone);
}

/**
 * Returns current month formatted as YYYY-MM in the user's local timezone
 */
export function getCurrentMonthString(date: Date = new Date(), timeZone?: string): string {
  const localDate = getLocalDateString(date, timeZone);
  return localDate.substring(0, 7);
}

/**
 * Formats an ISO string or Date into a human-readable date
 */
export function formatDisplayDate(
  isoDate: string | Date | undefined | null,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!isoDate) return '—';
  try {
    const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
    if (isNaN(date.getTime())) return '—';
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...options,
    };
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch {
    return '—';
  }
}

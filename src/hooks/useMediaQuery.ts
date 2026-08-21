import { useEffect, useState } from 'react';

/**
 * Responsive media query hook with SSR protection
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/**
 * Global keyboard shortcut listener
 */
export function useKeyboardShortcut(
  keyCombo: string, // e.g. "k", "meta+k", "ctrl+k", "escape"
  callback: (e: KeyboardEvent) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const combo = keyCombo.toLowerCase();

      if (combo === 'meta+k' || combo === 'ctrl+k' || combo === 'mod+k') {
        if (isMeta && key === 'k') {
          e.preventDefault();
          callback(e);
        }
      } else if (combo === 'escape' && key === 'escape') {
        callback(e);
      } else if (combo === key) {
        callback(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyCombo, callback, enabled]);
}

/**
 * Debounced value hook
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(handler);
  }, [value, delayMs]);

  return debouncedValue;
}

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from '../lib/storage';

interface ShellContextValue {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isContextPanelOpen: boolean;
  toggleContextPanel: () => void;
  setContextPanelOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    return safeStorage.get<boolean>(APP_CONSTANTS.STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
  });

  const [isContextPanelOpen, setContextPanelOpenState] = useState<boolean>(() => {
    return safeStorage.get<boolean>(APP_CONSTANTS.STORAGE_KEYS.CONTEXT_PANEL_OPEN, false);
  });

  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!isSidebarCollapsed);
  }, [isSidebarCollapsed, setSidebarCollapsed]);

  const setContextPanelOpen = useCallback((open: boolean) => {
    setContextPanelOpenState(open);
    safeStorage.set(APP_CONSTANTS.STORAGE_KEYS.CONTEXT_PANEL_OPEN, open);
  }, []);

  const toggleContextPanel = useCallback(() => {
    setContextPanelOpen(!isContextPanelOpen);
  }, [isContextPanelOpen, setContextPanelOpen]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isSidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed,
      isContextPanelOpen,
      toggleContextPanel,
      setContextPanelOpen,
      isCommandPaletteOpen,
      setCommandPaletteOpen,
      isMobileMenuOpen,
      setMobileMenuOpen,
      toggleMobileMenu,
    }),
    [
      isSidebarCollapsed,
      toggleSidebar,
      setSidebarCollapsed,
      isContextPanelOpen,
      toggleContextPanel,
      setContextPanelOpen,
      isCommandPaletteOpen,
      setCommandPaletteOpen,
      isMobileMenuOpen,
      setMobileMenuOpen,
      toggleMobileMenu,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
}

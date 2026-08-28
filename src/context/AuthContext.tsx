import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import {
  AuthSession,
  AuthStatus,
  LoginCredentials,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  PasswordResetResponse,
  Profile,
  SignupPayload,
  User,
  UserPreferences,
} from '../types/user.types';

interface AuthContextValue {
  session: AuthSession | null;
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  signup: (payload: SignupPayload) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  updateUserPreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  requestPasswordReset: (payload: PasswordResetRequestPayload) => Promise<{ success: boolean; data?: PasswordResetResponse; error?: string }>;
  confirmPasswordReset: (payload: PasswordResetConfirmPayload) => Promise<{ success: boolean; message?: string; error?: string }>;
  exportUserData: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('UNAUTHENTICATED');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const res = await authService.getCurrentSession();
        if (!isMounted) return;

        if (res.success && res.data) {
          setSession(res.data);
          setStatus('AUTHENTICATED');
        } else {
          setSession(null);
          const code = res.error?.code;
          if (code === 'TOKEN_EXPIRED') {
            setStatus('TOKEN_EXPIRED');
          } else if (code === 'TOKEN_INVALID') {
            setStatus('TOKEN_INVALID');
          } else if (code === 'NETWORK_ERROR') {
            setStatus('NETWORK_ERROR');
          } else {
            setStatus('UNAUTHENTICATED');
          }
        }
      } catch {
        if (isMounted) {
          setSession(null);
          setStatus('NETWORK_ERROR');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const res = await authService.login(credentials);
      if (res.success && res.data) {
        setSession(res.data);
        setStatus('AUTHENTICATED');
        return { success: true };
      }
      setSession(null);
      setStatus(res.error?.code === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'UNAUTHENTICATED');
      return { success: false, error: res.error?.message || 'Login failed' };
    } catch {
      setSession(null);
      setStatus('NETWORK_ERROR');
      return { success: false, error: 'An unexpected error occurred during login' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    setIsLoading(true);
    try {
      const res = await authService.signup(payload);
      if (res.success && res.data) {
        setSession(res.data);
        setStatus('AUTHENTICATED');
        return { success: true };
      }
      setSession(null);
      setStatus(res.error?.code === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'UNAUTHENTICATED');
      return { success: false, error: res.error?.message || 'Signup failed' };
    } catch {
      setSession(null);
      setStatus('NETWORK_ERROR');
      return { success: false, error: 'An unexpected error occurred during signup' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAsDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authService.createDemoSession();
      if (res.success && res.data) {
        setSession(res.data);
        setStatus('AUTHENTICATED');
      } else {
        setSession(null);
        setStatus('UNAUTHENTICATED');
      }
    } catch {
      setSession(null);
      setStatus('NETWORK_ERROR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setSession(null);
      setStatus('UNAUTHENTICATED');
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (profileUpdates: Partial<Profile>) => {
      if (!session?.user) {
        return { success: false, error: 'No active session' };
      }
      const res = await userService.updateProfile(session.user.id, profileUpdates);
      if (res.success && res.data) {
        setSession((prev) => (prev ? { ...prev, user: res.data! } : null));
        return { success: true };
      }
      return { success: false, error: res.error?.message || 'Failed to update profile' };
    },
    [session]
  );

  const updateUserPreferences = useCallback(
    async (prefs: Partial<UserPreferences>) => {
      if (!session?.user) return;
      const res = await userService.updatePreferences(session.user.id, prefs);
      if (res.success && res.data) {
        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            user: {
              ...prev.user,
              preferences: res.data!,
            },
          };
        });
      }
    },
    [session]
  );

  const requestPasswordReset = useCallback(async (payload: PasswordResetRequestPayload) => {
    try {
      const res = await authService.requestPasswordReset(payload);
      if (res.success && res.data) {
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error?.message || 'Password reset request failed' };
    } catch {
      return { success: false, error: 'Unexpected error during password reset request' };
    }
  }, []);

  const confirmPasswordReset = useCallback(async (payload: PasswordResetConfirmPayload) => {
    try {
      const res = await authService.confirmPasswordReset(payload);
      if (res.success && res.data) {
        return { success: true, message: res.data.message };
      }
      return { success: false, error: res.error?.message || 'Password reset confirmation failed' };
    } catch {
      return { success: false, error: 'Unexpected error resetting password' };
    }
  }, []);

  const exportUserData = useCallback(async () => {
    if (!session?.user?.id) {
      return { success: false, error: 'No authenticated user session found.' };
    }
    try {
      const res = await userService.exportFullUserData(session.user.id);
      if (res.success && res.data) {
        return { success: true, data: res.data };
      }
      return { success: false, error: res.error?.message || 'Export failed.' };
    } catch {
      return { success: false, error: 'Unexpected error during user data export.' };
    }
  }, [session]);

  const deleteAccount = useCallback(async () => {
    if (!session?.user?.id) {
      return { success: false, error: 'No authenticated user session found.' };
    }
    try {
      const res = await userService.deleteAccount(session.user.id);
      if (res.success) {
        setSession(null);
        return { success: true };
      }
      return { success: false, error: res.error?.message || 'Account deletion failed.' };
    } catch {
      return { success: false, error: 'Unexpected error deleting account.' };
    }
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      isAuthenticated: status === 'AUTHENTICATED' && !!session?.token,
      isLoading,
      login,
      signup,
      loginAsDemo,
      logout,
      updateProfile,
      updateUserPreferences,
      requestPasswordReset,
      confirmPasswordReset,
      exportUserData,
      deleteAccount,
    }),
    [
      session,
      status,
      isLoading,
      login,
      signup,
      loginAsDemo,
      logout,
      updateProfile,
      updateUserPreferences,
      requestPasswordReset,
      confirmPasswordReset,
      exportUserData,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

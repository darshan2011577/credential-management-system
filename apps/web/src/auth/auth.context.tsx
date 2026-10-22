import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthContextValue, AuthState } from './auth.types.js';
import { apiGetMe, apiLogin, apiLogout, apiChangePassword } from './auth.api.js';


const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Verify active session on app startup
  const checkAuth = useCallback(async () => {
    try {
      const user = await apiGetMe();
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await apiLogin(email, password);
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMsg,
      }));
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await apiLogout();
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const user = await apiGetMe();
      setState((prev) => ({ ...prev, user }));
    } catch {
      await logout();
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await apiChangePassword(currentPassword, newPassword);
      // Reset auth state as all sessions were invalidated on password change
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Password changed successfully. Please log in with your new password.',
      });
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to change password.';
      return { success: false, error: errorMsg };
    }
  };

  const clearError = (): void => {
    setState((prev) => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshProfile,
        changePassword,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

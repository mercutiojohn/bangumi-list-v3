import { useSnapshot } from 'valtio';
import { userStore, userActions } from '@/stores/user';
import { apiClient } from '@/lib/api';
import type { User } from 'bangumi-list-v3-shared';

// Hook to access user state
export const useUser = () => {
  return useSnapshot(userStore);
};

// Hook for user authentication actions
export const useUserActions = () => {
  const signup = async (email: string, password: string): Promise<void> => {
    await apiClient.request<void>('POST', 'user/signup', undefined, {
      email,
      password,
    });
  };

  const login = async (email: string, password: string, save = true): Promise<void> => {
    const { token } = await apiClient.request<{ token: string }>('POST', 'user/login', undefined, {
      email,
      password,
    });

    apiClient.setCredential(token);
    apiClient.saveCredential(!save);

    // Get user info and update store
    const user = await apiClient.request<User>('GET', 'user/me', undefined, undefined, true);
    userActions.login(user);
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.request<void>('POST', 'user/logout', undefined, undefined, true);
    } finally {
      apiClient.removeCredential();
      userActions.logout();
    }
  };

  const updateUser = async (data: { oldPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.request<void>('PATCH', 'user/me', undefined, data, true);
  };

  const getCurrentUser = async (): Promise<User> => {
    return await apiClient.request<User>('GET', 'user/me', undefined, undefined, true);
  };

  return {
    signup,
    login,
    logout,
    updateUser,
    getCurrentUser,
  };
};

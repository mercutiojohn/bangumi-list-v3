import { proxy } from 'valtio';
import type { User } from 'bangumi-list-v3-shared';

// User Store
export interface UserState {
  isLogin: boolean;
  id: string | null;
  email: string | null;
}

const initialUserState: UserState = {
  isLogin: false,
  id: null,
  email: null,
};

export const userStore = proxy<UserState>(initialUserState);

export const userActions = {
  login: (user: User) => {
    userStore.isLogin = true;
    userStore.id = user.id;
    userStore.email = user.email;
  },
  logout: () => {
    userStore.isLogin = false;
    userStore.id = null;
    userStore.email = null;
  },
};

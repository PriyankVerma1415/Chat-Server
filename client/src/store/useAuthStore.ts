import { create } from 'zustand';
import api from '../services/api';
import { socket } from '../services/socket';

interface User {
  _id: string;
  username: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  bio: string;
  profileCompleted: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    set({ token });
    if (token && get().user) {
      socket.auth = { token };
      if (!socket.connected) {
         socket.connect();
      }
    }
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout failed', e);
    }
    socket.disconnect();
    set({ user: null, token: null });
  },
  initialize: async () => {
    try {
      // Try to refresh the token using the httpOnly cookie
      const { data: refreshData } = await api.post('/auth/refresh');
      set({ token: refreshData.token });
      
      // If successful, fetch user data
      const { data: userData } = await api.get('/auth/me');
      set({ user: userData });

      socket.auth = { token: refreshData.token };
      socket.connect();
      socket.emit('setup', userData);
      
    } catch (error) {
      // Refresh failed or user not found
      set({ user: null, token: null });
    }
  },
}));

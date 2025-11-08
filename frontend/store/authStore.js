// frontend/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../utils/apiClient';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loading: false,

      initAuth: () => {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          const storedUser = localStorage.getItem('user');
          
          if (token && storedUser) {
            try {
              const user = JSON.parse(storedUser);
              set({ user, isAuthenticated: true });
            } catch (error) {
              console.error('Failed to parse stored user:', error);
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            }
          }
        }
      },

      signup: async (data) => {
        try {
          set({ loading: true });
          const response = await authAPI.signup(data);
          return response; // Response is already unwrapped
        } catch (error) {
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      verifyOTP: async (data) => {
        try {
          set({ loading: true });
          const response = await authAPI.verifyOTP(data);
          
          if (response.success) {
            const { token, user } = response.data;
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('token', token);
              localStorage.setItem('user', JSON.stringify(user));
            }
            
            set({ user, isAuthenticated: true });
          }
          
          return response;
        } catch (error) {
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      login: async (data) => {
        try {
          set({ loading: true });
          const response = await authAPI.login(data);
          
          if (response.success) {
            const { token, user } = response.data;
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('token', token);
              localStorage.setItem('user', JSON.stringify(user));
            }
            
            set({ user, isAuthenticated: true });
          }
          
          return response;
        } catch (error) {
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      switchRole: async (newRole) => {
        try {
          set({ loading: true });
          const response = await authAPI.switchRole({ role: newRole });
          
          if (response.success) {
            const user = response.data.user;
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('user', JSON.stringify(user));
            }
            
            set({ user });
          }
          
          return response;
        } catch (error) {
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      getProfile: async () => {
        try {
          set({ loading: true });
          const response = await authAPI.getProfile();
          
          if (response.success) {
            const user = response.data.user;
            
            if (typeof window !== 'undefined') {
              localStorage.setItem('user', JSON.stringify(user));
            }
            
            set({ user, isAuthenticated: true });
          }
          
          return response;
        } catch (error) {
          set({ isAuthenticated: false, user: null });
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        set({ user: null, isAuthenticated: false });
      },

      setUser: (user) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user));
        }
        set({ user, isAuthenticated: !!user });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
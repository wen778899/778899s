import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null, // { public_id, points }
      login: (userData) => set({ isAuthenticated: true, user: userData }),
      logout: () => set({ isAuthenticated: false, user: null }),
      setUser: (userData) => set({ user: userData }),
      updatePoints: (newPoints) => set((state) => ({
        user: state.user ? { ...state.user, points: newPoints } : null,
      })),
    }),
    {
      name: 'auth-storage', // local storage key
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAuthStore;
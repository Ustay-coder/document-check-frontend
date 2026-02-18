import { create } from "zustand";
import { api } from "@/lib/api";
import type { UserResponse } from "@/lib/types";

interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;

  setAuth: (token: string, user: UserResponse) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null, isLoading: false });
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await api.getMe();
      set({ token, user, isLoading: false });
    } catch {
      localStorage.removeItem("token");
      set({ token: null, user: null, isLoading: false });
    }
  },
}));

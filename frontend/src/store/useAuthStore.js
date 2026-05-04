import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('biohr_user')) || null,
  token: localStorage.getItem('biohr_token') || null,
  isAuthenticated: !!localStorage.getItem('biohr_token'),
  
  login: (user, token) => {
    localStorage.setItem('biohr_user', JSON.stringify(user));
    localStorage.setItem('biohr_token', token);
    set({ user, token, isAuthenticated: true });
  },
  
  logout: () => {
    localStorage.removeItem('biohr_user');
    localStorage.removeItem('biohr_token');
    set({ user: null, token: null, isAuthenticated: false });
  }
}));

export default useAuthStore;

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  
  // Loading states
  globalLoading: boolean;
  
  // Modals
  modals: Record<string, boolean>;
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
    persistent?: boolean;
  }>;
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  
  // Modal actions
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleModal: (modalId: string) => void;
  
  // Notification actions
  addNotification: (notification: Omit<UIState['notifications'][0], 'id'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      sidebarCollapsed: false,
      globalLoading: false,
      modals: {},
      notifications: [],

      setTheme: (theme) => {
        set({ theme });
        
        // Apply theme to document
        if (typeof window !== 'undefined') {
          const root = window.document.documentElement;
          
          if (theme === 'dark') {
            root.classList.add('dark');
          } else if (theme === 'light') {
            root.classList.remove('dark');
          } else {
            // System theme
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
              root.classList.add('dark');
            } else {
              root.classList.remove('dark');
            }
          }
        }
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      setGlobalLoading: (loading) => {
        set({ globalLoading: loading });
      },

      openModal: (modalId) => {
        set((state) => ({
          modals: { ...state.modals, [modalId]: true },
        }));
      },

      closeModal: (modalId) => {
        set((state) => ({
          modals: { ...state.modals, [modalId]: false },
        }));
      },

      toggleModal: (modalId) => {
        set((state) => ({
          modals: { ...state.modals, [modalId]: !state.modals[modalId] },
        }));
      },

      addNotification: (notification) => {
        const id = Math.random().toString(36).substring(2, 15);
        const newNotification = { ...notification, id };
        
        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));
        
        // Auto-remove notification after duration (default 5 seconds)
        if (!notification.persistent) {
          const duration = notification.duration || 5000;
          setTimeout(() => {
            get().removeNotification(id);
          }, duration);
        }
        
        return id;
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// Initialize theme on app start
if (typeof window !== 'undefined') {
  const { theme } = useUIStore.getState();
  useUIStore.getState().setTheme(theme);
}
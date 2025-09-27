import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface UIState {
  // Layout
  sidebarCollapsed: boolean;
  propertiesPanelCollapsed: boolean;
  previewPanelCollapsed: boolean;

  // Theme
  theme: Theme;

  // Modals and dialogs
  showNodeSettings: boolean;
  showExportDialog: boolean;
  showImportDialog: boolean;
  showPresetDialog: boolean;

  // Notifications
  notifications: Notification[];

  // Loading states
  isLoading: boolean;
  loadingMessage: string;

  // Keyboard shortcuts
  showShortcutsHelp: boolean;

  // Context menu
  showContextMenu: boolean;
  contextMenuPosition: { x: number; y: number } | null;
  contextMenuTarget: string | null;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

interface UIActions {
  // Layout
  toggleSidebar: () => void;
  togglePropertiesPanel: () => void;
  togglePreviewPanel: () => void;

  // Theme
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Modals
  showNodeSettingsModal: (show: boolean) => void;
  showExportModal: (show: boolean) => void;
  showImportModal: (show: boolean) => void;
  showPresetModal: (show: boolean) => void;

  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Loading
  setLoading: (loading: boolean, message?: string) => void;

  // Keyboard shortcuts
  toggleShortcutsHelp: () => void;

  // Context menu
  showContextMenuAt: (x: number, y: number, target: string) => void;
  hideContextMenu: () => void;
}

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      propertiesPanelCollapsed: false,
      previewPanelCollapsed: false,
      theme: 'light',
      showNodeSettings: false,
      showExportDialog: false,
      showImportDialog: false,
      showPresetDialog: false,
      notifications: [],
      isLoading: false,
      loadingMessage: '',
      showShortcutsHelp: false,
      showContextMenu: false,
      contextMenuPosition: null,
      contextMenuTarget: null,

      // Layout actions
      toggleSidebar: () => {
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        }));
      },

      togglePropertiesPanel: () => {
        set((state) => ({
          propertiesPanelCollapsed: !state.propertiesPanelCollapsed,
        }));
      },

      togglePreviewPanel: () => {
        set((state) => ({
          previewPanelCollapsed: !state.previewPanelCollapsed,
        }));
      },

      // Theme actions
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          root.setAttribute('data-theme', systemTheme);
        } else {
          root.setAttribute('data-theme', theme);
        }
        localStorage.setItem('theme', theme);
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },

      // Modal actions
      showNodeSettingsModal: (show) => {
        set({ showNodeSettings: show });
      },

      showExportModal: (show) => {
        set({ showExportDialog: show });
      },

      showImportModal: (show) => {
        set({ showImportDialog: show });
      },

      showPresetModal: (show) => {
        set({ showPresetDialog: show });
      },

      // Notification actions
      addNotification: (notification) => {
        const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: Notification = {
          id,
          timestamp: Date.now(),
          duration: 5000,
          ...notification,
        };

        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));

        // Auto-remove notification after duration
        if (newNotification.duration && newNotification.duration > 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, newNotification.duration);
        }
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      // Loading actions
      setLoading: (loading, message = '') => {
        set({
          isLoading: loading,
          loadingMessage: message,
        });
      },

      // Keyboard shortcuts
      toggleShortcutsHelp: () => {
        set((state) => ({
          showShortcutsHelp: !state.showShortcutsHelp,
        }));
      },

      // Context menu actions
      showContextMenuAt: (x, y, target) => {
        set({
          showContextMenu: true,
          contextMenuPosition: { x, y },
          contextMenuTarget: target,
        });
      },

      hideContextMenu: () => {
        set({
          showContextMenu: false,
          contextMenuPosition: null,
          contextMenuTarget: null,
        });
      },
    }),
    { name: 'ui-store' }
  )
);

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('theme') as Theme;
if (savedTheme) {
  useUIStore.getState().setTheme(savedTheme);
}
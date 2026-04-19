import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/ui';

beforeEach(() => {
  useUIStore.setState({ sidebarCollapsed: false, commandPaletteOpen: false });
});

describe('useUIStore', () => {
  it('has default state', () => {
    const s = useUIStore.getState();
    expect(s.sidebarCollapsed).toBe(false);
    expect(s.commandPaletteOpen).toBe(false);
  });

  it('toggleSidebar flips collapsed state', () => {
    const { toggleSidebar } = useUIStore.getState();
    toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('setSidebarCollapsed sets value directly', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('setCommandPaletteOpen opens/closes', () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    useUIStore.getState().setCommandPaletteOpen(false);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });
});

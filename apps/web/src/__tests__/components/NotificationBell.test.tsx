import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell } from '@/components/notifications/NotificationBell';

// Mock the useNotifications hook
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: vi.fn(() => ({
    notifications: [],
    unreadCount: 0,
    data: [],
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    isLoading: false,
  })),
  useMarkNotificationRead: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  })),
  useMarkAllNotificationsRead: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  })),
}));

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe('NotificationBell', () => {
  it('renders bell button', () => {
    const Wrapper = makeWrapper();
    render(<NotificationBell />, { wrapper: Wrapper });
    const btn = screen.getByRole('button', { name: /notificações/i });
    expect(btn).toBeDefined();
  });

  it('does not show badge when unreadCount is 0', () => {
    const Wrapper = makeWrapper();
    render(<NotificationBell />, { wrapper: Wrapper });
    // Badge with count should not exist
    const badge = screen.queryByText('0');
    expect(badge).toBeNull();
  });

  it('shows badge with unread count', async () => {
    const { useNotifications } = await import('@/hooks/useNotifications');
    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      notifications: [],
      unreadCount: 5,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      isLoading: false,
    });
    const Wrapper = makeWrapper();
    render(<NotificationBell />, { wrapper: Wrapper });
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows 99+ when count exceeds 99', async () => {
    const { useNotifications } = await import('@/hooks/useNotifications');
    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      notifications: [],
      unreadCount: 150,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      isLoading: false,
    });
    const Wrapper = makeWrapper();
    render(<NotificationBell />, { wrapper: Wrapper });
    expect(screen.getByText('99+')).toBeDefined();
  });

  it('has accessible aria-label with count', async () => {
    const { useNotifications } = await import('@/hooks/useNotifications');
    (useNotifications as ReturnType<typeof vi.fn>).mockReturnValue({
      notifications: [],
      unreadCount: 3,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      isLoading: false,
    });
    const Wrapper = makeWrapper();
    render(<NotificationBell />, { wrapper: Wrapper });
    const btn = screen.getByRole('button');
    const label = btn.getAttribute('aria-label');
    expect(label).toContain('3');
  });
});

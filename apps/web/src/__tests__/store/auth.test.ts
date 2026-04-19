import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth';

// Reset zustand store between tests
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    orgId: 'grupo-lauxen',
    companies: [],
    selectedCompany: null,
  });
});

describe('useAuthStore', () => {
  it('has default state', () => {
    const state = useAuthStore.getState();
    expect(state.orgId).toBe('grupo-lauxen');
    expect(state.user).toBeNull();
  });

  it('setUser updates user', () => {
    const { setUser } = useAuthStore.getState();
    setUser({ id: 'u-1', email: 'test@example.com', name: 'Test User' });
    expect(useAuthStore.getState().user).toEqual({ id: 'u-1', email: 'test@example.com', name: 'Test User' });
  });

  it('setUser with null clears user', () => {
    const { setUser } = useAuthStore.getState();
    setUser({ id: 'u-1', email: 'x@x.com', name: 'X' });
    setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setOrgId updates orgId', () => {
    const { setOrgId } = useAuthStore.getState();
    setOrgId('org-new');
    expect(useAuthStore.getState().orgId).toBe('org-new');
  });

  it('setCompanies updates list', () => {
    const { setCompanies } = useAuthStore.getState();
    const companies = [{ id: 'co-1', nome: 'Test Co', cnpj: '', avatarColor: '#000' }];
    setCompanies(companies);
    expect(useAuthStore.getState().companies).toHaveLength(1);
  });

  it('setSelectedCompany updates selection', () => {
    const company = { id: 'co-1', nome: 'Test Co', cnpj: '', avatarColor: '#000' };
    const { setSelectedCompany } = useAuthStore.getState();
    setSelectedCompany(company);
    expect(useAuthStore.getState().selectedCompany).toEqual(company);
  });

  it('clear resets user, orgId, selectedCompany', () => {
    const { setUser, setOrgId, setSelectedCompany, clear } = useAuthStore.getState();
    setUser({ id: 'u-1', email: 'x@x.com', name: 'X' });
    setOrgId('org-1');
    setSelectedCompany({ id: 'co-1', nome: 'Co', cnpj: '', avatarColor: '' });
    clear();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.orgId).toBeNull();
    expect(state.selectedCompany).toBeNull();
  });
});

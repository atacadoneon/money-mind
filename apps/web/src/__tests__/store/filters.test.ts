import { describe, it, expect, beforeEach } from 'vitest';
import { useFiltersStore } from '@/store/filters';

beforeEach(() => {
  useFiltersStore.setState({
    contasPagar: { situacao: 'todas', page: 1, pageSize: 25, sortBy: 'dataVencimento', sortDir: 'asc' },
    contasReceber: { situacao: 'todas', page: 1, pageSize: 25, sortBy: 'dataVencimento', sortDir: 'asc' },
    dateRanges: {},
  });
});

describe('useFiltersStore', () => {
  it('has default contasPagar state', () => {
    const { contasPagar } = useFiltersStore.getState();
    expect(contasPagar.situacao).toBe('todas');
    expect(contasPagar.page).toBe(1);
  });

  it('setContasPagar merges partial updates', () => {
    const { setContasPagar } = useFiltersStore.getState();
    setContasPagar({ situacao: 'aberto', page: 2 });
    const { contasPagar } = useFiltersStore.getState();
    expect(contasPagar.situacao).toBe('aberto');
    expect(contasPagar.page).toBe(2);
    expect(contasPagar.pageSize).toBe(25); // unchanged
  });

  it('resetContasPagar restores defaults', () => {
    const { setContasPagar, resetContasPagar } = useFiltersStore.getState();
    setContasPagar({ situacao: 'atrasado', page: 5 });
    resetContasPagar();
    const { contasPagar } = useFiltersStore.getState();
    expect(contasPagar.situacao).toBe('todas');
    expect(contasPagar.page).toBe(1);
  });

  it('setContasReceber merges', () => {
    const { setContasReceber } = useFiltersStore.getState();
    setContasReceber({ situacao: 'pago' });
    expect(useFiltersStore.getState().contasReceber.situacao).toBe('pago');
  });

  it('resetContasReceber restores defaults', () => {
    const { setContasReceber, resetContasReceber } = useFiltersStore.getState();
    setContasReceber({ situacao: 'pago', page: 3 });
    resetContasReceber();
    expect(useFiltersStore.getState().contasReceber.situacao).toBe('todas');
  });

  it('setDateRange stores date range per page key', () => {
    const { setDateRange, getDateRange } = useFiltersStore.getState();
    setDateRange('contas-pagar', { from: '2026-01-01', to: '2026-01-31' });
    expect(getDateRange('contas-pagar')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('getDateRange returns default for unknown page', () => {
    const { getDateRange } = useFiltersStore.getState();
    expect(getDateRange('unknown-page')).toEqual({ from: null, to: null });
  });

  it('date ranges are isolated per page', () => {
    const { setDateRange, getDateRange } = useFiltersStore.getState();
    setDateRange('page-a', { from: '2026-01-01', to: '2026-01-31' });
    setDateRange('page-b', { from: '2026-02-01', to: '2026-02-28' });
    expect(getDateRange('page-a').from).toBe('2026-01-01');
    expect(getDateRange('page-b').from).toBe('2026-02-01');
  });
});

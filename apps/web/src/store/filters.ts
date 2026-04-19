import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ContasPagarFilters, ContasReceberFilters } from "@/types";

interface PageDateRange {
  from: string | null;
  to: string | null;
}

interface FiltersState {
  contasPagar: ContasPagarFilters;
  contasReceber: ContasReceberFilters;
  // date ranges per page (stored as ISO strings for persistence)
  dateRanges: Record<string, PageDateRange>;
  setContasPagar: (f: Partial<ContasPagarFilters>) => void;
  setContasReceber: (f: Partial<ContasReceberFilters>) => void;
  resetContasPagar: () => void;
  resetContasReceber: () => void;
  setDateRange: (page: string, range: PageDateRange) => void;
  getDateRange: (page: string) => PageDateRange;
}

const defaultCp: ContasPagarFilters = { situacao: "todas", page: 1, pageSize: 25, sortBy: "dataVencimento", sortDir: "asc" };
const defaultCr: ContasReceberFilters = { situacao: "todas", page: 1, pageSize: 25, sortBy: "dataVencimento", sortDir: "asc" };
const defaultRange: PageDateRange = { from: null, to: null };

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set, get) => ({
      contasPagar: defaultCp,
      contasReceber: defaultCr,
      dateRanges: {},
      setContasPagar: (f) => set((s) => ({ contasPagar: { ...s.contasPagar, ...f } })),
      setContasReceber: (f) => set((s) => ({ contasReceber: { ...s.contasReceber, ...f } })),
      resetContasPagar: () => set({ contasPagar: defaultCp }),
      resetContasReceber: () => set({ contasReceber: defaultCr }),
      setDateRange: (page, range) =>
        set((s) => ({ dateRanges: { ...s.dateRanges, [page]: range } })),
      getDateRange: (page) => get().dateRanges[page] ?? defaultRange
    }),
    { name: "mm:filters" }
  )
);

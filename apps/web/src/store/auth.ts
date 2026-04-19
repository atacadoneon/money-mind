import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Empresa } from "@/types";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AuthUser | null;
  orgId: string | null;
  companies: Empresa[];
  selectedCompany: Empresa | null;
  setUser: (user: AuthUser | null) => void;
  setOrgId: (orgId: string | null) => void;
  setCompanies: (c: Empresa[]) => void;
  setSelectedCompany: (c: Empresa | null) => void;
  clear: () => void;
}

const DEFAULT_COMPANIES: Empresa[] = [];

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      orgId: null,
      companies: DEFAULT_COMPANIES,
      selectedCompany: DEFAULT_COMPANIES[0] ?? null,
      setUser: (user) => set({ user }),
      setOrgId: (orgId) => {
        if (typeof window !== "undefined" && orgId) {
          window.localStorage.setItem("mm:orgId", orgId);
        }
        set({ orgId });
      },
      setCompanies: (companies) => set({ companies }),
      setSelectedCompany: (selectedCompany) => set({ selectedCompany }),
      clear: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("mm:dev-token");
          window.localStorage.removeItem("mm:orgId");
        }
        set({ user: null, orgId: null, companies: [], selectedCompany: null });
      }
    }),
    { name: "mm:auth" }
  )
);

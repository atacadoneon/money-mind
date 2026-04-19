import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OnboardingStep =
  | "welcome"
  | "company"
  | "tiny"
  | "conta-simples"
  | "import"
  | "marker"
  | "tour"
  | "done";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "company",
  "tiny",
  "conta-simples",
  "import",
  "marker",
  "tour",
  "done"
];

interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: Set<OnboardingStep>;
  companyData: { nome: string; cnpj: string; segmento: string } | null;
  tinyData: { clientId: string; clientSecret: string; v3Token: string } | null;
  contaSimplesData: { apiKey: string; apiSecret: string } | null;
  importOptions: {
    contatos: boolean;
    cp: boolean;
    cr: boolean;
    categorias: boolean;
  };
  syncJobId: string | null;
  setStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  markCompleted: (step: OnboardingStep) => void;
  setCompanyData: (d: OnboardingState["companyData"]) => void;
  setTinyData: (d: OnboardingState["tinyData"]) => void;
  setContaSimplesData: (d: OnboardingState["contaSimplesData"]) => void;
  setImportOptions: (d: Partial<OnboardingState["importOptions"]>) => void;
  setSyncJobId: (id: string | null) => void;
  reset: () => void;
}

const INITIAL_IMPORT: OnboardingState["importOptions"] = {
  contatos: true,
  cp: true,
  cr: true,
  categorias: true
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: "welcome",
      completedSteps: new Set<OnboardingStep>(),
      companyData: null,
      tinyData: null,
      contaSimplesData: null,
      importOptions: INITIAL_IMPORT,
      syncJobId: null,
      setStep: (step) => set({ currentStep: step }),
      nextStep: () => {
        const { currentStep } = get();
        const idx = ONBOARDING_STEPS.indexOf(currentStep);
        const next = ONBOARDING_STEPS[idx + 1];
        if (next) set({ currentStep: next });
      },
      markCompleted: (step) =>
        set((s) => ({ completedSteps: new Set([...s.completedSteps, step]) })),
      setCompanyData: (companyData) => set({ companyData }),
      setTinyData: (tinyData) => set({ tinyData }),
      setContaSimplesData: (contaSimplesData) => set({ contaSimplesData }),
      setImportOptions: (d) =>
        set((s) => ({ importOptions: { ...s.importOptions, ...d } })),
      setSyncJobId: (syncJobId) => set({ syncJobId }),
      reset: () =>
        set({
          currentStep: "welcome",
          completedSteps: new Set<OnboardingStep>(),
          companyData: null,
          tinyData: null,
          contaSimplesData: null,
          importOptions: INITIAL_IMPORT,
          syncJobId: null
        })
    }),
    {
      name: "mm:onboarding",
      partialize: (s) => ({
        currentStep: s.currentStep,
        completedSteps: [...s.completedSteps],
        companyData: s.companyData,
        importOptions: s.importOptions,
        syncJobId: s.syncJobId
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<OnboardingState>),
        completedSteps: new Set(
          ((persisted as { completedSteps?: string[] }).completedSteps) ?? []
        ) as unknown as Set<OnboardingStep>
      })
    }
  )
);

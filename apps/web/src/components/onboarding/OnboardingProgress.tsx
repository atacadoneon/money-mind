"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/store/onboarding";

const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: "Boas-vindas",
  company: "Empresa",
  tiny: "Tiny ERP",
  "conta-simples": "Conta Simples",
  import: "Importar dados",
  marker: "Marcador",
  tour: "Tour guiado",
  done: "Pronto"
};

interface Props {
  currentStep: OnboardingStep;
  completedSteps: Set<OnboardingStep>;
}

export function OnboardingProgress({ currentStep, completedSteps }: Props) {
  const steps = ONBOARDING_STEPS.filter((s) => s !== "done");

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const isCompleted = completedSteps.has(step);
        const isCurrent = currentStep === step;
        const isPast =
          ONBOARDING_STEPS.indexOf(step) < ONBOARDING_STEPS.indexOf(currentStep);

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                  isCompleted || isPast
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary bg-background text-primary"
                    : "border-muted-foreground/30 bg-background text-muted-foreground"
                )}
              >
                {isCompleted || isPast ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "hidden text-[10px] sm:block whitespace-nowrap",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-8 rounded transition-all",
                  isPast || isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

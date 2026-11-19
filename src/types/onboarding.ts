export interface OnboardingStep {
  id: "dados_escola" | "primeiro_curso" | "primeira_turma" | "pagina_publica";
  title: string;
  description: string;
  href: string;
  isCompleted: boolean;
  actionLabel: string;
}

export interface OnboardingProgressDTO {
  isDismissed: boolean;
  isAllCompleted: boolean;
  completedCount: number;
  totalSteps: number;
  percent: number;
  steps: OnboardingStep[];
}

export interface CompletionEvidence {
  evidencia?: string;
  justificativa?: string;
}

export const hasCompletionEvidence = (proof?: CompletionEvidence | null) => Boolean(
  proof?.evidencia?.trim() || proof?.justificativa?.trim(),
);

export const isFinalChecklistTransition = (
  checklist: Record<string, boolean>,
  currentKey: string,
  nextValue: boolean,
) => nextValue && Object.entries(checklist).every(([key, completed]) => (
  key === currentKey ? true : completed
));

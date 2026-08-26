import { describe, expect, it } from 'vitest';
import { hasCompletionEvidence, isFinalChecklistTransition } from './completionEvidence';

describe('evidência da conclusão operacional', () => {
  it('detecta somente a transição que completa a última etapa pendente', () => {
    expect(isFinalChecklistTransition({ 0: true, 1: false }, '1', true)).toBe(true);
    expect(isFinalChecklistTransition({ 0: false, 1: false }, '1', true)).toBe(false);
    expect(isFinalChecklistTransition({ 0: true, 1: true }, '1', false)).toBe(false);
  });

  it('aceita evidência ou justificativa explícita e rejeita texto vazio', () => {
    expect(hasCompletionEvidence({ evidencia: 'Protocolo 123' })).toBe(true);
    expect(hasCompletionEvidence({ justificativa: 'Documento conferido' })).toBe(true);
    expect(hasCompletionEvidence({ justificativa: '   ' })).toBe(false);
  });
});

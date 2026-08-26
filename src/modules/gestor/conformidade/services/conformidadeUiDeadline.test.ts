import { describe, expect, it } from 'vitest';
import pageSource from '../ConformidadePage.tsx?raw';
import checklistSource from '../components/ConformidadeChecklist.tsx?raw';
import hookSource from '../hooks/useConformidade.ts?raw';

describe('conformidade UI deadline consistency', () => {
  it('usa o atraso canônico devolvido pelo servidor', () => {
    expect(hookSource).toContain("'atrasados'");
    expect(hookSource).toContain('item.atrasoDias > 0');
    expect(pageSource).toContain('const isVencido = item.atrasoDias > 0');
    expect(hookSource).not.toContain('item.diasParaVencimento < 0');
    expect(pageSource).not.toContain('diasParaVencimento < 0');
    expect(checklistSource).toContain('disabled={isUpdating || !item.podeAtualizar}');
    expect(checklistSource).toContain('isFinalChecklistTransition');
    expect(checklistSource).toContain('hasCompletionEvidence');
    expect(pageSource).toContain('updateErrorMessage');
  });
});

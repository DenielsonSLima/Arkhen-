import { describe, expect, it } from 'vitest';
import { normalizeObrigacao } from './obrigacoesService';

describe('normalizeObrigacao', () => {
  it('normaliza o regime legado Isento e preserva a ordem das etapas', () => {
    const result = normalizeObrigacao({
      id: 'a1',
      codigo: 'folha-mei',
      nome: 'Folha Salarial',
      categoria: 'Trabalhista',
      regimes: ['Isento', 'MEI', 'MEI'],
      periodicidade: 'mensal',
      origemPadrao: 'Escritório envia',
      temVencimento: true,
      diaVencimento: 40,
      etapas: [' Conferir dados ', '', 'Transmitir eSocial'],
      ativo: true,
      ordem: 10,
    });

    expect(result.regimes).toEqual(['MEI', 'Isenta']);
    expect(result.etapas).toEqual(['Conferir dados', 'Transmitir eSocial']);
    expect(result.diaVencimento).toBe(31);
  });

  it('rejeita item sem identidade canônica', () => {
    expect(() => normalizeObrigacao({ nome: 'Sem código' })).toThrow('obrigação inválida');
  });
});

import { describe, expect, it } from 'vitest';
import {
  OBRIGACAO_PERIODICIDADE_LABELS,
  OBRIGACAO_PERIODICIDADES,
  createEmptyObrigacao,
} from '../obrigacoes.types';
import {
  buildObrigacaoPayload,
  normalizeObrigacao,
  normalizeObrigacoesResumo,
} from './obrigacoesService';

describe('normalizeObrigacao', () => {
  it('oferece as periodicidades antigas e as quatro novas no formulário', () => {
    expect(OBRIGACAO_PERIODICIDADES.map((value) => OBRIGACAO_PERIODICIDADE_LABELS[value]))
      .toEqual([
        'Diário',
        'Único',
        'Semanal',
        'Quinzenal',
        'Mensal',
        'Trimestral',
        'Semestral',
        'Anual',
      ]);
  });

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

  it.each([
    ['diaria', {}],
    ['unica', { dataVencimento: '2026-09-15' }],
    ['semanal', { diaSemana: 5 }],
    ['anual', { diaVencimento: 31, mesVencimento: 12 }],
  ] as const)('preserva a agenda da periodicidade %s', (periodicidade, agenda) => {
    const result = normalizeObrigacao({
      id: `id-${periodicidade}`,
      codigo: `codigo-${periodicidade}`,
      nome: `Obrigação ${periodicidade}`,
      periodicidade,
      ...agenda,
    });

    expect(result).toMatchObject({ periodicidade, ...agenda });
  });

  it('envia somente os campos de agenda aceitos pela periodicidade', () => {
    const base = {
      ...createEmptyObrigacao(),
      diaSemana: 3,
      dataVencimento: '2026-10-08',
      mesVencimento: 10,
      diaVencimento: 8,
    };
    const annual = buildObrigacaoPayload({
      ...base,
      periodicidade: 'anual',
    });
    const weekly = buildObrigacaoPayload({ ...base, periodicidade: 'semanal' });
    const uniqueWithoutDeadline = buildObrigacaoPayload({
      ...base,
      periodicidade: 'unica',
      temVencimento: false,
    });
    const monthlyWithoutDeadline = buildObrigacaoPayload({
      ...base,
      periodicidade: 'mensal',
      temVencimento: false,
    });

    expect(annual).toMatchObject({ periodicidade: 'anual', mesVencimento: 10, diaVencimento: 8 });
    expect(annual).not.toHaveProperty('diaSemana');
    expect(annual).not.toHaveProperty('dataVencimento');
    expect(weekly).toMatchObject({ periodicidade: 'semanal', diaSemana: 3 });
    expect(weekly).not.toHaveProperty('diaVencimento');
    expect(uniqueWithoutDeadline).toMatchObject({
      periodicidade: 'unica',
      temVencimento: false,
      dataVencimento: '2026-10-08',
    });
    expect(uniqueWithoutDeadline).not.toHaveProperty('diaSemana');
    expect(monthlyWithoutDeadline).not.toHaveProperty('diaVencimento');
  });
});

describe('normalizeObrigacoesResumo', () => {
  it('aceita somente os quatro totais calculados pela RPC', () => {
    expect(normalizeObrigacoesResumo({
      total: 15,
      ativos: 12,
      comPrazo: 10,
      etapas: 71,
    })).toEqual({ total: 15, ativos: 12, comPrazo: 10, etapas: 71 });
  });

  it.each([
    null,
    { total: '15', ativos: 12, comPrazo: 10, etapas: 71 },
    { total: 15, ativos: -1, comPrazo: 0, etapas: 0 },
    { total: 2, ativos: 3, comPrazo: 1, etapas: 0 },
    { total: 3, ativos: 2, comPrazo: 3, etapas: 0 },
  ])('rejeita envelope ausente, adulterado ou inconsistente: %o', (value) => {
    expect(() => normalizeObrigacoesResumo(value)).toThrow(/resumo/i);
  });
});

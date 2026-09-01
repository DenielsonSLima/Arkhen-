import { describe, expect, it } from 'vitest';
import type { RotinaWorkspaceItem } from './rotinasWorkspace';
import {
  filterRotinas,
  getRotinaCompanyMetrics,
  getRotinaEditableExecutionDate,
  getRotinaEditableModelId,
  getRotinaFrequenciaLabel,
  groupRotinasByCompany,
} from './rotinasWorkspace';

const makeRotina = (
  overrides: Partial<RotinaWorkspaceItem> = {},
): RotinaWorkspaceItem => ({
  id: 'rotina-1',
  nome: 'Conferência fiscal',
  categoria: 'Fiscal',
  frequencia: 'Mensal',
  intervaloDias: 30,
  responsavel: '',
  cliente: 'Empresa repetida',
  clienteId: 'cliente-1',
  proximaExecucao: '2026-09-10',
  prioridade: 'Média',
  ativa: true,
  checklist: ['Conferir documentos'],
  observacoes: '',
  ...overrides,
});

describe('getRotinaFrequenciaLabel', () => {
  it('reconhece aliases legados de recorrências personalizadas', () => {
    expect(getRotinaFrequenciaLabel('Personalizada', 60)).toBe('Bimestral');
    expect(getRotinaFrequenciaLabel('Personalizada', 365)).toBe('Anual');
    expect(getRotinaFrequenciaLabel('Personalizada', 45)).toBe('A cada 45 dias');
    expect(getRotinaFrequenciaLabel('Trimestral')).toBe('Trimestral');
  });
});

describe('getRotinaEditableExecutionDate', () => {
  it('preserva a data-base quando a execução foi ajustada para um dia útil', () => {
    expect(getRotinaEditableExecutionDate(makeRotina({
      dataAncora: '2026-01-04',
      proximaExecucaoBase: '2026-10-04',
      proximaExecucao: '2026-10-05',
    }))).toBe('2026-10-04');
  });
});

describe('getRotinaEditableModelId', () => {
  it('converte vínculo de modelo indisponível em rotina manual sem perder o conteúdo', () => {
    const availableIds = new Set(['modelo-ativo']);

    expect(getRotinaEditableModelId('modelo-ativo', availableIds)).toBe('modelo-ativo');
    expect(getRotinaEditableModelId('modelo-desvinculado', availableIds)).toBeUndefined();
  });
});

describe('groupRotinasByCompany', () => {
  const companies = [
    { id: 'cliente-1', nome: 'Empresa repetida', cnpj: '111' },
    { id: 'cliente-2', nome: 'Empresa repetida', cnpj: '222' },
    { id: 'cliente-3', nome: 'Empresa sem rotina', cnpj: '333' },
  ];

  it('agrupa exclusivamente pelo clienteId estável e mantém empresas sem rotinas', () => {
    const rotinas = [
      makeRotina({ id: 'r-1', clienteId: 'cliente-1' }),
      makeRotina({ id: 'r-2', clienteId: 'cliente-2' }),
      makeRotina({ id: 'r-sem-id', clienteId: undefined }),
      makeRotina({ id: 'r-desconhecida', clienteId: 'cliente-inexistente' }),
    ];

    const groups = groupRotinasByCompany(companies, rotinas);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => [group.cliente.id, group.rotinas.map((item) => item.id)]))
      .toEqual([
        ['cliente-1', ['r-1']],
        ['cliente-2', ['r-2']],
        ['cliente-3', []],
      ]);
    expect(groups[2]).toMatchObject({ totalRotinas: 0, semResponsavel: 0 });
    expect(groups[2].proximaExecucao).toBeUndefined();
  });

  it('deriva métricas e a execução ativa mais próxima para cada empresa', () => {
    const metrics = getRotinaCompanyMetrics([
      makeRotina({ id: 'r-1', proximaExecucao: '2026-10-01' }),
      makeRotina({
        id: 'r-2',
        proximaExecucao: '2026-09-01',
        responsavel: 'Ana',
        responsavelConfigUsuarioId: 'config-ana',
      }),
      makeRotina({ id: 'r-3', proximaExecucao: '2026-08-01', ativa: false }),
    ]);

    expect(metrics).toEqual({
      totalRotinas: 3,
      semResponsavel: 2,
      proximaExecucao: '2026-09-01',
    });
  });
});

describe('filterRotinas', () => {
  const rotinas = [
    makeRotina({
      id: 'bimestral',
      nome: 'Apuração de tributos',
      clienteId: 'cliente-1',
      frequencia: 'Personalizada',
      intervaloDias: 60,
      responsavel: 'Ágata Lima',
      responsavelConfigUsuarioId: 'config-agata',
      responsavelUserId: 'auth-agata',
      protocoloCodigo: 'PROTO-FISCAL',
    }),
    makeRotina({
      id: 'anual',
      nome: 'Revisão societária',
      clienteId: 'cliente-2',
      frequencia: 'Personalizada',
      intervaloDias: 365,
      responsavel: 'Bruno',
      responsavelConfigUsuarioId: 'config-bruno',
    }),
    makeRotina({
      id: 'semanal-sem-responsavel',
      nome: 'Cobrança de documentos',
      clienteId: 'cliente-1',
      frequencia: 'Semanal',
      intervaloDias: 7,
      responsavel: '',
    }),
    makeRotina({
      id: 'personalizada-45',
      clienteId: 'cliente-1',
      frequencia: 'Personalizada',
      intervaloDias: 45,
    }),
  ];

  it('filtra por empresa usando somente o ID estável', () => {
    expect(filterRotinas(rotinas, { companyId: 'cliente-2' }).map((item) => item.id))
      .toEqual(['anual']);
    expect(filterRotinas(rotinas, { companyId: 'Empresa repetida' })).toEqual([]);
  });

  it('filtra aliases de frequência e responsável por IDs estáveis', () => {
    expect(filterRotinas(rotinas, { frequency: 'Bimestral' }).map((item) => item.id))
      .toEqual(['bimestral']);
    expect(filterRotinas(rotinas, { frequency: 'Anual' }).map((item) => item.id))
      .toEqual(['anual']);
    expect(filterRotinas(rotinas, { responsibleId: 'config-agata' }).map((item) => item.id))
      .toEqual(['bimestral']);
    expect(filterRotinas(rotinas, { responsibleId: 'auth-agata' }).map((item) => item.id))
      .toEqual(['bimestral']);
    expect(filterRotinas(rotinas, { frequency: 'Personalizada' }).map((item) => item.id))
      .toEqual(['personalizada-45']);
  });

  it('combina busca sem acentos, frequência e itens sem responsável', () => {
    expect(filterRotinas(rotinas, { search: 'apuracao', frequency: 'Bimestral' }).map((item) => item.id))
      .toEqual(['bimestral']);
    expect(filterRotinas(rotinas, { search: 'proto-fiscal' }).map((item) => item.id))
      .toEqual(['bimestral']);
    expect(filterRotinas(rotinas, { responsibleId: 'sem-responsavel' }).map((item) => item.id))
      .toEqual(['semanal-sem-responsavel', 'personalizada-45']);
  });
});

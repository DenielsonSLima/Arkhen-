import { describe, expect, it } from 'vitest';
import type { RotinaAtividade } from '../services/rotinasAtividadesService';
import { buildResponsaveisPorGrupo, getResponsavelDoGrupo } from './responsaveisPorGrupo';

const rotina = (responsavel: string): RotinaAtividade => ({
  id: responsavel,
  clienteId: 'cliente-1',
  nome: 'Fechamento',
  categoria: 'Contábil',
  frequencia: 'Mensal',
  intervaloDias: 30,
  responsavel,
  cliente: 'Cliente teste',
  proximaExecucao: '2026-06-10',
  prioridade: 'Média',
  checklist: [],
  observacoes: '',
  ativa: true,
});

describe('responsáveis dos grupos de fechamento', () => {
  it('resume múltiplos responsáveis das rotinas do cliente como equipe', () => {
    const mapa = buildResponsaveisPorGrupo([rotina('Ana'), rotina('Bruno')]);

    expect(getResponsavelDoGrupo(mapa, 'cliente-1', '06/2026')).toBe('Equipe (2)');
    expect(getResponsavelDoGrupo(mapa, 'cliente-1', '08/2026')).toBe('Equipe (2)');
  });

  it('usa a rotina local como fallback e nunca devolve texto vazio', () => {
    const rotinaCliente = {
      clienteId: 'cliente-2',
      responsavel: 'Carla',
    } as RotinaAtividade;
    const mapa = buildResponsaveisPorGrupo([rotinaCliente]);

    expect(getResponsavelDoGrupo(mapa, 'cliente-2', '06/2026')).toBe('Carla');
    expect(getResponsavelDoGrupo(mapa, 'cliente-3', '06/2026')).toBe('Não atribuído');
  });
});

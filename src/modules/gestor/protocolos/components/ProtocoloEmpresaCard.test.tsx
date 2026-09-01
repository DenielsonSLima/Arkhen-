/** @vitest-environment jsdom */

import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmpresaProtocolosGrupo } from '../hooks/useProtocolos';
import type { ProtocoloEntrega } from '../services/protocolosService';
import { ProtocoloEmpresaCard } from './ProtocoloEmpresaCard';

afterEach(cleanup);

const protocolo = (status: ProtocoloEntrega['status']): ProtocoloEntrega => ({
  id: `protocolo-${status}`,
  empresaId: 'cliente-1',
  empresaNome: 'Empresa Alfa',
  empresaCnpj: '12.345.678/0001-90',
  empresaStatus: 'Ativa',
  empresaTipo: 'Simples Nacional',
  empresaTipoEstabelecimento: 'Matriz',
  empresaEmail: '',
  empresaTelefone: '',
  competencia: '2026-08',
  periodoReferencia: 'Mensal',
  entregaId: `entrega-${status}`,
  entregaNome: 'Obrigação fiscal',
  categoria: 'Fiscal',
  origemPadrao: 'Ambos',
  prazo: '2026-09-21',
  status,
  atualizadoEm: '',
  responsavel: '',
  anotacoesList: [],
});

const makeGroup = (withProgress: boolean): EmpresaProtocolosGrupo => ({
  groupId: 'cliente-1::2026-08',
  empresaId: 'cliente-1',
  empresaNome: 'Empresa Alfa',
  empresaCnpj: '12.345.678/0001-90',
  empresaStatus: 'Ativa',
  empresaTipo: 'Simples Nacional',
  empresaTipoEstabelecimento: 'Matriz',
  empresaEmail: '',
  empresaTelefone: '',
  competencia: '2026-08',
  fluxoOperacional: withProgress ? {
    clienteId: 'cliente-1',
    competencia: '2026-08',
    tarefasTotal: 1,
    tarefasConcluidas: 0,
    etapasTotal: 12,
    etapasConcluidas: 9,
    percentual: 75,
  } : undefined,
  items: [protocolo('Pendente'), protocolo('Pendente')],
});

describe('ProtocoloEmpresaCard', () => {
  it('abre com Enter e Espaço e impede o comportamento padrão das teclas', () => {
    const onOpen = vi.fn();
    render(<ProtocoloEmpresaCard group={makeGroup(true)} onOpen={onOpen} />);
    const card = screen.getByRole('button');
    const enterEvent = createEvent.keyDown(card, { key: 'Enter' });
    const spaceEvent = createEvent.keyDown(card, { key: ' ' });

    fireEvent(card, enterEvent);
    fireEvent(card, spaceEvent);

    expect(enterEvent.defaultPrevented).toBe(true);
    expect(spaceEvent.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('prioriza o progresso operacional e mantém entregas legais separadas', () => {
    render(<ProtocoloEmpresaCard group={makeGroup(true)} onOpen={vi.fn()} />);

    expect(screen.getByText('Fluxo operacional')).toBeTruthy();
    expect(screen.getByText('9/12 (75%)')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75');
    expect(screen.getByText('Entregas legais')).toBeTruthy();
    expect(screen.getByText('0/2')).toBeTruthy();
  });

  it('explica quando a tarefa ainda não foi materializada sem mostrar 0/0', () => {
    render(<ProtocoloEmpresaCard group={makeGroup(false)} onOpen={vi.fn()} />);

    expect(screen.getByText('Fluxo ainda não gerado')).toBeTruthy();
    expect(screen.queryByText('0/0')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('0/2')).toBeTruthy();
  });

  it('não mostra 0/0 quando existe tarefa sem etapas cadastradas', () => {
    const group = makeGroup(true);
    group.fluxoOperacional = {
      ...group.fluxoOperacional!,
      etapasTotal: 0,
      etapasConcluidas: 0,
      tarefasTotal: 1,
      tarefasConcluidas: 0,
      percentual: 0,
    };

    render(<ProtocoloEmpresaCard group={group} onOpen={vi.fn()} />);

    expect(screen.getByText('0/1 tarefas (0%)')).toBeTruthy();
    expect(screen.queryByText('0/0 (0%)')).toBeNull();
  });
});

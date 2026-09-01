/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProtocoloEntrega } from '../services/protocolosService';
import { ProtocoloArquivosList } from './ProtocoloArquivosList';

const makeProtocol = (overrides: Partial<ProtocoloEntrega> = {}): ProtocoloEntrega => ({
  id: 'cliente-1-2026-08-dctfweb-mensal',
  empresaId: 'cliente-1',
  empresaNome: 'Cliente Novo',
  empresaCnpj: '12.345.678/0001-00',
  empresaStatus: 'Ativa',
  empresaTipo: 'Simples Nacional',
  empresaTipoEstabelecimento: 'Matriz',
  empresaEmail: 'cliente@teste.local',
  empresaTelefone: '',
  competencia: '2026-08',
  periodoReferencia: 'Mensal',
  entregaId: 'dctfweb',
  entregaNome: 'DCTFWeb',
  categoria: 'Fiscal',
  origemPadrao: 'Ambos',
  prazo: '2026-09-25',
  status: 'Pendente',
  atualizadoEm: '',
  responsavel: '',
  anotacoesList: [],
  recebidoEm: '',
  concluidoPor: '',
  podeAlterarStatus: true,
  podeAnotar: true,
  ...overrides,
});

const formatDate = (value: string) => value || '-';

afterEach(cleanup);

describe('ProtocoloArquivosList', () => {
  it('envia somente status e evidência válida e adota o retorno canônico', async () => {
    const pending = makeProtocol();
    const canonical = makeProtocol({
      status: 'Concluído',
      recebidoEm: '2026-08-31T21:00:00Z',
      concluidoEm: '2026-08-31T21:00:00Z',
      concluidoPor: 'Usuária autenticada',
      evidencia: 'Documento validado',
    });
    const onUpdate = vi.fn().mockResolvedValue(canonical);

    render(<ProtocoloArquivosList items={[pending]} formatDate={formatDate} onUpdateProtocolo={onUpdate} />);

    const evidence = await screen.findByRole('textbox', { name: /evidência ou justificativa/i });
    const conclude = screen.getByRole('button', { name: /^concluir$/i });
    expect((conclude as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(evidence, { target: { value: 'Documento validado' } });
    fireEvent.click(conclude);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(pending.id, {
        status: 'Concluído',
        anotacao: 'Documento validado',
      });
    });
    expect(await screen.findByText('Usuária autenticada')).toBeTruthy();
    expect(screen.getByText('Documento validado')).toBeTruthy();
  });

  it('exige justificativa para reabrir um protocolo concluído', async () => {
    const concluded = makeProtocol({
      status: 'Concluído',
      recebidoEm: '2026-08-31T20:00:00Z',
      concluidoPor: 'Gestora',
    });
    const canonical = makeProtocol();
    const onUpdate = vi.fn().mockResolvedValue(canonical);

    render(<ProtocoloArquivosList items={[concluded]} formatDate={formatDate} onUpdateProtocolo={onUpdate} />);
    fireEvent.click(screen.getByRole('tab', { name: /histórico/i }));

    const evidence = await screen.findByRole('textbox', { name: /evidência ou justificativa/i });
    const reopen = screen.getByRole('button', { name: /^reabrir$/i });
    fireEvent.change(evidence, { target: { value: 'curto' } });
    expect((reopen as HTMLButtonElement).disabled).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.change(evidence, { target: { value: 'Documento precisa de correção' } });
    fireEvent.click(reopen);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(concluded.id, {
        status: 'Pendente',
        anotacao: 'Documento precisa de correção',
      });
    });
  });

  it('respeita as capacidades retornadas pelo servidor', async () => {
    const readonly = makeProtocol({ podeAlterarStatus: false, podeAnotar: false });
    const onUpdate = vi.fn();

    render(<ProtocoloArquivosList items={[readonly]} formatDate={formatDate} onUpdateProtocolo={onUpdate} />);

    const evidence = await screen.findByRole('textbox', { name: /evidência ou justificativa/i });
    expect((evidence as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^concluir$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /adicionar/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

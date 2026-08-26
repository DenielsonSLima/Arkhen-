/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProtocoloEntrega } from '../services/protocolosService';
import { ProtocoloArquivosList } from './ProtocoloArquivosList';

const protocolo = (capabilities: Pick<ProtocoloEntrega, 'podeAlterarStatus' | 'podeAnotar'>): ProtocoloEntrega => ({
  id: '11111111-1111-4111-8111-111111111111-2026-08-xml-nfe-mensal',
  empresaId: '11111111-1111-4111-8111-111111111111',
  empresaNome: 'Cliente Real',
  empresaCnpj: '12.345.678/0001-00',
  empresaStatus: 'Ativa',
  empresaTipo: 'Simples Nacional',
  empresaTipoEstabelecimento: 'Matriz',
  empresaEmail: 'cliente@empresa.test',
  empresaTelefone: '',
  competencia: '2026-08',
  periodoReferencia: 'Mensal',
  entregaId: 'xml-nfe',
  entregaNome: 'XML de NF-e',
  categoria: 'Fiscal',
  origemPadrao: 'Cliente envia',
  prazo: '2026-09-10',
  status: 'Pendente',
  atualizadoEm: '',
  responsavel: '',
  anotacoesList: [],
  ...capabilities,
});

const formatDate = (value: string) => value;

describe('ProtocoloArquivosList capabilities', () => {
  afterEach(cleanup);

  it('mantém conclusão e anotação bloqueadas para perfil somente leitura', async () => {
    const onUpdate = vi.fn();
    render(
      <ProtocoloArquivosList
        items={[protocolo({ podeAlterarStatus: false, podeAnotar: false })]}
        formatDate={formatDate}
        onUpdateProtocolo={onUpdate}
      />,
    );

    await waitFor(() => expect(screen.getByText('Evidência atual')).toBeTruthy());
    expect((screen.getByTitle('Seu perfil não pode alterar o status') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Concluir' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Adicionar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('permite ao gestor concluir somente após informar evidência', async () => {
    const saved = protocolo({ podeAlterarStatus: true, podeAnotar: true });
    const onUpdate = vi.fn().mockResolvedValue({ ...saved, status: 'Concluído' });
    render(
      <ProtocoloArquivosList items={[saved]} formatDate={formatDate} onUpdateProtocolo={onUpdate} />,
    );

    await waitFor(() => expect(screen.getByText('Evidência atual')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Arquivo validado pela revisão.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(saved.id, {
      status: 'Concluído',
      anotacao: 'Arquivo validado pela revisão.',
    }));
  });

  it('permite ao criador anotar protocolo novo sem liberar alteração de status', async () => {
    const item = protocolo({ podeAlterarStatus: false, podeAnotar: true });
    const onUpdate = vi.fn().mockResolvedValue(item);
    render(
      <ProtocoloArquivosList items={[item]} formatDate={formatDate} onUpdateProtocolo={onUpdate} />,
    );

    await waitFor(() => expect(screen.getByText('Evidência atual')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Observação operacional inicial.' } });
    expect((screen.getByRole('button', { name: 'Concluir' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(item.id, {
      anotacao: 'Observação operacional inicial.',
    }));
  });
});

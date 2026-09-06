/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  getParametros: vi.fn(),
  resetParametros: vi.fn(),
  saveParametros: vi.fn(),
}));

vi.mock('./services/parametrosCalculoService', () => ({
  PARAMETROS_CALCULO_QUERY_KEY: ['parametrizacao', 'rescisao'],
  parametrosCalculoService: serviceMock,
}));

import { ParametrosCalculoPage } from './ParametrosCalculoPage';

const parametros = {
  version: 5,
  updatedAt: '2026-09-04T10:00:00-03:00',
  tiposRescisao: [
    {
      id: 'sem_justa_causa',
      label: 'Sem Justa Causa',
      descricao: 'Com aviso prévio e multa de FGTS.',
      geraAvisoPrevio: true,
      geraMultaFgts: true,
      ativo: true,
    },
    {
      id: 'com_justa_causa',
      label: 'Com Justa Causa',
      descricao: 'Sem aviso prévio indenizado e sem multa de FGTS.',
      geraAvisoPrevio: false,
      geraMultaFgts: false,
      ativo: true,
    },
    {
      id: 'pedido_demissao',
      label: 'Pedido de Demissão',
      descricao: 'Pedido do funcionário, sem multa de FGTS.',
      geraAvisoPrevio: false,
      geraMultaFgts: false,
      ativo: true,
    },
  ],
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ParametrosCalculoPage />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
};

beforeEach(() => {
  vi.clearAllMocks();
  serviceMock.getParametros.mockResolvedValue(parametros);
  serviceMock.saveParametros.mockImplementation(async (value) => value);
  serviceMock.resetParametros.mockResolvedValue(parametros);
});

afterEach(cleanup);

describe('ParametrosCalculoPage', () => {
  it('organiza os motivos em cards com resumo e efeitos claros', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Motivos de rescisão' })).toBeTruthy();
    expect(screen.getByText('3 de 3 ativos')).toBeTruthy();
    expect(document.querySelectorAll('.parametros-option-card')).toHaveLength(3);
    expect(screen.getAllByText('Efeitos no cálculo')).toHaveLength(3);
    expect(screen.getByLabelText('Gerar multa do FGTS em Sem Justa Causa')).toBeTruthy();
  });

  it('sinaliza alterações e salva status e efeitos atualizados', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Motivos de rescisão' });

    const saveButton = screen.getByRole('button', { name: 'Salvar alterações' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Status de Sem Justa Causa'));
    fireEvent.click(screen.getByLabelText('Gerar aviso prévio em Sem Justa Causa'));

    expect(screen.getByText('Alterações pendentes')).toBeTruthy();
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);

    await waitFor(() => expect(serviceMock.saveParametros).toHaveBeenCalledTimes(1));
    const saved = serviceMock.saveParametros.mock.calls[0][0];
    expect(saved.tiposRescisao[0]).toMatchObject({ ativo: false, geraAvisoPrevio: false });
  });
});

it('preserva o rascunho e a versão original após uma atualização remota', async () => {
  const { queryClient } = renderPage();
  const input = await screen.findByLabelText('Nome exibido de sem_justa_causa') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Minha edição' } });
  await act(async () => {
    queryClient.setQueryData(['parametrizacao', 'rescisao'], {
      ...parametros,
      updatedAt: '2026-09-05T10:00:00-03:00',
      tiposRescisao: parametros.tiposRescisao.map(tipo => ({ ...tipo, label: 'Alteração remota' })),
    });
  });
  expect(input.value).toBe('Minha edição');
  expect(screen.getByText('Alterações pendentes')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(serviceMock.saveParametros).toHaveBeenCalledOnce());
  expect(serviceMock.saveParametros.mock.calls[0][0].updatedAt).toBe(parametros.updatedAt);
});

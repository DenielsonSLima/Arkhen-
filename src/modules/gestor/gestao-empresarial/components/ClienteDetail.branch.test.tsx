/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClientBranch, Company } from '../services/gestaoEmpresarialService';
import { ClienteDetail } from './ClienteDetail';

const branch: ClientBranch = {
  id: 'filial-1',
  companyId: 'cliente-1',
  nome: 'Filial Original',
  cnpj: '12.345.678/0002-70',
  email: '',
  telefone: '',
  cidade: 'Maceió',
  uf: 'AL',
  ativo: true,
  documentFolderPath: 'Filiais/Filial Original - filial-1',
};

const company: Company = {
  id: 'cliente-1',
  nome: 'Empresa Matriz',
  razaoSocial: 'Empresa Matriz Ltda',
  cnpj: '12.345.678/0001-90',
  tipo: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '',
  endereco: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  polos: [branch],
};

describe('ClienteDetail branch editing', () => {
  it('preserva documentFolderPath ao aplicar os dados retornados pelo formulário', async () => {
    const onUpdateCompany = vi.fn().mockResolvedValue(undefined);
    render(
      <ClienteDetail
        company={company}
        initialTab="filiais"
        onBack={vi.fn()}
        onUpdateCompany={onUpdateCompany}
        onToggleStatus={vi.fn()}
        onSyncCnae={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Editar Dados da Filial'));
    fireEvent.change(screen.getByDisplayValue('Filial Original'), {
      target: { value: 'Filial Atualizada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Filial' }));

    await waitFor(() => expect(onUpdateCompany).toHaveBeenCalledTimes(1));
    const updatedCompany = onUpdateCompany.mock.calls[0][0] as Company;
    expect(updatedCompany.polos).toEqual([
      expect.objectContaining({
        id: branch.id,
        nome: 'Filial Atualizada',
        documentFolderPath: branch.documentFolderPath,
      }),
    ]);
  });
});

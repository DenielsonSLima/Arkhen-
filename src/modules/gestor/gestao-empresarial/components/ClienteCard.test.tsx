/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Company } from '../services/gestaoEmpresarialService';
import { ClienteCard } from './ClienteCard';

afterEach(cleanup);

const company = {
  id: 'partner-1',
  nome: 'B & M Assessoria',
  razaoSocial: 'Barreto & Machado Assessoria e Consultoria Contábil Ltda',
  cnpj: '35.898.750/0001-07',
  tipo: 'Simples Nacional',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '(79) 99468-9000',
  endereco: 'Antonio Dultra, 1169',
  cidade: 'Itabaiana',
  uf: 'SE',
  funcionarios: [],
  ferias: [],
  documentos: [],
  polos: [],
} satisfies Company;

const renderCard = () => {
  const onSelect = vi.fn();
  const onEdit = vi.fn();
  const onToggleStatus = vi.fn();
  const onDelete = vi.fn();

  render(
    <ClienteCard
      company={company}
      isAccountingClient
      onSelect={onSelect}
      onEdit={onEdit}
      onToggleStatus={onToggleStatus}
      onDelete={onDelete}
    />,
  );

  return { onSelect, onEdit, onToggleStatus, onDelete };
};

describe('ClienteCard', () => {
  it('renderiza as ações como botões identificáveis e não comprimíveis', () => {
    renderCard();

    expect(screen.getByRole('group', { name: `Ações de ${company.nome}` })).toBeTruthy();

    const editButton = screen.getByRole('button', { name: `Editar ${company.nome}` });
    const statusButton = screen.getByRole('button', { name: `Inativar ${company.nome}` });
    const deleteButton = screen.getByRole('button', { name: `Excluir ${company.nome}` });

    expect(editButton.getAttribute('type')).toBe('button');
    expect(statusButton.classList.contains('company-card-action-button')).toBe(true);
    expect(deleteButton.classList.contains('company-card-action-button--delete')).toBe(true);
  });

  it('executa cada ação sem abrir o card por propagação de clique', () => {
    const { onSelect, onEdit, onToggleStatus, onDelete } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: `Editar ${company.nome}` }));
    fireEvent.click(screen.getByRole('button', { name: `Inativar ${company.nome}` }));
    fireEvent.click(screen.getByRole('button', { name: `Excluir ${company.nome}` }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0]?.[1]).toBe(company);
    expect(onToggleStatus).toHaveBeenCalledWith(company);
    expect(onDelete).toHaveBeenCalledWith(company.id);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(company.nome));
    expect(onSelect).toHaveBeenCalledWith(company.id);
  });
});

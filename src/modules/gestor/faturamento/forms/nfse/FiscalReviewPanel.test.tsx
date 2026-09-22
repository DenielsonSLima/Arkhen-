/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FiscalReview } from '../../services/faturamentoFiscalTypes';
import { blankFiscalData } from './fiscalFormData';
import { FiscalReviewPanel } from './FiscalReviewPanel';

afterEach(cleanup);
const review: FiscalReview = {
  rascunho: { id: 'draft', empresaId: 'tenant', fiscalConfigId: 'config', clienteId: 'client',
    ambiente: 'homologacao', status: 'rascunho', dados: blankFiscalData(), createdAt: '', updatedAt: '' },
  prestador: { cnpj: '11222333000181', razaoSocial: 'Emitente', inscricaoMunicipal: '123' },
  tomador: { documento: '11144477735', razaoSocial: 'Tomador', endereco: 'Rua da revisão', numero: '10A',
    bairro: 'Centro', codigoMunicipio: '2802908', uf: 'SE', cep: '49500000', email: 'tomador@example.test', telefone: '79999990000' },
  endpoint: 'https://homologacao.webiss.com.br/ws/nfse.asmx', ready: true, blockers: [],
};
describe('FiscalReviewPanel', () => {
  it('mostra os dados efetivos do tomador retornados pela revisão no painel existente', () => {
    const { container } = render(<FiscalReviewPanel review={review} />);
    for (const [label, value] of [
      ['Endereço do tomador', 'Rua da revisão'], ['Número do tomador', '10A'], ['Bairro do tomador', 'Centro'],
      ['Município IBGE do tomador', '2802908'], ['UF do tomador', 'SE'], ['CEP do tomador', '49500000'],
      ['E-mail do tomador', 'tomador@example.test'], ['Telefone do tomador', '79999990000'],
    ]) expect(screen.getByText(label).nextElementSibling?.textContent).toBe(value);
    expect(container.querySelectorAll('dl.nfse-review-values')).toHaveLength(1);
  });
  it('mostra ausência de dados opcionais e mantém o bloqueio do serviço visível', () => {
    render(<FiscalReviewPanel review={{ ...review, ready: false, blockers: ['CEP do tomador invalido.'],
      tomador: { documento: '11144477735', razaoSocial: 'Tomador' } }} />);
    expect(screen.getByText('CEP do tomador').nextElementSibling?.textContent).toBe('Não informado');
    expect(screen.getByRole('alert').textContent).toContain('CEP do tomador invalido.');
  });
});

/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ModelosTab } from './ModelosTab';
const mocks = vi.hoisted(() => ({ save: vi.fn(), activate: vi.fn(), rows: [] as unknown[] }));
const tenant='11111111-1111-4111-8111-111111111111';
const config='33333333-3333-4333-8333-333333333333';
vi.mock('../queries/useFaturamentoFiscalQueries', () => ({
 useFiscalBillingTenant: () => ({ data: '11111111-1111-4111-8111-111111111111' }),
 useFiscalEmitters: () => ({ data: [{ id:'33333333-3333-4333-8333-333333333333',prestadorNome:'Empresa',prestadorCnpj:'00.000.000/0001-00' }] }),
}));
vi.mock('../modelos/queries/useFiscalModels', () => ({ useFiscalModels: () => ({
 list: { data:mocks.rows }, save:{ mutateAsync:mocks.save }, activate:{ mutateAsync:mocks.activate },
}) }));
const model={id:'22222222-2222-4222-8222-222222222222',empresaId:tenant,fiscalConfigId:config,nome:'Mensalidade',dados:{descricao:'Serviço contábil'},ativo:true,versao:1,updatedAt:'2026-11-12'};
beforeEach(()=>{vi.clearAllMocks(); mocks.rows=[model]; mocks.save.mockResolvedValue(model); mocks.activate.mockResolvedValue({...model,ativo:false});});
afterEach(cleanup);
describe('Modelos reais no Faturamento',()=>{
 it('clona em novo UUID, sem criar automaticamente',async()=>{
  render(<ModelosTab/>); fireEvent.click(screen.getByRole('button',{name:'Clonar'}));
  expect((screen.getByLabelText('Nome do modelo') as HTMLInputElement).value).toBe('Mensalidade (cópia)');
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Salvar modelo'}));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
  expect(mocks.save.mock.calls[0][0]).toMatchObject({versao:0,dados:model.dados,fiscalConfigId:config});
  expect(mocks.save.mock.calls[0][0].id).not.toBe(model.id);
 });
 it('inativação exige confirmação padrão e preserva identidade',async()=>{
  render(<ModelosTab/>); fireEvent.click(screen.getByRole('button',{name:'Inativar'}));
  expect(mocks.activate).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
  await waitFor(()=>expect(mocks.activate).toHaveBeenCalledWith({model,active:false}));
 });
 it('erro de gravação conserva formulário e valores para corrigir',async()=>{
  mocks.save.mockRejectedValue(new Error('Modelo alterado. Recarregue.'));
  render(<ModelosTab/>); fireEvent.click(screen.getByRole('button',{name:'Editar'}));
  fireEvent.click(screen.getByRole('button',{name:'Salvar modelo'}));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Nome do modelo') as HTMLInputElement).value).toBe('Mensalidade');
 });
 it('inativos só aparecem após habilitar filtro',()=>{
  mocks.rows=[{...model,ativo:false}]; render(<ModelosTab/>);
  expect(screen.queryByRole('button',{name:'Reativar'})).toBeNull();
  fireEvent.click(screen.getByLabelText('Mostrar inativos'));
  expect(screen.getByRole('button',{name:'Reativar'})).toBeTruthy();
  expect((screen.getByRole('button',{name:'Editar'}) as HTMLButtonElement).disabled).toBe(true);
 });
});

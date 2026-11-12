import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../../../lib/supabase', () => ({ supabase: {} }));
import { createModelService } from './modelosFiscalService';
const tenant = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const config = '33333333-3333-4333-8333-333333333333';
const model = { id, empresaId: tenant, fiscalConfigId: config, nome: 'Consultoria', dados: { descricao: 'Serviços contábeis' }, ativo: true, versao: 1, updatedAt: '2026-11-12' };
describe('Modelos fiscais: contrato e isolamento', () => {
  it('envia empresa esperada em todas consultas', async () => {
    const rpc = vi.fn().mockResolvedValue([model]);
    expect(await createModelService(rpc).list(tenant)).toEqual([model]);
    expect(rpc).toHaveBeenCalledWith('listar_modelos_fiscais', { p_empresa_id: tenant });
  });
  it('rejeita resposta de outra empresa', async () => {
    await expect(createModelService(vi.fn().mockResolvedValue([{ ...model, empresaId: id }])).list(tenant)).rejects.toThrow('outra empresa');
  });
  it('rejeita lista duplicada', async () => {
    await expect(createModelService(vi.fn().mockResolvedValue([model, model])).list(tenant)).rejects.toThrow('inconsistente');
  });
  it('salva por RPC sem chamar provedor e conserva versão para concorrência', async () => {
    const rpc = vi.fn().mockResolvedValue(model);
    await createModelService(rpc).save(tenant, { ...model, versao: 0 });
    expect(rpc).toHaveBeenCalledWith('salvar_modelo_fiscal', expect.objectContaining({ p_empresa_id: tenant, p_id: id, p_config_id: config, p_versao: 0 }));
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('não aceita identidade fiscal, datas ou tomador em presets', async () => {
    const rpc = vi.fn();
    await expect(createModelService(rpc).save(tenant, { ...model, dados: { ...model.dados, competencia: '2026-01-01' } } as never)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('inativa com versão, preservando a identidade', async () => {
    const rpc = vi.fn().mockResolvedValue({ ...model, ativo: false, versao: 2 });
    await createModelService(rpc).activate(tenant, model, false);
    expect(rpc).toHaveBeenCalledWith('ativar_modelo_fiscal', { p_empresa_id: tenant, p_id: id, p_versao: 1, p_ativo: false });
  });
  it('bloqueia mutação com modelo de empresa diferente antes da rede', async () => {
    const rpc = vi.fn();
    await expect(createModelService(rpc).activate(id, model, false)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

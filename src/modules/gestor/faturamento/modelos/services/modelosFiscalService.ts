import { z } from 'zod';
import { supabase } from '../../../../../lib/supabase';

export const presetKeys = ['descricao', 'valor', 'itemListaServico', 'codigoCnae', 'codigoTributacaoMunicipio',
  'codigoNbs', 'codigoMunicipio', 'municipioIncidencia', 'exigibilidadeIss', 'issRetido', 'responsavelRetencao',
  'optanteSimplesNacional', 'regimeEspecial', 'incentivoFiscal', 'aliquotaIss'] as const;
export type PresetKey = typeof presetKeys[number];
export type ModelData = Partial<Record<PresetKey, string>>;
const dataSchema = z.object(Object.fromEntries(presetKeys.map(key => [key, z.string().max(4000).optional()]))).strict();
const modelSchema = z.object({ id: z.uuid(), empresaId: z.uuid(), fiscalConfigId: z.uuid(), nome: z.string().min(1).max(100),
  dados: dataSchema, ativo: z.boolean(), versao: z.number().int().positive(), updatedAt: z.string().min(1) });
export interface FiscalModel { id: string; empresaId: string; fiscalConfigId: string; nome: string; dados: ModelData; ativo: boolean; versao: number; updatedAt: string }
export interface ModelInput { id: string; fiscalConfigId: string; nome: string; dados: ModelData; versao: number }
export function parseModel(value: unknown, tenant: string): FiscalModel {
  const row = modelSchema.parse(value) as FiscalModel;
  if (row.empresaId !== tenant) throw new Error('O modelo pertence a outra empresa.');
  return row;
}
export function createModelService(rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>) {
  const tenantId = (tenant: string) => z.uuid().parse(tenant);
  return {
    async list(tenant: string): Promise<FiscalModel[]> {
      const data = await rpc('listar_modelos_fiscais', { p_empresa_id: tenantId(tenant) });
      if (!Array.isArray(data)) throw new Error('Lista de modelos indisponível.');
      const rows = data.map(row => parseModel(row, tenant));
      if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Lista de modelos inconsistente.');
      return rows;
    },
    async save(tenant: string, input: ModelInput): Promise<FiscalModel> {
      const args = { p_empresa_id: tenantId(tenant), p_id: z.uuid().parse(input.id),
        p_config_id: z.uuid().parse(input.fiscalConfigId), p_nome: z.string().trim().min(1).max(100).parse(input.nome),
        p_dados: dataSchema.parse(input.dados), p_versao: z.number().int().nonnegative().parse(input.versao) };
      const row = parseModel(await rpc('salvar_modelo_fiscal', args), tenant);
      if (row.id !== input.id || row.fiscalConfigId !== input.fiscalConfigId) throw new Error('Resposta de modelo incompatível.');
      return row;
    },
    async activate(tenant: string, model: FiscalModel, active: boolean): Promise<FiscalModel> {
      parseModel(model, tenant);
      const row = parseModel(await rpc('ativar_modelo_fiscal', { p_empresa_id: tenantId(tenant), p_id: model.id,
        p_versao: model.versao, p_ativo: active }), tenant);
      if (row.id !== model.id || row.ativo !== active) throw new Error('Resposta de modelo incompatível.');
      return row;
    },
  };
}
export const modelosFiscalService = createModelService(async (name, args) => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (['PGRST202', '42883', '42P01'].includes(error.code || '')) throw new Error('Modelos fiscais indisponíveis: a atualização do banco ainda precisa ser aplicada.');
    throw new Error(error.message);
  }
  return data;
});

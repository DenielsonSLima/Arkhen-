import { supabase } from '../../../../../lib/supabase';

export type SystemModuleId =
  | 'inicio'
  | 'clientes'
  | 'atividades'
  | 'conformidade'
  | 'protocolos'
  | 'simulacoes-calculos'
  | 'reforma-tributaria'
  | 'faturamento'
  | 'financeiro'
  | 'documentos'
  | 'agenda'
  | 'parametrizacao'
  | 'configuracoes';

export interface SystemModuleConfig {
  id: SystemModuleId;
  nome: string;
  descricao: string;
  categoria: string;
  obrigatorio: boolean;
  habilitado: boolean;
  ordem: number;
}

export interface SystemModulesResponse {
  canManage: boolean;
  available: boolean;
  modulos: SystemModuleConfig[];
}

export interface SaveSystemModuleInput {
  id: SystemModuleId;
  habilitado: boolean;
}

const normalizeResponse = (value: unknown): SystemModulesResponse => {
  const response = (value || {}) as Partial<SystemModulesResponse>;
  return {
    canManage: response.canManage === true,
    available: true,
    modulos: Array.isArray(response.modulos) ? response.modulos : [],
  };
};

const fallbackModules: SystemModuleConfig[] = [
  ['inicio', 'Início', 'Painel inicial e indicadores do escritório.', 'Essenciais', true],
  ['clientes', 'Clientes', 'Carteira, empresas e dados cadastrais.', 'Essenciais', true],
  ['atividades', 'Atividades', 'Filas, rotinas e acompanhamento operacional.', 'Operação', false],
  ['conformidade', 'Conformidade', 'Obrigações e situação fiscal dos clientes.', 'Operação', false],
  ['protocolos', 'Protocolos', 'Solicitações, protocolos e entregas.', 'Operação', false],
  ['simulacoes-calculos', 'Simulações e Cálculos', 'Ferramentas tributárias e cenários.', 'Tributário', false],
  ['reforma-tributaria', 'Reforma Tributária', 'Adequação IBS/CBS e split payment.', 'Tributário', false],
  ['faturamento', 'Faturamento', 'Contratos, cobranças e notas de serviço.', 'Financeiro', false],
  ['financeiro', 'Financeiro', 'Contas, fluxo de caixa e conciliação.', 'Financeiro', false],
  ['documentos', 'Documentos', 'Arquivos e compartilhamentos.', 'Operação', false],
  ['agenda', 'Agenda', 'Compromissos e eventos da equipe.', 'Produtividade', false],
  ['parametrizacao', 'Parametrização', 'Cadastros e regras utilizadas pelo sistema.', 'Administração', false],
  ['configuracoes', 'Configurações', 'Empresa, equipe, permissões e integrações.', 'Essenciais', true],
].map(([id, nome, descricao, categoria, obrigatorio], ordem) => ({
  id: id as SystemModuleId,
  nome: String(nome),
  descricao: String(descricao),
  categoria: String(categoria),
  obrigatorio: Boolean(obrigatorio),
  habilitado: true,
  ordem: ordem + 1,
}));

const isMissingSchemaError = (error: { code?: string; message?: string }) => (
  error.code === 'PGRST202'
  || error.code === '42883'
  || String(error.message || '').includes('listar_configuracoes_modulos_sistema')
);

export const modulosSistemaService = {
  async list(): Promise<SystemModulesResponse> {
    const { data, error } = await supabase.rpc('listar_configuracoes_modulos_sistema');
    if (error && isMissingSchemaError(error)) {
      return { canManage: false, available: false, modulos: fallbackModules };
    }
    if (error) throw new Error(`Erro ao carregar módulos: ${error.message}`);
    return normalizeResponse(data);
  },

  async save(modulos: SaveSystemModuleInput[]): Promise<SystemModulesResponse> {
    const { data, error } = await supabase.rpc('salvar_configuracoes_modulos_sistema', {
      p_modulos: modulos,
    });
    if (error) throw new Error(`Erro ao salvar módulos: ${error.message}`);
    return normalizeResponse(data);
  },
};

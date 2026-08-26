import { supabase } from '../../../../lib/supabase';
import { getInicioEmpresaId } from './inicioTenant';

interface EmpresaSetupRow {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  cidade: string | null;
  estado: string | null;
  logo_url: string | null;
}

interface MarcaDaguaSetupRow {
  file_url_paisagem: string | null;
  file_url_retrato: string | null;
}

interface ClienteSetupRow {
  id: string;
  modelos_ativos: string[] | null;
}

export interface InicioSetupSource {
  empresa: EmpresaSetupRow | null;
  marcaDagua: MarcaDaguaSetupRow | null;
  clientes: ClienteSetupRow[];
  modelosAtivos: number;
  rotinasAtivas: number;
  tarefasAtivas: number;
  usuariosAtivos: number;
}

export interface InicioSetupStatus {
  empresaCompleta: boolean;
  logoConfigurado: boolean;
  marcasDaguaConfiguradas: boolean;
  identidadeCompleta: boolean;
  clientesAtivos: number;
  clientesComModelos: number;
  modelosAtivos: number;
  modelosVinculados: boolean;
  rotinasAtivas: number;
  tarefasAtivas: number;
  operacaoPlanejada: boolean;
  usuariosAtivos: number;
  essenciaisConcluidos: number;
  essenciaisTotal: number;
  configuracaoEssencialCompleta: boolean;
  configuracaoRecomendadaCompleta: boolean;
}

const hasText = (value?: string | null) => Boolean(value?.trim());
const hasDigits = (value: string | null | undefined, length: number) => (
  String(value || '').replace(/\D/g, '').length === length
);
const isDemoCep = (value?: string | null) => (
  String(value || '').replace(/\D/g, '') === '49000000'
);
const isDemoAddress = (value?: string | null) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('ficticia');
};

const getCount = (
  response: { count: number | null; error: { message: string } | null },
  label: string,
) => {
  if (response.error) throw new Error(`Erro ao verificar ${label}: ${response.error.message}`);
  return response.count ?? 0;
};

export const buildInicioSetupStatus = (source: InicioSetupSource): InicioSetupStatus => {
  const empresa = source.empresa;
  const empresaCompleta = Boolean(
    (hasText(empresa?.razao_social) || hasText(empresa?.nome_fantasia))
    && hasDigits(empresa?.cnpj, 14)
    && (hasText(empresa?.email) || hasText(empresa?.telefone))
    && hasDigits(empresa?.cep, 8)
    && !isDemoCep(empresa?.cep)
    && hasText(empresa?.endereco)
    && !isDemoAddress(empresa?.endereco)
    && hasText(empresa?.numero)
    && hasText(empresa?.cidade)
    && hasText(empresa?.estado),
  );
  const logoConfigurado = hasText(empresa?.logo_url);
  const marcasDaguaConfiguradas = Boolean(
    hasText(source.marcaDagua?.file_url_paisagem)
    && hasText(source.marcaDagua?.file_url_retrato),
  );
  const identidadeCompleta = logoConfigurado && marcasDaguaConfiguradas;
  const clientesAtivos = source.clientes.length;
  const clientesComModelos = source.clientes.filter((cliente) => (
    Array.isArray(cliente.modelos_ativos) && cliente.modelos_ativos.length > 0
  )).length;
  const modelosVinculados = clientesAtivos > 0
    && source.modelosAtivos > 0
    && clientesComModelos === clientesAtivos;
  const operacaoPlanejada = source.rotinasAtivas > 0 || source.tarefasAtivas > 0;
  const essentialStates = [
    empresaCompleta,
    clientesAtivos > 0,
    modelosVinculados,
    operacaoPlanejada,
  ];
  const essenciaisConcluidos = essentialStates.filter(Boolean).length;

  return {
    empresaCompleta,
    logoConfigurado,
    marcasDaguaConfiguradas,
    identidadeCompleta,
    clientesAtivos,
    clientesComModelos,
    modelosAtivos: source.modelosAtivos,
    modelosVinculados,
    rotinasAtivas: source.rotinasAtivas,
    tarefasAtivas: source.tarefasAtivas,
    operacaoPlanejada,
    usuariosAtivos: source.usuariosAtivos,
    essenciaisConcluidos,
    essenciaisTotal: essentialStates.length,
    configuracaoEssencialCompleta: essenciaisConcluidos === essentialStates.length,
    configuracaoRecomendadaCompleta: identidadeCompleta && source.usuariosAtivos > 0,
  };
};

export const inicioSetupService = {
  async getStatus(): Promise<InicioSetupStatus> {
    const empresaId = await getInicioEmpresaId();
    const [
      empresaResponse,
      marcaDaguaResponse,
      clientesResponse,
      modelosResponse,
      rotinasResponse,
      tarefasResponse,
      usuariosResponse,
    ] = await Promise.all([
      supabase
        .from('configuracoes_empresa')
        .select('razao_social,nome_fantasia,cnpj,email,telefone,cep,endereco,numero,cidade,estado,logo_url')
        .eq('empresa_id', empresaId)
        .maybeSingle<EmpresaSetupRow>(),
      supabase
        .from('configuracoes_marca_dagua')
        .select('file_url_paisagem,file_url_retrato')
        .eq('empresa_id', empresaId)
        .maybeSingle<MarcaDaguaSetupRow>(),
      supabase
        .from('clientes')
        .select('id,modelos_ativos')
        .eq('empresa_id', empresaId)
        .eq('status', 'Ativa'),
      supabase
        .from('atividades_modelos')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('ativo', true),
      supabase
        .from('atividades_rotinas')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('ativa', true),
      supabase
        .from('atividades_tarefas')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('ativo', true),
      supabase
        .from('configuracoes_usuarios')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('status', 'Ativo'),
    ]);

    if (empresaResponse.error) throw new Error(`Erro ao verificar os dados da empresa: ${empresaResponse.error.message}`);
    if (marcaDaguaResponse.error) throw new Error(`Erro ao verificar a identidade visual: ${marcaDaguaResponse.error.message}`);
    if (clientesResponse.error) throw new Error(`Erro ao verificar os clientes: ${clientesResponse.error.message}`);

    return buildInicioSetupStatus({
      empresa: empresaResponse.data,
      marcaDagua: marcaDaguaResponse.data,
      clientes: (clientesResponse.data || []) as ClienteSetupRow[],
      modelosAtivos: getCount(modelosResponse, 'os modelos de fechamento'),
      rotinasAtivas: getCount(rotinasResponse, 'as rotinas recorrentes'),
      tarefasAtivas: getCount(tarefasResponse, 'as tarefas operacionais'),
      usuariosAtivos: getCount(usuariosResponse, 'a equipe'),
    });
  },
};

import type { EmpresaDados } from '../empresa/services/empresaService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type {
  FiscalConfigData,
  FiscalLocationGroup,
  FiscalMunicipalityContext,
  NfsHistoryItem,
  NfsStats,
} from './services/fiscalIntegrationService';
import { fiscalIntegrationService } from './services/fiscalIntegrationService';
import { makeContextKey } from './services/fiscalIntegrationHelpers';

export type FiscalTab = 'contexto' | 'resumo' | 'ambiente' | 'certificado' | 'rps' | 'historico';

type FiscalEmissorCompany = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  cidade?: string;
  uf?: string;
  contato?: string;
  email?: string;
};

export const INITIAL_FISCAL_CONFIG: FiscalConfigData = {
  ambiente: 'homologacao',
  provedor: 'WebISS',
  usuarioWebService: '',
  senhaWebService: '',
  senhaWebServiceConfigured: false,
  certificadoSenha: '',
  certificadoSenhaConfigured: false,
  certificadoArquivoConfigured: false,
  certificadoNome: '',
  certificadoEmpresa: '',
  certificadoCNPJ: '',
  certificadoEmitidoEm: '',
  certificadoValidade: '',
  certificadoDiasRestantes: 0,
  serieRps: '',
  ultimoNumeroRps: '',
  proximoNumeroRps: '',
  ultimoNumeroNfse: '',
  inscricaoMunicipal: '',
  codigoCnae: '',
  codigoServico: '',
  itemListaServico: '',
  aliquotaIss: '',
  naturezaOperacao: '',
  regimeEspecial: '',
  incentivadorCultural: '',
  issRetido: '',
};

export const INITIAL_NFS_STATS: NfsStats = {
  emitidas: 0,
  canceladas: 0,
  rejeitadas: 0,
  pendentes: 0,
  ultimaEmissao: '',
  ultimoCancelamento: '',
  proximoNumeroNfse: '',
  ultimoProtocolo: '',
};

export const buildOfficeCompanyFromDados = (dados: EmpresaDados): FiscalEmissorCompany => ({
  id: 'office',
  nome: dados.nomeFantasia || dados.razaoSocial,
  razaoSocial: dados.razaoSocial,
  cnpj: dados.cnpj,
  cidade: dados.cidade,
  uf: dados.estado,
  contato: dados.email || dados.telefone,
  email: dados.email,
});

export const mapToCompanyRecord = (officeCompany: FiscalEmissorCompany): Company => ({
  id: officeCompany.id,
  nome: officeCompany.nome,
  razaoSocial: officeCompany.razaoSocial,
  cnpj: officeCompany.cnpj,
  tipo: 'MEI',
  categoriaCliente: 'Contabilidade',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: officeCompany.email || '',
  telefone: officeCompany.contato || '',
  endereco: 'Configuração da empresa',
  cidade: officeCompany.cidade,
  uf: officeCompany.uf,
  cep: '',
  bairro: '',
  contato: officeCompany.contato || '',
  inscricaoEstadual: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  pastasDocumentos: [],
  categoriasDocumentos: [],
});

export const resolveCompanyName = (companyId: string, companies: Company[]) => {
  if (companyId === 'office') {
    const office = companies.find((item) => item.id === 'office');
    if (office) {
      return office.nome || office.razaoSocial || 'Escritório (contabilidade)';
    }
  }

  const company = companies.find((item) => item.id === companyId);
  return company?.nome || company?.razaoSocial || 'Empresa de emissão';
};

export const hasSameCompanySnapshot = (left: Company[], right: Company[]) => {
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const other = right[index];
    if (!other || item.id !== other.id) return false;

    return (
      (item.nome || item.razaoSocial) === (other.nome || other.razaoSocial)
      && (item.uf || '') === (other.uf || '')
      && (item.cidade || '') === (other.cidade || '')
    );
  });
};

export const getDefaultUf = () => fiscalIntegrationService.getAvailableUfs()[0] || 'SP';

const normalizeLocation = (value: string) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const buildFiscalLocationTree = (
  selectedCompanyId: string,
  companies: Company[],
  fiscalContexts: FiscalMunicipalityContext[],
): FiscalLocationGroup[] => {
  try {
    const normalizedCompanyId = selectedCompanyId || 'office';
    const selectedCompanyName = resolveCompanyName(normalizedCompanyId, companies);
    const allContexts = fiscalContexts.filter((context) => (
      !selectedCompanyId || context.companyId === selectedCompanyId
    ));
    const availableProfiles = fiscalIntegrationService.getAvailablePrefeituraProfiles();
    const grouped = new Map<string, Map<string, FiscalMunicipalityContext>>();
    const usedLocations = new Set<string>();

    availableProfiles.forEach((profile) => {
      const existing = allContexts.find(
        (context) => normalizeLocation(context.uf) === normalizeLocation(profile.uf)
          && normalizeLocation(context.municipio) === normalizeLocation(profile.municipio),
      );
      const context: FiscalMunicipalityContext = existing ? {
        ...existing,
        companyName: resolveCompanyName(existing.companyId, companies),
      } : {
        key: makeContextKey({
          companyId: normalizedCompanyId,
          uf: profile.uf,
          municipio: profile.municipio,
        }),
        companyId: normalizedCompanyId,
        companyName: selectedCompanyName,
        uf: profile.uf,
        municipio: profile.municipio,
        isActive: false,
      };

      const uf = (context.uf || 'NA').trim().toUpperCase();
      const municipio = context.municipio || 'Não informado';
      const normalizedUf = normalizeLocation(uf);
      const normalizedMunicipio = normalizeLocation(municipio);
      const ufMap = grouped.get(uf) || new Map<string, FiscalMunicipalityContext>();

      ufMap.set(normalizedMunicipio, context);
      grouped.set(uf, ufMap);
      usedLocations.add(`${normalizedUf}|${normalizedMunicipio}`);
    });

    allContexts.forEach((context) => {
      const normalizedUf = normalizeLocation(context.uf);
      const normalizedMunicipio = normalizeLocation(context.municipio);
      if (usedLocations.has(`${normalizedUf}|${normalizedMunicipio}`)) return;

      const uf = (context.uf || 'NA').trim().toUpperCase();
      const ufMap = grouped.get(uf) || new Map<string, FiscalMunicipalityContext>();
      ufMap.set(normalizedMunicipio, {
        ...context,
        companyName: resolveCompanyName(context.companyId, companies),
      });
      grouped.set(uf, ufMap);
    });

    if (grouped.size === 0) return [];

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([uf, municipios]) => ({
        uf,
        municipios: Array.from(municipios.entries())
          .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
          .map(([, context]) => ({
            municipio: context.municipio || 'Não informado',
            contexts: [context],
          })),
      }));
  } catch (error) {
    console.error('Erro ao carregar árvore de integrações:', error);
    return [];
  }
};

export type FiscalHistoryFilters = {
  periodoInicio: string;
  periodoFim: string;
  status: string;
  notaNum: string;
  operacao: string;
  searchQuery: string;
};

export const filterFiscalHistory = (
  history: NfsHistoryItem[],
  filters: FiscalHistoryFilters,
) => history.filter((item) => {
  if (filters.periodoInicio && item.data < filters.periodoInicio) return false;
  if (filters.periodoFim && item.data > filters.periodoFim) return false;
  if (filters.status !== 'Todos' && item.status !== filters.status) return false;
  if (filters.operacao !== 'Todos' && item.operacao !== filters.operacao) return false;
  if (filters.notaNum && !item.numeroNfse.includes(filters.notaNum)) return false;

  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    const text = `${item.usuario} ${item.mensagemPrefeitura} ${item.protocolo} ${item.operacao}`.toLowerCase();
    if (!text.includes(query)) return false;
  }

  return true;
});

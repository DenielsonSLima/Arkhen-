import type {
  FrequenciaAtividade,
  RotinaAtividade,
} from '../services/rotinasAtividadesService';

export type RotinaWorkspaceFrequency = FrequenciaAtividade
  | 'Bimestral'
  | 'Trimestral'
  | 'Semestral'
  | 'Anual';

export type RotinaWorkspaceItem = Omit<RotinaAtividade, 'frequencia'> & {
  frequencia: RotinaWorkspaceFrequency;
  clienteId?: string;
  protocoloCodigo?: string;
  modeloId?: string;
};

export interface RotinaWorkspaceCompany {
  id: string;
  nome: string;
  cnpj?: string;
  regime?: string;
  tipo?: string;
  tipoEstabelecimento?: string;
  logo?: string;
}

export interface RotinaCompanyMetrics {
  totalRotinas: number;
  semResponsavel: number;
  proximaExecucao?: string;
}

export interface RotinaCompanyGroup<
  TCompany extends RotinaWorkspaceCompany = RotinaWorkspaceCompany,
> extends RotinaCompanyMetrics {
  cliente: TCompany;
  rotinas: RotinaWorkspaceItem[];
}

export interface RotinasFilterState {
  search?: string;
  companyId?: string;
  frequency?: RotinaWorkspaceFrequency | '';
  responsibleId?: string;
}

export const getRotinaEditableExecutionDate = (
  rotina: Pick<RotinaAtividade, 'proximaExecucao' | 'proximaExecucaoBase' | 'dataAncora'>,
) => rotina.proximaExecucaoBase || rotina.dataAncora || rotina.proximaExecucao;

export const getRotinaEditableModelId = (
  modeloId: string | undefined,
  availableModelIds: ReadonlySet<string>,
) => (modeloId && availableModelIds.has(modeloId) ? modeloId : undefined);

const ALL_FILTER_VALUES = new Set(['', 'all', 'todos', 'todas']);
const UNASSIGNED_FILTER_VALUES = new Set([
  'sem responsavel',
  'sem-responsavel',
  'unassigned',
]);

const normalizeText = (value: unknown) => String(value ?? '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const isAllFilter = (value: unknown) => ALL_FILTER_VALUES.has(normalizeText(value));

const resolveFrequency = (
  input: RotinaWorkspaceFrequency | Pick<RotinaWorkspaceItem, 'frequencia' | 'intervaloDias'>,
  intervaloDias?: number,
) => (
  typeof input === 'string'
    ? { frequencia: input, intervaloDias }
    : input
);

export function getRotinaFrequenciaLabel(
  rotina: Pick<RotinaWorkspaceItem, 'frequencia' | 'intervaloDias'>,
): string;
export function getRotinaFrequenciaLabel(
  frequencia: RotinaWorkspaceFrequency,
  intervaloDias?: number,
): string;
export function getRotinaFrequenciaLabel(
  input: RotinaWorkspaceFrequency | Pick<RotinaWorkspaceItem, 'frequencia' | 'intervaloDias'>,
  intervaloDias?: number,
) {
  const resolved = resolveFrequency(input, intervaloDias);

  if (resolved.frequencia !== 'Personalizada') return resolved.frequencia;
  if (resolved.intervaloDias === 60) return 'Bimestral';
  if (resolved.intervaloDias === 365) return 'Anual';
  if (resolved.intervaloDias && resolved.intervaloDias > 0) {
    return `A cada ${resolved.intervaloDias} dias`;
  }
  return 'Personalizada';
}

const hasResponsible = (rotina: RotinaWorkspaceItem) => Boolean(
  rotina.responsavelConfigUsuarioId
  || rotina.responsavelUserId
  || rotina.responsavel?.trim(),
);

export const getRotinaCompanyMetrics = (
  rotinas: readonly RotinaWorkspaceItem[],
): RotinaCompanyMetrics => {
  const proximaExecucao = rotinas
    .filter((rotina) => rotina.ativa !== false && rotina.proximaExecucao?.trim())
    .map((rotina) => rotina.proximaExecucao.trim())
    .sort((left, right) => left.localeCompare(right))[0];

  return {
    totalRotinas: rotinas.length,
    semResponsavel: rotinas.filter((rotina) => !hasResponsible(rotina)).length,
    proximaExecucao,
  };
};

export const groupRotinasByCompany = <TCompany extends RotinaWorkspaceCompany>(
  companies: readonly TCompany[],
  rotinas: readonly RotinaWorkspaceItem[],
): RotinaCompanyGroup<TCompany>[] => {
  const rotinasByCompanyId = new Map<string, RotinaWorkspaceItem[]>();

  rotinas.forEach((rotina) => {
    const clienteId = rotina.clienteId?.trim();
    if (!clienteId) return;
    const current = rotinasByCompanyId.get(clienteId);
    if (current) current.push(rotina);
    else rotinasByCompanyId.set(clienteId, [rotina]);
  });

  const includedCompanyIds = new Set<string>();
  return companies.flatMap((cliente) => {
    if (!cliente.id || includedCompanyIds.has(cliente.id)) return [];
    includedCompanyIds.add(cliente.id);
    const companyRotinas = rotinasByCompanyId.get(cliente.id) || [];
    return [{
      cliente,
      rotinas: companyRotinas,
      ...getRotinaCompanyMetrics(companyRotinas),
    }];
  });
};

const matchesSearch = (rotina: RotinaWorkspaceItem, search: string) => {
  if (!search) return true;
  const searchableValues = [
    rotina.nome,
    rotina.cliente,
    rotina.responsavel,
    rotina.categoria,
    rotina.protocoloCodigo,
    rotina.modeloId,
    getRotinaFrequenciaLabel(rotina),
  ];
  return searchableValues.some((value) => normalizeText(value).includes(search));
};

const matchesFrequency = (
  rotina: RotinaWorkspaceItem,
  frequency: RotinasFilterState['frequency'],
) => {
  if (isAllFilter(frequency)) return true;
  if (frequency === 'Personalizada') {
    return rotina.frequencia === 'Personalizada'
      && rotina.intervaloDias !== 60
      && rotina.intervaloDias !== 365;
  }
  return normalizeText(getRotinaFrequenciaLabel(rotina)) === normalizeText(frequency);
};

const matchesResponsible = (
  rotina: RotinaWorkspaceItem,
  responsibleId: RotinasFilterState['responsibleId'],
) => {
  if (isAllFilter(responsibleId)) return true;
  const normalizedFilter = normalizeText(responsibleId);
  if (UNASSIGNED_FILTER_VALUES.has(normalizedFilter)) return !hasResponsible(rotina);

  return rotina.responsavelConfigUsuarioId === responsibleId
    || rotina.responsavelUserId === responsibleId
    || normalizeText(rotina.responsavel) === normalizedFilter;
};

export const filterRotinas = (
  rotinas: readonly RotinaWorkspaceItem[],
  filters: RotinasFilterState,
): RotinaWorkspaceItem[] => {
  const search = normalizeText(filters.search);

  return rotinas.filter((rotina) => (
    matchesSearch(rotina, search)
    && (isAllFilter(filters.companyId) || rotina.clienteId === filters.companyId)
    && matchesFrequency(rotina, filters.frequency)
    && matchesResponsible(rotina, filters.responsibleId)
  ));
};

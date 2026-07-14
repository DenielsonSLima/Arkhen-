import { supabase } from '../../../../lib/supabase';
import { gestaoEmpresarialService, type Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export type ConformidadeTipo = 'fiscal' | 'folha' | 'documentos' | 'protocolo' | 'atendimento';
export type ConformidadePrioridade = 'verde' | 'amarelo' | 'vermelho';
export type ConformidadeStatus = 'Pendente' | 'Em andamento' | 'Concluído';

export interface ConformidadeDocumentoPendente {
  id: string;
  nome: string;
  faltaDesde: string;
}

export interface ConformidadeEtapa {
  id: 'recebimento' | 'conferencia' | 'apuracao' | 'entrega' | 'fechamento';
  label: string;
  concluida: boolean;
  concluidaEm?: string;
  responsavel?: string;
}

export interface ConformidadeRegraContrato {
  prazoDias: number;
  impacto: 1 | 2 | 3 | 4 | 5;
  consequencia: string;
}

export interface ConformidadeObrigacao {
  id: string;
  tipo: ConformidadeTipo;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  competencia: string;
  rotina: string;
  descricao: string;
  responsavel: string;
  vencimento: string;
  prioridade: ConformidadePrioridade;
  status: ConformidadeStatus;
  atrasoDias: number;
  regraContrato: ConformidadeRegraContrato;
  etapas: ConformidadeEtapa[];
  documentosPendentes: ConformidadeDocumentoPendente[];
  criadoEm: string;
  atualizadoEm: string;
}

type ConformidadeEtapaId = ConformidadeEtapa['id'];
export type ConformidadeReferenceStep = Omit<ConformidadeEtapa, 'concluida' | 'concluidaEm' | 'responsavel'>;

interface ConformidadeTemplate {
  id: string;
  tipo: ConformidadeTipo;
  rotina: string;
  descricao: string;
  responsavelPadrao: string;
  diaVencimento: number;
  prazoContratoDias: number;
  impacto: 1 | 2 | 3 | 4 | 5;
  consequencia: string;
  documentos: string[];
}

const CONFORMIDADE_TABLE = 'conformidade_obrigacoes';
const SEED_MES_OFFSETS = [-1, 0, 1];

const REFERENCE_STEPS: ConformidadeReferenceStep[] = [
  { id: 'recebimento', label: 'Recebimento' },
  { id: 'conferencia', label: 'Conferência' },
  { id: 'apuracao', label: 'Apuração' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'fechamento', label: 'Fechamento' },
];

const stepIndexById = new Map<ConformidadeEtapaId, number>(REFERENCE_STEPS.map((step, index) => [step.id, index]));
const stepIds = new Set(stepIndexById.keys());

type ConformidadeProgressState = {
  obrigacaoId: string;
  clienteId: string;
  etapas: ConformidadeEtapa[];
  responsavel?: string;
  atualizadoEm: string;
};

type ConformidadeProgressDbRow = {
  obrigacao_id: string;
  cliente_id: string | null;
  etapas: unknown;
  status: ConformidadeStatus | null;
  responsavel: string | null;
  atualizado_em: string | null;
};

const TEMPLATES: ConformidadeTemplate[] = [
  {
    id: 'fiscal-apuracao',
    tipo: 'fiscal',
    rotina: 'Apuração Fiscal Mensal',
    descricao: 'Conferência de apurações fiscais e montagem da declaração mensal.',
    responsavelPadrao: 'João Silva',
    diaVencimento: 31,
    prazoContratoDias: 8,
    impacto: 5,
    consequencia: 'Emissão de alerta imediato, retenção de entrega até regularização do cliente.',
    documentos: ['Relatório SPED', 'Notas de entrada e saída'],
  },
  {
    id: 'fiscal-esocial',
    tipo: 'fiscal',
    rotina: 'eSocial e Retificações',
    descricao: 'Revisão de eventos do eSocial e eventual retificação por inconsistência.',
    responsavelPadrao: 'Karine',
    diaVencimento: 15,
    prazoContratoDias: 5,
    impacto: 4,
    consequencia: 'Multa por atraso e risco de bloqueio de envio de eventos.',
    documentos: ['Folha do período', 'Movimentações de eventos'],
  },
  {
    id: 'folha-mensal',
    tipo: 'folha',
    rotina: 'Fechamento de Folha',
    descricao: 'Conferência de encargos e aprovação da folha para pagamento.',
    responsavelPadrao: 'Fernanda',
    diaVencimento: 9,
    prazoContratoDias: 3,
    impacto: 5,
    consequencia: 'Repassar atraso ao cliente, com potencial cobrança administrativa e juros.',
    documentos: ['Ponto', 'Adeditivos e recibos', 'Tabela de benefícios'],
  },
  {
    id: 'documentos-habitec',
    tipo: 'documentos',
    rotina: 'Documentos de Atividade',
    descricao: 'Validação de documentos operacionais pendentes e arquivos faltantes.',
    responsavelPadrao: 'Pedro',
    diaVencimento: 10,
    prazoContratoDias: 10,
    impacto: 3,
    consequencia: 'Não iniciar o fechamento até o acervo documental estar completo.',
    documentos: ['Extratos', 'Comprovantes bancários', 'Contratos e recibos'],
  },
  {
    id: 'protocolo-competencia',
    tipo: 'protocolo',
    rotina: 'Protocolo de Entrega',
    descricao: 'Abertura e submissão das obrigações com validação de retorno do protocolo.',
    responsavelPadrao: 'João Silva',
    diaVencimento: 20,
    prazoContratoDias: 6,
    impacto: 4,
    consequencia: 'Bloquear novas tarefas do cliente até protocolo entregue.',
    documentos: ['Comprovantes de protocolo', 'XML de transmissão'],
  },
  {
    id: 'atendimento-cliente',
    tipo: 'atendimento',
    rotina: 'Retorno e Aprovação do Cliente',
    descricao: 'Revisão de pendências junto ao cliente e aprovação final para fechamento.',
    responsavelPadrao: 'Karine',
    diaVencimento: 14,
    prazoContratoDias: 4,
    impacto: 2,
    consequencia: 'Aviso ao gestor e replanejamento de competência.',
    documentos: ['Comprovante de aceite', 'Confirmação de retorno'],
  },
];

const isMissingConformidadeTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return err.code === '42P01' || String(err.message || '').includes('relation "public.conformidade_obrigacoes" does not exist');
};

const parseConformidadeEtapa = (raw: unknown): ConformidadeEtapa | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : '';
  if (!stepIds.has(id as ConformidadeEtapaId)) return null;

  return {
    id: id as ConformidadeEtapaId,
    label: REFERENCE_STEPS[stepIndexById.get(id as ConformidadeEtapaId) || 0].label,
    concluida: Boolean(item.concluida),
    concluidaEm: typeof item.concluidaEm === 'string' ? item.concluidaEm : undefined,
    responsavel: typeof item.responsavel === 'string' ? item.responsavel : undefined,
  };
};

const normalizeConformidadeEtapas = (value: unknown): ConformidadeEtapa[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => parseConformidadeEtapa(step))
    .filter((step): step is ConformidadeEtapa => !!step);
};

const parseUuid = (value: string) => {
  if (!value || typeof value !== 'string') return null;
  return /^[0-9a-fA-F-]{36}$/.test(value) ? value : null;
};

const loadProgressFromSupabase = async (): Promise<Map<string, ConformidadeProgressState>> => {
  try {
    const { data, error } = await supabase
      .from(CONFORMIDADE_TABLE)
      .select('obrigacao_id,cliente_id,etapas,status,responsavel,atualizado_em');

    if (error) {
      if (isMissingConformidadeTableError(error)) return new Map();
      throw error;
    }

    if (!Array.isArray(data)) return new Map();
    const progress = new Map<string, ConformidadeProgressState>();
    for (const row of data as unknown as ConformidadeProgressDbRow[]) {
      if (typeof row?.obrigacao_id !== 'string' || !row.obrigacao_id) continue;
      const etapas = normalizeConformidadeEtapas(row.etapas);
      progress.set(row.obrigacao_id, {
        obrigacaoId: row.obrigacao_id,
        clienteId: row.cliente_id || '',
        etapas,
        responsavel: row.responsavel || undefined,
        atualizadoEm: row.atualizado_em || new Date().toISOString(),
      });
    }
    return progress;
  } catch (error) {
    if (isMissingConformidadeTableError(error)) return new Map();
    console.warn('[conformidadeService] Falha ao carregar progresso da conformidade via Supabase. Seguindo sem cache remoto.', error);
    return new Map();
  }
};

const loadPersistedProgress = async (): Promise<Map<string, ConformidadeProgressState>> => (
  loadProgressFromSupabase()
);

const persistirProgressoObrigacao = async (obrigacao: ConformidadeObrigacao) => {
  try {
    const payload = {
      empresa_id: parseUuid(obrigacao.clienteId) || obrigacao.clienteId,
      obrigacao_id: obrigacao.id,
      cliente_id: parseUuid(obrigacao.clienteId),
      etapas: obrigacao.etapas,
      status: obrigacao.status,
      responsavel: obrigacao.responsavel,
      atualizado_em: obrigacao.atualizadoEm,
    };

    const { error } = await supabase
      .from(CONFORMIDADE_TABLE)
      .upsert(payload, { onConflict: 'empresa_id,obrigacao_id' });

    if (error) {
      if (isMissingConformidadeTableError(error)) return;
      throw error;
    }
  } catch (error) {
    if (isMissingConformidadeTableError(error)) return;
    console.error('[conformidadeService] Falha ao salvar progresso da conformidade no Supabase.', error);
  }
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const diffDays = (dueDateIso: string, reference: Date = new Date()) => {
  const due = new Date(`${dueDateIso}T00:00:00`);
  const now = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  return Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
};

const hashSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash &= hash;
  }
  return hash;
};

const calculaPrioridade = (diasRestantes: number, impacto: 1 | 2 | 3 | 4 | 5): ConformidadePrioridade => {
  if (diasRestantes >= 0 && impacto <= 2) return 'verde';
  if (diasRestantes >= -3 && impacto <= 4) return 'amarelo';
  if (impacto >= 5 && diasRestantes <= 6) return 'vermelho';
  if (diasRestantes < 0 && impacto >= 4) return 'vermelho';
  return 'amarelo';
};

const calculaStatus = (etapas: ConformidadeEtapa[]): ConformidadeStatus => {
  const concluidas = etapas.filter((etapa) => etapa.concluida).length;
  if (concluidas === 0) return 'Pendente';
  if (concluidas === etapas.length) return 'Concluído';
  return 'Em andamento';
};

const buildObrigacao = (company: Company, template: ConformidadeTemplate, monthOffset: number): ConformidadeObrigacao => {
  const now = new Date();
  const vencimento = buildDueDate(now, monthOffset, template.diaVencimento);
  const competencia = toMonthKey(new Date(vencimento));
  const id = `${company.id}-${template.id}-${competencia}`;
  const seed = hashSeed(id);
  const baseResponsavel = template.responsavelPadrao;
  const progressoInicial = monthOffset < 0 ? (seed % 3) : 0;
  const criadoEm = new Date(Date.now() - ((seed % 7) + 1) * 86400000).toISOString();
  const diasRestantes = diffDays(vencimento, now);
  const prioridade = calculaPrioridade(diasRestantes, template.impacto);

  const etapas = REFERENCE_STEPS.map((step, index) => ({
    ...step,
    concluida: monthOffset < 0 && index <= progressoInicial,
    concluidaEm: monthOffset < 0 && index <= progressoInicial
      ? new Date(Date.now() - ((progressoInicial - index) * 12 + 2) * 3600000).toISOString()
      : undefined,
    responsavel: monthOffset < 0 && index <= progressoInicial ? baseResponsavel : undefined,
  }));

  const documentosPendentes = template.documentos.map((nome, index) => ({
    id: `${id}-doc-${index}`,
    nome,
    faltaDesde: toDateInput(new Date(now.getTime() - (seed % 8 + index + 1) * 86400000)),
  }));

  return {
    id,
    tipo: template.tipo,
    clienteId: company.id,
    clienteNome: company.nome,
    cnpj: company.cnpj,
    competencia,
    rotina: template.rotina,
    descricao: template.descricao,
    responsavel: baseResponsavel,
    vencimento,
    prioridade,
    status: calculaStatus(etapas),
    atrasoDias: diasRestantes < 0 ? Math.abs(diasRestantes) : 0,
    regraContrato: {
      prazoDias: template.prazoContratoDias,
      impacto: template.impacto,
      consequencia: template.consequencia,
    },
    etapas,
    documentosPendentes,
    criadoEm,
    atualizadoEm: now.toISOString(),
  };
};

const buildDueDate = (base: Date, monthOffset: number, day: number) => {
  const monthDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, day);
  const correctedDay = Math.min(day, new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate());
  monthDate.setDate(correctedDay);
  return toDateInput(monthDate);
};

const enrichObrigacao = (raw: ConformidadeObrigacao): ConformidadeObrigacao => {
  const now = new Date();
  const diasRestantes = diffDays(raw.vencimento, now);
  const regraContrato = {
    prazoDias: raw.regraContrato.prazoDias || 0,
    impacto: raw.regraContrato.impacto || 1,
    consequencia: raw.regraContrato.consequencia || 'Sem regra associada no cadastro atual.',
  } satisfies ConformidadeRegraContrato;

  const etapas = REFERENCE_STEPS.map((step) => {
    const saved = raw.etapas.find((item) => item.id === step.id);
    return {
      ...step,
      concluida: saved?.concluida ?? false,
      concluidaEm: saved?.concluidaEm,
      responsavel: saved?.responsavel,
    };
  });

  const documentosPendentes = raw.documentosPendentes?.length
    ? raw.documentosPendentes
    : [{ id: `${raw.id}-doc-legacy`, nome: 'Documento pendente', faltaDesde: raw.criadoEm.slice(0, 10) }];

  return {
    ...raw,
    prioridade: calculaPrioridade(diasRestantes, regraContrato.impacto),
    status: calculaStatus(etapas),
    atrasoDias: diasRestantes < 0 ? Math.abs(diasRestantes) : 0,
    regraContrato,
    etapas,
    documentosPendentes,
  };
};

const sortObrigacoes = (list: ConformidadeObrigacao[]) => {
  const priorityWeight: Record<ConformidadePrioridade, number> = { verde: 1, amarelo: 2, vermelho: 3 };
  return [...list].sort((a, b) => {
    const weight = priorityWeight[b.prioridade] - priorityWeight[a.prioridade];
    if (weight !== 0) return weight;
    if (a.status !== b.status) return a.status === 'Em andamento' ? 1 : a.status === 'Pendente' ? -1 : 1;
    return a.vencimento.localeCompare(b.vencimento);
  });
};

const applyPersistedProgress = (
  obrigacao: ConformidadeObrigacao,
  progress?: ConformidadeProgressState | null,
) => {
  if (!progress || progress.etapas.length === 0) return obrigacao;
  return enrichObrigacao({
    ...obrigacao,
    etapas: obrigacao.etapas.map((etapa) => {
      const persisted = progress.etapas.find((item) => item.id === etapa.id);
      if (!persisted) return etapa;
      return {
        ...etapa,
        concluida: persisted.concluida,
        concluidaEm: persisted.concluidaEm,
        responsavel: persisted.responsavel || etapa.responsavel,
      };
    }),
    atualizadoEm: progress.atualizadoEm || obrigacao.atualizadoEm,
    responsavel: progress.responsavel || obrigacao.responsavel,
  });
};

const loadCompanies = async () => {
  const companies = await gestaoEmpresarialService.getCompanies();
  return companies.filter((company) => company.status === 'Ativa');
};

const buildSeedObrigacoes = async () => {
  const companies = await loadCompanies();
  const now = new Date();
  const nowKey = toMonthKey(now);
  const generated: ConformidadeObrigacao[] = [];

  for (const company of companies) {
    for (const template of TEMPLATES) {
      for (const offset of SEED_MES_OFFSETS) {
        const vencimento = buildDueDate(now, offset, template.diaVencimento);
        const vencimentoKey = vencimento.split('-').slice(0, 2).join('-');
        if (vencimentoKey < nowKey && offset < -1) continue;
        if (vencimentoKey > nowKey && offset > 1) continue;
        generated.push(buildObrigacao(company, template, offset));
      }
    }
  }

  return sortObrigacoes(generated);
};

const loadRpcObrigacoes = async (companyId?: string): Promise<ConformidadeObrigacao[] | null> => {
  const { data, error } = await supabase.rpc('get_conformidade_operacional', {
    p_cliente_id: companyId || null,
  });

  if (error || !Array.isArray(data)) {
    return null;
  }

  return data.map((item) => enrichObrigacao(item as ConformidadeObrigacao));
};

const getBaseObrigacoes = async (companyId?: string) => {
  const rpcItems = await loadRpcObrigacoes(companyId);
  if (rpcItems && rpcItems.length > 0) return rpcItems;
  return buildSeedObrigacoes();
};

const applyEtapaProgress = (
  obrigacao: ConformidadeObrigacao,
  etapaId: ConformidadeEtapaId,
  checked: boolean,
  usuario: string,
) => {
  const index = stepIndexById.get(etapaId);
  if (index === undefined) return obrigacao;

  if (checked) {
    const previous = obrigacao.etapas[index - 1];
    if (index > 0 && !previous.concluida) return obrigacao;
  }

  const now = new Date();
  const etapas = obrigacao.etapas.map((etapa, etapaIndex) => {
    if (etapaIndex < index) return etapa;
    if (etapaIndex === index) {
      if (!checked) {
        return { ...etapa, concluida: false, concluidaEm: undefined, responsavel: undefined };
      }

      return {
        ...etapa,
        concluida: true,
        concluidaEm: now.toISOString(),
        responsavel: usuario,
      };
    }

    if (!checked) {
      return {
        ...etapa,
        concluida: false,
        concluidaEm: undefined,
        responsavel: undefined,
      };
    }

    return etapa;
  });

  return enrichObrigacao({
    ...obrigacao,
    etapas,
    atualizadoEm: now.toISOString(),
    status: calculaStatus(etapas),
  });
};

export const conformidadeService = {
  async getObrigacoes(companyId?: string) {
    const persistedProgress = await loadPersistedProgress();
    const source = await getBaseObrigacoes(companyId);
    const merged = sortObrigacoes(source.map((item) => applyPersistedProgress(item, persistedProgress.get(item.id))));
    return companyId ? merged.filter((item) => item.clienteId === companyId) : merged;
  },

  async toggleEtapa(obrigacaoId: string, etapaId: ConformidadeEtapaId, checked: boolean, responsavel: string) {
    let all = await getBaseObrigacoes();
    const persistedProgress = await loadPersistedProgress();
    const next = all.map((obrigacao) => (
      obrigacao.id === obrigacaoId
        ? applyEtapaProgress(applyPersistedProgress(obrigacao, persistedProgress.get(obrigacao.id)), etapaId, checked, responsavel)
        : obrigacao
    ));

    const sorted = sortObrigacoes(next);
    const changed = next.find((item) => item.id === obrigacaoId);
    if (changed) {
      await persistirProgressoObrigacao(changed);
    }

    return sorted;
  },

  async getReferenceSteps() {
    return REFERENCE_STEPS;
  },

  async getTipoLabel(tipo: ConformidadeTipo) {
    const labels = {
      fiscal: 'Fiscal',
      folha: 'Folha',
      documentos: 'Documentos',
      protocolo: 'Protocolo',
      atendimento: 'Atendimento',
    } as const;
    return labels[tipo];
  },
};

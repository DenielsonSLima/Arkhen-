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

const STORAGE_KEY = 'contabil_conformidade_obrigacoes_v1';
const SEED_MES_OFFSETS = [-1, 0, 1];

const REFERENCE_STEPS: ConformidadeReferenceStep[] = [
  { id: 'recebimento', label: 'Recebimento' },
  { id: 'conferencia', label: 'Conferência' },
  { id: 'apuracao', label: 'Apuração' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'fechamento', label: 'Fechamento' },
];

const stepIndexById = new Map<ConformidadeEtapaId, number>(REFERENCE_STEPS.map((step, index) => [step.id, index]));

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
    documentos: ['Ponto', 'Aditivos e recibos', 'Tabela de benefícios'],
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

const readJson = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const notifyConformidadeChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('conformidade:changed'));
  }
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const clampDay = (year: number, month: number, day: number) => {
  const maxDay = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, maxDay));
};

const buildDueDate = (base: Date, monthOffset: number, day: number) => {
  const year = base.getFullYear();
  const targetMonth = base.getMonth() + monthOffset;
  const due = new Date(year, targetMonth, day);
  const fixedDay = clampDay(due.getFullYear(), due.getMonth(), day);
  due.setMonth(due.getMonth());
  due.setDate(fixedDay);
  return toDateInput(due);
};

const hashSeed = (value: string) => {
  let valueHash = 0;
  for (const char of value) {
    valueHash = (valueHash * 31 + char.charCodeAt(0)) % 99991;
  }
  return valueHash;
};

const diffDays = (targetISO: string, base: Date) => {
  const targetDate = new Date(`${targetISO}T00:00:00`);
  const baseDate = new Date(base.toISOString().slice(0, 10));
  const diff = targetDate.getTime() - baseDate.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
};

const calculaPrioridade = (diasRestantes: number, impacto: ConformidadeRegraContrato['impacto']): ConformidadePrioridade => {
  if (diasRestantes <= 1) return 'vermelho';
  if (diasRestantes <= 3) return 'amarelo';
  if (impacto >= 4) return 'amarelo';
  if (impacto >= 5 && diasRestantes <= 6) return 'vermelho';
  return 'verde';
};

const calculaStatus = (etapas: ConformidadeEtapa[]): ConformidadeStatus => {
  const concluídas = etapas.filter((etapa) => etapa.concluida).length;
  if (concluídas === 0) return 'Pendente';
  if (concluídas === etapas.length) return 'Concluído';
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

const loadPersisted = (): ConformidadeObrigacao[] => {
  const saved = readJson<ConformidadeObrigacao[]>(STORAGE_KEY, []);
  return saved.map(enrichObrigacao);
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

const loadCompanies = async () => {
  const companies = await gestaoEmpresarialService.getCompanies();
  return companies.filter((company) => company.status === 'Ativa');
};

const initializeSeed = async () => {
  const companies = await loadCompanies();
  const now = new Date();
  const existing = loadPersisted();
  const existingIds = new Set(existing.map((item) => item.id));
  const generated: ConformidadeObrigacao[] = [];
  const nowKey = toMonthKey(now);

  for (const company of companies) {
    for (const template of TEMPLATES) {
      for (const offset of SEED_MES_OFFSETS) {
        const vencimento = buildDueDate(now, offset, template.diaVencimento);
        if (toMonthKey(new Date(vencimento)) < nowKey && offset < -1) continue;
        if (toMonthKey(new Date(vencimento)) > nowKey && offset > 1) continue;
        const id = `${company.id}-${template.id}-${toMonthKey(new Date(vencimento))}`;
        if (!existingIds.has(id)) {
          generated.push(buildObrigacao(company, template, offset));
          existingIds.add(id);
        }
      }
    }
  }

  const merged = sortObrigacoes([...existing, ...generated]).map(enrichObrigacao);
  writeJson(STORAGE_KEY, merged);
  return merged;
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

const applyEtapaProgress = (obrigacao: ConformidadeObrigacao, etapaId: ConformidadeEtapaId, checked: boolean, usuario: string) => {
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
        return {
          ...etapa,
          concluida: false,
          concluidaEm: undefined,
          responsavel: undefined,
        };
      }

      return {
        ...etapa,
        concluida: true,
        concluidaEm: now.toISOString(),
        responsavel: usuario,
      };
    }

    // Se uma etapa anterior é desmarcada, etapas futuras também voltam para pendente.
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

  const updated: ConformidadeObrigacao = {
    ...obrigacao,
    etapas,
    atualizadoEm: now.toISOString(),
    status: calculaStatus(etapas),
  };

  return enrichObrigacao(updated);
};

export const conformidadeService = {
  async getObrigacoes(companyId?: string) {
    try {
      const rpcItems = await loadRpcObrigacoes(companyId);
      if (rpcItems && rpcItems.length > 0) {
        return sortObrigacoes(rpcItems);
      }
    } catch {
      // Mantem fallback local para ambientes sem a RPC aplicada.
    }

    const persisted = loadPersisted();
    const items = persisted.length === 0 ? await initializeSeed() : sortObrigacoes(persisted).map(enrichObrigacao);
    const scoped = companyId ? items.filter((item) => item.clienteId === companyId) : items;

    if (persisted.length > 0) {
      writeJson(STORAGE_KEY, items);
    }

    return scoped;
  },

  async toggleEtapa(obrigacaoId: string, etapaId: ConformidadeEtapaId, checked: boolean, responsavel: string) {
    const all = loadPersisted();
    const next = all.map((obrigacao) => (
      obrigacao.id === obrigacaoId
        ? applyEtapaProgress(enrichObrigacao(obrigacao), etapaId, checked, responsavel)
        : enrichObrigacao(obrigacao)
    ));
    const sorted = sortObrigacoes(next);
    writeJson(STORAGE_KEY, sorted);
    notifyConformidadeChanged();
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

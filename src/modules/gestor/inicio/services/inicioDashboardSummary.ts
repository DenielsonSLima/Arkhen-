import type { Evento } from '../../agenda/services/agenda.service';
import type { TarefaGestor } from '../../atividades/services/rotinasAtividadesService';

export type PeriodoChave = 'diaria' | 'semanal' | 'mensal';

export const PERIODO_CONFIG: Array<{ key: PeriodoChave; label: string }> = [
  { key: 'diaria', label: 'Diária' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensal', label: 'Mensal' },
];

export interface DashboardStats {
  clientesAtivos: number;
}

export interface VencimentoAlerta {
  id: string;
  empresaNome: string;
  tipo: 'documento' | 'certificado';
  nome: string;
  dataValidade: string;
  diasRestantes: number;
}

interface PeriodoResumo {
  total: number;
  done: number;
  pct: number;
}

export interface UsuarioResumo {
  key: string;
  usuario: string;
  total: number;
  done: number;
  atrasadas: number;
  pct: number;
  periodos: Record<PeriodoChave, PeriodoResumo>;
}

export interface InicioDashboardSummary {
  dataReferencia: string;
  tarefas: {
    total: number;
    done: number;
    pct: number;
    pendentesTotal: number;
    pendentes: TarefaGestor[];
    atividadesHoje: TarefaGestor[];
    atividadesHojeTotal: number;
    atrasadas: number;
    vencemHoje: number;
  };
  agenda: {
    total: number;
    hojeTotal: number;
    hoje: Evento[];
    semana: Evento[];
  };
  alertas: {
    total: number;
    vencidos: number;
    vencemHoje: number;
    itens: VencimentoAlerta[];
    criticos: VencimentoAlerta[];
  };
  operacao: {
    pendenciasTotal: number;
    atrasosTotal: number;
    vencemHojeTotal: number;
  };
  usuarios: UsuarioResumo[];
}

export interface InicioDashboardData {
  stats: DashboardStats;
  summary: InicioDashboardSummary;
}

export const EMPTY_INICIO_DASHBOARD_SUMMARY: InicioDashboardSummary = {
  dataReferencia: '',
  tarefas: {
    total: 0,
    done: 0,
    pct: 0,
    pendentesTotal: 0,
    pendentes: [],
    atividadesHoje: [],
    atividadesHojeTotal: 0,
    atrasadas: 0,
    vencemHoje: 0,
  },
  agenda: { total: 0, hojeTotal: 0, hoje: [], semana: [] },
  alertas: { total: 0, vencidos: 0, vencemHoje: 0, itens: [], criticos: [] },
  operacao: { pendenciasTotal: 0, atrasosTotal: 0, vencemHojeTotal: 0 },
  usuarios: [],
};

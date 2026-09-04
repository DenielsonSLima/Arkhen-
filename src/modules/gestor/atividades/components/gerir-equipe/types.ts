import type { CompanyActivityGroup } from '../../hooks/useAtividades';
import type {
  TarefaGestor,
  TarefaProgressoPatch,
} from '../../services/rotinasAtividadesService';

export type PeriodoFiltro = 'dia' | 'semana' | 'mes' | 'empresas';

export interface AbaGerirEquipeProps {
  companyGroups?: CompanyActivityGroup[];
  handleToggleStep?: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
}

export interface UserStats {
  id: string;
  nome: string;
  perfil: string;
  avatar: string;
  total: number;
  progresso: number;
  pendentes: number;
  atrasadas: number;
  emRisco: number;
  comPendencia: number;
  vencendoHoje: number;
  taxaNoPrazo: number;
}

export interface UsuarioEquipe {
  id: string;
  nome: string;
  configUsuarioId?: string;
  userId?: string;
}

export interface TaskSummary {
  done: number;
  progress: number;
  pending: number;
  late: number;
  atRisk: number;
  withIssue: number;
  dueToday: number;
  dueSoon: number;
  onTimeRate: number;
  total: number;
}

export interface TaskInspectorProps {
  filteredTasks: TarefaGestor[];
  requestArchive: (task: TarefaGestor) => void;
  selectedTask: TarefaGestor | null;
  setSelectedTaskId: (id: string | null) => void;
  toggleChecklist: (taskId: string, index: number, concluida: boolean) => void;
  updateTarefa: (id: string, patch: TarefaProgressoPatch) => void;
}

export interface CompanyInspectorProps {
  handleToggleStep?: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
  selectedCompany: CompanyActivityGroup | null;
  setSelectedCompanyId: (id: string | null) => void;
  userCompanyGroups: CompanyActivityGroup[];
}

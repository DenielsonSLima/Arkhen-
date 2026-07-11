import type { CompanyActivityGroup } from '../../hooks/useAtividades';
import type { TarefaGestor } from '../../services/rotinasAtividadesService';

export type PeriodoFiltro = 'dia' | 'semana' | 'mes' | 'empresas';

export interface AbaGerirEquipeProps {
  companyGroups?: CompanyActivityGroup[];
  handleToggleStep?: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
}

export interface UserStats {
  nome: string;
  perfil: string;
  avatar: string;
  total: number;
  progresso: number;
  pendentes: number;
  atrasadas: number;
}

export interface TaskSummary {
  done: number;
  progress: number;
  late: number;
  total: number;
}

export interface TaskInspectorProps {
  deleteTarefa: (id: string) => void;
  filteredTasks: TarefaGestor[];
  selectedTask: TarefaGestor | null;
  setSelectedTaskId: (id: string | null) => void;
  taskSummary: TaskSummary;
  toggleChecklist: (taskId: string, index: number, concluida: boolean) => void;
  updateTarefa: (id: string, patch: Partial<TarefaGestor>) => void;
}

export interface CompanyInspectorProps {
  handleToggleStep?: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
  selectedCompany: CompanyActivityGroup | null;
  setSelectedCompanyId: (id: string | null) => void;
  userCompanyGroups: CompanyActivityGroup[];
}

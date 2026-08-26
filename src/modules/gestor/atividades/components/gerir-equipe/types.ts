import type { CompanyActivityGroup } from '../../hooks/useAtividades';
import type { TarefaGestor } from '../../services/rotinasAtividadesService';
import type { CompletionEvidence } from '../../utils/completionEvidence';

export type PeriodoFiltro = 'dia' | 'semana' | 'mes' | 'empresas';

export interface AbaGerirEquipeProps {
  companyGroups?: CompanyActivityGroup[];
  handleToggleStep?: (instanciaId: string, etapa: string, value: boolean, proof?: CompletionEvidence) => Promise<void>;
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
  late: number;
  total: number;
}

export interface TaskInspectorProps {
  deleteTarefa: (id: string) => void;
  filteredTasks: TarefaGestor[];
  selectedTask: TarefaGestor | null;
  setSelectedTaskId: (id: string | null) => void;
  taskSummary: TaskSummary;
  toggleChecklist: (taskId: string, index: number, concluida: boolean, proof?: CompletionEvidence) => void;
  updateTarefa: (id: string, patch: Partial<TarefaGestor>) => void;
  authUserId: string | null;
  canManage: boolean;
  reviewTarefaAsync: (id: string, approve: boolean, justification?: string) => Promise<unknown>;
  reopenTarefaAsync: (id: string, justification: string) => Promise<unknown>;
  isSaving: boolean;
  saveError: Error | null;
}

export interface CompanyInspectorProps {
  handleToggleStep?: (instanciaId: string, etapa: string, value: boolean, proof?: CompletionEvidence) => Promise<void>;
  selectedCompany: CompanyActivityGroup | null;
  setSelectedCompanyId: (id: string | null) => void;
  userCompanyGroups: CompanyActivityGroup[];
}

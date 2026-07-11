// ============================================================
// Dados padrão da Agenda
// ============================================================

export type TipoEvento = string;
export type CategoriaEvento = string;

export interface Evento {
  id: string;
  titulo: string;
  descricao?: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:MM
  tipo: TipoEvento;
  categoriaId?: CategoriaEvento;
  empresaId?: string;
  empresaNome?: string;
  recorrente?: boolean;
  periodoRecorrencia?: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
  concluido?: boolean;
  responsavelId?: string;
  responsavelNome?: string;
  responsavelPerfil?: string;
  criadoPorId?: string;
  criadoPorNome?: string;
}

export interface UsuarioAgenda {
  id: string;
  nome: string;
  perfil: 'Administrador' | 'Gestor' | 'Contador Pleno' | 'Assistente' | 'Estagiário';
  status: 'Ativo' | 'Inativo' | 'Pendente';
  cor: string;
  ativo: boolean;
}

export const USUARIO_ATUAL_AGENDA: UsuarioAgenda = {
  id: '',
  nome: '',
  perfil: 'Administrador',
  status: 'Ativo',
  cor: '#64748b',
  ativo: true,
};

export const DEFAULT_USUARIOS_AGENDA: UsuarioAgenda[] = [];

export const DEFAULT_EMPRESAS_AGENDA: Array<{ id: string; nome: string }> = [];

// Gera prazos fiscais automáticos para um mês/ano
export function gerarPrazosFiscaisDoMes(ano: number, mes: number): Evento[] {
  void ano;
  void mes;
  return [];
}

export const DEFAULT_EVENTOS_EXTRAS: Evento[] = [];

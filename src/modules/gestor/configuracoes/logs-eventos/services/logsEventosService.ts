import { supabase } from '../../../../../lib/supabase';

export interface AuditLog {
  id: string;
  usuario: string;
  acao: string;
  modulo: string;
  tipo: 'Sucesso' | 'Alerta' | 'Info';
  ipAddress: string;
  horario: string;
}

export interface AuditLogRow {
  id: string;
  usuario_id: string | null;
  acao: string;
  modulo: string;
  tipo: 'Sucesso' | 'Erro' | 'Alerta';
  ip_address: string | null;
  detalhes: { usuario?: string } | null;
  created_at: string;
}

const formatHorario = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (sameDay(date, today)) return `Hoje, ${time}`;
  if (sameDay(date, yesterday)) return `Ontem, ${time}`;

  return date.toLocaleDateString('pt-BR');
};

const fromRow = (row: AuditLogRow): AuditLog => ({
  id: row.id,
  usuario: row.detalhes?.usuario || (row.usuario_id ? 'Usuário autenticado' : 'Sistema'),
  acao: row.acao,
  modulo: row.modulo,
  tipo: row.tipo === 'Erro' ? 'Alerta' : row.tipo,
  ipAddress: row.ip_address || 'localhost',
  horario: formatHorario(row.created_at),
});

export interface LogFilters { search: string; modulo: string; tipo: string }
export interface LogCursor { createdAt: string; id: string }
export const logsEventosService = {
  async getLogsPage(filters: LogFilters, cursor: LogCursor | null = null) {
    const { data, error } = await supabase.rpc('consultar_eventos_logs', {
      p_busca: filters.search.trim(), p_modulo: filters.modulo === 'Todos' ? '' : filters.modulo,
      p_tipo: filters.tipo === 'Todos' ? '' : filters.tipo,
      p_antes_em: cursor?.createdAt || null, p_antes_id: cursor?.id || null,
    });
    if (error) throw new Error(`Erro ao carregar logs de auditoria: ${error.message}`);
    const rows = (data?.rows || []) as AuditLogRow[];
    const last = rows.at(-1);
    return {
      logs: rows.map(fromRow), total: Number(data?.total || 0), modulos: (data?.modulos || []) as string[],
      next: rows.length === 100 && last ? { createdAt: last.created_at, id: last.id } : null,
    };
  },
};

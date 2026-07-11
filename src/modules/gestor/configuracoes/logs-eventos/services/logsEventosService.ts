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

interface AuditLogRow {
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

export const logsEventosService = {
  async getLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('configuracoes_eventos_logs')
      .select('id,usuario_id,acao,modulo,tipo,ip_address,detalhes,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(`Erro ao carregar logs de auditoria: ${error.message}`);
    return ((data || []) as AuditLogRow[]).map(fromRow);
  },
};

export interface AuditLog {
  id: string;
  usuario: string;
  acao: string;
  modulo: string;
  tipo: 'Sucesso' | 'Alerta' | 'Info';
  ipAddress: string;
  horario: string;
}

export const logsEventosService = {
  async getLogs(): Promise<AuditLog[]> {
    return [
      { id: '1', usuario: 'João Silva', acao: 'Alterou dados da empresa (Endereço Matriz)', modulo: 'Configurações', tipo: 'Sucesso', ipAddress: '192.168.0.45', horario: 'Hoje, 11:24' },
      { id: '2', usuario: 'Maria Souza', acao: 'Concluiu obrigação tributária DCTFWeb', modulo: 'Obrigações', tipo: 'Sucesso', ipAddress: '192.168.0.12', horario: 'Hoje, 09:15' },
      { id: '3', usuario: 'João Silva', acao: 'Alterou privilégios do perfil Analista Fiscal', modulo: 'Permissões', tipo: 'Alerta', ipAddress: '192.168.0.45', horario: 'Hoje, 08:30' },
      { id: '4', usuario: 'Sistema', acao: 'Tentativa de login malsucedida (IP bloqueado)', modulo: 'Segurança', tipo: 'Alerta', ipAddress: '177.42.158.9', horario: 'Hoje, 04:12' },
      { id: '5', usuario: 'João Silva', acao: 'Cadastrou novo cliente (Empresa Nova Ltda)', modulo: 'Clientes', tipo: 'Sucesso', ipAddress: '192.168.0.45', horario: 'Ontem, 16:45' },
      { id: '6', usuario: 'Sistema', acao: 'Backup diário do banco executado', modulo: 'Banco de Dados', tipo: 'Info', ipAddress: 'localhost', horario: 'Ontem, 03:00' },
      { id: '7', usuario: 'Pedro Santos', acao: 'Excluiu conta bancária secundária', modulo: 'Financeiro', tipo: 'Alerta', ipAddress: '192.168.0.88', horario: '06/07/2026, 14:10' },
      { id: '8', usuario: 'Maria Souza', acao: 'Vinculou conta do Google Drive', modulo: 'Integrações', tipo: 'Sucesso', ipAddress: '192.168.0.12', horario: '05/07/2026, 17:05' },
      { id: '9', usuario: 'João Silva', acao: 'Alterou sua foto de perfil', modulo: 'Meu Perfil', tipo: 'Info', ipAddress: '192.168.0.45', horario: '05/07/2026, 10:20' }
    ];
  },
};

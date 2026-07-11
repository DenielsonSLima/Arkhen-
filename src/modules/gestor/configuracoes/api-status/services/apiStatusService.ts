export interface EndpointStatus {
  id: string;
  nome: string;
  status: 'Online' | 'Offline' | 'Lento';
  latency: number; // ms
  uptime: number; // %
}

export const apiStatusService = {
  async getStatus(): Promise<EndpointStatus[]> {
    return [
      { id: '1', nome: 'Autenticação & Sessões', status: 'Online', latency: 45, uptime: 99.98 },
      { id: '2', nome: 'Serviço de Faturamento (Asaas)', status: 'Online', latency: 120, uptime: 99.85 },
      { id: '3', nome: 'Banco de Dados (PostgreSQL)', status: 'Online', latency: 15, uptime: 100 },
      { id: '4', nome: 'Módulo Fiscal (Emissão NF-e)', status: 'Lento', latency: 850, uptime: 99.12 },
    ];
  },
};

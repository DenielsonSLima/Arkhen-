// Serviço de simulação backend para o Módulo Financeiro
// Simula comportamento de tabelas do Supabase, RLS e RPCs (cálculos e chamadas Asaas)

export interface ContratoFinanceiro {
  id: string;
  empresaId: string; // Tenant (escritório contábil logado)
  clienteEmpresaId: string; // Empresa cliente vinculada
  valorMensal: number;
  diaVencimento: number;
  emissaoAutomaticaNfse: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CobrancaFinanceira {
  id: string;
  empresaId: string;
  clienteEmpresaId: string;
  valor: number;
  dataVencimento: string;
  status: 'Pendente' | 'Pago' | 'Vencido' | 'Cancelado';
  asaasCobrancaId?: string;
  asaasNfseId?: string;
  asaasBoletoUrl?: string;
  dataPagamento?: string;
  dataCancelamento?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  taxaInadimplencia: number;
}

const LOCAL_STORAGE_CONTRATOS_KEY = 'contabil_financeiro_contratos';
const LOCAL_STORAGE_COBRANCAS_KEY = 'contabil_financeiro_cobrancas';

const DEFAULT_CONTRATOS: ContratoFinanceiro[] = [
  {
    id: 'cont-1',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-1', // Tech Solutions Ltda
    valorMensal: 1200.00,
    diaVencimento: 10,
    emissaoAutomaticaNfse: true,
    ativo: true,
    createdAt: new Date(2026, 4, 10).toISOString(),
    updatedAt: new Date(2026, 4, 10).toISOString()
  },
  {
    id: 'cont-2',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-2', // Outra empresa mockada
    valorMensal: 850.00,
    diaVencimento: 15,
    emissaoAutomaticaNfse: false,
    ativo: true,
    createdAt: new Date(2026, 4, 12).toISOString(),
    updatedAt: new Date(2026, 4, 12).toISOString()
  }
];

const DEFAULT_COBRANCAS: CobrancaFinanceira[] = [
  {
    id: 'cob-1',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-1',
    valor: 1200.00,
    dataVencimento: '2026-05-10',
    status: 'Pago',
    asaasCobrancaId: 'pay_637281920192',
    asaasNfseId: 'nfse_98127391238',
    asaasBoletoUrl: 'https://asaas.com/b/pay_637281920192',
    dataPagamento: new Date(2026, 4, 9, 14, 30).toISOString(),
    createdAt: new Date(2026, 4, 1).toISOString(),
    updatedAt: new Date(2026, 4, 9).toISOString()
  },
  {
    id: 'cob-2',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-1',
    valor: 1200.00,
    dataVencimento: '2026-06-10',
    status: 'Pago',
    asaasCobrancaId: 'pay_738192039122',
    asaasNfseId: 'nfse_02910392012',
    asaasBoletoUrl: 'https://asaas.com/b/pay_738192039122',
    dataPagamento: new Date(2026, 5, 10, 10, 15).toISOString(),
    createdAt: new Date(2026, 5, 1).toISOString(),
    updatedAt: new Date(2026, 5, 10).toISOString()
  },
  {
    id: 'cob-3',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-1',
    valor: 1200.00,
    dataVencimento: '2026-07-10',
    status: 'Pendente',
    asaasCobrancaId: 'pay_839203918239',
    asaasNfseId: 'nfse_73928172938',
    asaasBoletoUrl: 'https://asaas.com/b/pay_839203918239',
    createdAt: new Date(2026, 6, 1).toISOString(),
    updatedAt: new Date(2026, 6, 1).toISOString()
  },
  {
    id: 'cob-4',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-2',
    valor: 850.00,
    dataVencimento: '2026-05-15',
    status: 'Pago',
    asaasCobrancaId: 'pay_123984719283',
    asaasBoletoUrl: 'https://asaas.com/b/pay_123984719283',
    dataPagamento: new Date(2026, 4, 15, 16, 40).toISOString(),
    createdAt: new Date(2026, 4, 1).toISOString(),
    updatedAt: new Date(2026, 4, 15).toISOString()
  },
  {
    id: 'cob-5',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-2',
    valor: 850.00,
    dataVencimento: '2026-06-15',
    status: 'Vencido',
    asaasCobrancaId: 'pay_928172839102',
    asaasBoletoUrl: 'https://asaas.com/b/pay_928172839102',
    createdAt: new Date(2026, 5, 1).toISOString(),
    updatedAt: new Date(2026, 5, 1).toISOString()
  },
  {
    id: 'cob-6',
    empresaId: 'office-1',
    clienteEmpresaId: 'emp-2',
    valor: 850.00,
    dataVencimento: '2026-07-15',
    status: 'Pendente',
    asaasCobrancaId: 'pay_019283746562',
    asaasBoletoUrl: 'https://asaas.com/b/pay_019283746562',
    createdAt: new Date(2026, 6, 1).toISOString(),
    updatedAt: new Date(2026, 6, 1).toISOString()
  }
];

export const financeiroService = {
  // MOCK TENANT ID (Simulando RLS)
  getTenantId(): string {
    return 'office-1';
  },

  async getContratos(): Promise<ContratoFinanceiro[]> {
    const data = localStorage.getItem(LOCAL_STORAGE_CONTRATOS_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data) as ContratoFinanceiro[];
        return parsed.filter(c => c.empresaId === this.getTenantId());
      } catch {
        return DEFAULT_CONTRATOS;
      }
    }
    localStorage.setItem(LOCAL_STORAGE_CONTRATOS_KEY, JSON.stringify(DEFAULT_CONTRATOS));
    return DEFAULT_CONTRATOS;
  },

  async saveContrato(contrato: Omit<ContratoFinanceiro, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ContratoFinanceiro> {
    const list = await this.getContratos();
    const isNew = !contrato.id;
    let target: ContratoFinanceiro;

    if (isNew) {
      target = {
        ...contrato,
        id: `cont-${Date.now()}`,
        empresaId: this.getTenantId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(target);
    } else {
      const idx = list.findIndex(c => c.id === contrato.id);
      if (idx === -1) throw new Error('Contrato não encontrado');
      target = {
        ...list[idx],
        ...contrato,
        updatedAt: new Date().toISOString()
      };
      list[idx] = target;
    }

    const allData = await this.getAllContratosRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_CONTRATOS_KEY, JSON.stringify([...otherTenants, ...list]));

    // Se for um novo contrato, gera a primeira cobrança pendente para este mês
    if (isNew) {
      await this.gerarCobrançaParaContrato(target);
    }

    return target;
  },

  async deleteContrato(id: string): Promise<void> {
    const list = await this.getContratos();
    const filtered = list.filter(c => c.id !== id);
    const allData = await this.getAllContratosRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_CONTRATOS_KEY, JSON.stringify([...otherTenants, ...filtered]));
  },

  async getCobranças(): Promise<CobrancaFinanceira[]> {
    const data = localStorage.getItem(LOCAL_STORAGE_COBRANCAS_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data) as CobrancaFinanceira[];
        return parsed.filter(c => c.empresaId === this.getTenantId());
      } catch {
        return DEFAULT_COBRANCAS;
      }
    }
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify(DEFAULT_COBRANCAS));
    return DEFAULT_COBRANCAS;
  },

  // Simula RPC: cancelar_cobranca_financeira
  async cancelarCobrança(cobrancaId: string): Promise<void> {
    const list = await this.getCobranças();
    const idx = list.findIndex(c => c.id === cobrancaId);
    if (idx === -1) throw new Error('Cobrança não encontrada.');
    if (list[idx].status === 'Pago') throw new Error('Não é possível cancelar uma cobrança já paga.');

    list[idx] = {
      ...list[idx],
      status: 'Cancelado',
      dataCancelamento: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const allData = await this.getAllCobrançasRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify([...otherTenants, ...list]));
  },

  // Simula RPC: cancelar_boleto_financeiro
  async cancelarBoleto(cobrancaId: string): Promise<void> {
    const list = await this.getCobranças();
    const idx = list.findIndex(c => c.id === cobrancaId);
    if (idx === -1) throw new Error('Cobrança não encontrada.');
    if (list[idx].status !== 'Pendente') throw new Error('Apenas boletos pendentes podem ser cancelados.');

    // Remove o link do boleto asaas_boleto_url para simular cancelamento no Asaas
    list[idx] = {
      ...list[idx],
      asaasBoletoUrl: undefined,
      updatedAt: new Date().toISOString()
    };

    const allData = await this.getAllCobrançasRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify([...otherTenants, ...list]));
  },

  // Simula RPC: emitir_nfse_asaas
  async emitirNfseManual(cobrancaId: string): Promise<string> {
    const list = await this.getCobranças();
    const idx = list.findIndex(c => c.id === cobrancaId);
    if (idx === -1) throw new Error('Cobrança não encontrada.');
    if (list[idx].status === 'Cancelado') throw new Error('Não é possível emitir NFS-e para cobranças canceladas.');

    const nfseId = `nfse_${Math.random().toString(36).substring(2, 15)}`;
    list[idx] = {
      ...list[idx],
      asaasNfseId: nfseId,
      updatedAt: new Date().toISOString()
    };

    const allData = await this.getAllCobrançasRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify([...otherTenants, ...list]));
    return nfseId;
  },

  // Função helper de auxílio ao protótipo: Simular recebimento (pagamento da fatura)
  async simularRecebimento(cobrancaId: string): Promise<void> {
    const list = await this.getCobranças();
    const idx = list.findIndex(c => c.id === cobrancaId);
    if (idx === -1) throw new Error('Cobrança não encontrada.');
    if (list[idx].status === 'Cancelado') throw new Error('Não é possível liquidar cobrança cancelada.');

    list[idx] = {
      ...list[idx],
      status: 'Pago',
      dataPagamento: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Se a emissão for automática e ainda não tiver nota, emite a NFS-e
    const contratos = await this.getContratos();
    const contrato = contratos.find(c => c.clienteEmpresaId === list[idx].clienteEmpresaId);
    if (contrato?.emissaoAutomaticaNfse && !list[idx].asaasNfseId) {
      list[idx].asaasNfseId = `nfse_${Math.random().toString(36).substring(2, 15)}`;
    }

    const allData = await this.getAllCobrançasRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify([...otherTenants, ...list]));
  },

  // Calcula estatísticas para o dashboard (Business Logic simulada no banco de dados)
  async getStats(): Promise<DashboardStats> {
    const cobrancas = await this.getCobranças();
    const validCob = cobrancas.filter(c => c.status !== 'Cancelado');

    const totalFaturado = validCob.reduce((acc, curr) => acc + curr.valor, 0);
    const totalRecebido = validCob.filter(c => c.status === 'Pago').reduce((acc, curr) => acc + curr.valor, 0);
    const totalPendente = validCob.filter(c => c.status === 'Pendente').reduce((acc, curr) => acc + curr.valor, 0);
    const totalVencido = validCob.filter(c => c.status === 'Vencido').reduce((acc, curr) => acc + curr.valor, 0);

    const totalDevido = totalRecebido + totalVencido;
    const taxaInadimplencia = totalDevido > 0 ? (totalVencido / totalDevido) * 100 : 0;

    return {
      totalFaturado,
      totalRecebido,
      totalPendente: totalPendente + totalVencido,
      taxaInadimplencia
    };
  },

  // Helper Privados de gerenciamento global do LocalStorage
  async getAllContratosRaw(): Promise<ContratoFinanceiro[]> {
    const data = localStorage.getItem(LOCAL_STORAGE_CONTRATOS_KEY);
    return data ? JSON.parse(data) : DEFAULT_CONTRATOS;
  },

  async getAllCobrançasRaw(): Promise<CobrancaFinanceira[]> {
    const data = localStorage.getItem(LOCAL_STORAGE_COBRANCAS_KEY);
    return data ? JSON.parse(data) : DEFAULT_COBRANCAS;
  },

  async gerarCobrançaParaContrato(contrato: ContratoFinanceiro): Promise<void> {
    const list = await this.getCobranças();
    const today = new Date();
    
    // Gera data de vencimento correspondente ao mês atual ou próximo
    let vencimentoAno = today.getFullYear();
    let vencimentoMes = today.getMonth() + 1; // 1-indexed

    // Formata o vencimento (se o dia já passou este mês, gera para o próximo mês)
    if (today.getDate() > contrato.diaVencimento) {
      vencimentoMes += 1;
      if (vencimentoMes > 12) {
        vencimentoMes = 1;
        vencimentoAno += 1;
      }
    }

    const mesStr = vencimentoMes.toString().padStart(2, '0');
    const diaStr = contrato.diaVencimento.toString().padStart(2, '0');
    const dataVencimento = `${vencimentoAno}-${mesStr}-${diaStr}`;

    const cobId = `cob-${Date.now()}`;
    const novaCobranca: CobrancaFinanceira = {
      id: cobId,
      empresaId: contrato.empresaId,
      clienteEmpresaId: contrato.clienteEmpresaId,
      valor: contrato.valorMensal,
      dataVencimento,
      status: 'Pendente',
      asaasCobrancaId: `pay_${Math.random().toString(36).substring(2, 14)}`,
      asaasBoletoUrl: `https://asaas.com/b/pay_${cobId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    list.push(novaCobranca);
    const allData = await this.getAllCobrançasRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify([...otherTenants, ...list]));
  },

  async gerarCobrançaManual(dados: {
    clienteEmpresaId: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
  }): Promise<void> {
    const list = await this.getCobranças();
    const cobId = `cob-${Date.now()}`;
    const asaasId = `pay_${Math.random().toString(36).substring(2, 14)}`;

    const novaCobranca: CobrancaFinanceira = {
      id: cobId,
      empresaId: this.getTenantId(),
      clienteEmpresaId: dados.clienteEmpresaId,
      valor: dados.valor,
      dataVencimento: dados.dataVencimento,
      status: 'Pendente',
      asaasCobrancaId: asaasId,
      asaasBoletoUrl: dados.meioPagamento === 'Pix' 
        ? `https://asaas.com/pix/pay_${cobId}` 
        : `https://asaas.com/b/pay_${cobId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    list.push(novaCobranca);
    const allData = await this.getAllCobrançasRaw();
    const otherTenants = allData.filter(c => c.empresaId !== this.getTenantId());
    localStorage.setItem(LOCAL_STORAGE_COBRANCAS_KEY, JSON.stringify([...otherTenants, ...list]));
  }
};

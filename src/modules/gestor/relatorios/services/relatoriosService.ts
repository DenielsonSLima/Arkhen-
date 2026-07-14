// Serviço de Agregação Contábil e Relatórios (RPCs do Banco de Dados)
import { persistedStorage } from '../../../../lib/persistedStorage';

export interface FaturamentoReportData {
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  taxaInadimplencia: number;
  historicoMensal: { mes: string; faturado: number; recebido: number; inadimplente: number }[];
  clientesMaisFaturados: { nome: string; valor: number }[];
}

export interface ConformidadeReportData {
  totalObrigacoes: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  taxaConformidade: number;
  distribuicaoObrigacoes: { nome: string; total: number; concluidas: number }[];
}

export interface PessoalReportData {
  totalFuncionarios: number;
  funcionariosAtivos: number;
  custoFolhaMensal: number;
  mediaSalarial: number;
  documentosPendentes: number;
  distribuicaoCargos: { cargo: string; count: number }[];
}

export interface ComparativoRegimeData {
  regime: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  aliquotaEfetiva: number;
  impostoTotal: number;
  custoPrevidenciario: number;
  custoTotal: number;
  recomendado: boolean;
}

export const relatoriosService = {
  // Simula RPC: get_relatorio_faturamento
  async getFaturamentoReport(companyId: string, startDate: string, endDate: string): Promise<FaturamentoReportData> {
    const rawCob = persistedStorage.getItem('contabil_financeiro_cobrancas');
    const rawComps = persistedStorage.getItem('contabil_gestao_empresarial_companies');
    
    const cobrancas = rawCob ? JSON.parse(rawCob) : [];
    const companies = rawComps ? JSON.parse(rawComps) : [];
    const compMap = new Map<string, string>(companies.map((c: any) => [c.id, c.nome]));

    // Filtra cobranças por tenant (empresa contábil logada, por convenção assumimos 1 na simulação)
    const filtered = cobrancas.filter((c: any) => {
      const matchesCompany = companyId === 'Todos' || c.clienteEmpresaId === companyId;
      const matchesStart = !startDate || c.dataVencimento >= startDate;
      const matchesEnd = !endDate || c.dataVencimento <= endDate;
      return matchesCompany && matchesStart && matchesEnd && c.status !== 'Cancelado';
    });

    let totalFaturado = 0;
    let totalRecebido = 0;
    let totalPendente = 0;
    let totalVencido = 0;

    const monthlyMap: { [key: string]: { faturado: number; recebido: number; inadimplente: number } } = {};
    const clientBillingMap: { [key: string]: number } = {};

    filtered.forEach((c: any) => {
      totalFaturado += c.valor;
      if (c.status === 'Pago') {
        totalRecebido += c.valor;
      } else {
        totalPendente += c.valor;
        if (c.status === 'Vencido') {
          totalVencido += c.valor;
        }
      }

      // Agrupa por mês
      const [year, month] = c.dataVencimento.split('-');
      const mesChave = `${month}/${year}`;
      if (!monthlyMap[mesChave]) {
        monthlyMap[mesChave] = { faturado: 0, recebido: 0, inadimplente: 0 };
      }
      monthlyMap[mesChave].faturado += c.valor;
      if (c.status === 'Pago') {
        monthlyMap[mesChave].recebido += c.valor;
      } else if (c.status === 'Vencido') {
        monthlyMap[mesChave].inadimplente += c.valor;
      }

      // Faturamento por cliente
      const clientName = compMap.get(c.clienteEmpresaId) || 'Outros';
      clientBillingMap[clientName] = (clientBillingMap[clientName] || 0) + c.valor;
    });

    const totalParaInadimplencia = totalRecebido + totalVencido;
    const taxaInadimplencia = totalParaInadimplencia > 0 ? (totalVencido / totalParaInadimplencia) * 100 : 0;

    const historicoMensal = Object.keys(monthlyMap).map(key => ({
      mes: key,
      ...monthlyMap[key]
    })).sort((a, b) => {
      const [mA, yA] = a.mes.split('/');
      const [mB, yB] = b.mes.split('/');
      return `${yA}-${mA}`.localeCompare(`${yB}-${mB}`);
    });

    const clientesMaisFaturados = Object.keys(clientBillingMap).map(nome => ({
      nome,
      valor: clientBillingMap[nome]
    })).sort((a, b) => b.valor - a.valor).slice(0, 5);

    return {
      totalFaturado,
      totalRecebido,
      totalPendente,
      taxaInadimplencia,
      historicoMensal,
      clientesMaisFaturados
    };
  },

  // Simula RPC: get_relatorio_conformidade
  async getConformidadeReport(companyId: string): Promise<ConformidadeReportData> {
    const rawInst = persistedStorage.getItem('contabil_atividades_instancias');
    const instancias = rawInst ? JSON.parse(rawInst) : [];

    const filtered = instancias.filter((inst: any) => {
      return companyId === 'Todos' || inst.clienteId === companyId;
    });

    const totalObrigacoes = filtered.length;
    const concluidas = filtered.filter((i: any) => i.status === 'Concluída').length;
    const pendentes = filtered.filter((i: any) => i.status === 'Pendente').length;
    
    // Simula atraso se a data de vencimento já passou (se aplicável, ou mocka proporcional)
    const atrasadas = Math.round(pendentes * 0.3); // Mock do banco de dados
    const taxaConformidade = totalObrigacoes > 0 ? (concluidas / totalObrigacoes) * 100 : 100;

    // Agrupa por tipo de obrigação
    const groupMap: { [key: string]: { total: number; concluidas: number } } = {};
    filtered.forEach((i: any) => {
      const typeName = i.modeloId.toUpperCase();
      if (!groupMap[typeName]) {
        groupMap[typeName] = { total: 0, concluidas: 0 };
      }
      groupMap[typeName].total += 1;
      if (i.status === 'Concluída') {
        groupMap[typeName].concluidas += 1;
      }
    });

    const distribuicaoObrigacoes = Object.keys(groupMap).map(key => ({
      nome: key,
      total: groupMap[key].total,
      concluidas: groupMap[key].concluidas
    }));

    return {
      totalObrigacoes,
      concluidas,
      pendentes,
      atrasadas,
      taxaConformidade,
      distribuicaoObrigacoes
    };
  },

  // Simula RPC: get_relatorio_custo_pessoal
  async getPessoalReport(companyId: string): Promise<PessoalReportData> {
    const rawComps = persistedStorage.getItem('contabil_gestao_empresarial_companies');
    const companies = rawComps ? JSON.parse(rawComps) : [];

    const activeCompanies = companies.filter((c: any) => companyId === 'Todos' || c.id === companyId);
    
    let totalFuncionarios = 0;
    let funcionariosAtivos = 0;
    let custoFolhaMensal = 0;
    let sumSalaries = 0;
    let countSalaries = 0;
    let documentosPendentes = 0;

    const cargoMap: { [key: string]: number } = {};

    activeCompanies.forEach((comp: any) => {
      const employees = comp.funcionarios || [];
      totalFuncionarios += employees.length;

      employees.forEach((f: any) => {
        if (f.status === 'Ativo') {
          funcionariosAtivos += 1;
          custoFolhaMensal += f.salario;
          sumSalaries += f.salario;
          countSalaries += 1;

          // Agrupa cargos
          cargoMap[f.cargo] = (cargoMap[f.cargo] || 0) + 1;
        }

        // Docs admissionais pendentes
        const docs = f.documentosAdmissao || [];
        docs.forEach((d: any) => {
          if (d.status === 'Pendente') {
            documentosPendentes += 1;
          }
        });
      });
    });

    const mediaSalarial = countSalaries > 0 ? sumSalaries / countSalaries : 0;
    const distribuicaoCargos = Object.keys(cargoMap).map(c => ({
      cargo: c,
      count: cargoMap[c]
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      totalFuncionarios,
      funcionariosAtivos,
      custoFolhaMensal,
      mediaSalarial,
      documentosPendentes,
      distribuicaoCargos
    };
  },

  // Simula RPC: calcular_comparativo_regimes
  async calcularComparativoRegimes(faturamentoAnual: number, custoFolhaAnual: number): Promise<ComparativoRegimeData[]> {
    // Simples Nacional: Alíquota média 10%
    const impostoSimples = faturamentoAnual * 0.10;
    const cppSimples = 0;

    // Lucro Presumido: Impostos cumulativos (~13.45%) + CPP Patronal (20% sobre a folha)
    const impostoPresumido = faturamentoAnual * 0.1345;
    const cppPresumido = custoFolhaAnual * 0.20;

    // Lucro Real: Impostos não-cumulativos (~19.35%) + CPP Patronal (20% sobre a folha)
    const impostoReal = faturamentoAnual * 0.1935;
    const cppReal = custoFolhaAnual * 0.20;

    const totalSimples = impostoSimples + cppSimples;
    const totalPresumido = impostoPresumido + cppPresumido;
    const totalReal = impostoReal + cppReal;

    const menorCusto = Math.min(totalSimples, totalPresumido, totalReal);

    return [
      {
        regime: 'Simples Nacional',
        aliquotaEfetiva: faturamentoAnual > 0 ? (totalSimples / faturamentoAnual) * 100 : 10.0,
        impostoTotal: impostoSimples,
        custoPrevidenciario: cppSimples,
        custoTotal: totalSimples,
        recomendado: totalSimples === menorCusto
      },
      {
        regime: 'Lucro Presumido',
        aliquotaEfetiva: faturamentoAnual > 0 ? (totalPresumido / faturamentoAnual) * 100 : 13.45,
        impostoTotal: impostoPresumido,
        custoPrevidenciario: cppPresumido,
        custoTotal: totalPresumido,
        recomendado: totalPresumido === menorCusto
      },
      {
        regime: 'Lucro Real',
        aliquotaEfetiva: faturamentoAnual > 0 ? (totalReal / faturamentoAnual) * 100 : 19.35,
        impostoTotal: impostoReal,
        custoPrevidenciario: cppReal,
        custoTotal: totalReal,
        recomendado: totalReal === menorCusto
      }
    ];
  }
};

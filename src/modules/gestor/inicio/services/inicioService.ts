import { persistedStorage } from '../../../../lib/persistedStorage';

export interface DashboardStats {
  clientesAtivos: number;
  clientesNovos: number;
  empresasAtivas: number;
  empresasNovas: number;
  obrigacoesMes: number;
  obrigacoesHoje: number;
  faturamentoMes: number;
  faturamentoCrescimento: number;
}

export interface AtividadeRecente {
  id: string;
  tipo: 'documento' | 'obrigacao' | 'cliente';
  titulo: string;
  detalhe: string;
  horario: string;
}

export interface ObrigacaoAgendada {
  id: string;
  dataDia: string;
  dataMes: string;
  titulo: string;
  detalhe: string;
  status: 'vence-hoje' | '5-dias' | '8-dias' | '13-dias';
}

export interface VencimentoAlerta {
  id: string;
  empresaNome: string;
  tipo: 'documento' | 'certificado';
  nome: string;
  dataValidade: string;
  diasRestantes: number;
}

const GESTAO_STORAGE_KEY = 'contabil_gestao_empresarial_companies';

function getDiasRestantes(dataValidade: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const val = new Date(dataValidade + 'T00:00:00');
  return Math.round((val.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export const inicioService = {
  async getDashboardData(): Promise<{
    stats: DashboardStats;
    atividades: AtividadeRecente[];
    agenda: ObrigacaoAgendada[];
  }> {
    return {
      stats: {
        clientesAtivos: 128,
        clientesNovos: 8,
        empresasAtivas: 156,
        empresasNovas: 12,
        obrigacoesMes: 24,
        obrigacoesHoje: 6,
        faturamentoMes: 48750.0,
        faturamentoCrescimento: 15,
      },
      atividades: [
        {
          id: '1',
          tipo: 'documento',
          titulo: 'Novo documento enviado',
          detalhe: 'Contrato Social - Empresa Exemplo Ltda',
          horario: 'Hoje, 10:30',
        },
        {
          id: '2',
          tipo: 'obrigacao',
          titulo: 'Obrigação concluída',
          detalhe: 'DCTFWeb - Empresa ABC Ltda',
          horario: 'Hoje, 09:15',
        },
        {
          id: '3',
          tipo: 'cliente',
          titulo: 'Novo cliente cadastrado',
          detalhe: 'Empresa Nova Ltda',
          horario: 'Ontem, 16:45',
        },
      ],
      agenda: [
        {
          id: '1',
          dataDia: '02',
          dataMes: 'JUL',
          titulo: 'DCTFWeb',
          detalhe: '3 empresas',
          status: 'vence-hoje',
        },
        {
          id: '2',
          dataDia: '07',
          dataMes: 'JUL',
          titulo: 'EFD-Reinf',
          detalhe: '5 empresas',
          status: '5-dias',
        },
        {
          id: '3',
          dataDia: '10',
          dataMes: 'JUL',
          titulo: 'DARF Simples Nacional',
          detalhe: '8-empresas',
          status: '8-dias',
        },
        {
          id: '4',
          dataDia: '15',
          dataMes: 'JUL',
          titulo: 'EFD-Contribuições',
          detalhe: '4 empresas',
          status: '13-dias',
        },
      ],
    };
  },

  getVencimentosProximos(): VencimentoAlerta[] {
    const alertas: VencimentoAlerta[] = [];
    try {
      const raw = persistedStorage.getItem(GESTAO_STORAGE_KEY);
      if (!raw) return alertas;
      const companies = JSON.parse(raw) as Array<{
        id: string;
        nome: string;
        documentos?: Array<{ id: string; nome: string; dataValidade?: string }>;
        certificados?: Array<{ id: string; tipo: string; titular: string; dataValidade: string }>;
      }>;

      for (const company of companies) {
        // Check documents
        for (const doc of company.documentos || []) {
          if (!doc.dataValidade) continue;
          const dias = getDiasRestantes(doc.dataValidade);
          if (dias <= 15) {
            alertas.push({
              id: `doc-${doc.id}`,
              empresaNome: company.nome,
              tipo: 'documento',
              nome: doc.nome,
              dataValidade: formatDateBR(doc.dataValidade),
              diasRestantes: dias,
            });
          }
        }
        // Check certificates
        for (const cert of company.certificados || []) {
          const dias = getDiasRestantes(cert.dataValidade);
          if (dias <= 15) {
            alertas.push({
              id: `cert-${cert.id}`,
              empresaNome: company.nome,
              tipo: 'certificado',
              nome: `${cert.tipo} — ${cert.titular}`,
              dataValidade: formatDateBR(cert.dataValidade),
              diasRestantes: dias,
            });
          }
        }
      }
    } catch {
      // silently fail
    }
    return alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);
  },
};

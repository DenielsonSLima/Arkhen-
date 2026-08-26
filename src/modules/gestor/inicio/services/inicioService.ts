import { persistedStorage } from '../../../../lib/persistedStorage';
import { supabase } from '../../../../lib/supabase';
import { getInicioEmpresaId } from './inicioTenant';

export interface DashboardStats {
  clientesAtivos: number;
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
  async getDashboardData(): Promise<{ stats: DashboardStats }> {
    const empresaId = await getInicioEmpresaId();
    const { count, error } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'Ativa');

    if (error) {
      throw new Error(`Erro ao carregar indicadores do painel: ${error.message}`);
    }

    return {
      stats: {
        clientesAtivos: count ?? 0,
      },
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

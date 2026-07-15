import { AlertTriangle, ArrowRight, CheckCircle2, FileSearch, Gauge, TimerReset } from 'lucide-react';
import type { ReformaPainel, ReformaStatus } from '../services/reformaTributaria.types';
import { ReformaStatusBadge } from './ReformaShared';
import { formatDate } from '../services/reformaPresentation';

interface Props {
  painel: ReformaPainel;
  podeGerenciar: boolean;
  onSelectClient: (clienteId: string) => void;
  onOpenAdequacao: () => void;
}

export const VisaoGeralTab = ({ painel, podeGerenciar, onSelectClient, onOpenAdequacao }: Props) => {
  const cards = [
    { label: 'CNPJs monitorados', value: painel.metricas.total, icon: Gauge, tone: 'slate' },
    { label: 'Adequados', value: painel.metricas.adequados, icon: CheckCircle2, tone: 'green' },
    { label: 'Em risco', value: painel.metricas.emRisco, icon: AlertTriangle, tone: 'red' },
    { label: 'Aguardando XML', value: painel.metricas.aguardandoXml, icon: FileSearch, tone: 'amber' },
    { label: 'Simulações pendentes', value: painel.metricas.simulacoesPendentes, icon: TimerReset, tone: 'blue' },
  ];

  return (
    <div className="rtc-tab-stack">
      <section className="rtc-deadline-strip">
        <div><small>Obrigatoriedade operacional</small><strong>03 AGO 2026</strong><span>{painel.metricas.diasAteObrigatoriedade} dias restantes</span></div>
        <i />
        <div><small>Decisão do Simples</small><strong>30 SET 2026</strong><span>{painel.metricas.diasAteOpcaoSimples} dias restantes</span></div>
      </section>

      <div className="rtc-metrics-grid">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article className={`rtc-metric rtc-metric-${tone}`} key={label}>
            <Icon size={19} /><span>{label}</span><strong>{value}</strong>
          </article>
        ))}
      </div>

      <section className="rtc-panel">
        <header className="rtc-panel-header">
          <div><span className="rtc-eyebrow">Carteira do escritório</span><h2>Mapa de preparação por CNPJ</h2></div>
          <small>Ordenado por criticidade operacional</small>
        </header>
        <div className="rtc-table-wrap">
          <table className="rtc-table">
            <thead><tr><th>Empresa</th><th>Regime</th><th>Emissor</th><th>Prazo</th><th>Status</th><th /></tr></thead>
            <tbody>
              {painel.clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td><strong>{cliente.nome}</strong><small>{cliente.cnpj || 'CNPJ não informado'}</small></td>
                  <td>{cliente.regime}</td>
                  <td>{cliente.emissor || 'Não informado'}</td>
                  <td>{formatDate(cliente.prazo)}</td>
                  <td><ReformaStatusBadge status={cliente.status as ReformaStatus} /></td>
                  <td>
                    <button type="button" className="rtc-row-action" disabled={!podeGerenciar} onClick={() => { onSelectClient(cliente.id); onOpenAdequacao(); }} aria-label={`Abrir ${cliente.nome}`}>
                      <ArrowRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

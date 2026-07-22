import React from 'react';
import { FileX, Trash2, ExternalLink } from 'lucide-react';
import type { CobrancaFinanceira, ContratoFinanceiro } from '../services/financeiroService';

interface CobrançasCardViewProps {
  filteredCobranças: CobrancaFinanceira[];
  contratos: ContratoFinanceiro[];
  companyMap: Map<string, { nome: string; cnpj: string }>;
  formatCurrency: (val: number) => string;
  formatVencimento: (dateStr: string) => string;
  formatTimestamp: (tsStr?: string) => string;
  handleEmitirNfseManual: (id: string) => Promise<void>;
  setBoletoToCancel: (cob: CobrancaFinanceira) => void;
  setCobrancaToCancel: (cob: CobrancaFinanceira) => void;
}

export const CobrançasCardView: React.FC<CobrançasCardViewProps> = ({
  filteredCobranças,
  contratos,
  companyMap,
  formatCurrency,
  formatVencimento,
  formatTimestamp,
  handleEmitirNfseManual,
  setBoletoToCancel,
  setCobrancaToCancel,
}) => {
  const getCompanyDetails = (compId: string) => {
    return companyMap.get(compId) || { nome: 'Empresa Removida', cnpj: '-' };
  };

  const groupCobrançasByMonth = (list: CobrancaFinanceira[]) => {
    const groups: { [key: string]: CobrancaFinanceira[] } = {};
    const sorted = [...list].sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento));

    sorted.forEach(c => {
      const [year, month] = c.dataVencimento.split('-');
      const monthsNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const monthName = monthsNames[parseInt(month) - 1];
      const groupName = `${monthName} de ${year}`;

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(c);
    });

    return groups;
  };

  const grouped = groupCobrançasByMonth(filteredCobranças);

  return (
    <div className="animate-slide-up">
      {filteredCobranças.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #eef1f5', marginTop: '16px' }}>
          Nenhuma cobrança localizada para os filtros selecionados.
        </div>
      ) : (
        Object.keys(grouped).map(monthKey => (
          <div key={monthKey} className="financeiro-mes-grupo">
            <h3 className="financeiro-mes-titulo">{monthKey}</h3>
            <div className="cobrancas-cards-grid">
              {grouped[monthKey].map(cob => {
                const comp = getCompanyDetails(cob.clienteEmpresaId);
                const contrato = contratos.find(c => c.clienteEmpresaId === cob.clienteEmpresaId);
                const isAutoNfse = contrato?.emissaoAutomaticaNfse;

                  const statusClass = cob.status === 'Pago' ? 'status-paid' : (cob.status === 'Vencido' ? 'status-overdue' : (cob.status === 'Cancelado' ? 'status-cancelled' : 'status-open'));
                  const statusLabel = cob.status === 'Pago' ? 'Recebida' : (cob.status === 'Vencido' ? 'Em atraso' : (cob.status === 'Cancelado' ? 'Cancelada' : 'Em aberto'));

                  return (
                    <div key={cob.id} className={`cobranca-card ${statusClass}`}>
                      <div className="cobranca-card-header">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', minWidth: 0 }}>
                          <div className={`cobranca-card-status-ribbon ${statusClass}`}>
                            Cobrança
                          </div>
                          <div className="cobranca-card-client">
                            <h4 title={comp.nome}>{comp.nome}</h4>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={`${comp.cnpj} ${isAutoNfse ? '• NFS-e Auto' : ''}`}>
                              {comp.cnpj}
                              {isAutoNfse && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  color: '#059669',
                                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  border: '1px solid rgba(5, 150, 105, 0.15)'
                                }}>
                                  Auto
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="cobranca-card-body">
                        <span className={`cobranca-badge ${cob.status.toLowerCase()}`} style={{ alignSelf: 'flex-start' }}>
                          {statusLabel}
                        </span>
                        <div className="financeiro-card-highlight">
                          <span>{formatCurrency(cob.valor)}</span>
                        </div>
                        <div className="financeiro-card-grid">
                          <div className="financeiro-card-grid-row">
                            <span>Vencimento</span>
                            <strong>{formatVencimento(cob.dataVencimento)}</strong>
                          </div>
                          {cob.status === 'Pago' && (
                            <div className="financeiro-card-grid-row">
                              <span>Pago em</span>
                              <strong style={{ color: '#059669' }}>{formatTimestamp(cob.dataPagamento).split(' ')[0]}</strong>
                            </div>
                          )}
                          <div className="financeiro-card-grid-row">
                            <span>NFS-e WebISS</span>
                            {cob.nfseId ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
                                  Emitida
                                </span>
                                <span title={cob.nfseId} style={{ color: '#64748b', fontSize: '0.72rem' }}>#{cob.nfseId}</span>
                              </div>
                            ) : cob.status === 'Cancelado' ? (
                              <strong>-</strong>
                            ) : (
                              <button onClick={() => handleEmitirNfseManual(cob.id)} style={{ background: 'none', border: 'none', color: 'var(--color-gold-dark)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }} title="Emitir NFS-e pelo WebISS">
                                Emitir NFS-e
                              </button>
                            )}
                          </div>
                          <div className="financeiro-card-grid-row">
                            <span>Identificador</span>
                            <strong title={cob.id}>#{cob.id.slice(0, 8).toUpperCase()}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="financeiro-card-footer financeiro-card-footer-actions">
                        <span title={cob.id}>ID {cob.id.slice(0, 8).toUpperCase()}</span>
                        <div className="financeiro-receber-actions">
                          {cob.bankSlipUrl && cob.status === 'Pendente' && (
                            <a href={cob.bankSlipUrl} target="_blank" rel="noreferrer" className="financeiro-action-btn link" title="Boleto Banco Inter">
                              <ExternalLink size={15} />
                            </a>
                          )}
                          {cob.status === 'Pendente' && cob.bankSlipUrl && (
                            <button onClick={() => setBoletoToCancel(cob)} className="financeiro-action-btn boleto-cancel" title="Cancelar Boleto">
                              <FileX size={15} />
                            </button>
                          )}
                          {cob.status !== 'Pago' && cob.status !== 'Cancelado' && (
                            <button onClick={() => setCobrancaToCancel(cob)} className="financeiro-action-btn cancel" title="Cancelar Cobrança">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

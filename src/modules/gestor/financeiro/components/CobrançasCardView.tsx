import React from 'react';
import { Check, Play, FileX, Trash2, ExternalLink } from 'lucide-react';
import type { CobrancaFinanceira, ContratoFinanceiro } from '../services/financeiroService';

interface CobrançasCardViewProps {
  filteredCobranças: CobrancaFinanceira[];
  contratos: ContratoFinanceiro[];
  companyMap: Map<string, { nome: string; cnpj: string }>;
  formatCurrency: (val: number) => string;
  formatVencimento: (dateStr: string) => string;
  formatTimestamp: (tsStr?: string) => string;
  handleEmitirNfseManual: (id: string) => Promise<void>;
  handleSimularRecebimento: (id: string) => Promise<void>;
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
  handleSimularRecebimento,
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

                return (
                  <div key={cob.id} className="cobranca-card">
                    <div className="cobranca-card-header">
                      <div className="cobranca-card-client">
                        <h4>{comp.nome}</h4>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                              NFS-e Auto
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={`cobranca-badge ${cob.status.toLowerCase()}`}>
                        {cob.status}
                      </span>
                    </div>

                    <div className="cobranca-card-body">
                      <div className="cobranca-card-row">
                        <span>Valor:</span>
                        <strong>{formatCurrency(cob.valor)}</strong>
                      </div>
                      <div className="cobranca-card-row">
                        <span>Vencimento:</span>
                        <strong>{formatVencimento(cob.dataVencimento)}</strong>
                      </div>
                      {cob.status === 'Pago' && (
                        <div className="cobranca-card-row">
                          <span>Pago em:</span>
                          <strong style={{ color: '#059669' }}>{formatTimestamp(cob.dataPagamento).split(' ')[0]}</strong>
                        </div>
                      )}
                      <div className="cobranca-card-row">
                        <span>NFS-e Asaas:</span>
                        {cob.asaasNfseId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={12} /> Emitida
                            </span>
                            <a
                              href={`https://asaas.com/nfse/${cob.asaasNfseId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '2px', textDecoration: 'underline' }}
                              title="Visualizar Nota Fiscal de Serviço"
                            >
                              Visualizar
                            </a>
                          </div>
                        ) : cob.status === 'Cancelado' ? (
                          <span>-</span>
                        ) : (
                          <button onClick={() => handleEmitirNfseManual(cob.id)} style={{ background: 'none', border: 'none', color: 'var(--color-gold-dark)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }} title="Emitir NFS-e manual no Asaas">
                            Emitir NFS-e
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="cobranca-card-actions">
                      {cob.asaasBoletoUrl && cob.status === 'Pendente' && (
                        <a href={cob.asaasBoletoUrl} target="_blank" rel="noreferrer" className="financeiro-action-btn link" title="Boleto Asaas">
                          <ExternalLink size={16} />
                        </a>
                      )}
                      {(cob.status === 'Pendente' || cob.status === 'Vencido') && (
                        <button onClick={() => handleSimularRecebimento(cob.id)} className="financeiro-action-btn pay" title="Simular Recebimento">
                          <Play size={16} />
                        </button>
                      )}
                      {cob.status === 'Pendente' && cob.asaasBoletoUrl && (
                        <button onClick={() => setBoletoToCancel(cob)} className="financeiro-action-btn boleto-cancel" title="Cancelar Boleto">
                          <FileX size={16} />
                        </button>
                      )}
                      {cob.status !== 'Pago' && cob.status !== 'Cancelado' && (
                        <button onClick={() => setCobrancaToCancel(cob)} className="financeiro-action-btn cancel" title="Cancelar Cobrança">
                          <Trash2 size={16} />
                        </button>
                      )}
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

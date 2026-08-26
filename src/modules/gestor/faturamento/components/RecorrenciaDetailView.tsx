import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Clock, Settings, FileText, DollarSign, Search, Download, Eye, Receipt } from 'lucide-react';

interface RecorrenciaDetailViewProps {
  recorrencia: any;
  onBack: () => void;
}

export const RecorrenciaDetailView: React.FC<RecorrenciaDetailViewProps> = ({ recorrencia, onBack }) => {
  const [activeTab, setActiveTab] = useState<'historico' | 'configuracoes'>('historico');
  const hasNfseReference = Boolean(recorrencia.emissaoNfse);
  const historico = recorrencia.historico || [];
  const formatCurrency = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={onBack}
          style={{ 
            background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', 
            padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#475569', backgroundColor: '#fff'
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {recorrencia.cliente}
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Contrato mensal • {recorrencia.servico} • {formatCurrency(recorrencia.valor)} / mês
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
        <button
          onClick={() => setActiveTab('historico')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: activeTab === 'historico' ? '#c59235' : '#64748b',
            borderBottom: activeTab === 'historico' ? '2px solid #c59235' : '2px solid transparent',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={16} />
          Cobranças já criadas
        </button>
        <button
          onClick={() => setActiveTab('configuracoes')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: activeTab === 'configuracoes' ? '#c59235' : '#64748b',
            borderBottom: activeTab === 'configuracoes' ? '2px solid #c59235' : '2px solid transparent',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Settings size={16} />
          Modelo mensal
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'historico' && (
        <div className="faturamento-card" style={{ padding: 0 }}>
          <div role="note" style={{ padding: '14px 16px', borderBottom: '1px solid #fde68a', background: '#fffbeb', color: '#78350f', fontSize: '0.85rem' }}>
            O histórico mostra somente cobranças já criadas. As próximas competências não são geradas automaticamente.
          </div>
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="faturamento-form-group" style={{ margin: 0, width: '300px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type="text" placeholder="Buscar lançamentos..." style={{ paddingLeft: '36px' }} />
              </div>
            </div>
          </div>
          <div className="faturamento-table-container">
            <table className="faturamento-table">
              <thead>
                <tr>
                  <th>Data de Emissão</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((item: { id: string; data: string; valor: number; status: string; tipo: string }) => (
                  <tr key={item.id}>
                    <td>{item.data}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <FileText size={14} color="#64748b" /> {item.tipo}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(item.valor)}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        backgroundColor: item.status === 'Pago' ? '#ecfdf5' : '#f8fafc',
                        color: item.status === 'Pago' ? '#10b981' : '#64748b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <CheckCircle size={12} /> {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button type="button" disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#94a3b8', padding: '4px' }} title="Indisponível: o histórico não fornece o documento fiscal">
                          <Eye size={16} />
                        </button>
                        <button type="button" disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#94a3b8', padding: '4px' }} title="Indisponível: o histórico não fornece o recibo">
                          <Receipt size={16} />
                        </button>
                        <button type="button" disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#94a3b8', padding: '4px' }} title="Indisponível: documento não vinculado pelo backend">
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'configuracoes' && (
        <div className="faturamento-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Referências do contrato mensal</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#3b82f6" /> NFS-e por competência
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  {hasNfseReference
                    ? 'Há uma referência fiscal salva, mas cada emissão depende de uma cobrança criada manualmente.'
                    : 'Nenhuma referência fiscal está salva; não há emissão automática.'}
                </p>
              </div>
              <span style={{ padding: '4px 8px', borderRadius: '999px', background: '#e2e8f0', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>Referência</span>
            </div>

            {hasNfseReference && (
              <div style={{ padding: '12px 16px', marginLeft: '24px', borderLeft: '3px solid #cbd5e1', color: '#64748b', fontSize: '0.82rem' }}>
                O contrato preserva somente a sinalização fiscal herdada. Informe serviço e descrição
                ao emitir a NFS-e vinculada à cobrança da competência.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} color="#10b981" /> Cobrança por competência
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>O contrato não agenda BolePix. Cada cobrança futura deve ser criada manualmente.</p>
              </div>
              <span style={{ padding: '4px 8px', borderRadius: '999px', background: '#e2e8f0', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>Manual</span>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="faturamento-btn-primary" disabled title="A edição exige o vínculo fiscal e financeiro da recorrência no backend.">
              Modelo somente leitura
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

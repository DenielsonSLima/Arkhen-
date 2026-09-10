import React, { useState } from 'react';
import { RecorrenciaExecucoes } from './RecorrenciaExecucoes';
import { RecorrenciaConfigForm } from '../forms/RecorrenciaConfigForm';
import { ArrowLeft, CheckCircle, Clock, Settings, FileText, Search, Download, Eye, Receipt } from 'lucide-react';

interface RecorrenciaDetailViewProps {
  recorrencia: any;
  onBack: () => void;
}

export const RecorrenciaDetailView: React.FC<RecorrenciaDetailViewProps> = ({ recorrencia, onBack }) => {
  const [activeTab, setActiveTab] = useState<'historico' | 'configuracoes'>('historico');
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
            {recorrencia.servico} • {formatCurrency(recorrencia.valor)} / mês
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
          Histórico de Lançamentos
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
          Configurações da Recorrência
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'historico' && <RecorrenciaExecucoes contratoId={recorrencia.id} />}
      {activeTab === 'historico' && (
        <div className="faturamento-card" style={{ padding: 0 }}>
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
                  <th>Vencimento</th>
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

      {activeTab === 'configuracoes' && <RecorrenciaConfigForm contratoId={recorrencia.id} />}
    </div>
  );
};

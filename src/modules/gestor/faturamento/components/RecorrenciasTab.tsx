import { useState } from 'react';
import { Plus, Pause, Calendar, FileText, Activity } from 'lucide-react';
import { ModalNovaRecorrencia } from './ModalNovaRecorrencia';
import { RecorrenciaDetailView } from './RecorrenciaDetailView';

export const RecorrenciasTab = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecorrencia, setSelectedRecorrencia] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'ativos' | 'inativos'>('ativos');

  const recorrencias = [
    { id: 1, cliente: 'Tech Solutions LTDA', servico: 'Assessoria Contábil', valor: 'R$ 1.500,00', dia: '5', status: 'Ativo', emissaoNfse: true, cobranca: true, situacao: 'em_dia' },
    { id: 2, cliente: 'Comercial Silva', servico: 'BPO Financeiro', valor: 'R$ 2.800,00', dia: '10', status: 'Ativo', emissaoNfse: true, cobranca: true, situacao: 'inadimplente', diasAtraso: 12 },
    { id: 3, cliente: 'Consultoria XYZ', servico: 'Assessoria Contábil', valor: 'R$ 1.200,00', dia: '15', status: 'Pausado', emissaoNfse: false, cobranca: false, situacao: 'em_dia' },
    { id: 4, cliente: 'Inovação Tech', servico: 'Assessoria Contábil', valor: 'R$ 3.500,00', dia: '20', status: 'Ativo', emissaoNfse: true, cobranca: true, situacao: 'em_dia' },
    { id: 5, cliente: 'Marketing Digital S.A.', servico: 'BPO Financeiro', valor: 'R$ 4.200,00', dia: '5', status: 'Ativo', emissaoNfse: true, cobranca: true, situacao: 'inadimplente', diasAtraso: 45 },
    { id: 6, cliente: 'Ex-Cliente Alpha', servico: 'Assessoria Contábil', valor: 'R$ 1.000,00', dia: '10', status: 'Inativo', emissaoNfse: false, cobranca: false, situacao: 'em_dia' },
  ];

  if (selectedRecorrencia) {
    return <RecorrenciaDetailView recorrencia={selectedRecorrencia} onBack={() => setSelectedRecorrencia(null)} />;
  }

  const filteredRecorrencias = recorrencias.filter(item => {
    if (activeSubTab === 'ativos') return item.status !== 'Inativo';
    return item.status === 'Inativo';
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Mensalidades e Recorrências</h2>
        <button className="faturamento-btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Nova Recorrência
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveSubTab('ativos')}
          style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
            color: activeSubTab === 'ativos' ? '#c59235' : '#64748b',
            borderBottom: activeSubTab === 'ativos' ? '2px solid #c59235' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          Ativos & Pausados
        </button>
        <button
          onClick={() => setActiveSubTab('inativos')}
          style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
            color: activeSubTab === 'inativos' ? '#c59235' : '#64748b',
            borderBottom: activeSubTab === 'inativos' ? '2px solid #c59235' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          Inativos
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }}>
        {filteredRecorrencias.map((item) => (
          <div 
            key={item.id} 
            className="faturamento-card" 
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative', overflow: 'hidden' }}
            onClick={() => setSelectedRecorrencia(item)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            }}
          >
            {item.situacao === 'inadimplente' && (
               <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: '#ef4444' }}></div>
            )}
            {item.situacao === 'em_dia' && (
               <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: '#10b981' }}></div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 8px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.cliente}</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.65rem', 
                    fontWeight: 600,
                    backgroundColor: item.status === 'Ativo' ? '#ecfdf5' : '#f8fafc',
                    color: item.status === 'Ativo' ? '#10b981' : '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {item.status === 'Ativo' ? <Activity size={10} /> : <Pause size={10} />}
                    {item.status}
                  </span>
                  
                  {item.situacao === 'em_dia' ? (
                     <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: '#f0fdf4', color: '#166534' }}>
                       Em Dia
                     </span>
                  ) : (
                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 600, backgroundColor: '#fef2f2', color: '#991b1b' }}>
                       {item.diasAtraso} dias atraso
                     </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} color="#94a3b8" /> {item.servico}
              </p>
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>{item.valor}</h4>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid #f1f5f9', marginTop: 'auto' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                <Calendar size={14} /> Todo dia {item.dia}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {item.emissaoNfse && <span style={{ padding: '2px 6px', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }} title="Emite NFS-e Automática">NFS-e</span>}
                {item.cobranca && <span style={{ padding: '2px 6px', backgroundColor: '#f8fafc', color: '#0f172a', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, border: '1px solid #e2e8f0' }} title="Gera Cobrança Automática">Cob</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ModalNovaRecorrencia isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

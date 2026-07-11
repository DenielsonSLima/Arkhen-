import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';

interface ModalNovaRecorrenciaProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNovaRecorrencia: React.FC<ModalNovaRecorrenciaProps> = ({ isOpen, onClose }) => {
  const [emitNfse, setEmitNfse] = useState(true);
  const [emitCobranca, setEmitCobranca] = useState(true);

  if (!isOpen) return null;

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div className="faturamento-card" style={{ width: '100%', maxWidth: '600px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Nova Recorrência
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Parceiro / Cliente</label>
            <select>
              <option value="">Selecione o parceiro...</option>
              <option value="1">Tech Solutions SA</option>
            </select>
          </div>
          
          <div className="faturamento-form-group">
            <label>Valor Mensal (R$)</label>
            <input type="text" placeholder="0,00" />
          </div>

          <div className="faturamento-form-group">
            <label>Dia de Vencimento/Emissão</label>
            <select>
              {[...Array(28)].map((_, i) => (
                <option key={i+1} value={i+1}>Dia {i+1}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', margin: 0 }}>Automações Ativas</h3>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={emitNfse} onChange={(e) => setEmitNfse(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>Emitir NFS-e automaticamente</span>
            </label>

            {emitNfse && (
              <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <div className="faturamento-form-group">
                  <label>Tipo de Serviço</label>
                  <select>
                    <option>17.19 - Contabilidade, inclusive serviços técnicos...</option>
                  </select>
                </div>
                <div className="faturamento-form-group">
                  <label>Anotações (Variáveis aceitas: [MES], [ANO])</label>
                  <textarea rows={2} placeholder="Honorários referentes a [MES]/[ANO]..."></textarea>
                </div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
              <input type="checkbox" checked={emitCobranca} onChange={(e) => setEmitCobranca(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>Gerar cobrança automaticamente (Asaas)</span>
            </label>

            {emitCobranca && (
              <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <div className="faturamento-form-group">
                  <label>Forma de Pagamento Padrão</label>
                  <select>
                    <option>Boleto + Pix</option>
                    <option>Apenas Pix</option>
                    <option>Cartão de Crédito</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button 
            onClick={() => {
              alert('Recorrência criada!');
              onClose();
            }}
            className="faturamento-btn-primary"
          >
            <Check size={16} /> Salvar Recorrência
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

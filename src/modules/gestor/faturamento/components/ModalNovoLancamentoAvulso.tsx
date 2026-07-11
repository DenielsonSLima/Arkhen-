import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, Check, FileText, DollarSign } from 'lucide-react';

interface ModalNovoLancamentoAvulsoProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNovoLancamentoAvulso: React.FC<ModalNovoLancamentoAvulsoProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<'nfse' | 'cobranca' | 'ambos' | null>(null);

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
            {step === 1 && 'O que você deseja gerar?'}
            {step === 2 && (tipo === 'nfse' ? 'Dados da NFS-e' : tipo === 'cobranca' ? 'Dados da Cobrança' : 'Dados do Lançamento')}
            {step === 3 && 'Opções Adicionais'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <button
              onClick={() => setTipo('nfse')}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '12px',
                border: `2px solid ${tipo === 'nfse' ? '#c59235' : '#e2e8f0'}`,
                backgroundColor: tipo === 'nfse' ? '#fefce8' : '#ffffff',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
              }}
            >
              <div style={{ padding: '12px', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '8px' }}>
                <FileText size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>Apenas NFS-e</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Emitir nota fiscal sem gerar cobrança.</p>
              </div>
            </button>

            <button
              onClick={() => setTipo('cobranca')}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '12px',
                border: `2px solid ${tipo === 'cobranca' ? '#c59235' : '#e2e8f0'}`,
                backgroundColor: tipo === 'cobranca' ? '#fefce8' : '#ffffff',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
              }}
            >
              <div style={{ padding: '12px', backgroundColor: '#ecfdf5', color: '#10b981', borderRadius: '8px' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>Apenas Cobrança</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Gerar boleto, pix ou link de pagamento sem nota fiscal.</p>
              </div>
            </button>

            <button
              onClick={() => setTipo('ambos')}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '12px',
                border: `2px solid ${tipo === 'ambos' ? '#c59235' : '#e2e8f0'}`,
                backgroundColor: tipo === 'ambos' ? '#fefce8' : '#ffffff',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
              }}
            >
              <div style={{ padding: '12px', backgroundColor: '#f5f3ff', color: '#8b5cf6', borderRadius: '8px' }}>
                <div style={{ display: 'flex' }}>
                  <FileText size={20} />
                  <DollarSign size={20} style={{ marginLeft: '-8px' }} />
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: '0 0 4px 0' }}>NFS-e + Cobrança</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Emitir nota fiscal e já gerar a cobrança vinculada.</p>
              </div>
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Parceiro / Cliente</label>
              <select>
                <option value="">Selecione o parceiro...</option>
                <option value="1">Tech Solutions SA</option>
              </select>
            </div>
            
            <div className="faturamento-form-group">
              <label>Valor (R$)</label>
              <input type="text" placeholder="0,00" />
            </div>

            <div className="faturamento-form-group">
              <label>Data</label>
              <input type="date" />
            </div>

            {(tipo === 'nfse' || tipo === 'ambos') && (
              <>
                <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Tipo de Serviço</label>
                  <select>
                    <option>17.19 - Contabilidade, inclusive serviços técnicos...</option>
                  </select>
                </div>
                <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Anotações / Descrição do Serviço</label>
                  <textarea rows={3} placeholder="Descreva o serviço para a NFS-e..."></textarea>
                </div>
              </>
            )}

            {(tipo === 'cobranca' || tipo === 'ambos') && (
              <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Forma de Pagamento</label>
                <select>
                  <option>Boleto + Pix</option>
                  <option>Apenas Pix</option>
                  <option>Cartão de Crédito</option>
                </select>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          {step > 1 ? (
            <button 
              onClick={() => setStep(step - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          ) : <div></div>}

          {step < 2 ? (
            <button 
              onClick={() => setStep(step + 1)}
              disabled={!tipo}
              className="faturamento-btn-primary"
              style={{ opacity: !tipo ? 0.5 : 1 }}
            >
              Continuar <ArrowRight size={16} />
            </button>
          ) : (
            <button 
              onClick={() => {
                alert('Gerado com sucesso!');
                onClose();
              }}
              className="faturamento-btn-primary"
            >
              <Check size={16} /> Confirmar Geração
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

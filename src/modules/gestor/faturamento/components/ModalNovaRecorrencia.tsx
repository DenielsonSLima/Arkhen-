import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Check } from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useSaveContratoFinanceiroMutation } from '../../financeiro/queries/useFinanceiroQueries';

interface ModalNovaRecorrenciaProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNovaRecorrencia: React.FC<ModalNovaRecorrenciaProps> = ({ isOpen, onClose }) => {
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    enabled: isOpen,
  });
  const saveContratoMutation = useSaveContratoFinanceiroMutation();
  const [emitNfse, setEmitNfse] = useState(true);
  const [emitCobranca, setEmitCobranca] = useState(true);
  const [clienteEmpresaId, setClienteEmpresaId] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [diaVencimento, setDiaVencimento] = useState(1);
  const [descricaoServico, setDescricaoServico] = useState('Honorários contábeis');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseCurrency = (value: string) => Number(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;

  const handleSubmit = async () => {
    const valor = parseCurrency(valorMensal);
    if (!clienteEmpresaId || valor <= 0) {
      setErrorMsg('Selecione o parceiro e informe um valor mensal válido.');
      return;
    }

    setErrorMsg(null);
    await saveContratoMutation.mutateAsync({
      clienteEmpresaId,
      descricaoServico,
      valorMensal: valor,
      diaVencimento,
      emissaoAutomaticaNfse: emitNfse,
      ativo: true,
      gerarCobranca: emitCobranca,
    });
    setClienteEmpresaId('');
    setValorMensal('');
    setDiaVencimento(1);
    setDescricaoServico('Honorários contábeis');
    onClose();
  };

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
            <select value={clienteEmpresaId} onChange={(event) => setClienteEmpresaId(event.target.value)}>
              <option value="">Selecione o parceiro...</option>
              {(clientesQuery.data || []).map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </div>
          
          <div className="faturamento-form-group">
            <label>Valor Mensal (R$)</label>
            <input type="text" placeholder="0,00" value={valorMensal} onChange={(event) => setValorMensal(event.target.value)} />
          </div>

          <div className="faturamento-form-group">
            <label>Dia de Vencimento/Emissão</label>
            <select value={diaVencimento} onChange={(event) => setDiaVencimento(Number(event.target.value))}>
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
                  <textarea rows={2} placeholder="Honorários referentes a [MES]/[ANO]..." value={descricaoServico} onChange={(event) => setDescricaoServico(event.target.value)}></textarea>
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

        {errorMsg && <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>{errorMsg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button 
            onClick={() => void handleSubmit()}
            disabled={saveContratoMutation.isPending}
            className="faturamento-btn-primary"
          >
            <Check size={16} /> {saveContratoMutation.isPending ? 'Salvando...' : 'Salvar Recorrência'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

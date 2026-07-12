import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ArrowRight, ArrowLeft, Check, DollarSign } from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useCreateCobrancaFinanceiraMutation } from '../../financeiro/queries/useFinanceiroQueries';

interface ModalNovoLancamentoAvulsoProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNovoLancamentoAvulso: React.FC<ModalNovoLancamentoAvulsoProps> = ({ isOpen, onClose }) => {
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    enabled: isOpen,
  });
  const createCobrancaMutation = useCreateCobrancaFinanceiraMutation();
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<'cobranca' | null>('cobranca');
  const [clienteEmpresaId, setClienteEmpresaId] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [meioPagamento, setMeioPagamento] = useState<'Pix' | 'Boleto' | 'Ambos'>('Ambos');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseCurrency = (value: string) => Number(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;

  const handleSubmit = async () => {
    const parsedValor = parseCurrency(valor);
    if (!clienteEmpresaId || parsedValor <= 0 || !dataVencimento) {
      setErrorMsg('Selecione o parceiro, valor e data.');
      return;
    }

    try {
      setErrorMsg(null);
      await createCobrancaMutation.mutateAsync({
        clienteEmpresaId,
        valor: parsedValor,
        dataVencimento,
        descricao: descricao.trim() || 'Cobrança avulsa',
        meioPagamento,
      });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Falha ao gerar cobrança.');
      return;
    }
    setStep(1);
    setTipo('cobranca');
    setClienteEmpresaId('');
    setValor('');
    setDataVencimento('');
    setDescricao('');
    setMeioPagamento('Ambos');
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
            {step === 1 && 'Nova cobrança'}
            {step === 2 && 'Dados da cobrança'}
            {step === 3 && 'Opções Adicionais'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div style={{ display: 'grid', gap: '16px' }}>
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
          </div>
        )}

        {step === 2 && (
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
              <label>Valor (R$)</label>
              <input type="text" placeholder="0,00" value={valor} onChange={(event) => setValor(event.target.value)} />
            </div>

            <div className="faturamento-form-group">
              <label>Data</label>
              <input type="date" value={dataVencimento} onChange={(event) => setDataVencimento(event.target.value)} />
            </div>

            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descrição</label>
              <textarea rows={3} placeholder="Descreva a cobrança..." value={descricao} onChange={(event) => setDescricao(event.target.value)}></textarea>
            </div>

            <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Forma de Pagamento</label>
              <select value={meioPagamento} onChange={(event) => setMeioPagamento(event.target.value as 'Pix' | 'Boleto' | 'Ambos')}>
                <option value="Ambos">Boleto + Pix</option>
                <option value="Pix">Apenas Pix</option>
                <option value="Boleto">Boleto</option>
              </select>
            </div>
          </div>
        )}

        {errorMsg && <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>{errorMsg}</div>}

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
              onClick={() => void handleSubmit()}
              disabled={createCobrancaMutation.isPending}
              className="faturamento-btn-primary"
            >
              <Check size={16} /> {createCobrancaMutation.isPending ? 'Gerando...' : 'Confirmar Geração'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

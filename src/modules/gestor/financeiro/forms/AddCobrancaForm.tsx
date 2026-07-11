import React, { useState } from 'react';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';

interface AddCobrancaFormProps {
  companies: Company[];
  onSave: (dados: {
    clienteEmpresaId: string;
    valor: number;
    dataVencimento: string;
    descricao: string;
    meioPagamento: 'Pix' | 'Boleto' | 'Ambos';
  }) => Promise<void>;
  onCancel: () => void;
}

export const AddCobrancaForm: React.FC<AddCobrancaFormProps> = ({
  companies,
  onSave,
  onCancel,
}) => {
  const [clienteEmpresaId, setClienteEmpresaId] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [descricao, setDescricao] = useState('Serviço de Terceiros');
  const [meioPagamento, setMeioPagamento] = useState<'Pix' | 'Boleto' | 'Ambos'>('Ambos');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clienteEmpresaId) {
      setError('Por favor, selecione o cliente.');
      return;
    }
    const parsedValor = parseFloat(valor);
    if (isNaN(parsedValor) || parsedValor <= 0) {
      setError('Por favor, informe um valor válido maior que zero.');
      return;
    }
    if (!dataVencimento) {
      setError('Por favor, selecione a data de vencimento.');
      return;
    }
    if (!descricao.trim()) {
      setError('Por favor, informe a descrição do serviço.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        clienteEmpresaId,
        valor: parsedValor,
        dataVencimento,
        descricao,
        meioPagamento,
      });
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar a cobrança.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="config-form animate-fade-in" style={{ padding: '8px' }}>
      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div className="form-item-group">
        <label>Cliente / Empresa</label>
        <select
          value={clienteEmpresaId}
          onChange={(e) => setClienteEmpresaId(e.target.value)}
          disabled={isSubmitting}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: '#1e293b' }}
        >
          <option value="">Selecione o Cliente...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({c.cnpj})
            </option>
          ))}
        </select>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="form-item-group">
          <label>Vencimento</label>
          <input
            type="date"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-item-group">
        <label>Descrição / Tipo do Serviço</label>
        <input
          type="text"
          placeholder="Ex: Consultoria Extraordinária, Serviço de Terceiros, etc."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="form-item-group">
        <label>Meio de Pagamento Asaas</label>
        <select
          value={meioPagamento}
          onChange={(e) => setMeioPagamento(e.target.value as any)}
          disabled={isSubmitting}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', color: '#1e293b' }}
        >
          <option value="Ambos">Boleto + Pix (Recomendado)</option>
          <option value="Boleto">Apenas Boleto</option>
          <option value="Pix">Apenas Pix</option>
        </select>
      </div>

      <div className="form-actions-row" style={{ marginTop: '24px', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          onClick={onCancel}
          className="financeiro-modal-btn cancel"
          style={{ color: '#64748b', borderColor: '#cbd5e1', backgroundColor: 'transparent' }}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-financeiro-add"
          style={{ padding: '10px 24px', boxShadow: 'none' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Gerando...' : 'Gerar Cobrança'}
        </button>
      </div>
    </form>
  );
};

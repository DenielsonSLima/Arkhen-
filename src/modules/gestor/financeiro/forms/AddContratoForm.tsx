import React, { useState, useEffect } from 'react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { ContratoFinanceiro } from '../services/financeiroService';

interface AddContratoFormProps {
  existingContracts: ContratoFinanceiro[];
  onSave: (data: Omit<ContratoFinanceiro, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export const AddContratoForm: React.FC<AddContratoFormProps> = ({ existingContracts, onSave, onCancel }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [valorMensal, setValorMensal] = useState<number>(0);
  const [diaVencimento, setDiaVencimento] = useState<number>(5);
  const [emissaoAutomatica, setEmissaoAutomatica] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const list = await gestaoEmpresarialService.getCompanies();
        // Filtra empresas que já possuem contrato ativo para evitar duplicidade direta de configuração principal
        const activeClientIds = existingContracts.filter(c => c.ativo).map(c => c.clienteEmpresaId);
        const available = list.filter(c => !activeClientIds.includes(c.id));
        setCompanies(available);
        if (available.length > 0) {
          setSelectedCompanyId(available[0].id);
        }
      } catch (err) {
        console.error('Erro ao buscar empresas:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, [existingContracts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCompanyId) {
      setError('Por favor, selecione uma empresa cliente.');
      return;
    }
    if (valorMensal <= 0) {
      setError('O valor mensal deve ser maior que zero.');
      return;
    }
    if (diaVencimento < 1 || diaVencimento > 28) {
      setError('O dia de vencimento deve estar entre 1 e 28.');
      return;
    }

    try {
      await onSave({
        clienteEmpresaId: selectedCompanyId,
        valorMensal,
        diaVencimento,
        emissaoAutomaticaNfse: emissaoAutomatica,
        ativo: true
      });
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar contrato.');
    }
  };

  if (loading) {
    return <div className="sub-loading">Carregando empresas disponíveis...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="popup-form-content">
      {error && <div className="error-message-banner" style={{ color: '#ef4444', marginBottom: '12px', fontSize: '0.82rem' }}>{error}</div>}

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label htmlFor="company-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
          Empresa Cliente
        </label>
        {companies.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: '#ef4444' }}>
            Nenhuma empresa ativa disponível sem contrato configurado.
          </div>
        ) : (
          <select
            id="company-select"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="form-input"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1f1f1f', backgroundColor: '#fff' }}
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.nome} ({c.cnpj})</option>
            ))}
          </select>
        )}
      </div>

      <div className="form-row-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group">
          <label htmlFor="valor-mensal" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
            Valor Mensal (R$)
          </label>
          <input
            id="valor-mensal"
            type="number"
            step="0.01"
            min="0"
            value={valorMensal || ''}
            onChange={(e) => setValorMensal(parseFloat(e.target.value) || 0)}
            className="form-input"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1f1f1f', backgroundColor: '#fff' }}
            placeholder="Ex: 1200.00"
          />
        </div>

        <div className="form-group">
          <label htmlFor="dia-vencimento" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
            Dia do Vencimento
          </label>
          <input
            id="dia-vencimento"
            type="number"
            min="1"
            max="28"
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(parseInt(e.target.value) || 1)}
            className="form-input"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1f1f1f', backgroundColor: '#fff' }}
          />
        </div>
      </div>

      <div className="form-group-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <input
          id="emissao-automatica"
          type="checkbox"
          checked={emissaoAutomatica}
          onChange={(e) => setEmissaoAutomatica(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <label htmlFor="emissao-automatica" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
          Habilitar Emissão Automática de NFS-e pelo Asaas
        </label>
      </div>

      <div className="popup-form-buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-invite" disabled={companies.length === 0}>
          Adicionar Contrato
        </button>
      </div>
    </form>
  );
};

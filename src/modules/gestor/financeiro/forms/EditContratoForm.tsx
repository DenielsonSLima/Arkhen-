import React, { useState, useEffect } from 'react';
import type { ContratoFinanceiro } from '../services/financeiroService';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';

interface EditContratoFormProps {
  contrato: ContratoFinanceiro;
  onSave: (data: ContratoFinanceiro) => Promise<void>;
  onCancel: () => void;
}

export const EditContratoForm: React.FC<EditContratoFormProps> = ({ contrato, onSave, onCancel }) => {
  const [companyName, setCompanyName] = useState('Buscando cliente...');
  const [valorMensal, setValorMensal] = useState<number>(contrato.valorMensal);
  const [diaVencimento, setDiaVencimento] = useState<number>(contrato.diaVencimento);
  const [emissaoAutomatica, setEmissaoAutomatica] = useState(contrato.emissaoAutomaticaNfse);
  const [ativo, setAtivo] = useState(contrato.ativo);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const list = await gestaoEmpresarialService.getCompanies();
        const comp = list.find(c => c.id === contrato.clienteEmpresaId);
        if (comp) {
          setCompanyName(comp.nome);
        } else {
          setCompanyName('Empresa não encontrada');
        }
      } catch (err) {
        console.error(err);
        setCompanyName('Erro ao carregar empresa');
      }
    };
    loadCompanyName();
  }, [contrato.clienteEmpresaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        ...contrato,
        valorMensal,
        diaVencimento,
        emissaoAutomaticaNfse: emissaoAutomatica,
        ativo
      });
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar contrato.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="popup-form-content">
      {error && <div className="error-message-banner" style={{ color: '#ef4444', marginBottom: '12px', fontSize: '0.82rem' }}>{error}</div>}

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
          Empresa Cliente
        </label>
        <input
          type="text"
          value={companyName}
          disabled
          className="form-input"
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#64748b', backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
        />
      </div>

      <div className="form-row-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group">
          <label htmlFor="edit-valor-mensal" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
            Valor Mensal (R$)
          </label>
          <input
            id="edit-valor-mensal"
            type="number"
            step="0.01"
            min="0"
            value={valorMensal || ''}
            onChange={(e) => setValorMensal(parseFloat(e.target.value) || 0)}
            className="form-input"
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1f1f1f', backgroundColor: '#fff' }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-dia-vencimento" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: '#64748b' }}>
            Dia do Vencimento
          </label>
          <input
            id="edit-dia-vencimento"
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

      <div className="form-group-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <input
          id="edit-emissao-automatica"
          type="checkbox"
          checked={emissaoAutomatica}
          onChange={(e) => setEmissaoAutomatica(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <label htmlFor="edit-emissao-automatica" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
          Habilitar Emissão Automática de NFS-e pelo Asaas
        </label>
      </div>

      <div className="form-group-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <input
          id="edit-ativo"
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <label htmlFor="edit-ativo" style={{ fontSize: '0.85rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
          Contrato Ativo
        </label>
      </div>

      <div className="popup-form-buttons" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-invite">
          Salvar Alterações
        </button>
      </div>
    </form>
  );
};

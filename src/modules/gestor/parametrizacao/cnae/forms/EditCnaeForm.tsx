import React, { useState } from 'react';
import type { Cnae } from '../../services/parametrizacaoService';

interface EditCnaeFormProps {
  cnae: Cnae;
  onSave: (cnae: Cnae) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const EditCnaeForm: React.FC<EditCnaeFormProps> = ({ cnae, onSave, onCancel, isSaving }) => {
  const [codigo, setCodigo] = useState(cnae.codigo);
  const [descricao, setDescricao] = useState(cnae.descricao);
  const [simplesNacional, setSimplesNacional] = useState(cnae.simplesNacional);
  const [simplesAnexo, setSimplesAnexo] = useState<Cnae['simplesAnexo']>(
    cnae.simplesAnexo !== 'N/A' ? cnae.simplesAnexo : 'Anexo III'
  );
  const [presuncaoIrpj, setPresuncaoIrpj] = useState(cnae.presuncaoIrpj.toFixed(2));
  const [presuncaoCsll, setPresuncaoCsll] = useState(cnae.presuncaoCsll.toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !descricao) return;

    onSave({
      id: cnae.id,
      codigo,
      descricao,
      simplesNacional,
      simplesAnexo: simplesNacional ? simplesAnexo : 'N/A',
      presuncaoIrpj: parseFloat(presuncaoIrpj) || 0,
      presuncaoCsll: parseFloat(presuncaoCsll) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="config-form popup-form">
      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Código CNAE *</label>
          <input
            type="text"
            required
            placeholder="Ex: 6201-5/00"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="form-item-group">
          <label>Enquadramento Simples Nacional</label>
          <div className="form-checkbox-group" style={{ margin: '6px 0' }}>
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={simplesNacional}
                onChange={(e) => setSimplesNacional(e.target.checked)}
                disabled={isSaving}
              />
              <span className="checkbox-checkmark"></span>
              Permitido no Simples
            </label>
          </div>
        </div>
      </div>

      <div className="form-item-group">
        <label>Descrição da Atividade *</label>
        <input
          type="text"
          required
          placeholder="Ex: Desenvolvimento de software..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          disabled={isSaving}
        />
      </div>

      <div className="form-divider-title">Alíquotas e Parâmetros</div>

      <div className="form-row-grid">
        {simplesNacional && (
          <div className="form-item-group">
            <label>Anexo do Simples Nacional</label>
            <select
              value={simplesAnexo}
              onChange={(e) => setSimplesAnexo(e.target.value as any)}
              disabled={isSaving}
            >
              <option value="Anexo I">Anexo I (Comércio)</option>
              <option value="Anexo II">Anexo II (Indústria)</option>
              <option value="Anexo III">Anexo III (Serviços - TI, Geral)</option>
              <option value="Anexo IV">Anexo IV (Serviços - Advocacia, Limpeza)</option>
              <option value="Anexo V">Anexo V (Serviços - Academias, Tecnologia Avançada)</option>
            </select>
          </div>
        )}
        
        <div className="form-item-group">
          <label>Presunção IRPJ (%)</label>
          <input
            type="number"
            step="0.01"
            required
            value={presuncaoIrpj}
            onChange={(e) => setPresuncaoIrpj(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="form-item-group">
          <label>Presunção CSLL (%)</label>
          <input
            type="number"
            step="0.01"
            required
            value={presuncaoCsll}
            onChange={(e) => setPresuncaoCsll(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="popup-form-buttons">
        <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </button>
        <button type="submit" className="btn-invite" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
};

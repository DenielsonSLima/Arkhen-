import React, { useState } from 'react';
import type { RegraImposto, Cnae } from '../../services/parametrizacaoService';

interface EditRegraImpostoFormProps {
  regra: RegraImposto;
  cnaes: Cnae[];
  onSave: (regra: RegraImposto) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const EditRegraImpostoForm: React.FC<EditRegraImpostoFormProps> = ({
  regra,
  cnaes,
  onSave,
  onCancel,
  isSaving,
}) => {
  const [nome, setNome] = useState(regra.nome);
  const [regime, setRegime] = useState(regra.regime);
  const [cnaeCodigo, setCnaeCodigo] = useState(regra.cnaeCodigo);
  const [cstPis, setCstPis] = useState(regra.cstPis);
  const [aliquotaPis, setAliquotaPis] = useState(regra.aliquotaPis.toFixed(2));
  const [cstCofins, setCstCofins] = useState(regra.cstCofins);
  const [aliquotaCofins, setAliquotaCofins] = useState(regra.aliquotaCofins.toFixed(2));

  const handleRegimeChange = (val: 'Lucro Presumido' | 'Lucro Real') => {
    setRegime(val);
    if (val === 'Lucro Presumido') {
      setAliquotaPis('0.65');
      setAliquotaCofins('3.00');
    } else {
      setAliquotaPis('1.65');
      setAliquotaCofins('7.60');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cnaeCodigo) return;

    onSave({
      id: regra.id,
      nome,
      regime,
      cnaeCodigo,
      cstPis,
      aliquotaPis: parseFloat(aliquotaPis) || 0,
      cstCofins,
      aliquotaCofins: parseFloat(aliquotaCofins) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="config-form popup-form">
      <div className="form-item-group">
        <label>Nome Identificador da Regra *</label>
        <input
          type="text"
          required
          placeholder="Ex: TI - Alíquota Básica Presumido"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={isSaving}
        />
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Regime Tributário *</label>
          <select
            value={regime}
            onChange={(e) => handleRegimeChange(e.target.value as any)}
            disabled={isSaving}
          >
            <option value="Lucro Presumido">Lucro Presumido (Cumulativo)</option>
            <option value="Lucro Real">Lucro Real (Não Cumulativo)</option>
          </select>
        </div>

        <div className="form-item-group">
          <label>Atividade CNAE Associada *</label>
          <select
            value={cnaeCodigo}
            onChange={(e) => setCnaeCodigo(e.target.value)}
            disabled={isSaving}
          >
            {cnaes.map((cnae) => (
              <option key={cnae.id} value={cnae.codigo}>
                {cnae.codigo} - {cnae.descricao.slice(0, 45)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-divider-title">Parâmetros PIS</div>
      
      <div className="form-row-grid">
        <div className="form-item-group">
          <label>CST PIS *</label>
          <select
            value={cstPis}
            onChange={(e) => setCstPis(e.target.value)}
            disabled={isSaving}
          >
            <option value="01">01 - Operação Tributável (Alíquota Básica)</option>
            <option value="04">04 - Operação Tributável (Monofásica)</option>
            <option value="06">06 - Operação Tributável (Alíquota Zero)</option>
            <option value="07">07 - Operação Isenta da Contribuição</option>
          </select>
        </div>

        <div className="form-item-group">
          <label>Alíquota PIS (%)</label>
          <input
            type="number"
            step="0.01"
            required
            value={aliquotaPis}
            onChange={(e) => setAliquotaPis(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="form-divider-title">Parâmetros COFINS</div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>CST COFINS *</label>
          <select
            value={cstCofins}
            onChange={(e) => setCstCofins(e.target.value)}
            disabled={isSaving}
          >
            <option value="01">01 - Operação Tributável (Alíquota Básica)</option>
            <option value="04">04 - Operação Tributável (Monofásica)</option>
            <option value="06">06 - Operação Tributável (Alíquota Zero)</option>
            <option value="07">07 - Operação Isenta da Contribuição</option>
          </select>
        </div>

        <div className="form-item-group">
          <label>Alíquota COFINS (%)</label>
          <input
            type="number"
            step="0.01"
            required
            value={aliquotaCofins}
            onChange={(e) => setAliquotaCofins(e.target.value)}
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

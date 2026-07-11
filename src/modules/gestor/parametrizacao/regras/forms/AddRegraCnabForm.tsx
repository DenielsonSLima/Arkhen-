import React, { useState } from 'react';
import type { RegraCnab } from '../../services/parametrizacaoService';

interface AddRegraCnabFormProps {
  onSave: (regra: RegraCnab) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const AddRegraCnabForm: React.FC<AddRegraCnabFormProps> = ({ onSave, onCancel, isSaving }) => {
  const [nome, setNome] = useState('');
  const [banco, setBanco] = useState('Asaas');
  const [tipoRegra, setTipoRegra] = useState<'cobranca' | 'conciliacao'>('conciliacao');

  // Cobrança parameters
  const [multa, setMulta] = useState('2.00');
  const [juros, setJuros] = useState('1.00');
  const [diasTolerancia, setDiasTolerancia] = useState('0');

  // Conciliação parameters
  const [padraoTexto, setPadraoTexto] = useState('');
  const [contaContabil, setContaContabil] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    onSave({
      id: '',
      nome,
      banco,
      tipoRegra,
      multa: tipoRegra === 'cobranca' ? parseFloat(multa) || 0 : null,
      juros: tipoRegra === 'cobranca' ? parseFloat(juros) || 0 : null,
      diasTolerancia: tipoRegra === 'cobranca' ? parseInt(diasTolerancia) || 0 : null,
      padraoTexto: tipoRegra === 'conciliacao' ? padraoTexto : null,
      contaContabil: tipoRegra === 'conciliacao' ? contaContabil : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="config-form popup-form">
      <div className="form-item-group">
        <label>Nome Identificador da Regra *</label>
        <input
          type="text"
          required
          placeholder="Ex: Conciliação automática - Tarifas Asaas"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={isSaving}
        />
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Instituição Bancária *</label>
          <select
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            disabled={isSaving}
          >
            <option value="Asaas">Asaas</option>
            <option value="Itaú">Itaú Unibanco</option>
            <option value="Banco do Brasil">Banco do Brasil</option>
            <option value="Bradesco">Bradesco</option>
            <option value="Santander">Santander</option>
          </select>
        </div>

        <div className="form-item-group">
          <label>Tipo de Regra Bancária *</label>
          <select
            value={tipoRegra}
            onChange={(e) => setTipoRegra(e.target.value as any)}
            disabled={isSaving}
          >
            <option value="conciliacao">Conciliação Automática de Extrato</option>
            <option value="cobranca">Geração de Cobrança (Juros/Multa)</option>
          </select>
        </div>
      </div>

      {tipoRegra === 'cobranca' ? (
        <div className="animate-fade-in">
          <div className="form-divider-title">Parâmetros de Cobrança</div>
          
          <div className="form-row-grid">
            <div className="form-item-group">
              <label>Multa por Atraso (%)</label>
              <input
                type="number"
                step="0.01"
                required
                value={multa}
                onChange={(e) => setMulta(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="form-item-group">
              <label>Juros Mensais (%)</label>
              <input
                type="number"
                step="0.01"
                required
                value={juros}
                onChange={(e) => setJuros(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="form-item-group">
              <label>Dias de Tolerância</label>
              <input
                type="number"
                required
                value={diasTolerancia}
                onChange={(e) => setDiasTolerancia(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="form-divider-title">Parâmetros de Conciliação Contábil</div>
          
          <div className="form-row-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>
            <div className="form-item-group">
              <label>Texto a buscar no Extrato *</label>
              <input
                type="text"
                required
                placeholder="Ex: TARIFA / TED RECEBIDA"
                value={padraoTexto}
                onChange={(e) => setPadraoTexto(e.target.value.toUpperCase())}
                disabled={isSaving}
              />
              <span className="input-helper-text">Termo que identifica a transação no arquivo de extrato.</span>
            </div>
            
            <div className="form-item-group">
              <label>Conta de Contrapartida Contábil *</label>
              <input
                type="text"
                required
                placeholder="Ex: Receitas de Prestação / Despesa Bancária"
                value={contaContabil}
                onChange={(e) => setContaContabil(e.target.value)}
                disabled={isSaving}
              />
              <span className="input-helper-text">Mapeamento contábil para lançamento automático.</span>
            </div>
          </div>
        </div>
      )}

      <div className="popup-form-buttons">
        <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </button>
        <button type="submit" className="btn-invite" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Criar Regra CNAB'}
        </button>
      </div>
    </form>
  );
};

import React, { useState, useEffect } from 'react';
import { Save, Check } from 'lucide-react';
import { useInternalTabs } from '../../../../hooks/useInternalTabs';
import { useFloatingCalculator } from '../../../../hooks/useFloatingCalculator';
import type { CalculatorModel } from '../../../../stores/floatingCalculatorStore';

export const CalculatorPrefsConfig: React.FC = () => {
  const { persistEnabled, setPersistEnabled } = useInternalTabs();
  const { setModel } = useFloatingCalculator();
  const [userId, setUserId] = useState('');
  const [defaultModel, setDefaultModel] = useState<CalculatorModel>('normal');
  const [localPersist, setLocalPersist] = useState(persistEnabled);
  const [successMsg, setSuccessMsg] = useState('');

  const PREFS_STORAGE_KEY = 'contabil_calculator_prefs_';
  const CURRENT_USER_ID = 'u-gestor';

  useEffect(() => {
    setUserId(CURRENT_USER_ID);

    try {
      const saved = localStorage.getItem(`${PREFS_STORAGE_KEY}${CURRENT_USER_ID}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.defaultModel) {
          setDefaultModel(parsed.defaultModel);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Salvar modelo padrão da calculadora para o usuário
      localStorage.setItem(
        `${PREFS_STORAGE_KEY}${userId}`,
        JSON.stringify({ defaultModel })
      );

      // Sincronizar com o store da calculadora ativa
      setModel(defaultModel);

      // Salvar persistência das abas
      setPersistEnabled(localPersist);

      setSuccessMsg('Configurações salvas com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header">
        <h2>Preferências do Sistema</h2>
        <p>Ajuste as preferências de ferramentas, calculadora e comportamento de abas.</p>
      </div>

      {successMsg && (
        <div className="success-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="empresa-form">
        <div className="form-grid">
          {/* Configuração de Modelo da Calculadora */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Modelo Padrão da Calculadora</label>
            <span className="field-desc" style={{ fontSize: '0.78rem', color: '#666', display: 'block', marginBottom: '8px' }}>
              Escolha qual calculadora será exibida ao iniciar o sistema ou ao abrir a ferramenta.
            </span>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value as CalculatorModel)}
              className="form-control"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d2d4d7' }}
            >
              <option value="normal">Calculadora Normal (Aritmética)</option>
              <option value="accounting">Calculadora Contábil (Pró-rata, Juros, Líquido/Bruto)</option>
              <option value="tax">Calculadora Tributária/Fiscal (Impostos, Retenções, DARF Atrasado)</option>
            </select>
          </div>

          {/* Configuração de Abas */}
          <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '16px' }}>
            <label>Comportamento de Abas Internas</label>
            <div style={{ marginTop: '8px' }}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={localPersist}
                  onChange={(e) => setLocalPersist(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.88rem', color: '#212529', fontWeight: 500 }}>
                  Manter abas abertas após recarregar a página
                </span>
              </label>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginTop: '4px', marginLeft: '28px' }}>
              Se ativado, as abas que você deixou abertas serão restauradas automaticamente quando você atualizar a página.
            </span>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-submit" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} /> Salvar Preferências
          </button>
        </div>
      </form>
    </div>
  );
};

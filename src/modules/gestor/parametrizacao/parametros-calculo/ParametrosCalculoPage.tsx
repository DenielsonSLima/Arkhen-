import React, { useEffect, useState } from 'react';
import { Calculator, FileText, Percent, Plus, RotateCcw, Save } from 'lucide-react';
import {
  parametrosCalculoService,
  type AnexoDasParametro,
  type ParametrosCalculo,
  type RegimePisCofinsParametro,
  type TipoRescisaoParametro,
} from './services/parametrosCalculoService';
import './ParametrosCalculo.css';

type TabKey = 'rescisao' | 'das' | 'pis' | 'geral';

const emptyTipoRescisao = (): TipoRescisaoParametro => ({
  id: `rescisao_${Date.now()}`,
  label: 'Novo Tipo',
  descricao: '',
  geraAvisoPrevio: false,
  geraMultaFgts: false,
  ativo: true,
});

const emptyRegimePis = (): RegimePisCofinsParametro => ({
  id: `regime_${Date.now()}`,
  label: 'Novo Regime',
  descricao: '',
  aliquotaPis: 0,
  aliquotaCofins: 0,
  permiteCreditoEntrada: false,
  ativo: true,
});

export const ParametrosCalculoPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('rescisao');
  const [parametros, setParametros] = useState<ParametrosCalculo | null>(null);
  const [activeAnexoId, setActiveAnexoId] = useState('I');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    parametrosCalculoService.getParametros().then(setParametros);
  }, []);

  const updateTipos = (updater: (list: TipoRescisaoParametro[]) => TipoRescisaoParametro[]) => {
    setParametros((prev) => prev ? { ...prev, tiposRescisao: updater(prev.tiposRescisao) } : prev);
  };

  const updateRegimes = (updater: (list: RegimePisCofinsParametro[]) => RegimePisCofinsParametro[]) => {
    setParametros((prev) => prev ? { ...prev, regimesPisCofins: updater(prev.regimesPisCofins) } : prev);
  };

  const updateAnexos = (updater: (list: AnexoDasParametro[]) => AnexoDasParametro[]) => {
    setParametros((prev) => prev ? { ...prev, anexosDas: updater(prev.anexosDas) } : prev);
  };

  const updateRegrasGerais = (field: string, value: number) => {
    setParametros((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        regrasGerais: {
          ...prev.regrasGerais,
          [field]: value
        }
      };
    });
  };

  const handleSave = async () => {
    if (!parametros) return;
    setIsSaving(true);
    const saved = await parametrosCalculoService.saveParametros(parametros);
    setParametros(saved);
    setSuccessMsg('Parâmetros de cálculo salvos com sucesso.');
    setIsSaving(false);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleReset = async () => {
    setIsSaving(true);
    const defaults = await parametrosCalculoService.resetParametros();
    setParametros(defaults);
    setActiveAnexoId('I');
    setSuccessMsg('Parâmetros restaurados para o padrão.');
    setIsSaving(false);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  if (!parametros) {
    return <div className="sub-loading">Carregando parâmetros de cálculo...</div>;
  }

  const activeAnexo = parametros.anexosDas.find((anexo) => anexo.id === activeAnexoId) ?? parametros.anexosDas[0];

  return (
    <div className="submodule-content-card parametros-calculo-page animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Parâmetros de Cálculo</h2>
          <p>Gerencie listas usadas nas simulações: tipos de rescisão, anexos do DAS e regimes de PIS/COFINS.</p>
        </div>
        <div className="tab-buttons-header">
          <button className="btn-cancel" onClick={handleReset} disabled={isSaving}>
            <RotateCcw size={15} /> Restaurar
          </button>
          <button className="btn-add-user" onClick={handleSave} disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {successMsg && <div className="success-banner animate-fade-in" style={{ marginTop: 12 }}>{successMsg}</div>}

      <div className="tab-buttons-header" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
        <button className={`btn-tab ${activeTab === 'rescisao' ? 'active' : ''}`} onClick={() => setActiveTab('rescisao')}>
          <FileText size={16} /> Rescisão
        </button>
        <button className={`btn-tab ${activeTab === 'das' ? 'active' : ''}`} onClick={() => setActiveTab('das')}>
          <Calculator size={16} /> DAS / Anexos
        </button>
        <button className={`btn-tab ${activeTab === 'pis' ? 'active' : ''}`} onClick={() => setActiveTab('pis')}>
          <Percent size={16} /> PIS/COFINS
        </button>
        <button className={`btn-tab ${activeTab === 'geral' ? 'active' : ''}`} onClick={() => setActiveTab('geral')}>
          <Percent size={16} /> Encargos & Alíquotas
        </button>
      </div>

      {activeTab === 'rescisao' && (
        <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
          <div className="table-actions-row">
            <h3>Tipos de Rescisão</h3>
            <button className="btn-add-user" onClick={() => updateTipos((list) => [...list, emptyTipoRescisao()])}>
              <Plus size={16} /> Novo Tipo
            </button>
          </div>
          <div className="table-responsive">
            <table className="config-table">
              <thead>
                <tr>
                  <th>Identificador</th>
                  <th>Nome exibido</th>
                  <th>Descrição</th>
                  <th>Aviso</th>
                  <th>Multa FGTS</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {parametros.tiposRescisao.map((tipo, index) => (
                  <tr key={tipo.id}>
                    <td><code className="ip-code">{tipo.id}</code></td>
                    <td><input value={tipo.label} onChange={(e) => updateTipos((list) => list.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} /></td>
                    <td><input value={tipo.descricao} onChange={(e) => updateTipos((list) => list.map((item, i) => i === index ? { ...item, descricao: e.target.value } : item))} /></td>
                    <td><input type="checkbox" checked={tipo.geraAvisoPrevio} onChange={(e) => updateTipos((list) => list.map((item, i) => i === index ? { ...item, geraAvisoPrevio: e.target.checked } : item))} /></td>
                    <td><input type="checkbox" checked={tipo.geraMultaFgts} onChange={(e) => updateTipos((list) => list.map((item, i) => i === index ? { ...item, geraMultaFgts: e.target.checked } : item))} /></td>
                    <td><input type="checkbox" checked={tipo.ativo} onChange={(e) => updateTipos((list) => list.map((item, i) => i === index ? { ...item, ativo: e.target.checked } : item))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'das' && activeAnexo && (
        <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
          <div className="table-actions-row">
            <h3>Anexos do Simples Nacional</h3>
            <select value={activeAnexo.id} onChange={(e) => setActiveAnexoId(e.target.value)} style={{ maxWidth: 240 }}>
              {parametros.anexosDas.map((anexo) => <option key={anexo.id} value={anexo.id}>{anexo.label}</option>)}
            </select>
          </div>
          <div className="form-row-grid" style={{ gridTemplateColumns: '1fr 2fr auto', marginBottom: 16 }}>
            <div className="form-group"><label>Nome</label><input value={activeAnexo.label} onChange={(e) => updateAnexos((list) => list.map((item) => item.id === activeAnexo.id ? { ...item, label: e.target.value } : item))} /></div>
            <div className="form-group"><label>Descrição</label><input value={activeAnexo.descricao} onChange={(e) => updateAnexos((list) => list.map((item) => item.id === activeAnexo.id ? { ...item, descricao: e.target.value } : item))} /></div>
            <div className="form-group"><label>Ativo</label><input type="checkbox" checked={activeAnexo.ativo} onChange={(e) => updateAnexos((list) => list.map((item) => item.id === activeAnexo.id ? { ...item, ativo: e.target.checked } : item))} /></div>
          </div>
          <div className="table-responsive">
            <table className="config-table">
              <thead>
                <tr><th>Faixa</th><th>Limite Superior</th><th>Alíquota nominal (%)</th><th>Valor a Deduzir</th></tr>
              </thead>
              <tbody>
                {activeAnexo.faixas.map((faixa, faixaIndex) => (
                  <tr key={faixa.faixa}>
                    <td><span className="table-badge badge-orange">Faixa {faixa.faixa}</span></td>
                    <td><input type="number" value={faixa.limiteSuperior} onChange={(e) => updateAnexos((list) => list.map((anexo) => anexo.id === activeAnexo.id ? { ...anexo, faixas: anexo.faixas.map((item, i) => i === faixaIndex ? { ...item, limiteSuperior: Number(e.target.value) } : item) } : anexo))} /></td>
                    <td><input type="number" step="0.01" value={faixa.aliquota} onChange={(e) => updateAnexos((list) => list.map((anexo) => anexo.id === activeAnexo.id ? { ...anexo, faixas: anexo.faixas.map((item, i) => i === faixaIndex ? { ...item, aliquota: Number(e.target.value) } : item) } : anexo))} /></td>
                    <td><input type="number" value={faixa.deducao} onChange={(e) => updateAnexos((list) => list.map((anexo) => anexo.id === activeAnexo.id ? { ...anexo, faixas: anexo.faixas.map((item, i) => i === faixaIndex ? { ...item, deducao: Number(e.target.value) } : item) } : anexo))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pis' && (
        <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
          <div className="table-actions-row">
            <h3>Regimes de PIS/COFINS</h3>
            <button className="btn-add-user" onClick={() => updateRegimes((list) => [...list, emptyRegimePis()])}>
              <Plus size={16} /> Novo Regime
            </button>
          </div>
          <div className="table-responsive">
            <table className="config-table">
              <thead>
                <tr><th>Identificador</th><th>Nome exibido</th><th>PIS (%)</th><th>COFINS (%)</th><th>Credita entradas</th><th>Ativo</th></tr>
              </thead>
              <tbody>
                {parametros.regimesPisCofins.map((regime, index) => (
                  <tr key={regime.id}>
                    <td><code className="ip-code">{regime.id}</code></td>
                    <td><input value={regime.label} onChange={(e) => updateRegimes((list) => list.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} /></td>
                    <td><input type="number" step="0.01" value={regime.aliquotaPis} onChange={(e) => updateRegimes((list) => list.map((item, i) => i === index ? { ...item, aliquotaPis: Number(e.target.value) } : item))} /></td>
                    <td><input type="number" step="0.01" value={regime.aliquotaCofins} onChange={(e) => updateRegimes((list) => list.map((item, i) => i === index ? { ...item, aliquotaCofins: Number(e.target.value) } : item))} /></td>
                    <td><input type="checkbox" checked={regime.permiteCreditoEntrada} onChange={(e) => updateRegimes((list) => list.map((item, i) => i === index ? { ...item, permiteCreditoEntrada: e.target.checked } : item))} /></td>
                    <td><input type="checkbox" checked={regime.ativo} onChange={(e) => updateRegimes((list) => list.map((item, i) => i === index ? { ...item, ativo: e.target.checked } : item))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'geral' && parametros.regrasGerais && (
        <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Regras Gerais de Encargos & Alíquotas</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 4 }}>
              Estes parâmetros alimentam diretamente os simuladores de Encargos Trabalhistas, Férias, Simulação de Contratação e Tempo de Empresa.
            </p>
          </div>
          
          <div className="form-row-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600 }}>Alíquota do FGTS Mensal (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={parametros.regrasGerais.aliquotaFgts}
                onChange={(e) => updateRegrasGerais('aliquotaFgts', Number(e.target.value))}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                Padrão CLT: 8,0% para funcionários gerais (14% com multa do FGTS se aplicável).
              </span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600 }}>Alíquota de INSS Patronal (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={parametros.regrasGerais.aliquotaInssPatronal}
                onChange={(e) => updateRegrasGerais('aliquotaInssPatronal', Number(e.target.value))}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                Contribuição Previdenciária patronal fixa (geralmente 20,0%).
              </span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600 }}>Provisão Mensal (13º + Férias + 1/3) (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={parametros.regrasGerais.provisaoFerias13}
                onChange={(e) => updateRegrasGerais('provisaoFerias13', Number(e.target.value))}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                Estimativa para provisão de férias e 13º salário (padrão médio de mercado: 19,44%).
              </span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600 }}>Alíquota do Simples Nacional - PJ (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={parametros.regrasGerais.aliquotaSimplesPj}
                onChange={(e) => updateRegrasGerais('aliquotaSimplesPj', Number(e.target.value))}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                Alíquota inicial adotada para simular o imposto do trabalhador PJ no Simples Nacional (padrão: 6,0%).
              </span>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontWeight: 600 }}>Multa FGTS para Rescisão (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={parametros.regrasGerais.multaFgtsRescisao}
                onChange={(e) => updateRegrasGerais('multaFgtsRescisao', Number(e.target.value))}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  width: '100%',
                  fontSize: '0.95rem'
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                A multa rescisória sobre o saldo acumulado de FGTS (padrão legal: 40,0%).
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

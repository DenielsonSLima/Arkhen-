import React, { useEffect, useState } from 'react';
import { Calculator, FileText, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import {
  DEFAULT_PARAMETROS_CALCULO,
  parametrosCalculoService,
  type AnexoDasParametro,
  type ParametrosCalculo,
} from './services/parametrosCalculoService';
import './ParametrosCalculo.css';

type TabKey = 'rescisao' | 'das';

export const ParametrosCalculoPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('rescisao');
  const [parametros, setParametros] = useState<ParametrosCalculo | null>(null);
  const [activeAnexoId, setActiveAnexoId] = useState('I');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    parametrosCalculoService.getParametros().then(setParametros);
  }, []);

  const updateAnexos = (updater: (list: AnexoDasParametro[]) => AnexoDasParametro[]) => {
    setParametros((prev) => prev ? { ...prev, anexosDas: updater(prev.anexosDas) } : prev);
  };

  const handleSave = async () => {
    if (!parametros) return;
    setIsSaving(true);
    const saved = await parametrosCalculoService.saveParametros(parametros);
    setParametros(saved);
    setSuccessMsg('Parâmetros do planejamento salvos com sucesso.');
    setIsSaving(false);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleReset = async () => {
    if (!parametros) return;
    setIsSaving(true);
    const restored = await parametrosCalculoService.saveParametros({
      ...parametros,
      anexosDas: DEFAULT_PARAMETROS_CALCULO.anexosDas,
    });
    setParametros(restored);
    setActiveAnexoId('I');
    setSuccessMsg('Faixas do planejamento restauradas para o padrão.');
    setIsSaving(false);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  if (!parametros) {
    return <div className="sub-loading">Carregando parâmetros de cálculo...</div>;
  }

  const tiposRescisao = parametros.tiposRescisao.filter((tipo) => (
    ['sem_justa_causa', 'com_justa_causa', 'pedido_demissao'].includes(tipo.id)
  ));
  const activeAnexo = parametros.anexosDas.find((anexo) => anexo.id === activeAnexoId)
    ?? parametros.anexosDas[0];

  return (
    <div className="submodule-content-card parametros-calculo-page animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Parâmetros de Cálculo</h2>
          <p>Consulte as regras de rescisão e mantenha as tabelas usadas no planejamento tributário.</p>
        </div>
        {activeTab === 'das' && (
          <div className="tab-buttons-header">
            <button className="btn-cancel" onClick={handleReset} disabled={isSaving}>
              <RotateCcw size={15} /> Restaurar faixas
            </button>
            <button className="btn-add-user" onClick={handleSave} disabled={isSaving}>
              <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar planejamento'}
            </button>
          </div>
        )}
      </div>

      {successMsg && <div className="success-banner animate-fade-in" style={{ marginTop: 12 }}>{successMsg}</div>}

      <div className="tab-buttons-header" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
        <button className={`btn-tab ${activeTab === 'rescisao' ? 'active' : ''}`} onClick={() => setActiveTab('rescisao')}>
          <FileText size={16} /> Rescisão
        </button>
        <button className={`btn-tab ${activeTab === 'das' ? 'active' : ''}`} onClick={() => setActiveTab('das')}>
          <Calculator size={16} /> Planejamento / Anexos
        </button>
      </div>

      {activeTab === 'rescisao' && (
        <>
          <div className="info-banner animate-fade-in" style={{ marginTop: 12 }}>
            <ShieldCheck size={16} />
            As regras de aviso-prévio e multa do FGTS são validadas no servidor e não podem ser alteradas localmente.
          </div>

          <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
            <div className="table-actions-row">
              <h3>
                <FileText size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Tipos de Rescisão
              </h3>
            </div>
            <div className="table-responsive">
              <table className="config-table parametros-rescisao-table">
                <thead>
                  <tr>
                    <th>Nome exibido</th>
                    <th>Descrição</th>
                    <th>Aviso</th>
                    <th>Multa FGTS</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposRescisao.map((tipo) => (
                    <tr key={tipo.id}>
                      <td><strong>{tipo.label}</strong></td>
                      <td>{tipo.descricao}</td>
                      <td>{tipo.geraAvisoPrevio ? 'Sim' : 'Não'}</td>
                      <td>{tipo.geraMultaFgts ? 'Sim' : 'Não'}</td>
                      <td>
                        <span className={`status-badge ${tipo.ativo ? 'active' : ''}`}>
                          {tipo.ativo ? 'Disponível' : 'Desativado localmente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'das' && activeAnexo && (
        <div className="tab-pane animate-fade-in" style={{ marginTop: 20 }}>
          <div className="table-actions-row">
            <div>
              <h3>Anexos do Simples Nacional</h3>
              <p className="parametros-calculo-page__hint">
                Estas faixas alimentam o módulo de planejamento tributário.
              </p>
            </div>
            <label className="parametros-calculo-page__anexo-selector">
              <span>Anexo</span>
              <select value={activeAnexo.id} onChange={(event) => setActiveAnexoId(event.target.value)}>
                {parametros.anexosDas.map((anexo) => (
                  <option key={anexo.id} value={anexo.id}>{anexo.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row-grid parametros-calculo-page__anexo-details">
            <div className="form-group">
              <label htmlFor="parametro-anexo-nome">Nome</label>
              <input
                id="parametro-anexo-nome"
                value={activeAnexo.label}
                onChange={(event) => updateAnexos((list) => list.map((item) => (
                  item.id === activeAnexo.id ? { ...item, label: event.target.value } : item
                )))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="parametro-anexo-descricao">Descrição</label>
              <input
                id="parametro-anexo-descricao"
                value={activeAnexo.descricao}
                onChange={(event) => updateAnexos((list) => list.map((item) => (
                  item.id === activeAnexo.id ? { ...item, descricao: event.target.value } : item
                )))}
              />
            </div>
            <label className="parametros-calculo-page__active-field">
              <input
                type="checkbox"
                checked={activeAnexo.ativo}
                onChange={(event) => updateAnexos((list) => list.map((item) => (
                  item.id === activeAnexo.id ? { ...item, ativo: event.target.checked } : item
                )))}
              />
              Ativo
            </label>
          </div>

          <div className="table-responsive">
            <table className="config-table">
              <thead>
                <tr>
                  <th>Faixa</th>
                  <th>Limite superior (R$)</th>
                  <th>Alíquota nominal (%)</th>
                  <th>Valor a deduzir (R$)</th>
                </tr>
              </thead>
              <tbody>
                {activeAnexo.faixas.map((faixa, faixaIndex) => (
                  <tr key={faixa.faixa}>
                    <td><span className="table-badge badge-orange">Faixa {faixa.faixa}</span></td>
                    {(['limiteSuperior', 'aliquota', 'deducao'] as const).map((field) => (
                      <td key={field}>
                        <input
                          aria-label={`${field} da faixa ${faixa.faixa}`}
                          type="number"
                          min="0"
                          step={field === 'aliquota' ? '0.01' : '0.01'}
                          value={faixa[field]}
                          onChange={(event) => updateAnexos((list) => list.map((anexo) => (
                            anexo.id === activeAnexo.id
                              ? {
                                  ...anexo,
                                  faixas: anexo.faixas.map((item, index) => (
                                    index === faixaIndex
                                      ? { ...item, [field]: Math.max(0, Number(event.target.value)) }
                                      : item
                                  )),
                                }
                              : anexo
                          )))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

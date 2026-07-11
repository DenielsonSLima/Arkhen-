import React, { useState, useEffect } from 'react';
import { Settings, Users, Plus, Trash2, CheckCircle2, FilePlus2 } from 'lucide-react';
import { atividadesService } from '../services/atividadesService';
import type { ClienteEmpresa, ModeloAtividade } from '../services/atividadesService';
import { MODELOS_PADRAO, REGIMES_APLICAVEIS, emptyNewModel } from './defaultChecklistModels';

export const ConfigFluxosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'modelos' | 'empresas'>('modelos');
  const [modelos, setModelos] = useState<ModeloAtividade[]>([]);
  const [clientes, setClientes] = useState<ClienteEmpresa[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editing state for models
  const [selectedModelo, setSelectedModelo] = useState<ModeloAtividade | null>(null);
  const [newStepText, setNewStepText] = useState('');
  const [showNewModelForm, setShowNewModelForm] = useState(false);
  const [newModel, setNewModel] = useState(emptyNewModel);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let mod = await atividadesService.getModelos();
      if (mod.length === 0) {
        mod = await Promise.all(MODELOS_PADRAO.map((modelo) => atividadesService.saveModelo(modelo)));
      }
      const cli = await atividadesService.getClientes();
      setModelos(mod);
      setClientes(cli);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateModelo = async () => {
    const etapas = newModel.etapas
      .split('\n')
      .map((etapa) => etapa.trim())
      .filter(Boolean);

    if (!newModel.nome.trim() || etapas.length === 0) return;

    const modelo: ModeloAtividade = {
      id: `modelo-${Date.now()}`,
      nome: newModel.nome.trim(),
      descricao: newModel.descricao.trim() || 'Modelo personalizado de checklist.',
      etapas,
      tipos: newModel.tipos,
    };

    try {
      const savedModelo = await atividadesService.saveModelo(modelo);
      setModelos((current) => [...current, savedModelo]);
      setSelectedModelo(savedModelo);
      setNewModel(emptyNewModel());
      setShowNewModelForm(false);
      setSuccessMsg('Novo modelo de checklist criado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleNewModelTipo = (tipo: string, checked: boolean) => {
    setNewModel((current) => ({
      ...current,
      tipos: checked
        ? Array.from(new Set([...current.tipos, tipo]))
        : current.tipos.filter((item) => item !== tipo),
    }));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleModelForCliente = async (clienteId: string, modeloId: string, active: boolean) => {
    const target = clientes.find((c) => c.id === clienteId);
    if (!target) return;

    let newModelos = [...target.modelosAtivos];
    if (active) {
      if (!newModelos.includes(modeloId)) {
        newModelos.push(modeloId);
      }
    } else {
      newModelos = newModelos.filter((id) => id !== modeloId);
    }

    const updatedCliente: ClienteEmpresa = {
      ...target,
      modelosAtivos: newModelos,
    };

    setClientes(clientes.map((c) => (c.id === clienteId ? updatedCliente : c)));

    try {
      await atividadesService.saveCliente(updatedCliente);
      setSuccessMsg('Vínculo de atividade atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };


  const handleApplyPattern = async () => {
    let updatedClientes = [...clientes];
    for (let c of updatedClientes) {
      const activeForThisRegime = modelos
        .filter(m => m.tipos && m.tipos.includes(c.regime))
        .map(m => m.id);
      
      // Merge unique models
      c.modelosAtivos = Array.from(new Set([...c.modelosAtivos, ...activeForThisRegime]));
      await atividadesService.saveCliente(c);
    }
    setClientes(updatedClientes);
    setSuccessMsg('Padrão aplicado! Todos os clientes foram atualizados de acordo com seu Tipo/Regime.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAddStepToModelo = async () => {
    if (!selectedModelo || !newStepText.trim()) return;

    const updatedModelo: ModeloAtividade = {
      ...selectedModelo,
      etapas: [...selectedModelo.etapas, newStepText.trim()],
    };

    setSelectedModelo(updatedModelo);
    setModelos(modelos.map((m) => (m.id === selectedModelo.id ? updatedModelo : m)));
    setNewStepText('');

    try {
      await atividadesService.saveModelo(updatedModelo);
      setSuccessMsg('Etapa adicionada ao modelo!');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveStepFromModelo = async (idx: number) => {
    if (!selectedModelo) return;

    const updatedEtapas = selectedModelo.etapas.filter((_, i) => i !== idx);
    const updatedModelo: ModeloAtividade = {
      ...selectedModelo,
      etapas: updatedEtapas,
    };

    setSelectedModelo(updatedModelo);
    setModelos(modelos.map((m) => (m.id === selectedModelo.id ? updatedModelo : m)));

    try {
      await atividadesService.saveModelo(updatedModelo);
      setSuccessMsg('Etapa removida do modelo!');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
    <div className="submodule-content-card animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Parametrização de Fluxos de Atividades</h2>
          <p>Gerencie os modelos de checklists contábeis e controle quais atividades são exigidas por cada cliente.</p>
        </div>
        <div className="tab-buttons-header">
          <button
            className={`btn-tab ${activeTab === 'modelos' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('modelos');
              setSelectedModelo(null);
            }}
          >
            <Settings size={16} /> Modelos de Checklist
          </button>
          <button
            className={`btn-tab ${activeTab === 'empresas' ? 'active' : ''}`}
            onClick={() => setActiveTab('empresas')}
          >
            <Users size={16} /> Vinculação de Clientes
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="success-banner animate-fade-in" style={{ marginTop: '12px' }}>
          <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
          {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="sub-loading">Carregando configurações...</div>
      ) : activeTab === 'modelos' ? (
        <div className="tab-pane" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
            <div>
              <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>{modelos.length} modelos cadastrados</strong>
              <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                Use os modelos padrão ou crie checklists personalizados para sua operação.
              </p>
            </div>
            <button
              type="button"
              className="btn-add-user"
              onClick={() => setShowNewModelForm(true)}
              style={{ borderRadius: '8px', padding: '10px 16px' }}
            >
              <FilePlus2 size={16} /> Novo Modelo
            </button>
          </div>

          {modelos.length === 0 && (
            <div className="fluxo-setup-box" style={{ textAlign: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Nenhum modelo cadastrado</h3>
              <p style={{ color: '#64748b', margin: '8px 0 0 0' }}>Crie um novo modelo ou recarregue para aplicar os padrões iniciais.</p>
            </div>
          )}

          <div className="models-preset-grid">
            {modelos.map((modelo) => (
              <div
                key={modelo.id}
                className={`model-preset-card ${selectedModelo?.id === modelo.id ? 'gold-border' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedModelo(modelo)}
              >
                <div className="model-preset-header">
                  <h4>{modelo.nome}</h4>
                  <p>{modelo.descricao}</p>
                </div>
                <div className="model-preset-steps-list">
                  <strong>Etapas ({modelo.etapas.length}):</strong>
                  {modelo.etapas.slice(0, 3).map((etapa, i) => (
                    <span key={i}>• {etapa}</span>
                  ))}
                  {modelo.etapas.length > 3 && <span style={{ fontStyle: 'italic' }}>+ {modelo.etapas.length - 3} etapas...</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Edit Checklist Panel */}
          {selectedModelo && (
            <div className="fluxo-setup-box animate-slide-up">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-text-dark)' }}>
                Configurando etapas do modelo: <span className="gold-text">{selectedModelo.nome}</span>
              </h3>

              
              {/* Tipos Aplicáveis */}
              <div style={{ marginTop: '16px', marginBottom: '16px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '10px' }}>Tipos / Regimes Aplicáveis</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '12px' }}>Vincule os tipos de empresas que utilizarão este padrão.</p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {REGIMES_APLICAVEIS.map(tipo => {
                    const isChecked = selectedModelo.tipos?.includes(tipo) || false;
                    return (
                      <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', color: '#475569' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={async (e) => {
                            const currentTipos = selectedModelo.tipos || [];
                            let newTipos;
                            if (e.target.checked) {
                              newTipos = [...currentTipos, tipo];
                            } else {
                              newTipos = currentTipos.filter(t => t !== tipo);
                            }
                            const updatedModelo = { ...selectedModelo, tipos: newTipos };
                            setSelectedModelo(updatedModelo);
                            setModelos(modelos.map(m => m.id === selectedModelo.id ? updatedModelo : m));
                            await atividadesService.saveModelo(updatedModelo);
                          }}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--color-gold-primary)' }}
                        />
                        {tipo}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {selectedModelo.etapas.map((etapa, idx) => (
                  <div key={idx} className="model-stage-input-row">
                    <input
                      type="text"
                      disabled
                      value={etapa}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcdcdc', backgroundColor: '#f1f5f9', fontSize: '0.82rem' }}
                    />
                    <button
                      className="btn-remove-stage"
                      onClick={() => handleRemoveStepFromModelo(idx)}
                      title="Excluir Etapa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Step */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Nova etapa do checklist..."
                  value={newStepText}
                  onChange={(e) => setNewStepText(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcdcdc', fontSize: '0.85rem' }}
                />
                <button className="btn-add-user" onClick={handleAddStepToModelo} style={{ borderRadius: '6px', padding: '0 16px' }}>
                  <Plus size={16} /> Adicionar Etapa
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="tab-pane" style={{ marginTop: '20px' }}>
          <div className="table-responsive">
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <button className="btn-save-settings" onClick={handleApplyPattern} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Aplicar Padrões por Tipo (Regime)
              </button>
            </div>
            <table className="config-table">

              <thead>
                <tr>
                  <th>Empresa Cliente</th>
                  <th>Regime Tributário</th>
                  {modelos.map((m) => (
                    <th key={m.id} style={{ textAlign: 'center', fontSize: '0.75rem' }}>{m.nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>
                      <strong>{cliente.nome}</strong>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>CNPJ: {cliente.cnpj}</div>
                    </td>
                    <td>
                      <span className={`partner-badge ${cliente.regime === 'Simples Nacional' ? 'mei' : cliente.regime === 'Lucro Presumido' ? 'lucro-presumido' : 'lucro-real'}`}>
                        {cliente.regime}
                      </span>
                    </td>
                    {modelos.map((m) => {
                      const isChecked = cliente.modelosAtivos.includes(m.id);
                      return (
                        <td key={m.id} style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-block' }}>
                            <label className="checkbox-container" style={{ margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleToggleModelForCliente(cliente.id, m.id, e.target.checked)}
                              />
                              <span className="checkbox-checkmark"></span>
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    {showNewModelForm && (
      <div
        className="confirm-modal-backdrop"
        onClick={() => setShowNewModelForm(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      >
        <div
          className="animate-slide-up"
          onClick={(event) => event.stopPropagation()}
          style={{
            width: 'min(860px, 100%)',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--color-text-dark)' }}>
                Criar novo modelo de checklist
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '6px 0 0 0' }}>
                Cadastre um modelo personalizado e defina quais regimes podem utilizá-lo.
              </p>
            </div>
            <button
              type="button"
              className="btn-save-settings"
              onClick={() => setShowNewModelForm(false)}
              style={{ background: '#64748b', minWidth: 42, padding: '8px 10px' }}
              aria-label="Fechar modal"
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.85fr) minmax(280px, 1fr)', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Nome do modelo</label>
              <input
                type="text"
                value={newModel.nome}
                onChange={(event) => setNewModel((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Ex.: Admissão de Funcionário"
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#111827', background: '#fff' }}
                autoFocus
              />
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Descrição</label>
              <textarea
                value={newModel.descricao}
                onChange={(event) => setNewModel((current) => ({ ...current, descricao: event.target.value }))}
                placeholder="Resumo do objetivo do checklist"
                rows={4}
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#111827', background: '#fff', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Etapas do checklist</label>
              <p style={{ margin: '-4px 0 0 0', color: '#64748b', fontSize: '0.75rem', lineHeight: 1.35 }}>
                Digite uma etapa por linha. Cada linha será criada como um item separado do checklist.
              </p>
              <textarea
                value={newModel.etapas}
                onChange={(event) => setNewModel((current) => ({ ...current, etapas: event.target.value }))}
                placeholder={'Exemplo:\nConferir documentos\nGerar guia\nEnviar protocolo ao cliente'}
                rows={9}
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', color: '#111827', background: '#fff', resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '14px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
            <strong style={{ fontSize: '0.8rem', color: '#0f172a', display: 'block', marginBottom: '10px' }}>Tipos / Regimes Aplicáveis</strong>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {REGIMES_APLICAVEIS.map((tipo) => (
                <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={newModel.tipos.includes(tipo)}
                    onChange={(event) => toggleNewModelTipo(tipo, event.target.checked)}
                    style={{ width: '14px', height: '14px', accentColor: 'var(--color-gold-primary)' }}
                  />
                  {tipo}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn-save-settings" onClick={() => setShowNewModelForm(false)} style={{ background: '#64748b' }}>
              Cancelar
            </button>
            <button type="button" className="btn-add-user" onClick={handleCreateModelo} style={{ borderRadius: '6px', padding: '0 16px' }}>
              <Plus size={16} /> Criar Modelo
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

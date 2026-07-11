import React, { useState } from 'react';
import { Plus, Percent, CreditCard, Edit, Trash2, CheckCircle2 } from 'lucide-react';
import { useRegras } from '../hooks/useRegras';
import { FormCard } from '../../gestao-empresarial/forms/FormCard';
import { AddRegraImpostoForm } from './forms/AddRegraImpostoForm';
import { EditRegraImpostoForm } from './forms/EditRegraImpostoForm';
import { AddRegraCnabForm } from './forms/AddRegraCnabForm';
import { EditRegraCnabForm } from './forms/EditRegraCnabForm';
import type { RegraImposto, RegraCnab } from '../services/parametrizacaoService';

export const RegrasApuracaoPage: React.FC = () => {
  const {
    activeSubTab,
    setActiveSubTab,
    regrasImposto,
    regrasCnab,
    cnaes,
    isLoading,
    isSaving,
    successMsg,
    showModalImposto,
    setShowModalImposto,
    showModalCnab,
    setShowModalCnab,
    editingRegraImposto,
    setEditingRegraImposto,
    editingRegraCnab,
    setEditingRegraCnab,
    handleSaveRegraImposto,
    handleDeleteRegraImposto,
    handleSaveRegraCnab,
    handleDeleteRegraCnab,
  } = useRegras();

  const [regraImpostoToDelete, setRegraImpostoToDelete] = useState<RegraImposto | null>(null);
  const [regraCnabToDelete, setRegraCnabToDelete] = useState<RegraCnab | null>(null);

  const openAddImposto = () => {
    setEditingRegraImposto(null);
    setShowModalImposto(true);
  };

  const openEditImposto = (regra: RegraImposto) => {
    setEditingRegraImposto(regra);
    setShowModalImposto(true);
  };

  const openAddCnab = () => {
    setEditingRegraCnab(null);
    setShowModalCnab(true);
  };

  const openEditCnab = (regra: RegraCnab) => {
    setEditingRegraCnab(regra);
    setShowModalCnab(true);
  };

  return (
    <div className="submodule-content-card animate-fade-in">
      {/* Header */}
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Impostos</h2>
          <p>Parametrize regras de PIS/COFINS, alíquotas e parâmetros fiscais usados nas rotinas do escritório.</p>
        </div>
        <div className="tab-buttons-header">
          <button
            className={`btn-tab ${activeSubTab === 'impostos' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('impostos')}
          >
            <Percent size={16} /> Impostos (PIS/COFINS)
          </button>
          <button
            className={`btn-tab ${activeSubTab === 'cnab' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('cnab')}
          >
            <CreditCard size={16} /> Regras Financeiras
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="success-banner animate-fade-in" style={{ marginTop: '12px' }}>
          <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
          {successMsg}
        </div>
      )}

      {/* TABS CONTENT */}
      {activeSubTab === 'impostos' ? (
        <div className="tab-pane animate-fade-in" style={{ marginTop: '20px' }}>
          <div className="table-actions-row">
            <h3>Faturamento e Alíquotas</h3>
            <button className="btn-add-user" onClick={openAddImposto}>
              <Plus size={16} /> Nova Regra de Imposto
            </button>
          </div>

          {isLoading ? (
            <div className="sub-loading">Carregando regras...</div>
          ) : regrasImposto.length === 0 ? (
            <div className="empty-state-card">
              <p>Nenhuma regra de imposto cadastrada.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>Identificador / Nome</th>
                    <th>Regime</th>
                    <th>CNAE</th>
                    <th>CST PIS (Alíq)</th>
                    <th>CST COFINS (Alíq)</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {regrasImposto.map((regra) => (
                    <tr key={regra.id}>
                      <td><strong>{regra.nome}</strong></td>
                      <td>
                        <span className={`partner-badge ${regra.regime === 'Lucro Real' ? 'lucro-real' : 'lucro-presumido'}`}>
                          {regra.regime}
                        </span>
                      </td>
                      <td><code className="ip-code">{regra.cnaeCodigo}</code></td>
                      <td>
                        <span className="ip-code">{regra.cstPis}</span> 
                        <span style={{ marginLeft: '6px', fontWeight: 600 }}>{regra.aliquotaPis.toFixed(2)}%</span>
                      </td>
                      <td>
                        <span className="ip-code">{regra.cstCofins}</span>
                        <span style={{ marginLeft: '6px', fontWeight: 600 }}>{regra.aliquotaCofins.toFixed(2)}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openEditImposto(regra)}
                          className="btn-action-responsavel"
                          title="Editar Regra"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setRegraImpostoToDelete(regra)}
                          className="btn-action-responsavel"
                          style={{ color: '#ef4444' }}
                          title="Excluir Regra"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="tab-pane animate-fade-in" style={{ marginTop: '20px' }}>
          <div className="table-actions-row">
            <h3>Parâmetros CNAB e Integração Bancária</h3>
            <button className="btn-add-user" onClick={openAddCnab}>
              <Plus size={16} /> Nova Regra CNAB
            </button>
          </div>

          {isLoading ? (
            <div className="sub-loading">Carregando regras...</div>
          ) : regrasCnab.length === 0 ? (
            <div className="empty-state-card">
              <p>Nenhuma regra CNAB cadastrada.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>Nome da Regra</th>
                    <th>Banco</th>
                    <th>Tipo</th>
                    <th>Configurações / Mapeamento</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {regrasCnab.map((regra) => (
                    <tr key={regra.id}>
                      <td><strong>{regra.nome}</strong></td>
                      <td><span className="ip-code">{regra.banco}</span></td>
                      <td>
                        <span className={`table-badge ${regra.tipoRegra === 'cobranca' ? 'badge-orange' : 'badge-green'}`}>
                          {regra.tipoRegra === 'cobranca' ? 'Cobrança/Boleto' : 'Conciliação Extrato'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {regra.tipoRegra === 'cobranca' ? (
                          <span>Multa: <strong>{regra.multa}%</strong> | Juros: <strong>{regra.juros}% ao mês</strong> (Tolerância: {regra.diasTolerancia} dias)</span>
                        ) : (
                          <span>Se texto contém <code>"{regra.padraoTexto}"</code> &rarr; Lançar em <strong>{regra.contaContabil}</strong></span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openEditCnab(regra)}
                          className="btn-action-responsavel"
                          title="Editar Regra"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => setRegraCnabToDelete(regra)}
                          className="btn-action-responsavel"
                          style={{ color: '#ef4444' }}
                          title="Excluir Regra"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAIS IMPOSTOS */}
      {showModalImposto && (
        <FormCard
          title={editingRegraImposto ? 'Editar Regra de Imposto' : 'Nova Regra de Imposto PIS/COFINS'}
          onClose={() => setShowModalImposto(false)}
        >
          {editingRegraImposto ? (
            <EditRegraImpostoForm
              regra={editingRegraImposto}
              cnaes={cnaes}
              onSave={handleSaveRegraImposto}
              onCancel={() => setShowModalImposto(false)}
              isSaving={isSaving}
            />
          ) : (
            <AddRegraImpostoForm
              cnaes={cnaes}
              onSave={handleSaveRegraImposto}
              onCancel={() => setShowModalImposto(false)}
              isSaving={isSaving}
            />
          )}
        </FormCard>
      )}

      {/* MODAIS CNAB */}
      {showModalCnab && (
        <FormCard
          title={editingRegraCnab ? 'Editar Regra CNAB' : 'Nova Regra CNAB / Conciliação'}
          onClose={() => setShowModalCnab(false)}
        >
          {editingRegraCnab ? (
            <EditRegraCnabForm
              regra={editingRegraCnab}
              onSave={handleSaveRegraCnab}
              onCancel={() => setShowModalCnab(false)}
              isSaving={isSaving}
            />
          ) : (
            <AddRegraCnabForm
              onSave={handleSaveRegraCnab}
              onCancel={() => setShowModalCnab(false)}
              isSaving={isSaving}
            />
          )}
        </FormCard>
      )}

      {/* CONFIRMAÇÃO EXCLUSÃO IMPOSTO */}
      {regraImpostoToDelete && (
        <div className="modal-backdrop" onClick={() => setRegraImpostoToDelete(null)}>
          <div className="modal-container confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal-title" style={{ color: '#ef4444' }}>Excluir Regra de Imposto</h3>
            <p className="confirm-modal-message">
              Tem certeza que deseja remover permanentemente a regra de imposto <strong>{regraImpostoToDelete.nome}</strong>?
            </p>
            <div className="confirm-modal-buttons popup-form-buttons">
              <button className="btn-cancel" onClick={() => setRegraImpostoToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn-invite"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: 'none' }}
                onClick={() => {
                  handleDeleteRegraImposto(regraImpostoToDelete.id);
                  setRegraImpostoToDelete(null);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO EXCLUSÃO CNAB */}
      {regraCnabToDelete && (
        <div className="modal-backdrop" onClick={() => setRegraCnabToDelete(null)}>
          <div className="modal-container confirm-modal-container" onClick={(e) => e.stopPropagation()}>
            <h3 className="confirm-modal-title" style={{ color: '#ef4444' }}>Excluir Regra CNAB</h3>
            <p className="confirm-modal-message">
              Tem certeza que deseja remover permanentemente a regra CNAB <strong>{regraCnabToDelete.nome}</strong>?
            </p>
            <div className="confirm-modal-buttons popup-form-buttons">
              <button className="btn-cancel" onClick={() => setRegraCnabToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn-invite"
                style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: 'none' }}
                onClick={() => {
                  handleDeleteRegraCnab(regraCnabToDelete.id);
                  setRegraCnabToDelete(null);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Edit, Landmark, Plus, Trash2 } from 'lucide-react';
import { useContasBancarias } from './hooks/useContasBancarias';
import type { ContaBancaria } from './services/contasBancariasService';
import './ContasBancariasConfig.css';

export const ContasBancariasConfig: React.FC = () => {
  const {
    contas,
    resumoContas,
    isLoadingContas,
    isSavingConta,
    successMsgConta,
    errorMsgConta,
    editingConta,
    setEditingConta,
    showModalConta,
    setShowModalConta,
    handleContaSave,
    handleContaDelete,
  } = useContasBancarias();

  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [numeroConta, setNumeroConta] = useState('');
  const [tipoConta, setTipoConta] = useState<'corrente' | 'poupança'>('corrente');
  const [saldoInicial, setSaldoInicial] = useState('0.00');
  const [accountToDelete, setAccountToDelete] = useState<ContaBancaria | null>(null);

  const openAddModal = () => {
    setBanco('');
    setAgencia('');
    setNumeroConta('');
    setTipoConta('corrente');
    setSaldoInicial('0.00');
    setEditingConta(null);
    setShowModalConta(true);
  };

  const openEditModal = (conta: ContaBancaria) => {
    setEditingConta(conta);
    setBanco(conta.banco);
    setAgencia(conta.agencia);
    setNumeroConta(conta.numeroConta);
    setTipoConta(conta.tipoConta);
    setSaldoInicial(conta.saldoInicial.toFixed(2));
    setShowModalConta(true);
  };

  const onSubmitConta = (event: React.FormEvent) => {
    event.preventDefault();
    if (!banco || !agencia || !numeroConta) return;
    handleContaSave({
      id: editingConta?.id || '',
      banco,
      agencia,
      numeroConta,
      tipoConta,
      saldoInicial: parseFloat(saldoInicial) || 0,
    });
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Contas Bancárias</h2>
          <p>Cadastre contas do escritório, saldos iniciais e saldos disponíveis para controle financeiro.</p>
        </div>
        <button className="btn-add-user" onClick={openAddModal}>
          <Plus size={16} /> Adicionar Conta
        </button>
      </div>

      {successMsgConta && (
        <div className="success-banner animate-fade-in">
          <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
          {successMsgConta}
        </div>
      )}

      <div className="bancaria-summary-grid">
        <div className="bancaria-summary-card gold-border">
          <span className="summary-label">Saldo Inicial Acumulado</span>
          <span className="summary-value gold-text">{formatCurrency(resumoContas.saldoInicial)}</span>
        </div>
        <div className="bancaria-summary-card">
          <span className="summary-label">Saldo Atual Disponível</span>
          <span className="summary-value">{formatCurrency(resumoContas.saldoAtual)}</span>
        </div>
        <div className="bancaria-summary-card">
          <span className="summary-label">Total de Contas</span>
          <span className="summary-value">{resumoContas.totalContas}</span>
        </div>
      </div>

      <div className="table-actions-row">
        <h3>Contas Cadastradas</h3>
      </div>

      {isLoadingContas ? (
        <div className="sub-loading">Carregando contas bancárias...</div>
      ) : contas.length === 0 ? (
        <div className="empty-state-card">
          <Landmark size={32} className="empty-state-icon" />
          <p>Nenhuma conta bancária cadastrada.</p>
          <button className="btn-save-settings" onClick={openAddModal} style={{ marginTop: '12px' }}>
            Criar Primeira Conta
          </button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th>Banco</th>
                <th>Agência</th>
                <th>Conta</th>
                <th>Tipo</th>
                <th>Saldo Inicial</th>
                <th>Saldo Atual</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id}>
                  <td><strong>{conta.banco}</strong></td>
                  <td>{conta.agencia}</td>
                  <td>{conta.numeroConta}</td>
                  <td>
                    <span className={`table-badge ${conta.tipoConta === 'corrente' ? 'badge-green' : 'badge-orange'}`}>
                      {conta.tipoConta}
                    </span>
                  </td>
                  <td>{formatCurrency(conta.saldoInicial)}</td>
                  <td className="gold-text fw-bold">{formatCurrency(conta.saldoAtual)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => openEditModal(conta)} className="btn-action-responsavel" title="Editar Conta">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => setAccountToDelete(conta)} className="btn-action-responsavel danger-icon-button" title="Remover Conta">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModalConta && (
        <div className="modal-backdrop" onClick={() => setShowModalConta(false)}>
          <div className="modal-container" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>{editingConta ? 'Editar Conta Bancária' : 'Adicionar Conta Bancária'}</h3>
            {errorMsgConta && (
              <div className="error-banner">
                <AlertCircle size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
                {errorMsgConta}
              </div>
            )}
            <form onSubmit={onSubmitConta} className="config-form popup-form">
              <div className="form-item-group">
                <label>Instituição Financeira (Banco) *</label>
                <input type="text" required placeholder="Ex: Itaú, Banco do Brasil, Asaas" value={banco} onChange={(event) => setBanco(event.target.value)} disabled={isSavingConta} />
              </div>
              <div className="form-row-grid">
                <div className="form-item-group">
                  <label>Agência *</label>
                  <input type="text" required placeholder="Ex: 0001 / 1234-5" value={agencia} onChange={(event) => setAgencia(event.target.value)} disabled={isSavingConta} />
                </div>
                <div className="form-item-group">
                  <label>Conta Corrente *</label>
                  <input type="text" required placeholder="Ex: 12345-6" value={numeroConta} onChange={(event) => setNumeroConta(event.target.value)} disabled={isSavingConta} />
                </div>
              </div>
              <div className="form-row-grid">
                <div className="form-item-group">
                  <label>Tipo de Conta</label>
                  <select value={tipoConta} onChange={(event) => setTipoConta(event.target.value as 'corrente' | 'poupança')} disabled={isSavingConta}>
                    <option value="corrente">Corrente</option>
                    <option value="poupança">Poupança</option>
                  </select>
                </div>
                <div className="form-item-group">
                  <label>Saldo Inicial (R$)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={saldoInicial} onChange={(event) => setSaldoInicial(event.target.value)} disabled={isSavingConta} />
                </div>
              </div>
              <div className="popup-form-buttons">
                <button type="button" className="btn-cancel" onClick={() => setShowModalConta(false)}>Cancelar</button>
                <button type="submit" className="btn-invite" disabled={isSavingConta}>{isSavingConta ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accountToDelete && (
        <div className="modal-backdrop" onClick={() => setAccountToDelete(null)}>
          <div className="modal-container confirm-modal-container" onClick={(event) => event.stopPropagation()}>
            <h3 className="confirm-modal-title danger-text">Excluir Conta Bancária</h3>
            <p className="confirm-modal-message">
              Tem certeza que deseja remover a conta do <strong>{accountToDelete.banco}</strong> ({accountToDelete.numeroConta})?
              Esta ação removerá o saldo correspondente.
            </p>
            <div className="confirm-modal-buttons popup-form-buttons">
              <button className="btn-cancel" onClick={() => setAccountToDelete(null)}>Cancelar</button>
              <button className="btn-invite danger-confirm-button" onClick={() => {
                handleContaDelete(accountToDelete.id);
                setAccountToDelete(null);
              }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

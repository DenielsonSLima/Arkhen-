import React, { useMemo, useState } from 'react';
import { Edit3, FileText, Plus, Search, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import type { TipoDocumento } from './tiposDocumentosService';
import {
  useSaveTipoDocumentoMutation,
  useTiposDocumentosQuery,
  useToggleTipoDocumentoMutation,
} from './useTiposDocumentosQueries';
import '../ParametrizacaoPlaceholder.css';

const emptyForm = {
  nome: '',
  descricao: '',
  ativo: true,
};

export const TiposDocumentosPage: React.FC = () => {
  const tiposQuery = useTiposDocumentosQuery();
  const saveTipo = useSaveTipoDocumentoMutation();
  const toggleTipo = useToggleTipoDocumentoMutation();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<TipoDocumento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const items = useMemo(() => tiposQuery.data || [], [tiposQuery.data]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => (
      !term ||
      item.nome.toLowerCase().includes(term) ||
      item.descricao.toLowerCase().includes(term)
    ));
  }, [items, searchTerm]);

  const totals = useMemo(() => ({
    total: items.length,
    ativos: items.filter((item) => item.ativo).length,
    sistema: items.filter((item) => item.sistema).length,
  }), [items]);

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setErrorMsg('');
    setShowModal(true);
  };

  const openEdit = (item: TipoDocumento) => {
    setEditingItem(item);
    setForm({
      nome: item.nome,
      descricao: item.descricao,
      ativo: item.ativo,
    });
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');

    try {
      await saveTipo.mutateAsync({
        id: editingItem?.id,
        nome: form.nome,
        descricao: form.descricao,
        ativo: form.ativo,
      });
      setShowModal(false);
      setSuccessMsg(editingItem ? 'Tipo de documento atualizado.' : 'Tipo de documento criado.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar tipo de documento.');
    }
  };

  const handleToggle = async (item: TipoDocumento) => {
    setErrorMsg('');
    try {
      await toggleTipo.mutateAsync({ id: item.id, ativo: !item.ativo });
      setSuccessMsg(item.ativo ? 'Tipo de documento inativado.' : 'Tipo de documento ativado.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar status.');
    }
  };

  return (
    <div className="parametrizacao-page animate-fade-in">
      <div className="submodule-content-card">
        <div className="submodule-card-header flex-header parametrizacao-docs-header">
          <div className="parametrizacao-title">
            <span className="parametrizacao-title-icon"><FileText size={22} /></span>
            <div>
              <h2>Tipos de Documentos</h2>
              <p>Padronize os tipos usados nos anexos, contratos, procurações e documentos por empresa.</p>
            </div>
          </div>
          <button type="button" className="btn-add-user" onClick={openAdd}>
            <Plus size={16} /> Novo Tipo
          </button>
        </div>

        {(successMsg || errorMsg || tiposQuery.error) && (
          <div className={errorMsg || tiposQuery.error ? 'form-alert-banner error' : 'success-banner'} style={{ marginTop: 12 }}>
            {errorMsg || (tiposQuery.error ? 'Erro ao carregar tipos de documentos no Supabase.' : successMsg)}
          </div>
        )}

        <div className="parametrizacao-docs-summary">
          <article>
            <span>Total</span>
            <strong>{totals.total}</strong>
          </article>
          <article>
            <span>Ativos</span>
            <strong>{totals.ativos}</strong>
          </article>
          <article>
            <span>Padrões do sistema</span>
            <strong>{totals.sistema}</strong>
          </article>
        </div>

        <div className="parametrizacao-docs-note">
          <ShieldCheck size={17} />
          <span>Contrato, CNH, Financiamento e Procuração são padrões para todas as empresas. Eles não devem ser excluídos; use inativar quando não forem necessários.</span>
        </div>

        <div className="parametrizacao-toolbar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th style={{ width: '240px' }}>Nome</th>
                <th>Descrição</th>
                <th style={{ width: '120px' }}>Origem</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tiposQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="parametrizacao-empty-row">Carregando tipos de documentos...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="parametrizacao-empty-row">Nenhum tipo encontrado.</td>
                </tr>
              ) : filteredItems.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.nome}</strong></td>
                  <td style={{ color: '#475569' }}>{item.descricao}</td>
                  <td>
                    <span className={item.sistema ? 'parametrizacao-origin system' : 'parametrizacao-origin custom'}>
                      {item.sistema ? 'Sistema' : 'Personalizado'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge-clear ${item.ativo ? 'active' : 'inactive'}`}>
                      <span className="status-dot" />
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="parametrizacao-actions">
                      <button
                        type="button"
                        className="btn-action-small"
                        onClick={() => handleToggle(item)}
                        title={item.ativo ? 'Inativar tipo' : 'Ativar tipo'}
                      >
                        {item.ativo ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                      </button>
                      <button
                        type="button"
                        className="btn-action-small"
                        onClick={() => openEdit(item)}
                        title="Editar tipo"
                      >
                        <Edit3 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay-custom parametrizacao-modal-overlay">
          <form className="cliente-form-container parametrizacao-docs-modal" onSubmit={handleSave}>
            <div className="cliente-form-header">
              <h2>{editingItem ? 'Editar Tipo de Documento' : 'Novo Tipo de Documento'}</h2>
              <p>{editingItem?.sistema ? 'Este tipo é padrão do sistema e pode ser inativado quando necessário.' : 'Cadastre uma classificação documental personalizada.'}</p>
            </div>

            {errorMsg && <div className="form-alert-banner error"><span>{errorMsg}</span></div>}

            <div className="parametrizacao-form-stack">
              <label>
                <span>Nome *</span>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                  placeholder="Ex: Contrato de prestação"
                />
              </label>
              <label>
                <span>Descrição</span>
                <textarea
                  value={form.descricao}
                  onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                  placeholder="Explique onde este tipo de documento será usado..."
                  rows={3}
                />
              </label>
              <label className="parametrizacao-check-line">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
                />
                <span>Tipo ativo</span>
              </label>
            </div>

            <div className="form-footer-actions parametrizacao-modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-submit" disabled={saveTipo.isPending}>
                {saveTipo.isPending ? 'Salvando...' : 'Salvar Tipo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

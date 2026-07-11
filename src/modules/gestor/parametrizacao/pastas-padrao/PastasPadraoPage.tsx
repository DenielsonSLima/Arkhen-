import React, { useMemo, useState } from 'react';
import { Edit3, FolderTree, Plus, Search, ShieldCheck, ToggleLeft, ToggleRight, Wand2 } from 'lucide-react';
import type { PastaPadraoDocumento } from './services/pastasPadraoService';
import {
  useApplyPastasPadraoMutation,
  usePastasPadraoQuery,
  useSavePastaPadraoMutation,
  useTogglePastaPadraoMutation,
} from './services/usePastasPadraoQueries';
import '../catalogos/ParametrizacaoPlaceholder.css';

const emptyForm = {
  caminho: '',
  descricao: '',
  ativo: true,
};

export const PastasPadraoPage: React.FC = () => {
  const pastasQuery = usePastasPadraoQuery();
  const savePasta = useSavePastaPadraoMutation();
  const togglePasta = useTogglePastaPadraoMutation();
  const applyPastas = useApplyPastasPadraoMutation();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState<PastaPadraoDocumento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const items = useMemo(() => pastasQuery.data || [], [pastasQuery.data]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => (
      !term ||
      item.caminho.toLowerCase().includes(term) ||
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

  const openEdit = (item: PastaPadraoDocumento) => {
    setEditingItem(item);
    setForm({
      caminho: item.caminho,
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
      await savePasta.mutateAsync({
        id: editingItem?.id,
        caminho: form.caminho,
        descricao: form.descricao,
        ativo: form.ativo,
      });
      setShowModal(false);
      setSuccessMsg(editingItem ? 'Pasta padrão atualizada.' : 'Pasta padrão criada.');
      window.setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar pasta padrão.');
    }
  };

  const handleToggle = async (item: PastaPadraoDocumento) => {
    setErrorMsg('');
    try {
      await togglePasta.mutateAsync({ id: item.id, ativo: !item.ativo });
      setSuccessMsg(item.ativo ? 'Pasta padrão inativada.' : 'Pasta padrão ativada.');
      window.setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar status.');
    }
  };

  const handleApplyToAll = async () => {
    setErrorMsg('');
    try {
      const count = await applyPastas.mutateAsync();
      setSuccessMsg(`${count} cliente${count === 1 ? '' : 's'} atualizado${count === 1 ? '' : 's'} com as pastas ativas.`);
      window.setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aplicar pastas nas empresas.');
    }
  };

  return (
    <div className="parametrizacao-page animate-fade-in">
      <div className="submodule-content-card">
        <div className="submodule-card-header flex-header parametrizacao-docs-header">
          <div className="parametrizacao-title">
            <span className="parametrizacao-title-icon"><FolderTree size={22} /></span>
            <div>
              <h2>Pastas Padrão de Documentos</h2>
              <p>Defina a estrutura criada automaticamente na aba Documentos de cada empresa cliente.</p>
            </div>
          </div>
          <div className="parametrizacao-header-actions">
            <button type="button" className="btn-table-action" onClick={handleApplyToAll} disabled={applyPastas.isPending}>
              <Wand2 size={15} /> {applyPastas.isPending ? 'Aplicando...' : 'Aplicar em clientes'}
            </button>
            <button type="button" className="btn-add-user" onClick={openAdd}>
              <Plus size={16} /> Nova Pasta
            </button>
          </div>
        </div>

        {(successMsg || errorMsg || pastasQuery.error) && (
          <div className={errorMsg || pastasQuery.error ? 'form-alert-banner error' : 'success-banner'} style={{ marginTop: 12 }}>
            {errorMsg || (pastasQuery.error ? 'Erro ao carregar pastas padrão no Supabase.' : successMsg)}
          </div>
        )}

        <div className="parametrizacao-docs-summary">
          <article>
            <span>Total</span>
            <strong>{totals.total}</strong>
          </article>
          <article>
            <span>Ativas</span>
            <strong>{totals.ativos}</strong>
          </article>
          <article>
            <span>Padrões do sistema</span>
            <strong>{totals.sistema}</strong>
          </article>
        </div>

        <div className="parametrizacao-docs-note">
          <ShieldCheck size={17} />
          <span>As pastas ativas entram automaticamente no cadastro de novos clientes. Para clientes já cadastrados, use aplicar em clientes; para remover um padrão, inative em vez de excluir.</span>
        </div>

        <div className="parametrizacao-toolbar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por pasta ou descrição..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th style={{ width: '280px' }}>Caminho da Pasta</th>
                <th>Descrição</th>
                <th style={{ width: '120px' }}>Origem</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pastasQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="parametrizacao-empty-row">Carregando pastas padrão...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="parametrizacao-empty-row">Nenhuma pasta encontrada.</td>
                </tr>
              ) : filteredItems.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.caminho}</strong></td>
                  <td style={{ color: '#475569' }}>{item.descricao}</td>
                  <td>
                    <span className={item.sistema ? 'parametrizacao-origin system' : 'parametrizacao-origin custom'}>
                      {item.sistema ? 'Sistema' : 'Personalizado'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge-clear ${item.ativo ? 'active' : 'inactive'}`}>
                      <span className="status-dot" />
                      {item.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="parametrizacao-actions">
                      <button
                        type="button"
                        className="btn-action-small"
                        onClick={() => handleToggle(item)}
                        title={item.ativo ? 'Inativar pasta' : 'Ativar pasta'}
                      >
                        {item.ativo ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                      </button>
                      <button
                        type="button"
                        className="btn-action-small"
                        onClick={() => openEdit(item)}
                        title="Editar pasta"
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
              <h2>{editingItem ? 'Editar Pasta Padrão' : 'Nova Pasta Padrão'}</h2>
              <p>Use barra para criar subpastas, como Fiscal/Guias e Comprovantes.</p>
            </div>

            {errorMsg && <div className="form-alert-banner error"><span>{errorMsg}</span></div>}

            <div className="parametrizacao-form-stack">
              <label>
                <span>Caminho da pasta *</span>
                <input
                  type="text"
                  value={form.caminho}
                  onChange={(event) => setForm((current) => ({ ...current, caminho: event.target.value }))}
                  placeholder="Ex: Societario/Documentos dos Socios"
                />
              </label>
              <label>
                <span>Descrição</span>
                <textarea
                  value={form.descricao}
                  onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
                  placeholder="Explique quando esta pasta deve ser usada..."
                  rows={3}
                />
              </label>
              <label className="parametrizacao-check-line">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
                />
                <span>Pasta ativa para novos clientes</span>
              </label>
            </div>

            <div className="form-footer-actions parametrizacao-modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn-submit" disabled={savePasta.isPending}>
                {savePasta.isPending ? 'Salvando...' : 'Salvar Pasta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  History,
  Inbox,
  MessageSquare,
  Plus,
  Send,
  X,
} from 'lucide-react';
import type { ProtocoloEntrega, ProtocoloUpdate } from '../services/protocolosService';
import './ProtocoloArquivosList.css';

type AbaProtocolo = 'recebidos' | 'enviados' | 'pendencias' | 'historico';

interface ProtocoloArquivosListProps {
  items: ProtocoloEntrega[];
  formatDate: (value: string) => string;
  onUpdateProtocolo: (id: string, updates: ProtocoloUpdate) => Promise<ProtocoloEntrega | undefined>;
}

const MIN_EVIDENCIA_LENGTH = 8;
const MAX_EVIDENCIA_LENGTH = 2000;

const ABA_CONFIG: { key: AbaProtocolo; label: string; icon: React.ElementType }[] = [
  { key: 'pendencias', label: 'Pendências', icon: Clock },
  { key: 'recebidos', label: 'Documentos recebidos', icon: Inbox },
  { key: 'enviados', label: 'Documentos enviados', icon: Send },
  { key: 'historico', label: 'Histórico do mês', icon: History },
];

const getFlowMatch = (item: ProtocoloEntrega, aba: AbaProtocolo) => {
  if (aba === 'recebidos') return item.origemPadrao === 'Cliente envia' || item.origemPadrao === 'Ambos';
  if (aba === 'enviados') return item.origemPadrao === 'Escritório envia' || item.origemPadrao === 'Ambos';
  if (aba === 'pendencias') return item.status === 'Pendente';
  return true;
};

const getFlowLabel = (origem: ProtocoloEntrega['origemPadrao']) => {
  if (origem === 'Ambos') return 'Cliente e Escritório';
  if (origem === 'Escritório envia') return 'Enviado';
  return 'Recebido';
};

export const ProtocoloArquivosList: React.FC<ProtocoloArquivosListProps> = ({
  items,
  formatDate,
  onUpdateProtocolo,
}) => {
  const [activeTab, setActiveTab] = useState<AbaProtocolo>('pendencias');
  const [previewFile, setPreviewFile] = useState<ProtocoloEntrega | null>(null);
  const [novaAnotacao, setNovaAnotacao] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [operationError, setOperationError] = useState('');

  const hasGlobalItems = items.length > 0;

  const tabItems = useMemo(() => {
    return ABA_CONFIG.reduce<Record<AbaProtocolo, ProtocoloEntrega[]>>((acc, tab) => {
      acc[tab.key] = items.filter((item) => getFlowMatch(item, tab.key));
      return acc;
    }, {
      recebidos: [],
      enviados: [],
      pendencias: [],
      historico: [],
    });
  }, [items]);

  useEffect(() => {
    setPreviewFile((current) => {
      const currentFromQuery = current
        ? tabItems[activeTab].find((item) => item.id === current.id)
        : undefined;
      return currentFromQuery || tabItems[activeTab][0] || null;
    });
  }, [activeTab, tabItems]);

  const displayedItems = tabItems[activeTab] || [];

  const handleStatusToggle = async (item: ProtocoloEntrega) => {
    if (!item.podeAlterarStatus) {
      setOperationError('Seu perfil pode consultar este item, mas não pode concluir ou reabrir.');
      return;
    }

    const anotacao = novaAnotacao.trim();
    if (previewFile?.id !== item.id || anotacao.length < MIN_EVIDENCIA_LENGTH) {
      setPreviewFile(item);
      if (previewFile?.id !== item.id) setNovaAnotacao('');
      setOperationError('Descreva no painel a evidência da conclusão ou o motivo da reabertura.');
      return;
    }

    const newStatus = item.status === 'Concluído' ? 'Pendente' : 'Concluído';
    const updates: ProtocoloUpdate = { status: newStatus, anotacao };
    setUpdatingId(item.id);
    setOperationError('');
    try {
      const saved = await onUpdateProtocolo(item.id, updates);
      if (saved && previewFile?.id === item.id) setPreviewFile(saved);
      setNovaAnotacao('');
    } catch (error) {
      console.error('Falha ao atualizar item de acompanhamento.', error);
      setOperationError(error instanceof Error ? error.message : 'Não foi possível atualizar o item.');
    } finally {
      setUpdatingId('');
    }
  };

  const handleAddAnotacao = async () => {
    const anotacao = novaAnotacao.trim();
    if (!previewFile || anotacao.length < MIN_EVIDENCIA_LENGTH) return;
    if (!previewFile.podeAnotar) {
      setOperationError('Seu perfil não pode adicionar anotações neste item.');
      return;
    }

    setUpdatingId(previewFile.id);
    setOperationError('');
    try {
      const saved = await onUpdateProtocolo(previewFile.id, { anotacao });
      if (saved) setPreviewFile(saved);
      setNovaAnotacao('');
    } catch (error) {
      console.error('Falha ao adicionar anotação ao item de acompanhamento.', error);
      setOperationError(error instanceof Error ? error.message : 'Não foi possível salvar a anotação.');
    } finally {
      setUpdatingId('');
    }
  };

  const getShortDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return formatDate(dateStr.split('T')[0]);
  };

  const getShortTime = (dateStr?: string) => {
    if (!dateStr || !dateStr.includes('T')) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  };

  return (
    <div className="protocolo-files-workspace">
      {operationError ? (
        <div className="protocolo-operation-error" role="alert">
          <span>{operationError}</span>
          <button type="button" onClick={() => setOperationError('')} aria-label="Fechar mensagem"><X size={14} /></button>
        </div>
      ) : null}
      <div className={`protocolo-files-layout ${hasGlobalItems ? 'has-preview' : ''}`}>
        <div className="protocolo-files-browser">
          <div className="protocolo-files-table-shell">
            <div className="protocolo-flow-tabs" role="tablist" aria-label="Fluxo de acompanhamento">
              {ABA_CONFIG.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  className={`protocolo-flow-tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                  <strong>{tabItems[key].length}</strong>
                </button>
              ))}
            </div>

            <section className="protocolo-file-category">
              <div className="protocolo-file-category-title">
                <strong>{ABA_CONFIG.find((item) => item.key === activeTab)?.label || 'Acompanhamento'}</strong>
                <span>{displayedItems.length} de {items.length}</span>
              </div>

              <div className="protocolo-file-table-head">
                <span />
                <span>Entrega</span>
                <span>Origem</span>
                <span>Prazo</span>
                <span>Recebido em</span>
                <span>Concluído por</span>
                <span>Status</span>
                <span>Categoria</span>
                <span>Ações</span>
              </div>

              <div className="protocolo-files-list">
                {displayedItems.length === 0 ? (
                  <div className="protocolo-empty-state">
                    <p>Nenhum item encontrado nesta aba.</p>
                  </div>
                ) : (
                  displayedItems.map((item) => {
                    const statusClasses = item.status === 'Concluído' ? 'available' : 'waiting';
                    const ActionIcon = item.status === 'Concluído' ? X : CheckCircle2;
                      return (
	                      <article
	                        key={item.id}
	                        className={`protocolo-file-row ${previewFile?.id === item.id ? 'active' : ''}`}
	                        role="button"
	                        tabIndex={0}
	                        aria-label={`Ver detalhes de ${item.entregaNome}`}
	                        onClick={() => {
	                          setPreviewFile(item);
	                          setNovaAnotacao('');
	                        }}
	                        onKeyDown={(event) => {
	                          if (event.key === 'Enter' || event.key === ' ') {
	                            event.preventDefault();
	                            setPreviewFile(item);
	                            setNovaAnotacao('');
	                          }
	                        }}
	                      >
                        <div className="protocolo-file-icon">
                          {item.status === 'Concluído' ? <CheckCircle2 size={16} color="#10b981" /> : <Clock size={16} color="#f59e0b" />}
                        </div>
                        <div className="protocolo-file-meta">
                          <strong>{item.entregaNome}</strong>
                          {item.periodoReferencia !== 'Mensal' ? (
                            <span>{item.periodoReferencia}</span>
                          ) : null}
                        </div>
                        <span className="protocolo-file-cell">{getFlowLabel(item.origemPadrao)}</span>
                        <span className="protocolo-date-cell">
                          <small>{getShortDate(item.prazo)}</small>
                        </span>
                        <span className="protocolo-date-cell">
                          <small>{getShortDate(item.recebidoEm)}</small>
                          {getShortTime(item.recebidoEm) ? <em>{getShortTime(item.recebidoEm)}</em> : null}
                        </span>
                        <span className="protocolo-file-cell protocolo-completed-by">
                          {item.status === 'Concluído'
                            ? item.concluidoPor || (item.auditoriaPendente ? 'Auditoria pendente' : 'Sem autoria')
                            : '-'}
                        </span>
                        <span className="protocolo-date-cell">
                          <span className={`protocolo-file-status ${statusClasses}`}>
                            {item.status}
                          </span>
                        </span>
                        <span className="protocolo-file-cell">{item.categoria}</span>
                        <div className="protocolo-file-actions">
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            title="Anotações"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPreviewFile(item);
                              setNovaAnotacao('');
                            }}
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            type="button"
                            className={item.status === 'Concluído' ? 'danger' : 'approve'}
                            disabled={updatingId === item.id || !item.podeAlterarStatus}
                            title={!item.podeAlterarStatus
                              ? 'Seu perfil não pode alterar o status'
                              : item.status === 'Concluído' ? 'Reabrir item' : 'Concluir item'}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStatusToggle(item);
                            }}
                          >
                            <ActionIcon size={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="protocolo-file-preview">
          {!hasGlobalItems ? (
            <div className="protocolo-preview-empty">
              <MessageSquare size={20} color="#94a3b8" />
              <span>Nenhum item em acompanhamento.</span>
            </div>
          ) : !previewFile ? (
            <div className="protocolo-preview-empty">
              <MessageSquare size={20} color="#94a3b8" />
              <span>Selecione um item para visualizar o detalhe.</span>
            </div>
          ) : (
            <>
              <div className="protocolo-preview-top">
                <MessageSquare size={20} color="#64748b" />
                <div>
                  <strong>{previewFile.entregaNome}</strong>
                  <small>
                    Prazo {getShortDate(previewFile.prazo)} • {getFlowLabel(previewFile.origemPadrao)}
                  </small>
                </div>
              </div>

              <dl>
                <div><dt>Status</dt><dd>{previewFile.status}</dd></div>
                {previewFile.auditoriaPendente ? (
                  <div><dt>Auditoria</dt><dd>Revisão pendente</dd></div>
                ) : null}
                <div>
                  <dt>Recebido em</dt>
                  <dd>
                    {getShortDate(previewFile.recebidoEm)}
                    {getShortTime(previewFile.recebidoEm) ? <small>{getShortTime(previewFile.recebidoEm)}</small> : null}
                  </dd>
                </div>
                <div><dt>Concluído por</dt><dd>{previewFile.status === 'Concluído' ? previewFile.concluidoPor || 'Sem autoria disponível' : '-'}</dd></div>
                <div><dt>Concluído em</dt><dd>{getShortDate(previewFile.concluidoEm)}</dd></div>
                <div><dt>Evidência atual</dt><dd>{previewFile.evidencia || 'Sem evidência registrada'}</dd></div>
                <div><dt>Total Anotações</dt><dd>{previewFile.anotacoesList?.length || 0}</dd></div>
              </dl>

              <div className="protocolo-review-panel">
                <div className="protocolo-review-actions">
                  <button
                    type="button"
                    className={previewFile.status === 'Concluído' ? 'reject' : 'approve'}
                    disabled={!previewFile.podeAlterarStatus
                      || updatingId === previewFile.id
                      || novaAnotacao.trim().length < MIN_EVIDENCIA_LENGTH}
                    onClick={() => handleStatusToggle(previewFile)}
                  >
                    {previewFile.status === 'Concluído' ? <X size={15} /> : <CheckCircle2 size={15} />}
                    {previewFile.status === 'Concluído' ? 'Reabrir' : 'Concluir'}
                  </button>
                </div>

                <div className="anotacoes-list">
                  <h4>Anotações</h4>
                  {previewFile.anotacoesList && previewFile.anotacoesList.length > 0 ? (
                    previewFile.anotacoesList.map((a) => (
                      <div key={a.id} className="anotacao-item">
                        <small>{new Date(a.data).toLocaleString('pt-BR')}</small>
                        {a.autor ? <small>{a.autor}</small> : null}
                        <p>{a.texto}</p>
                      </div>
                    ))
                  ) : (
                    <span className="no-anotacoes">Nenhuma anotação registrada.</span>
                  )}
                </div>

                <label>
                  <span>Evidência ou justificativa</span>
                  <textarea
                    value={novaAnotacao}
                    maxLength={MAX_EVIDENCIA_LENGTH}
                    disabled={!previewFile.podeAnotar && !previewFile.podeAlterarStatus}
                    placeholder="Descreva o que foi validado ou o motivo da reabertura (mínimo 8 caracteres)."
                    onChange={(event) => setNovaAnotacao(event.target.value)}
                  />
                </label>
                <button
                  className="add-anotacao-btn"
                  onClick={handleAddAnotacao}
                  disabled={!previewFile.podeAnotar
                    || novaAnotacao.trim().length < MIN_EVIDENCIA_LENGTH
                    || updatingId === previewFile.id}
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

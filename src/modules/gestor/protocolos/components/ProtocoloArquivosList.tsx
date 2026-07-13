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
  onUpdateProtocolo: (id: string, updates: ProtocoloUpdate) => void;
}

const ABA_CONFIG: { key: AbaProtocolo; label: string; icon: React.ElementType }[] = [
  { key: 'pendencias', label: 'Pendências', icon: Clock },
  { key: 'recebidos', label: 'Documentos recebidos', icon: Inbox },
  { key: 'enviados', label: 'Documentos enviados', icon: Send },
  { key: 'historico', label: 'Histórico', icon: History },
];

const getFlowMatch = (item: ProtocoloEntrega, aba: AbaProtocolo) => {
  if (aba === 'recebidos') return item.origemPadrao === 'Cliente envia' || item.origemPadrao === 'Ambos';
  if (aba === 'enviados') return item.origemPadrao === 'Escritório envia' || item.origemPadrao === 'Ambos';
  if (aba === 'pendencias') return item.status === 'Pendente';
  return item.status === 'Concluído';
};

const getFlowLabel = (origem: ProtocoloEntrega['origemPadrao']) => {
  if (origem === 'Ambos') return 'Cliente e Escritório';
  if (origem === 'Escritório envia') return 'Enviado';
  return 'Recebido';
};

const getCurrentUserName = () => {
  try {
    const savedProfile = localStorage.getItem('gestor_user_profile');
    if (!savedProfile) return 'Administrador';
    const profile = JSON.parse(savedProfile) as { nome?: unknown };
    return typeof profile.nome === 'string' && profile.nome.trim() ? profile.nome.trim() : 'Administrador';
  } catch {
    return 'Administrador';
  }
};

export const ProtocoloArquivosList: React.FC<ProtocoloArquivosListProps> = ({
  items,
  formatDate,
  onUpdateProtocolo,
}) => {
  const [activeTab, setActiveTab] = useState<AbaProtocolo>('pendencias');
  const [previewFile, setPreviewFile] = useState<ProtocoloEntrega | null>(null);
  const [novaAnotacao, setNovaAnotacao] = useState('');

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
    if (!previewFile || !tabItems[activeTab].some((item) => item.id === previewFile.id)) {
      setPreviewFile(tabItems[activeTab][0] || null);
    }
  }, [activeTab, previewFile, tabItems]);

  const displayedItems = tabItems[activeTab] || [];

  const handleStatusToggle = (item: ProtocoloEntrega) => {
    const newStatus = item.status === 'Concluído' ? 'Pendente' : 'Concluído';
    const updates: ProtocoloUpdate = newStatus === 'Concluído'
      ? { status: newStatus, recebidoEm: item.recebidoEm || new Date().toISOString(), concluidoPor: item.concluidoPor || getCurrentUserName() }
      : { status: newStatus, recebidoEm: '', concluidoPor: '' };
    onUpdateProtocolo(item.id, updates);
    if (previewFile?.id === item.id) {
      setPreviewFile({ ...previewFile, ...updates });
    }
  };

  const handleAddAnotacao = () => {
    if (!previewFile || !novaAnotacao.trim()) return;

    const newAnotacao = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      texto: novaAnotacao.trim(),
    };

    const updatedAnotacoes = [...(previewFile.anotacoesList || []), newAnotacao];

    onUpdateProtocolo(previewFile.id, { anotacoesList: updatedAnotacoes });
    setPreviewFile({ ...previewFile, anotacoesList: updatedAnotacoes });
    setNovaAnotacao('');
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
      <div className={`protocolo-files-layout ${hasGlobalItems ? 'has-preview' : ''}`}>
        <div className="protocolo-files-browser">
          <div className="protocolo-files-table-shell">
            <div className="protocolo-flow-tabs" role="tablist" aria-label="Fluxo de protocolos">
              {ABA_CONFIG.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
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
                <strong>{ABA_CONFIG.find((item) => item.key === activeTab)?.label || 'Protocolos'}</strong>
                <span>{displayedItems.length} de {items.length}</span>
              </div>

              <div className="protocolo-file-table-head">
                <span />
                <span>Protocolo</span>
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
                          {item.status === 'Concluído' ? item.concluidoPor || 'Administrador' : '-'}
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
                            title={item.status === 'Concluído' ? 'Reabrir protocolo' : 'Concluir protocolo'}
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
              <span>Nenhum protocolo disponível.</span>
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
                <div>
                  <dt>Recebido em</dt>
                  <dd>
                    {getShortDate(previewFile.recebidoEm)}
                    {getShortTime(previewFile.recebidoEm) ? <small>{getShortTime(previewFile.recebidoEm)}</small> : null}
                  </dd>
                </div>
                <div><dt>Concluído por</dt><dd>{previewFile.status === 'Concluído' ? previewFile.concluidoPor || 'Administrador' : '-'}</dd></div>
                <div><dt>Total Anotações</dt><dd>{previewFile.anotacoesList?.length || 0}</dd></div>
              </dl>

              <div className="protocolo-review-panel">
                <div className="protocolo-review-actions">
                  <button
                    type="button"
                    className={previewFile.status === 'Concluído' ? 'reject' : 'approve'}
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
                        <p>{a.texto}</p>
                      </div>
                    ))
                  ) : (
                    <span className="no-anotacoes">Nenhuma anotação registrada.</span>
                  )}
                </div>

                <label>
                  <span>Nova Anotação</span>
                  <textarea
                    value={novaAnotacao}
                    placeholder="Digite a anotação para este protocolo"
                    onChange={(event) => setNovaAnotacao(event.target.value)}
                  />
                </label>
                <button
                  className="add-anotacao-btn"
                  onClick={handleAddAnotacao}
                  disabled={!novaAnotacao.trim()}
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

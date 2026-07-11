import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, FileText, Key, Link2, Search, ShieldX, Trash2, ExternalLink } from 'lucide-react';
import { documentShareService, type SharedDocumentLink } from '../services/documentShareService';
import { SystemQuickModal } from '../../components/SystemQuickModal';

interface SharedDocumentsTabProps {
  refreshKey: number;
  onNotify?: (message: string) => void;
}

type SharedDocumentBatch = {
  groupId: string;
  status: 'Ativo' | 'Expirado';
  documento: string;
  empresa: string;
  geradoPor: string;
  link: string;
  dataGeracao: string;
  dataExpiracao: string;
  dataGeracaoIso?: string;
  dataExpiracaoIso?: string;
  senha?: string;
  tempoLimite: string;
  documentos: SharedDocumentLink[];
};

const PAGE_SIZE = 8;
const STATUS_TABS: Array<'Ativo' | 'Expirado' | 'Todos'> = ['Ativo', 'Expirado', 'Todos'];

const formatDisplayLink = (link: string) => {
  try {
    const parsed = new URL(link);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return link.replace(/^https?:\/\//, '');
  }
};

const buildBatchDisplayLabel = (batch: SharedDocumentBatch) => {
  if (batch.documentos.length <= 1) return batch.documento;
  return `${batch.documento} + ${batch.documentos.length - 1} arquivo(s)`;
};

const buildBatchSecondaryLabel = (batch: SharedDocumentBatch) => {
  if (batch.documentos.length <= 1) return `Gerado em ${batch.dataGeracao}`;
  return `Lote com ${batch.documentos.length} arquivo(s) · Gerado em ${batch.dataGeracao}`;
};

export const SharedDocumentsTab: React.FC<SharedDocumentsTabProps> = ({ refreshKey, onNotify }) => {
  const [links, setLinks] = useState<SharedDocumentLink[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Expirado'>('Ativo');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingGroupIds, setRevokingGroupIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    groupId: string;
    action: 'revoke' | 'delete';
  }>({
    isOpen: false,
    groupId: '',
    action: 'revoke',
  });

  useEffect(() => {
    let mounted = true;
    if (refreshKey) {
      setCurrentPage(1);
    }
    setIsLoading(true);
    documentShareService.list()
      .then((nextLinks) => {
        if (mounted) setLinks(nextLinks);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const batches = useMemo(() => {
    const grouped = new Map<string, SharedDocumentLink[]>();
    links.forEach((link) => {
      const groupId = link.shareGroupId || link.id;
      const bucket = grouped.get(groupId);
      if (bucket) {
        bucket.push(link);
      } else {
        grouped.set(groupId, [link]);
      }
    });

    return Array.from(grouped.entries()).map(([groupId, docs]) => {
      const primary = docs[0];
      const batchStatus: SharedDocumentBatch['status'] = docs.some((item) => item.status === 'Ativo') ? 'Ativo' : 'Expirado';
      return {
        groupId,
        status: batchStatus,
        documento: primary.documento || 'Compartilhamento sem arquivo',
        empresa: primary.empresa || 'Biblioteca pessoal',
        geradoPor: primary.geradoPor || 'Responsável',
        link: primary.link,
        dataGeracao: primary.dataGeracao,
        dataExpiracao: primary.dataExpiracao,
        dataGeracaoIso: primary.dataGeracaoIso,
        dataExpiracaoIso: primary.dataExpiracaoIso,
        senha: primary.senha,
        tempoLimite: primary.tempoLimite,
        documentos: docs,
      };
    }).sort((a, b) => {
      const aDate = a.dataGeracaoIso ? Date.parse(a.dataGeracaoIso) : 0;
      const bDate = b.dataGeracaoIso ? Date.parse(b.dataGeracaoIso) : 0;
      if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
      if (Number.isNaN(aDate)) return 1;
      if (Number.isNaN(bDate)) return -1;
      return bDate - aDate;
    });
  }, [links]);

  const filteredBatches = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return batches.filter((batch) => {
      const matchesStatus = statusFilter === 'Todos' || batch.status === statusFilter;
      const matchesSearch = !search || batch.documentos.some((doc) => doc.documento.toLowerCase().includes(search) || (doc.empresa || '').toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [batches, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => ({
    Ativo: batches.filter((batch) => batch.status === 'Ativo').length,
    Expirado: batches.filter((batch) => batch.status === 'Expirado').length,
    Todos: batches.length,
  }), [batches]);

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));
  const paginatedBatches = filteredBatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleCopy = async (batch: SharedDocumentBatch) => {
    const docs = batch.documentos.map((doc) => `- ${doc.documento}`).join('\n');
    const payloadTitle = batch.documentos.length > 1
      ? `Compartilhamento em lote (${batch.documentos.length} arquivos):`
      : 'Arquivo compartilhado:';
    const payloadSenha = batch.senha ? `\nSenha: ${batch.senha}` : '';
    const payload = `${payloadTitle}\n${docs}\n\n${batch.link}${payloadSenha}\n\nDisponível por: ${batch.tempoLimite}\nExpira em: ${batch.dataExpiracao}`;

    await navigator.clipboard.writeText(payload);
    setCopiedId(batch.groupId);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopyLinkOnly = async (batch: SharedDocumentBatch) => {
    await navigator.clipboard.writeText(batch.link);
    setCopiedId(`link:${batch.groupId}`);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRevoke = async (groupId: string) => {
    setRevokingGroupIds((current) => {
      const next = new Set(current);
      next.add(groupId);
      return next;
    });

    setLinks((current) => current.map((link) => (
      link.id === groupId || link.shareGroupId === groupId
        ? { ...link, status: 'Expirado' }
        : link
    )));

    const revoked = await documentShareService.revoke(groupId);
    const latest = await documentShareService.list();
    setLinks(latest);

    if (!revoked) {
      onNotify?.('Não foi possível revogar agora no servidor. Alteração salva localmente.');
    } else {
      onNotify?.('Link de compartilhamento revogado.');
    }

    setRevokingGroupIds((current) => {
      const next = new Set(current);
      next.delete(groupId);
      return next;
    });
  };

  const handleDelete = async (groupId: string) => {
    setRevokingGroupIds((current) => {
      const next = new Set(current);
      next.add(groupId);
      return next;
    });

    setLinks((current) => current.filter((link) => (
      link.id !== groupId && link.shareGroupId !== groupId
    )));

    const deleted = await documentShareService.delete(groupId);
    const latest = await documentShareService.list();
    setLinks(latest);

    if (!deleted) {
      onNotify?.('Não foi possível excluir agora no servidor. Alteração salva localmente.');
    } else {
      onNotify?.('Link de compartilhamento excluído definitivamente.');
    }

    setRevokingGroupIds((current) => {
      const next = new Set(current);
      next.delete(groupId);
      return next;
    });
  };

  const handleActionClick = (groupId: string, status: 'Ativo' | 'Expirado') => {
    setConfirmModalState({
      isOpen: true,
      groupId,
      action: status === 'Ativo' ? 'revoke' : 'delete',
    });
  };

  const handleConfirmAction = () => {
    if (confirmModalState.action === 'revoke') {
      handleRevoke(confirmModalState.groupId);
    } else {
      handleDelete(confirmModalState.groupId);
    }
  };

  const handleTogglePassword = (groupId: string) => {
    setVisiblePasswordId((current) => (current === groupId ? null : groupId));
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: '34px 20px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center', color: '#64748b', fontWeight: 750 }}>
        Carregando arquivos compartilhados...
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="animate-fade-in" style={{ padding: '34px 20px', border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#f8fafc', textAlign: 'center' }}>
        <Link2 size={34} style={{ color: '#94a3b8', marginBottom: '10px' }} />
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '0.98rem', fontWeight: 850 }}>Nenhum arquivo compartilhado</h3>
        <p style={{ margin: '6px auto 0', maxWidth: '420px', color: '#64748b', fontSize: '0.8rem' }}>
          Selecione um arquivo na Biblioteca ou Por Empresa e use Compartilhar para criar o primeiro link.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por arquivo ou empresa..."
            style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid #d8e0ea', borderRadius: '8px', outline: 'none', color: '#0f172a', fontSize: '0.8rem', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab;
          const label = tab === 'Ativo' ? 'Ativos' : tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              style={{ border: 'none', borderBottom: isActive ? '2px solid var(--color-gold-primary)' : '2px solid transparent', background: 'transparent', color: isActive ? '#b45309' : '#64748b', padding: '8px 10px', cursor: 'pointer', fontWeight: 850, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '7px' }}
            >
              {label}
              <span style={{ minWidth: '22px', height: '20px', padding: '0 7px', borderRadius: '999px', background: isActive ? '#fffbeb' : '#f1f5f9', border: isActive ? '1px solid #fde68a' : '1px solid #e2e8f0', color: isActive ? '#b45309' : '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem' }}>
                {statusCounts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="table-responsive-wrapper">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Arquivo</th>
              <th>Link</th>
              <th>Expiração</th>
              <th>Senha</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBatches.map((batch) => {
              const isCopied = copiedId === batch.groupId;
              const isLinkCopied = copiedId === `link:${batch.groupId}`;
              const isPasswordVisible = visiblePasswordId === batch.groupId;
              const label = buildBatchDisplayLabel(batch);

              return (
                <tr key={batch.groupId}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 850, background: batch.status === 'Ativo' ? '#f0fdf4' : '#f1f5f9', color: batch.status === 'Ativo' ? '#166534' : '#64748b', border: batch.status === 'Ativo' ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                      {batch.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.84rem' }}>
                        <FileText size={15} color="var(--color-gold-primary)" />
                        {label}
                      </strong>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        {batch.empresa} · {buildBatchSecondaryLabel(batch)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleCopyLinkOnly(batch)}
                      disabled={batch.status === 'Expirado'}
                      style={{ maxWidth: '240px', border: '1px solid #d8e0ea', background: isLinkCopied ? '#f0fdf4' : '#ffffff', color: isLinkCopied ? '#166534' : '#475569', opacity: batch.status === 'Expirado' ? 0.5 : 1, borderRadius: '7px', padding: '6px 9px', cursor: batch.status === 'Expirado' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.72rem' }}
                      title={batch.link}
                    >
                      {isLinkCopied ? <Check size={13} /> : <Link2 size={13} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isLinkCopied ? 'Link copiado' : formatDisplayLink(batch.link)}
                      </span>
                    </button>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 700 }}>{batch.dataExpiracao}</td>
                  <td>
                    {batch.senha ? (
                      <button
                        type="button"
                        onClick={() => handleTogglePassword(batch.groupId)}
                        style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800 }}
                      >
                        <Key size={13} />
                        {isPasswordVisible ? batch.senha : '••••••••'}
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontStyle: 'italic' }}>Sem senha</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                    onClick={() => handleCopy(batch)}
                    disabled={batch.status === 'Expirado'}
                        style={{ border: '1px solid #cbd5e1', background: isCopied ? '#f0fdf4' : '#ffffff', color: isCopied ? '#166534' : '#475569', opacity: batch.status === 'Expirado' ? 0.5 : 1, borderRadius: '7px', padding: '6px 9px', cursor: batch.status === 'Expirado' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, fontSize: '0.74rem' }}
                      >
                      {isCopied ? <Check size={13} /> : <Clipboard size={13} />}
                      {isCopied ? 'Copiado' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(batch.link, '_blank', 'noopener,noreferrer')}
                      style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '7px', padding: '6px 9px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, fontSize: '0.74rem' }}
                    >
                      <ExternalLink size={13} />
                      Abrir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActionClick(batch.groupId, batch.status)}
                        disabled={revokingGroupIds.has(batch.groupId)}
                        title={revokingGroupIds.has(batch.groupId) ? 'Processando...' : batch.status === 'Ativo' ? 'Revogar' : 'Excluir'}
                        style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', borderRadius: '7px', width: '32px', height: '32px', cursor: revokingGroupIds.has(batch.groupId) ? 'not-allowed' : 'pointer', opacity: revokingGroupIds.has(batch.groupId) ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {revokingGroupIds.has(batch.groupId) ? <span style={{ fontSize: '0.58rem' }}>...</span> : batch.status === 'Ativo' ? <ShieldX size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedBatches.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '22px', color: '#64748b', fontWeight: 750 }}>
                  Nenhum compartilhamento encontrado nesta aba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.76rem', fontWeight: 750 }}>
        <span>
          Mostrando {filteredBatches.length === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredBatches.length)} de {filteredBatches.length}
        </span>
        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            style={{ border: '1px solid #d8e0ea', background: '#ffffff', color: '#475569', borderRadius: '7px', padding: '6px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, fontWeight: 800 }}
          >
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            style={{ border: '1px solid #d8e0ea', background: '#ffffff', color: '#475569', borderRadius: '7px', padding: '6px 10px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, fontWeight: 800 }}
          >
            Próxima
          </button>
        </div>
      </div>

      <SystemQuickModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.action === 'revoke' ? 'Revogar Compartilhamento' : 'Excluir Compartilhamento'}
        message={
          confirmModalState.action === 'revoke'
            ? 'Tem certeza de que deseja revogar este link de compartilhamento? O acesso público aos arquivos correspondentes será bloqueado imediatamente.'
            : 'Tem certeza de que deseja excluir definitivamente este link de compartilhamento? Esta ação removerá o registro do histórico do servidor.'
        }
        confirmLabel={confirmModalState.action === 'revoke' ? 'Revogar' : 'Excluir'}
        cancelLabel="Cancelar"
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
        danger={true}
      />
    </div>
  );
};

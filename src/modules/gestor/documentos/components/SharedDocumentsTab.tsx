import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, FileText, Key, Link2, Search, ShieldX, Trash2 } from 'lucide-react';
import { documentShareService, type SharedDocumentLink } from '../services/documentShareService';

interface SharedDocumentsTabProps {
  refreshKey: number;
  onNotify?: (message: string) => void;
}

const PAGE_SIZE = 8;
const STATUS_TABS: Array<'Ativo' | 'Expirado' | 'Todos'> = ['Ativo', 'Expirado', 'Todos'];

export const SharedDocumentsTab: React.FC<SharedDocumentsTabProps> = ({ refreshKey, onNotify }) => {
  const [links, setLinks] = useState<SharedDocumentLink[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Expirado'>('Ativo');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let mounted = true;
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

  const filteredLinks = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return links.filter((link) => {
      const matchesStatus = statusFilter === 'Todos' || link.status === statusFilter;
      const matchesSearch = !search || link.documento.toLowerCase().includes(search) || link.empresa.toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [links, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => ({
    Ativo: links.filter((link) => link.status === 'Ativo').length,
    Expirado: links.filter((link) => link.status === 'Expirado').length,
    Todos: links.length,
  }), [links]);

  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / PAGE_SIZE));
  const paginatedLinks = filteredLinks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleCopy = async (link: SharedDocumentLink) => {
    await navigator.clipboard.writeText(`${link.link}${link.senha ? `\nSenha: ${link.senha}` : ''}`);
    setCopiedId(link.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRevoke = async (id: string) => {
    await documentShareService.revoke(id);
    setLinks(await documentShareService.list());
    onNotify?.('Link de compartilhamento revogado.');
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
              <th>Expiração</th>
              <th>Senha</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLinks.map((link) => {
              const isCopied = copiedId === link.id;
              const isPasswordVisible = visiblePasswordId === link.id;
              return (
                <tr key={link.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 850, background: link.status === 'Ativo' ? '#f0fdf4' : '#f1f5f9', color: link.status === 'Ativo' ? '#166534' : '#64748b', border: link.status === 'Ativo' ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                      {link.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.84rem' }}>
                        <FileText size={15} color="var(--color-gold-primary)" />
                        {link.documento}
                      </strong>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{link.empresa} · Gerado em {link.dataGeracao}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 700 }}>{link.dataExpiracao}</td>
                  <td>
                    {link.senha ? (
                      <button type="button" onClick={() => setVisiblePasswordId(isPasswordVisible ? null : link.id)} style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800 }}>
                        <Key size={13} />
                        {isPasswordVisible ? link.senha : '••••••••'}
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontStyle: 'italic' }}>Sem senha</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button type="button" onClick={() => handleCopy(link)} disabled={link.status === 'Expirado'} style={{ border: '1px solid #cbd5e1', background: isCopied ? '#f0fdf4' : '#ffffff', color: isCopied ? '#166534' : '#475569', opacity: link.status === 'Expirado' ? 0.5 : 1, borderRadius: '7px', padding: '6px 9px', cursor: link.status === 'Expirado' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, fontSize: '0.74rem' }}>
                        {isCopied ? <Check size={13} /> : <Clipboard size={13} />}
                        {isCopied ? 'Copiado' : 'Copiar'}
                      </button>
                      <button type="button" onClick={() => handleRevoke(link.id)} title="Revogar" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', borderRadius: '7px', width: '32px', height: '32px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {link.status === 'Ativo' ? <ShieldX size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedLinks.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '22px', color: '#64748b', fontWeight: 750 }}>
                  Nenhum compartilhamento encontrado nesta aba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.76rem', fontWeight: 750 }}>
        <span>
          Mostrando {filteredLinks.length === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredLinks.length)} de {filteredLinks.length}
        </span>
        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} style={{ border: '1px solid #d8e0ea', background: '#ffffff', color: '#475569', borderRadius: '7px', padding: '6px 10px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, fontWeight: 800 }}>
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} style={{ border: '1px solid #d8e0ea', background: '#ffffff', color: '#475569', borderRadius: '7px', padding: '6px 10px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, fontWeight: 800 }}>
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};

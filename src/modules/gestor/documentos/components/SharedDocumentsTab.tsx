import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, FileText, Key, Link2, Search, ShieldX, Trash2 } from 'lucide-react';
import { documentShareService, type SharedDocumentLink } from '../services/documentShareService';

interface SharedDocumentsTabProps {
  refreshKey: number;
  onNotify?: (message: string) => void;
}

export const SharedDocumentsTab: React.FC<SharedDocumentsTabProps> = ({ refreshKey, onNotify }) => {
  const [links, setLinks] = useState<SharedDocumentLink[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Expirado'>('Todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);

  useEffect(() => {
    setLinks(documentShareService.list());
  }, [refreshKey]);

  const filteredLinks = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return links.filter((link) => {
      const matchesStatus = statusFilter === 'Todos' || link.status === statusFilter;
      const matchesSearch = !search || link.documento.toLowerCase().includes(search) || link.empresa.toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [links, searchTerm, statusFilter]);

  const handleCopy = async (link: SharedDocumentLink) => {
    await navigator.clipboard.writeText(`${link.link}${link.senha ? `\nSenha: ${link.senha}` : ''}`);
    setCopiedId(link.id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRevoke = (id: string) => {
    documentShareService.revoke(id);
    setLinks(documentShareService.list());
    onNotify?.('Link de compartilhamento revogado.');
  };

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
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'Todos' | 'Ativo' | 'Expirado')} style={{ padding: '8px 10px', border: '1px solid #d8e0ea', borderRadius: '8px', background: '#ffffff', color: '#475569', fontSize: '0.8rem' }}>
          <option value="Todos">Todos os status</option>
          <option value="Ativo">Ativos</option>
          <option value="Expirado">Expirados</option>
        </select>
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
            {filteredLinks.map((link) => {
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

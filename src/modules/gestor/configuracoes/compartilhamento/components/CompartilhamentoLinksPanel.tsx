import React, { useMemo, useState } from 'react';
import { Check, Clipboard, Clock, FileText, Key, Search, Trash2, User } from 'lucide-react';
import { copyToClipboard } from '../../../../../lib/clipboard';
import type { SharedDocumentLink } from '../../../documentos/services/documentShareService';

interface CompartilhamentoLinksPanelProps {
  links: SharedDocumentLink[];
  revokingId?: string | null;
  onRevoke: (id: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.82rem',
  backgroundColor: '#ffffff',
  color: '#111827',
  boxSizing: 'border-box',
};

export const CompartilhamentoLinksPanel: React.FC<CompartilhamentoLinksPanelProps> = ({
  links,
  revokingId,
  onRevoke,
}) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'Todos' | 'Ativo' | 'Expirado'>('Todos');
  const [user, setUser] = useState('Todos');
  const [date, setDate] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);

  const users = useMemo(() => Array.from(new Set(links.map((link) => link.geradoPor))), [links]);
  const filteredLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const formattedDate = date ? date.split('-').reverse().join('/') : '';
    return links.filter((link) => (
      (!term || [link.documento, link.empresa, link.geradoPor].some((value) => value.toLowerCase().includes(term)))
      && (status === 'Todos' || link.status === status)
      && (user === 'Todos' || link.geradoPor === user)
      && (!formattedDate || link.dataGeracao.includes(formattedDate))
    ));
  }, [date, links, search, status, user]);

  const handleCopy = async (link: SharedDocumentLink) => {
    await copyToClipboard(link.link);
    setCopiedId(link.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('Todos');
    setUser('Todos');
    setDate('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)) auto', gap: '10px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <label style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input aria-label="Buscar compartilhamentos" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por documento ou empresa..." style={{ ...inputStyle, paddingLeft: '34px' }} />
        </label>
        <select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} style={inputStyle}>
          <option value="Todos">Todos os status</option>
          <option value="Ativo">Ativo</option>
          <option value="Expirado">Expirado</option>
        </select>
        <select aria-label="Filtrar por responsável" value={user} onChange={(event) => setUser(event.target.value)} style={inputStyle}>
          <option value="Todos">Criado por: Todos</option>
          {users.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <input aria-label="Filtrar por data" type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
        {(search || status !== 'Todos' || user !== 'Todos' || date) && (
          <button type="button" onClick={clearFilters} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', color: '#475569', padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>Limpar</button>
        )}
      </div>

      <div style={{ color: '#64748b', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Lista de compartilhamentos ({filteredLinks.length})
      </div>

      <div className="table-responsive">
        <table className="table-custom">
          <thead>
            <tr>
              <th>Status</th><th>Documento / Empresa</th><th>Criado por</th><th>Geração</th>
              <th>Expiração</th><th>Chave</th><th>Link</th><th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredLinks.map((link) => {
              const copied = copiedId === link.id;
              const passwordVisible = visiblePasswordId === link.id;
              const revokeTarget = link.shareGroupId || link.id;
              return (
                <tr key={link.id}>
                  <td><span style={{ color: link.status === 'Ativo' ? '#166534' : '#64748b', fontWeight: 700 }}>{link.status}</span></td>
                  <td>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b' }}><FileText size={15} color="var(--color-gold-primary)" />{link.documento}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.74rem' }}>{link.empresa}</span>
                  </td>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} />{link.geradoPor}</span></td>
                  <td>{link.dataGeracao}</td>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={13} />{link.dataExpiracao}</span></td>
                  <td>
                    {link.senha ? (
                      <button type="button" onClick={() => setVisiblePasswordId(passwordVisible ? null : link.id)} style={{ border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309', borderRadius: '5px', padding: '4px 7px', cursor: 'pointer', fontFamily: 'monospace' }}>
                        <Key size={12} style={{ marginRight: '5px' }} />{passwordVisible ? link.senha : '••••••••'}
                      </button>
                    ) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sem senha</span>}
                  </td>
                  <td><span title={link.link} style={{ display: 'block', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.link}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button type="button" onClick={() => handleCopy(link)} disabled={link.status === 'Expirado'} title="Copiar URL" style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: copied ? '#166534' : '#475569', borderRadius: '5px', padding: '6px 8px', cursor: 'pointer' }}>
                        {copied ? <Check size={13} /> : <Clipboard size={13} />}
                      </button>
                      <button type="button" onClick={() => onRevoke(revokeTarget)} disabled={revokingId === revokeTarget || link.status === 'Expirado'} title="Revogar link" style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', borderRadius: '5px', padding: '6px 8px', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredLinks.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Nenhum compartilhamento encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

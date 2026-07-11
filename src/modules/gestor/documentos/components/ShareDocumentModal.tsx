import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Key, Link2, Share2, Timer, X } from 'lucide-react';
import { DEFAULT_SHARE_PASSWORD, documentShareService, formatShareDateTime, generateSharePassword, parseShareDurationMs, SHARE_EXPIRATION_OPTIONS, type ShareableDocument, type SharedDocumentLink } from '../services/documentShareService';

interface ShareDocumentModalProps {
  isOpen: boolean;
  documents: ShareableDocument[];
  onClose: () => void;
  onCreated: (links: SharedDocumentLink[]) => void;
}

export const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({
  isOpen,
  documents,
  onClose,
  onCreated,
}) => {
  const [tempoLimite, setTempoLimite] = useState(() => localStorage.getItem('cfg_share_tempo_padrao') || '3 horas');
  const [exigirSenha, setExigirSenha] = useState(() => localStorage.getItem('cfg_share_exigir_senha_padrao') === 'true');
  const [senha, setSenha] = useState(() => DEFAULT_SHARE_PASSWORD);
  const [createdLinks, setCreatedLinks] = useState<SharedDocumentLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canCreate = documents.length > 0;
  const title = useMemo(() => (
    documents.length === 1 ? 'Compartilhar arquivo' : `Compartilhar ${documents.length} arquivos`
  ), [documents.length]);
  
  const expirationPreview = useMemo(() => (
    formatShareDateTime(new Date(Date.now() + parseShareDurationMs(tempoLimite)))
  ), [tempoLimite]);

  const hasUniqueLink = useMemo(() => {
    if (createdLinks.length === 0) return false;
    const firstUrl = createdLinks[0].link;
    return createdLinks.every((l) => l.link === firstUrl);
  }, [createdLinks]);

  useEffect(() => {
    if (!isOpen) return;
    setTempoLimite(localStorage.getItem('cfg_share_tempo_padrao') || '3 horas');
    setExigirSenha(localStorage.getItem('cfg_share_exigir_senha_padrao') === 'true');
    setSenha(DEFAULT_SHARE_PASSWORD);
    setCreatedLinks([]);
    setCopied(false);
    setCopiedLinkId(null);
    setIsCreating(false);
    setErrorMessage('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setErrorMessage('');
    try {
      const links = await documentShareService.createLinks({
        documents,
        tempoLimite,
        exigirSenha,
        senha,
      });
      setCreatedLinks(links);
      onCreated(links);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao gerar link temporário.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    const payload = createdLinks.map((link) => (
      `${link.documento}\n${link.link}${link.senha ? `\nSenha: ${link.senha}` : ''}\nDisponível por: ${link.tempoLimite}\nExpira em: ${link.dataExpiracao}`
    )).join('\n\n');
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyOnlyLink = async (link: SharedDocumentLink) => {
    await navigator.clipboard.writeText(link.link);
    setCopiedLinkId(link.id);
    window.setTimeout(() => setCopiedLinkId(null), 1800);
  };

  const formatDisplayLink = (link: string) => {
    try {
      const parsed = new URL(link);
      return `${parsed.host}${parsed.pathname}`;
    } catch {
      return link.replace(/^https?:\/\//, '');
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d8e0ea',
    borderRadius: '8px',
    padding: '9px 11px',
    fontSize: '0.82rem',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '640px', padding: 0, overflow: 'hidden', border: '1px solid rgba(197, 146, 53, 0.46)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ background: '#0f172a', color: '#ffffff', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 850, color: '#ffffff' }}>{title}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#cbd5e1' }}>Gere links temporários com ou sem senha.</p>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Arquivos selecionados
              </label>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '174px', overflow: 'auto', background: '#f8fafc' }}>
                {documents.map((doc) => (
                  <div key={doc.id} style={{ padding: '9px 10px', borderBottom: '1px solid #e2e8f0' }}>
                    <strong style={{ display: 'block', fontSize: '0.78rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.nome}</strong>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{doc.empresaNome || 'Biblioteca pessoal'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Expiração do link
              </label>
              <select 
                value={tempoLimite} 
                onChange={(event) => setTempoLimite(event.target.value)} 
                disabled={createdLinks.length > 0 || isCreating}
                style={{ 
                  ...fieldStyle, 
                  opacity: createdLinks.length > 0 ? 0.75 : 1, 
                  cursor: createdLinks.length > 0 ? 'not-allowed' : 'default' 
                }}
              >
                {SHARE_EXPIRATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setExigirSenha((current) => !current)}
              disabled={createdLinks.length > 0 || isCreating}
              style={{ 
                border: exigirSenha ? '1px solid #d9a441' : '1px solid #d8e0ea', 
                background: exigirSenha ? '#fffbeb' : '#ffffff', 
                borderRadius: '8px', 
                padding: '11px', 
                cursor: createdLinks.length > 0 ? 'not-allowed' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                gap: '12px', 
                color: '#0f172a',
                opacity: createdLinks.length > 0 ? 0.75 : 1 
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 850, fontSize: '0.82rem' }}>
                <Key size={16} color={exigirSenha ? '#b45309' : '#94a3b8'} />
                Proteger com senha
              </span>
              <span style={{ width: '34px', height: '20px', borderRadius: '999px', background: exigirSenha ? '#d9a441' : '#cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: exigirSenha ? 'flex-end' : 'flex-start', padding: '2px', boxSizing: 'border-box' }}>
                <i style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ffffff', display: 'block' }} />
              </span>
            </button>

            {exigirSenha && (
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Senha temporária
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    value={senha} 
                    onChange={(event) => setSenha(event.target.value)} 
                    disabled={createdLinks.length > 0 || isCreating}
                    style={{ 
                      ...fieldStyle, 
                      opacity: createdLinks.length > 0 ? 0.75 : 1, 
                      cursor: createdLinks.length > 0 ? 'not-allowed' : 'text' 
                    }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setSenha(generateSharePassword())} 
                    disabled={createdLinks.length > 0 || isCreating}
                    style={{ 
                      border: '1px solid #d8e0ea', 
                      background: '#ffffff', 
                      borderRadius: '8px', 
                      padding: '0 10px', 
                      color: '#475569', 
                      cursor: createdLinks.length > 0 ? 'not-allowed' : 'pointer', 
                      fontWeight: 800,
                      opacity: createdLinks.length > 0 ? 0.75 : 1 
                    }}
                  >
                    Gerar
                  </button>
                </div>
              </div>
            )}

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#f8fafc', color: '#64748b', fontSize: '0.76rem', lineHeight: 1.35 }}>
              <Timer size={15} style={{ color: '#b45309', verticalAlign: 'middle', marginRight: '6px' }} />
              Os links ficam ativos por {tempoLimite}, até {expirationPreview}, e podem ser revogados depois em Compartilhados.
            </div>
          </div>
        </div>

        {errorMessage && (
          <div style={{ margin: '0 18px 16px', padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.76rem', fontWeight: 750 }}>
            {errorMessage}
          </div>
        )}

        {createdLinks.length > 0 && (
          <div style={{ margin: '0 18px 16px', display: 'grid', gap: '8px' }}>
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.76rem', fontWeight: 750 }}>
              {createdLinks.length} link(s) gerado(s). Disponível por {tempoLimite}, até {expirationPreview}. {exigirSenha ? 'Senha incluída no compartilhamento.' : 'Acesso sem senha.'}
            </div>

            {hasUniqueLink && createdLinks.length > 1 ? (
              /* Exibição unificada para Lote de Compartilhamento (Evita links repetidos) */
              <div style={{ border: '1px solid #d8e0ea', borderRadius: '8px', padding: '12px', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', marginBottom: '2px' }}>
                      Link de lote unificado ({createdLinks.length} arquivos)
                    </strong>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '0.72rem', width: '100%' }}>
                      <Link2 size={13} color="var(--color-gold-primary)" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatDisplayLink(createdLinks[0].link)}
                      </span>
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleCopyOnlyLink(createdLinks[0])} 
                    style={{ 
                      border: '1px solid #cbd5e1', 
                      background: copiedLinkId === createdLinks[0].id ? '#f0fdf4' : '#ffffff', 
                      color: copiedLinkId === createdLinks[0].id ? '#166534' : '#475569', 
                      borderRadius: '7px', 
                      padding: '7px 12px', 
                      cursor: 'pointer', 
                      fontWeight: 800, 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.72rem' 
                    }}
                  >
                    {copiedLinkId === createdLinks[0].id ? <Check size={14} /> : <Clipboard size={14} />}
                    {copiedLinkId === createdLinks[0].id ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
                
                {/* Lista pequena dos arquivos inclusos no lote */}
                <div style={{ borderTop: '1px solid #edf2f7', marginTop: '10px', paddingTop: '8px', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Arquivos no compartilhamento:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '72px', overflowY: 'auto' }}>
                    {createdLinks.map((link) => (
                      <span key={link.id} style={{ fontSize: '0.7rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        • {link.documento}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Exibição individual padrão */
              <div style={{ border: '1px solid #d8e0ea', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                {createdLinks.map((link, index) => {
                  const isCopied = copiedLinkId === link.id;
                  return (
                    <div key={link.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', alignItems: 'center', padding: '9px 10px', borderTop: index === 0 ? 'none' : '1px solid #edf2f7' }}>
                      <div style={{ minWidth: 0, textAlign: 'left' }}>
                        <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.documento}</strong>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '0.72rem', maxWidth: '100%' }}>
                          <Link2 size={13} color="var(--color-gold-primary)" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatDisplayLink(link.link)}</span>
                        </span>
                      </div>
                      <button type="button" onClick={() => handleCopyOnlyLink(link)} style={{ border: '1px solid #cbd5e1', background: isCopied ? '#f0fdf4' : '#ffffff', color: isCopied ? '#166534' : '#475569', borderRadius: '7px', padding: '7px 10px', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem' }}>
                        {isCopied ? <Check size={14} /> : <Clipboard size={14} />}
                        {isCopied ? 'Copiado' : 'Copiar link'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '14px 18px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          {createdLinks.length > 0 && (
            <button type="button" onClick={handleCopy} style={{ border: '1px solid #cbd5e1', background: copied ? '#f0fdf4' : '#ffffff', color: copied ? '#166534' : '#475569', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
              {copied ? 'Copiado' : 'Copiar links'}
            </button>
          )}
          <button type="button" onClick={createdLinks.length > 0 ? onClose : handleCreate} disabled={!canCreate || isCreating} style={{ border: 'none', background: 'var(--color-gold-gradient)', color: '#ffffff', borderRadius: '8px', padding: '8px 14px', cursor: canCreate && !isCreating ? 'pointer' : 'not-allowed', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: '7px', opacity: isCreating ? 0.72 : 1 }}>
            <Share2 size={15} />
            {createdLinks.length > 0 ? 'Concluir' : isCreating ? 'Gerando...' : 'Gerar compartilhamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

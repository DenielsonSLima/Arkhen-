import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, KeyRound, Lock, ShieldCheck, Timer } from 'lucide-react';
import { documentShareService, fromBase64Url, hashSharePassword, type SharedDocumentLink } from '../../gestor/documentos/services/documentShareService';

type PublicLinkPayload = Pick<SharedDocumentLink, 'id' | 'documento' | 'empresa' | 'tempoLimite' | 'dataGeracao' | 'dataExpiracao' | 'senhaHash' | 'arquivoUrl'>;

const parseExpiration = (value: string) => {
  const [datePart, timePart = '00:00'] = value.split(' ');
  const [day, month, year] = datePart.split('/');
  return new Date(`${year}-${month}-${day}T${timePart}:00`);
};

const getPayloadFromUrl = (): PublicLinkPayload | null => {
  const hashValue = window.location.hash.replace(/^#/, '');
  if (!hashValue) return null;

  try {
    return JSON.parse(fromBase64Url(hashValue)) as PublicLinkPayload;
  } catch {
    return null;
  }
};

const getFallbackLink = (): PublicLinkPayload | null => {
  const id = window.location.pathname.split('/').filter(Boolean).pop();
  if (!id) return null;
  const link = documentShareService.list().find((item) => item.id === id);
  return link || null;
};

export const PublicSharedDocumentPage: React.FC = () => {
  const [linkData] = useState<PublicLinkPayload | null>(() => getPayloadFromUrl() || getFallbackLink());
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => !linkData?.senhaHash);

  useEffect(() => {
    document.title = linkData ? `${linkData.documento} | Arquivo compartilhado` : 'Link indisponível | Arkhen';
  }, [linkData]);

  const isExpired = useMemo(() => {
    if (!linkData?.dataExpiracao) return true;
    const parsed = parseExpiration(linkData.dataExpiracao);
    return Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now();
  }, [linkData]);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!linkData?.senhaHash) return;
    const passwordHash = await hashSharePassword(password);
    if (passwordHash !== linkData.senhaHash) {
      setPasswordError('Senha incorreta. Confira o código recebido e tente novamente.');
      return;
    }
    setPasswordError('');
    setIsUnlocked(true);
  };

  const canDownload = Boolean(linkData?.arquivoUrl && isUnlocked && !isExpired);

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <section style={{ width: '100%', maxWidth: '720px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 24px 70px rgba(15, 23, 42, 0.14)', overflow: 'hidden' }}>
        <div style={{ background: '#0f172a', color: '#ffffff', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(197, 146, 53, 0.16)', border: '1px solid rgba(197, 146, 53, 0.45)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={23} color="#dfb35e" />
          </div>
          <div>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.76rem', fontWeight: 750 }}>Arkhen Gestão Contábil</p>
            <h1 style={{ margin: '3px 0 0', color: '#ffffff', fontSize: '1.18rem', lineHeight: 1.25 }}>Arquivo compartilhado com acesso temporário</h1>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {!linkData ? (
            <div style={{ padding: '22px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
              Link não encontrado. Solicite um novo compartilhamento para acessar este arquivo.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                <FileText size={28} color="#c59235" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', overflowWrap: 'anywhere' }}>{linkData.documento}</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>{linkData.empresa}</p>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '12px', background: '#ffffff' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: '#64748b', fontSize: '0.74rem', fontWeight: 800 }}><Timer size={15} /> Disponível por</span>
                  <strong style={{ display: 'block', marginTop: '5px', fontSize: '0.92rem', color: '#0f172a' }}>{linkData.tempoLimite}</strong>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '12px', background: '#ffffff' }}>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 800 }}>Expira em</span>
                  <strong style={{ display: 'block', marginTop: '5px', fontSize: '0.92rem', color: isExpired ? '#b91c1c' : '#0f172a' }}>{linkData.dataExpiracao}</strong>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '12px', background: '#ffffff' }}>
                  <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: 800 }}>Gerado em</span>
                  <strong style={{ display: 'block', marginTop: '5px', fontSize: '0.92rem', color: '#0f172a' }}>{linkData.dataGeracao}</strong>
                </div>
              </div>

              {isExpired && (
                <div style={{ marginTop: '16px', padding: '12px', borderRadius: '9px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontWeight: 750, fontSize: '0.82rem' }}>
                  Este link temporário expirou. Peça um novo compartilhamento ao responsável.
                </div>
              )}

              {!isExpired && linkData.senhaHash && !isUnlocked && (
                <form onSubmit={handleUnlock} style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', border: '1px solid #fde68a', background: '#fffbeb' }}>
                  <label style={{ display: 'block', color: '#92400e', fontSize: '0.78rem', fontWeight: 850, marginBottom: '8px' }}>
                    Senha de acesso
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Ex.: ARKH-1876-SEC"
                      style={{ flex: '1 1 220px', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px 12px', color: '#0f172a', outline: 'none' }}
                    />
                    <button type="submit" style={{ border: 'none', borderRadius: '8px', padding: '10px 14px', background: 'var(--color-gold-gradient)', color: '#ffffff', fontWeight: 850, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                      <KeyRound size={16} /> Acessar
                    </button>
                  </div>
                  {passwordError && <p style={{ margin: '8px 0 0', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 750 }}>{passwordError}</p>}
                </form>
              )}

              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={canDownload ? linkData.arquivoUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={linkData.documento}
                  aria-disabled={!canDownload}
                  style={{ pointerEvents: canDownload ? 'auto' : 'none', opacity: canDownload ? 1 : 0.5, borderRadius: '8px', padding: '10px 14px', background: canDownload ? '#0f172a' : '#94a3b8', color: '#ffffff', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {isUnlocked ? <Download size={16} /> : <Lock size={16} />}
                  {isUnlocked ? 'Baixar arquivo' : 'Aguardando senha'}
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
};

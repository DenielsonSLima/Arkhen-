import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, KeyRound, Lock, ShieldCheck, Timer } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import logoImage from '../../../assets/camada-o.png';
import {
  formatShareDateTime,
  hashSharePassword,
  parseLegacySharedPayload,
  type SharedDocumentLink,
} from '../../gestor/documentos/services/documentShareService';
import { parseShareDurationMs } from '../../gestor/documentos/services/documentShareService';

type PublicLinkPayload = Pick<SharedDocumentLink, 'id' | 'documento' | 'empresa' | 'tempoLimite' | 'dataGeracao' | 'dataExpiracao'> & {
  senhaObrigatoria: boolean;
  dataGeracaoIso: string;
  dataExpiracaoIso: string;
  storageBucket?: string;
  storagePath?: string;
  legacyUrl?: string;
};

interface PublicShareRow {
  id: string;
  documento: string;
  empresa: string;
  tempo_limite: string;
  data_geracao: string;
  data_expiracao: string;
  senha_obrigatoria: boolean;
  storage_bucket: string | null;
  storage_path: string | null;
}

const getShareIdFromPath = () => window.location.pathname.split('/').filter(Boolean).pop();

const mapPublicShareRow = (row: PublicShareRow): PublicLinkPayload => ({
  id: row.id,
  documento: row.documento,
  empresa: row.empresa,
  tempoLimite: row.tempo_limite,
  dataGeracao: formatShareDateTime(new Date(row.data_geracao)),
  dataGeracaoIso: row.data_geracao,
  dataExpiracao: formatShareDateTime(new Date(row.data_expiracao)),
  dataExpiracaoIso: row.data_expiracao,
  senhaObrigatoria: row.senha_obrigatoria,
  storageBucket: row.storage_bucket || undefined,
  storagePath: row.storage_path || undefined,
});

const parseLegacyDateTime = (value: string) => {
  if (!value) return null;
  const cleaned = value.replace(',', '').trim();
  const [datePart, timePart = '00:00'] = cleaned.split(' ');
  const [day, month, year] = datePart.split('/');
  if (!day || !month || !year) return null;
  return new Date(`${Number(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`);
};

const mapLegacyPayload = (payload: ReturnType<typeof parseLegacySharedPayload>) => {
  if (!payload) return null;

  const created = parseLegacyDateTime(payload.dataGeracao);
  const expires = parseLegacyDateTime(payload.dataExpiracao);

  return {
    id: payload.id,
    documento: payload.documento,
    empresa: payload.empresa || 'Biblioteca pessoal',
    tempoLimite: payload.tempoLimite || '1 hora',
    dataGeracao: formatShareDateTime(created || new Date()),
    dataGeracaoIso: created ? created.toISOString() : '',
    dataExpiracao: formatShareDateTime(expires || new Date()),
    dataExpiracaoIso: expires ? expires.toISOString() : '',
    senhaObrigatoria: false,
    storageBucket: undefined,
    storagePath: undefined,
    legacyUrl: payload.arquivoUrl,
  };
};

const fetchPublicShare = async (passwordHash?: string) => {
  const shareId = getShareIdFromPath();
  if (!shareId) return null;

  const { data, error } = await supabase.rpc('get_public_document_share', {
    p_share_id: shareId,
    p_password_hash: passwordHash || null,
  });
  if (!error && data?.[0]) return mapPublicShareRow(data[0] as PublicShareRow);

  const legacyPayload = parseLegacySharedPayload(window.location.hash.replace(/^#/, ''));
  return mapLegacyPayload(legacyPayload);
};

const createDownloadUrl = async (share: PublicLinkPayload) => {
  if (share.legacyUrl) return share.legacyUrl;
  if (!share.storageBucket || !share.storagePath) return null;
  const duration = Math.max(parseShareDurationMs(share.tempoLimite), 60) / 1000;
  const { data, error } = await supabase.storage.from(share.storageBucket).createSignedUrl(share.storagePath, duration);
  if (error) return null;
  return data?.signedUrl || null;
};

export const PublicSharedDocumentPage: React.FC = () => {
  const [linkData, setLinkData] = useState<PublicLinkPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchPublicShare()
      .then((share) => {
        if (!mounted) return;
        setLinkData(share);
        setIsUnlocked(Boolean(share && !share.senhaObrigatoria));
        if (share && !share.senhaObrigatoria) {
          createDownloadUrl(share).then((url) => {
            if (mounted) setDownloadUrl(url);
          });
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.title = linkData ? `${linkData.documento} | Arquivo compartilhado` : 'Link indisponível | Arkhen';
  }, [linkData]);

  const isExpired = useMemo(() => {
    if (!linkData?.dataExpiracaoIso) return true;
    const parsed = new Date(linkData.dataExpiracaoIso);
    return Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now();
  }, [linkData]);

  const fileExt = useMemo(() => {
    if (!linkData?.documento) return '';
    return linkData.documento.split('.').pop()?.toLowerCase() || '';
  }, [linkData?.documento]);

  const previewMode = useMemo(() => {
    if (fileExt === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(fileExt)) return 'image';
    return 'generic';
  }, [fileExt]);

  const previewSource = useMemo(() => {
    if (!downloadUrl) return '';
    return downloadUrl.split('#')[0];
  }, [downloadUrl]);

  const previewImage = useMemo(() => (previewMode === 'pdf' && previewSource ? `${previewSource}#page=1&view=FitH&toolbar=0&navpanes=0` : ''), [previewMode, previewSource]);

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!linkData?.senhaObrigatoria) return;
    const passwordHash = await hashSharePassword(password);
    const share = await fetchPublicShare(passwordHash);
    if (!share || (!share.storagePath && !share.legacyUrl)) {
      setPasswordError('Senha incorreta. Confira o código recebido e tente novamente.');
      return;
    }
    const url = await createDownloadUrl(share);
    if (!url) {
      setPasswordError('Não foi possível preparar o download. Solicite um novo link.');
      return;
    }
    setPasswordError('');
    setLinkData(share);
    setDownloadUrl(url);
    setIsUnlocked(true);
  };

  const canDownload = Boolean(downloadUrl && isUnlocked && !isExpired);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#0f172a',
        backgroundImage: `linear-gradient(rgba(10, 15, 35, 0.6), rgba(10, 15, 35, 0.72)), url(${logoImage})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '260px 260px',
      }}
    >
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
          {isLoading ? (
            <div style={{ padding: '22px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 750 }}>
              Carregando arquivo compartilhado...
            </div>
          ) : !linkData ? (
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

              <section style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(220px, 1fr)', gap: '14px' }}>
                <div
                  style={{
                    position: 'relative',
                    minHeight: '280px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundImage: `linear-gradient(140deg, rgba(15, 23, 42, 0.04), rgba(255, 255, 255, 0.86))`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '150px',
                      height: '150px',
                      backgroundImage: `url(${logoImage})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      opacity: 0.08,
                      pointerEvents: 'none',
                    }}
                  />
                  <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
                    {previewMode === 'pdf' && previewImage && (
                      <iframe
                        src={previewImage}
                        title={linkData.documento}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                    )}
                    {previewMode === 'image' && previewSource && (
                      <img
                        src={previewSource}
                        alt={linkData.documento}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0f172a', display: 'block' }}
                      />
                    )}
                    {previewMode === 'generic' && (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '8px', textAlign: 'center', padding: '16px' }}>
                        <FileText size={34} />
                        <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700 }}>Prévia indisponível</p>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#ffffff' }}>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#0f172a' }}>Prévia rápida</h3>
                  <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.82rem' }}>Baixe ou visualize pelo botão abaixo.</p>
                  <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#f8fafc' }}>
                      <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Nome</span>
                      <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#0f172a', wordBreak: 'break-word' }}>{linkData.documento}</p>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#f8fafc' }}>
                      <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Formato</span>
                      <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#0f172a' }}>{fileExt ? fileExt.toUpperCase() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </section>

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

              {!isExpired && linkData.senhaObrigatoria && !isUnlocked && (
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
                  href={canDownload ? downloadUrl || undefined : undefined}
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

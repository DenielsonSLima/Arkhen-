import React, { useEffect, useMemo, useState } from 'react';
import { Key, RotateCcw, Timer, X } from 'lucide-react';
import {
  formatShareDateTime,
  generateSharePassword,
  isSharePasswordRequired,
  documentShareService,
  parseShareDurationMs,
  SHARE_EXPIRATION_OPTIONS,
  type ShareConfiguration,
} from '../services/documentShareService';

interface RenewShareModalProps {
  isOpen: boolean;
  documento: string;
  documentosCount: number;
  senhaAtual?: string;
  senhaHashAtual?: string;
  onClose: () => void;
  onRenew: (input: { tempoLimite: string; exigirSenha: boolean; senha?: string }) => void;
  isRenewing?: boolean;
}

export const RenewShareModal: React.FC<RenewShareModalProps> = ({
  isOpen,
  documento,
  documentosCount,
  senhaAtual,
  senhaHashAtual,
  onClose,
  onRenew,
  isRenewing = false,
}) => {
  const [tempoLimite, setTempoLimite] = useState<string>(() => SHARE_EXPIRATION_OPTIONS[2]);
  const [exigirSenha, setExigirSenha] = useState(() => Boolean(senhaAtual || senhaHashAtual));
  const [sharePolicy, setSharePolicy] = useState<ShareConfiguration | null>(null);
  const [senha, setSenha] = useState(() => senhaAtual || generateSharePassword());
  const [isPolicyLoading, setIsPolicyLoading] = useState(false);
  const [policyReloadKey, setPolicyReloadKey] = useState(0);
  const [policyError, setPolicyError] = useState('');

  const expirationPreview = useMemo(() => (
    formatShareDateTime(new Date(Date.now() + parseShareDurationMs(tempoLimite)))
  ), [tempoLimite]);
  const passwordRequiredByPolicy = sharePolicy
    ? isSharePasswordRequired(sharePolicy, tempoLimite)
    : false;
  const effectivePasswordProtection = exigirSenha || passwordRequiredByPolicy;

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setExigirSenha(Boolean(senhaAtual || senhaHashAtual));
    setSenha(senhaAtual || generateSharePassword());
    setSharePolicy(null);
    setPolicyError('');
    setIsPolicyLoading(true);

    documentShareService.getConfiguracaoCompartilhamento()
      .then((config) => {
        if (!mounted) return;
        setSharePolicy(config);
        setTempoLimite(config.tempoPadrao);
        setExigirSenha(Boolean(senhaAtual || senhaHashAtual)
          || isSharePasswordRequired(config, config.tempoPadrao));
      })
      .catch((error) => {
        if (!mounted) return;
        setPolicyError(error instanceof Error
          ? error.message
          : 'Não foi possível carregar as políticas de compartilhamento.');
      })
      .finally(() => {
        if (mounted) setIsPolicyLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, senhaAtual, senhaHashAtual, policyReloadKey]);

  if (!isOpen) return null;

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #d8e0ea',
    borderRadius: '8px',
    padding: '9px 11px',
    fontSize: '0.82rem',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '520px', padding: 0, overflow: 'hidden', border: '1px solid rgba(197, 146, 53, 0.46)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ background: '#0f172a', color: '#ffffff', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 850, color: '#ffffff' }}>Renovar compartilhamento</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {documentosCount > 1 ? `${documento} e mais ${documentosCount - 1} arquivo(s)` : documento}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', width: '34px', height: '34px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px', display: 'grid', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Novo prazo do link
            </label>
            <select value={tempoLimite} onChange={(event) => setTempoLimite(event.target.value)} disabled={isRenewing || isPolicyLoading || !sharePolicy} style={fieldStyle}>
              {SHARE_EXPIRATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setExigirSenha((current) => !current)}
            disabled={isRenewing || isPolicyLoading || !sharePolicy || passwordRequiredByPolicy}
            style={{ border: effectivePasswordProtection ? '1px solid #d9a441' : '1px solid #d8e0ea', background: effectivePasswordProtection ? '#fffbeb' : '#ffffff', borderRadius: '8px', padding: '11px', cursor: isRenewing || passwordRequiredByPolicy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#0f172a', opacity: isRenewing ? 0.7 : 1 }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 850, fontSize: '0.82rem' }}>
              <Key size={16} color={effectivePasswordProtection ? '#b45309' : '#94a3b8'} />
              {passwordRequiredByPolicy ? 'Senha exigida pela política' : 'Proteger com senha'}
            </span>
            <span style={{ width: '34px', height: '20px', borderRadius: '999px', background: effectivePasswordProtection ? '#d9a441' : '#cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: effectivePasswordProtection ? 'flex-end' : 'flex-start', padding: '2px', boxSizing: 'border-box' }}>
              <i style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ffffff', display: 'block' }} />
            </span>
          </button>

          {effectivePasswordProtection && (
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                Senha temporária
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={senha} onChange={(event) => setSenha(event.target.value)} disabled={isRenewing || isPolicyLoading || !sharePolicy} style={fieldStyle} />
                <button type="button" onClick={() => setSenha(generateSharePassword())} disabled={isRenewing || isPolicyLoading || !sharePolicy} style={{ border: '1px solid #d8e0ea', background: '#ffffff', borderRadius: '8px', padding: '0 10px', color: '#475569', cursor: isRenewing || isPolicyLoading || !sharePolicy ? 'not-allowed' : 'pointer', fontWeight: 800 }}>
                  Gerar
                </button>
              </div>
            </div>
          )}

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#f8fafc', color: '#64748b', fontSize: '0.76rem', lineHeight: 1.35 }}>
            <Timer size={15} style={{ color: '#b45309', verticalAlign: 'middle', marginRight: '6px' }} />
            O link voltará a ficar ativo por {tempoLimite}, até {expirationPreview}.
          </div>

          {policyError && (
            <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.76rem', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span>{policyError}</span>
              <button type="button" onClick={() => setPolicyReloadKey((current) => current + 1)} disabled={isPolicyLoading} style={{ border: '1px solid #fca5a5', background: '#ffffff', color: '#991b1b', borderRadius: '6px', padding: '6px 9px', cursor: isPolicyLoading ? 'not-allowed' : 'pointer', fontWeight: 800 }}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 18px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} disabled={isRenewing} style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '8px', padding: '8px 12px', cursor: isRenewing ? 'not-allowed' : 'pointer', fontWeight: 800 }}>
            Cancelar
          </button>
          <button type="button" onClick={() => onRenew({ tempoLimite, exigirSenha: effectivePasswordProtection, senha })} disabled={isRenewing || isPolicyLoading || !sharePolicy} style={{ border: 'none', background: 'var(--color-gold-gradient)', color: '#ffffff', borderRadius: '8px', padding: '8px 14px', cursor: isRenewing || isPolicyLoading || !sharePolicy ? 'not-allowed' : 'pointer', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: '7px', opacity: isRenewing || isPolicyLoading || !sharePolicy ? 0.72 : 1 }}>
            <RotateCcw size={15} />
            {isPolicyLoading ? 'Carregando políticas...' : isRenewing ? 'Renovando...' : 'Renovar link'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Key, RotateCcw, Timer, X } from 'lucide-react';
import {
  DEFAULT_SHARE_PASSWORD,
  formatShareDateTime,
  generateSharePassword,
  parseShareDurationMs,
  SHARE_EXPIRATION_OPTIONS,
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
  const [tempoLimite, setTempoLimite] = useState(() => localStorage.getItem('cfg_share_tempo_padrao') || '3 horas');
  const [exigirSenha, setExigirSenha] = useState(() => Boolean(senhaAtual || senhaHashAtual));
  const [senha, setSenha] = useState(() => senhaAtual || DEFAULT_SHARE_PASSWORD);

  const expirationPreview = useMemo(() => (
    formatShareDateTime(new Date(Date.now() + parseShareDurationMs(tempoLimite)))
  ), [tempoLimite]);

  useEffect(() => {
    if (!isOpen) return;
    setTempoLimite(localStorage.getItem('cfg_share_tempo_padrao') || '3 horas');
    setExigirSenha(Boolean(senhaAtual || senhaHashAtual));
    setSenha(senhaAtual || DEFAULT_SHARE_PASSWORD);
  }, [isOpen, senhaAtual, senhaHashAtual]);

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
            <select value={tempoLimite} onChange={(event) => setTempoLimite(event.target.value)} disabled={isRenewing} style={fieldStyle}>
              {SHARE_EXPIRATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setExigirSenha((current) => !current)}
            disabled={isRenewing}
            style={{ border: exigirSenha ? '1px solid #d9a441' : '1px solid #d8e0ea', background: exigirSenha ? '#fffbeb' : '#ffffff', borderRadius: '8px', padding: '11px', cursor: isRenewing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#0f172a', opacity: isRenewing ? 0.7 : 1 }}
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
                <input value={senha} onChange={(event) => setSenha(event.target.value)} disabled={isRenewing} style={fieldStyle} />
                <button type="button" onClick={() => setSenha(generateSharePassword())} disabled={isRenewing} style={{ border: '1px solid #d8e0ea', background: '#ffffff', borderRadius: '8px', padding: '0 10px', color: '#475569', cursor: isRenewing ? 'not-allowed' : 'pointer', fontWeight: 800 }}>
                  Gerar
                </button>
              </div>
            </div>
          )}

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#f8fafc', color: '#64748b', fontSize: '0.76rem', lineHeight: 1.35 }}>
            <Timer size={15} style={{ color: '#b45309', verticalAlign: 'middle', marginRight: '6px' }} />
            O link voltará a ficar ativo por {tempoLimite}, até {expirationPreview}.
          </div>
        </div>

        <div style={{ padding: '14px 18px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} disabled={isRenewing} style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '8px', padding: '8px 12px', cursor: isRenewing ? 'not-allowed' : 'pointer', fontWeight: 800 }}>
            Cancelar
          </button>
          <button type="button" onClick={() => onRenew({ tempoLimite, exigirSenha, senha })} disabled={isRenewing} style={{ border: 'none', background: 'var(--color-gold-gradient)', color: '#ffffff', borderRadius: '8px', padding: '8px 14px', cursor: isRenewing ? 'not-allowed' : 'pointer', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: '7px', opacity: isRenewing ? 0.72 : 1 }}>
            <RotateCcw size={15} />
            {isRenewing ? 'Renovando...' : 'Renovar link'}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, User } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';

interface ResumoAuditoriaTabProps {
  selectedGroup: CompanyActivityGroup;
  competencia: string;
  fechamentoMeta: { finalizado: boolean; dataHora: string; usuario: string } | null;
  handleSaveFechamentoMeta: (meta: { finalizado: boolean; dataHora: string; usuario: string }) => Promise<void>;
  getActivityIcon: (modeloId: string, status: string, size?: number) => React.ReactNode;
  onSelectTab: (modeloId: string) => void;
}

export const ResumoAuditoriaTab: React.FC<ResumoAuditoriaTabProps> = ({
  selectedGroup,
  competencia,
  fechamentoMeta,
  handleSaveFechamentoMeta,
  getActivityIcon,
  onSelectTab,
}) => {
  // Audit form states
  const [auditFinalizado, setAuditFinalizado] = useState(false);
  const [auditDataHora, setAuditDataHora] = useState('');
  const [auditUsuario, setAuditUsuario] = useState('');
  const [auditSuccessMsg, setAuditSuccessMsg] = useState(false);

  // Synchronize audit states when metadata is loaded
  useEffect(() => {
    if (fechamentoMeta) {
      setAuditFinalizado(fechamentoMeta.finalizado || false);
      setAuditDataHora(fechamentoMeta.dataHora || new Date().toISOString().slice(0, 16));
      setAuditUsuario(fechamentoMeta.usuario || '');
    }
  }, [fechamentoMeta, selectedGroup]);

  const handleSaveAudit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveFechamentoMeta({
      finalizado: auditFinalizado,
      dataHora: auditDataHora,
      usuario: auditUsuario,
    });
    setAuditSuccessMsg(true);
    setTimeout(() => setAuditSuccessMsg(false), 3000);
  };

  const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    try {
      const date = new Date(dtStr);
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return dtStr;
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: '20px',
      alignItems: 'start'
    }}>
      {/* Left Column: Resumo das Obrigações */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Resumo das Obrigações</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedGroup.atividades.map((atv) => (
            <div
              key={atv.instanciaId}
              onClick={() => onSelectTab(atv.modeloId)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = 'var(--color-gold-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={`Ver checklist de ${atv.modeloNome}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getActivityIcon(atv.modeloId, atv.status, 16)}
                <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem' }}>{atv.modeloNome}</span>
              </div>
              <span className={`table-badge ${atv.status === 'Concluída' ? 'badge-status-concl' : atv.status === 'Em andamento' ? 'badge-status-and' : 'badge-status-p'}`} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>
                {atv.status} ({atv.progresso}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Auditoria de Fechamento */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck style={{ color: 'var(--color-gold-primary)' }} />
          Auditoria de Fechamento Geral
        </h3>
        <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '16px' }}>
          Registre e valide a finalização de todas as obrigações da competência com controle de data, hora e responsável.
        </p>

        {auditSuccessMsg && (
          <div className="success-banner animate-fade-in" style={{ marginBottom: '16px', padding: '10px 14px' }}>
            <CheckCircle2 size={16} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
            Dados de auditoria salvos com sucesso!
          </div>
        )}

        <form onSubmit={handleSaveAudit} className="config-form" style={{ padding: 0, margin: 0, border: 'none', background: 'none' }}>
          {/* Status checkbox */}
          <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={auditFinalizado}
                onChange={(e) => setAuditFinalizado(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--color-gold-primary)' }}
              />
              Finalizar e Homologar Fechamento da Competência ({competencia})
            </label>
          </div>

          <div className="form-row-grid">
            {/* Date & Time */}
            <div className="form-item-group">
              <label style={{ color: '#334155', fontWeight: 600, fontSize: '0.75rem' }}>
                <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
                Data e Hora do Fechamento
              </label>
              <input
                type="datetime-local"
                required
                value={auditDataHora}
                onChange={(e) => setAuditDataHora(e.target.value)}
                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem' }}
              />
            </div>

            {/* User Executor */}
            <div className="form-item-group">
              <label style={{ color: '#334155', fontWeight: 600, fontSize: '0.75rem' }}>
                <User size={12} style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline' }} />
                Usuário Executor (Responsável)
              </label>
              <input
                type="text"
                value={auditUsuario}
                onChange={(e) => setAuditUsuario(e.target.value)}
                placeholder="Responsável pelo fechamento"
                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-invite" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> Salvar Auditoria Contábil
          </button>
        </form>

        {/* Saved Audit info stamp */}
        {fechamentoMeta?.finalizado && (
          <div style={{ marginTop: '20px', borderTop: '1px dashed #e2e8f0', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '1.5rem' }}>🛡️</div>
            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              Fechamento contábil homologado por <strong style={{ color: '#0f172a' }}>{fechamentoMeta.usuario}</strong> em <strong style={{ color: '#0f172a' }}>{formatDateTime(fechamentoMeta.dataHora)}</strong>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { BankEnvironment } from '../../../gateway/bankGateway';

export type SecretState = 'configured' | 'pending' | 'removing';

export const environmentLabel: Record<BankEnvironment, string> = {
  producao: 'Produção',
  homologacao: 'Homologação',
};

export const environmentTone: Record<BankEnvironment, { label: string; color: string; bg: string; border: string }> = {
  producao: {
    label: 'Ambiente real',
    color: '#b91c1c',
    bg: '#fff1f2',
    border: '#fecaca',
  },
  homologacao: {
    label: 'Sandbox de testes',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
};

export const maskedSecret = '••••••••••••••••••••••••';

export const panelStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  background: '#ffffff',
  padding: '18px',
};

export const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
};

export const iconBoxStyle = (color: string, bg = '#f8fafc'): React.CSSProperties => ({
  width: '36px',
  height: '36px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '10px',
  background: bg,
  color,
  flexShrink: 0,
});

export const buttonStyle = (tone: 'danger' | 'undo' | 'neutral' = 'neutral'): React.CSSProperties => {
  const map = {
    danger: { border: '#fecaca', bg: '#fff1f2', color: '#991b1b' },
    undo: { border: '#bfdbfe', bg: '#eff6ff', color: '#1d4ed8' },
    neutral: { border: '#cbd5e1', bg: '#ffffff', color: '#334155' },
  }[tone];

  return {
    border: `1px solid ${map.border}`,
    background: map.bg,
    color: map.color,
    borderRadius: '8px',
    padding: '8px 11px',
    fontSize: '0.76rem',
    fontWeight: 850,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  };
};

export const getSecretState = (configured: boolean, typedValue: string, removing: boolean): SecretState => {
  if (removing) return 'removing';
  if (configured || typedValue.trim()) return 'configured';
  return 'pending';
};

const secretStatusMeta: Record<SecretState, { label: string; color: string; bg: string; border: string }> = {
  configured: { label: 'Configurada', color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  pending: { label: 'Pendente', color: '#991b1b', bg: '#fff1f2', border: '#fecaca' },
  removing: { label: 'Remover ao salvar', color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
};

export const SecretStatus: React.FC<{ state: SecretState }> = ({ state }) => {
  const meta = secretStatusMeta[state];
  const Icon = state === 'pending' ? AlertCircle : CheckCircle2;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      border: `1px solid ${meta.border}`,
      background: meta.bg,
      color: meta.color,
      borderRadius: '999px',
      padding: '5px 9px',
      fontSize: '0.72rem',
      fontWeight: 850,
    }}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
};

export const secretInputStyle = (state: SecretState): React.CSSProperties => {
  const meta = secretStatusMeta[state];
  return {
    borderColor: meta.border,
    background: meta.bg,
    color: meta.color,
    fontWeight: 800,
    width: '100%',
    boxSizing: 'border-box',
    paddingRight: '42px',
  };
};

export const secretIconColor = (state: SecretState) => (
  state === 'pending' ? '#dc2626' : state === 'removing' ? '#d97706' : '#16a34a'
);

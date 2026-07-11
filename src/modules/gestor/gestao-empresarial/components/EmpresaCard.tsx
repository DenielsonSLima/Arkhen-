import React, { useMemo } from 'react';
import { Users, Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';

interface EmpresaCardProps {
  company: Company;
  onSelect: (id: string) => void;
}

export const EmpresaCard: React.FC<EmpresaCardProps> = ({ company, onSelect }) => {
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRegimeClass = (regime: string) => {
    switch (regime) {
      case 'PF': return 'pf';
      case 'MEI': return 'mei';
      case 'Simples Nacional': return 'simples';
      case 'Lucro Presumido': return 'presumido';
      case 'Lucro Real': return 'real';
      case 'Isenta': return 'isenta';
      default: return '';
    }
  };

  const isAtiva = company.status === 'Ativa';

  // Certificate status
  const certStatus = useMemo(() => {
    const certs = company.certificados || [];
    if (certs.length === 0) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let minDias = Infinity;
    for (const c of certs) {
      const val = new Date(c.dataValidade + 'T00:00:00');
      const dias = Math.round((val.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (dias < minDias) minDias = dias;
    }
    if (minDias < 0) return { label: 'Cert. Vencido', color: '#ef4444' };
    if (minDias <= 15) return { label: `Cert. vence em ${minDias}d`, color: '#f97316' };
    return { label: 'Cert. Válido', color: '#22c55e' };
  }, [company.certificados]);

  // Get short address (street name + number or city name)
  const getShortAddress = (fullAddr: string) => {
    if (!fullAddr) return '-';
    // If it contains a dash, return the first part or city
    const parts = fullAddr.split(' - ');
    return parts[0];
  };

  return (
    <div className="company-card animate-fade-in" onClick={() => onSelect(company.id)}>
      <div className="company-card-header">
        <div className="company-logo-avatar">
          {company.logo ? (
            <img src={company.logo} alt={company.nome} className="company-logo-img" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
          ) : (
            <span>{getInitials(company.nome)}</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span className={`regime-badge ${getRegimeClass(company.tipo)}`}>
            {company.tipo}
          </span>
          <span className={`estab-badge ${company.tipoEstabelecimento.toLowerCase()}`}>
            {company.tipoEstabelecimento}
          </span>
        </div>
      </div>

      <div className="company-card-info" style={{ marginBottom: '4px' }}>
        <h3>{company.nome}</h3>
        <p style={{ fontSize: '0.74rem', color: 'var(--color-text-dark-muted)', fontWeight: 600 }}>{company.cnpj}</p>
      </div>

      {/* Contact and Address Details */}
      <div className="company-card-details" style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px', paddingBottom: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={13} style={{ color: 'var(--color-gold-primary)', flexShrink: 0 }} />
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{company.email}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Phone size={13} style={{ color: 'var(--color-gold-primary)', flexShrink: 0 }} />
          <span>{company.telefone}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={13} style={{ color: 'var(--color-gold-primary)', flexShrink: 0 }} />
          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={company.endereco}>
            {getShortAddress(company.endereco)}
          </span>
        </div>
      </div>

      <div className="company-card-footer" style={{ marginTop: 'auto' }}>
        <div className="company-card-stats">
          <Users size={14} style={{ marginRight: '4px' }} />
          <span>
            {company.funcionariosCount === 1
              ? '1 Colaborador'
              : `${company.funcionariosCount} Colaboradores`}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {certStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 700, color: certStatus.color }}>
              <ShieldCheck size={12} />
              {certStatus.label}
            </div>
          )}
          <div className={`status-indicator ${isAtiva ? 'ativa' : 'inativa'}`}>
            <span className="status-dot"></span>
            <span>{company.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

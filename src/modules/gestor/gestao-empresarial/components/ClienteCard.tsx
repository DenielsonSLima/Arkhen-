import React from 'react';
import { Building2, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { normalizeCatalogLabel } from '../../shared/catalogLabel';
import type { Company } from '../services/gestaoEmpresarialService';
import { getEffectiveTaxRegime } from '../services/taxRegime';

interface ClienteCardProps {
  company: Company;
  isAccountingClient: boolean;
  onSelect: (id: string) => void;
  onEdit: (event: React.MouseEvent, company: Company) => void;
  onToggleStatus: (company: Company) => void;
  onDelete: (id: string) => void;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (!name) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const logoFrameStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  minWidth: 44,
  maxWidth: 44,
  minHeight: 44,
  maxHeight: 44,
  flex: '0 0 44px',
  overflow: 'hidden',
};

const logoImageStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  maxWidth: 44,
  maxHeight: 44,
  objectFit: 'contain',
};

const getRegimeClass = (regime: string) => {
  if (regime === 'Simples Nacional') return 'simples';
  if (regime === 'Lucro Presumido') return 'presumido';
  if (regime === 'Lucro Real') return 'real';
  if (regime === 'PF') return 'pf';
  if (regime === 'Isenta') return 'isenta';
  return '';
};

export const ClienteCard: React.FC<ClienteCardProps> = ({
  company,
  isAccountingClient,
  onSelect,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  const isAtiva = company.status === 'Ativa';
  const effectiveTaxRegime = getEffectiveTaxRegime(company.tipo);

  return (
    <div className="company-card" onClick={() => onSelect(company.id)}>
      <div className="company-card-header">
        <div className="company-logo-avatar" style={logoFrameStyle}>
          {company.logo ? (
            <img
              src={company.logo}
              alt={company.nome}
              className="company-logo-img"
              width={44}
              height={44}
              style={logoImageStyle}
            />
          ) : (
            <span>{getInitials(company.nome)}</span>
          )}
        </div>
        <span className={`regime-badge ${getRegimeClass(effectiveTaxRegime)}`}>
          {normalizeCatalogLabel(effectiveTaxRegime)}
        </span>
      </div>
      
      <div className="company-card-info">
        <h3>{company.nome}</h3>
        <p>{company.razaoSocial}</p>
        <p style={{ fontWeight: 700 }}>{company.cnpj}</p>
      </div>
      
      <div className="company-card-details">
        <span><strong>Cidade/UF:</strong> {company.cidade || '-'}{company.uf ? `/${company.uf}` : ''}</span>
        <span><strong>Endereço:</strong> {company.endereco || '-'}</span>
        <span><strong>CEP:</strong> {company.cep || '-'}</span>
        <span><strong>IE/IM:</strong> {company.inscricaoEstadual || '-'}</span>
        <span><strong>Email:</strong> {company.email || '-'}</span>
        <span><strong>Telefone:</strong> {company.telefone || '-'}</span>
        {isAccountingClient && (
          <span><strong>Categoria do cliente:</strong> {normalizeCatalogLabel(company.categoriaCliente || 'Sem categoria')}</span>
        )}
      </div>
      
      <div className="company-card-footer" onClick={(event) => event.stopPropagation()}>
        <span className="company-card-branches">
          <Building2 size={14} /> {company.polos?.length || 0} filiais
        </span>
        <div className="company-card-actions" role="group" aria-label={`Ações de ${company.nome}`}>
          <button
            type="button"
            className="company-card-action-button"
            onClick={(event) => onEdit(event, company)}
            title="Editar parceiro"
            aria-label={`Editar ${company.nome}`}
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            className="company-card-action-button"
            onClick={() => onToggleStatus(company)}
            title={isAtiva ? 'Inativar parceiro' : 'Ativar parceiro'}
            aria-label={`${isAtiva ? 'Inativar' : 'Ativar'} ${company.nome}`}
          >
            {company.status === 'Inativa' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          </button>
          <button
            type="button"
            className="company-card-action-button company-card-action-button--delete"
            onClick={() => onDelete(company.id)}
            title="Excluir parceiro"
            aria-label={`Excluir ${company.nome}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

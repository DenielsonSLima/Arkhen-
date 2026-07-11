import React from 'react';
import { Building2, Edit3, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';

interface ClienteCardProps {
  company: Company;
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

const getRegimeClass = (regime: string) => {
  if (regime === 'MEI') return 'mei';
  if (regime === 'Simples Nacional') return 'simples';
  if (regime === 'Lucro Presumido') return 'presumido';
  if (regime === 'Lucro Real') return 'real';
  if (regime === 'PF') return 'pf';
  if (regime === 'Isenta') return 'isenta';
  return '';
};

export const ClienteCard: React.FC<ClienteCardProps> = ({
  company,
  onSelect,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  const isAtiva = company.status === 'Ativa';

  return (
    <div className="company-card" onClick={() => onSelect(company.id)}>
      <div className="company-card-header">
        <div className="company-logo-avatar">
          {company.logo ? (
            <img src={company.logo} alt={company.nome} className="company-logo-img" />
          ) : (
            <span>{getInitials(company.nome)}</span>
          )}
        </div>
        <span className={`regime-badge ${getRegimeClass(company.tipo)}`}>{company.tipo}</span>
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
        <span><strong>Tipo:</strong> {company.categoriaCliente || 'Cliente Contábil'}</span>
      </div>
      
      <div className="company-card-footer" onClick={(event) => event.stopPropagation()}>
        <span><Building2 size={14} /> {company.polos?.length || 0} filiais</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn-icon-table" onClick={(event) => onEdit(event, company)} title="Editar Cliente">
            <Edit3 size={14} />
          </button>
          <button className="btn-icon-table" onClick={() => onToggleStatus(company)} title={isAtiva ? 'Inativar Cliente' : 'Ativar Cliente'}>
            {company.status === 'Inativa' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          </button>
          <button className="btn-icon-table delete" onClick={() => onDelete(company.id)} title="Excluir Cliente">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

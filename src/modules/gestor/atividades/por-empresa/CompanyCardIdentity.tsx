import React from 'react';
import './CompanyCardIdentity.css';

interface CompanyCardIdentityProps {
  name: string;
  cnpj: string;
  regime: string;
  tipoEstabelecimento: string;
  logo?: string;
}

const isRealLogo = (logo: string | undefined): boolean => {
  if (!logo) return false;
  const trimmed = logo.trim();
  return trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
};

const getInitials = (name: string) => {
  const initials = name
    .split(' ')
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

  return initials || name.slice(0, 2).toUpperCase() || 'CO';
};

const getRegimeClass = (regime: string) => {
  if (regime === 'MEI') return 'mei';
  if (regime === 'Simples Nacional') return 'simples';
  if (regime === 'Lucro Presumido') return 'lucro-presumido';
  if (regime === 'Lucro Real') return 'lucro-real';
  if (regime === 'PF') return 'pf';
  if (regime === 'Isenta' || regime === 'Isento') return 'isenta';
  return 'default';
};

const getEstabelecimentoClass = (tipoEstabelecimento: string) => (
  tipoEstabelecimento.toLowerCase() === 'filial' ? 'filial' : 'matriz'
);

export const CompanyCardIdentity: React.FC<CompanyCardIdentityProps> = ({
  name,
  cnpj,
  regime,
  tipoEstabelecimento,
  logo,
}) => {
  const regimeClass = getRegimeClass(regime);
  const estabelecimentoClass = getEstabelecimentoClass(tipoEstabelecimento);

  return (
    <div className={`company-card-identity regime-${regimeClass}`}>
      {isRealLogo(logo) ? (
        <img className="company-card-identity-logo" src={logo} alt={name} />
      ) : (
        <span className="company-card-identity-initials">{getInitials(name)}</span>
      )}

      <div className="company-card-identity-title">
        <h4>{name}</h4>
        <p>{cnpj || 'CNPJ nao informado'}</p>
        <div className="company-card-identity-badges">
          <span className={`company-card-regime-badge ${regimeClass}`}>{regime}</span>
          <span className={`company-card-establishment-badge ${estabelecimentoClass}`}>
            {tipoEstabelecimento || 'Matriz'}
          </span>
        </div>
      </div>
    </div>
  );
};

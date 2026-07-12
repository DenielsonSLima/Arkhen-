/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState, type ChangeEvent, type FocusEvent, type ReactNode } from 'react';
import { Building2, Check, Landmark, Search } from 'lucide-react';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const formatCurrencyInput = (value: string) => {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatPercentInput = (value: string) => {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const parseCurrencyInput = (value: string) => Number(onlyDigits(value)) / 100 || 0;

export const parsePercentInput = (value: string) => Number(onlyDigits(value)) / 100 || 0;

export const formatBillingDocument = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value || 'Documento nao informado';
};

export const getBillingInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const getBillingClientName = (cliente: Company) => cliente.razaoSocial || cliente.nome || 'Parceiro sem nome';

export const getBillingClientMeta = (cliente: Company) => {
  const tags = [
    cliente.cnpj ? `CNPJ ${formatBillingDocument(cliente.cnpj)}` : 'CNPJ nao informado',
    cliente.tipoEstabelecimento || 'Unidade nao informada',
    cliente.tipo || 'Regime nao informado',
    cliente.categoriaCliente || '',
  ].filter(Boolean);
  return tags.join(' • ');
};

interface BillingInputFrameProps {
  icon: ReactNode;
  children: ReactNode;
}

export const BillingInputFrame = ({ icon, children }: BillingInputFrameProps) => (
  <div className="faturamento-input-with-icon">
    {icon}
    {children}
  </div>
);

interface BillingSectionTitleProps {
  title: string;
  description: string;
}

export const BillingSectionTitle = ({ title, description }: BillingSectionTitleProps) => (
  <div className="faturamento-form-section-title" style={{ gridColumn: '1 / -1' }}>
    <strong>{title}</strong>
    <span>{description}</span>
  </div>
);

interface BillingClientContextProps {
  cliente?: Company;
}

export const BillingClientContext = ({ cliente }: BillingClientContextProps) => {
  if (!cliente) return null;

  const unidade = cliente.tipoEstabelecimento === 'Matriz' ? 'Matriz' : 'Polo';

  return (
    <div className="faturamento-client-context">
      <div className="faturamento-client-context-main">
        <span className="faturamento-client-avatar">
          {getBillingInitials(cliente.nome)}
        </span>
        <div>
          <strong>{cliente.razaoSocial || cliente.nome}</strong>
          <span>CNPJ {formatBillingDocument(cliente.cnpj)}</span>
        </div>
      </div>
      <div className="faturamento-client-context-meta">
        <span>
          <Building2 size={15} />
          <small>Unidade</small>
          <strong>{unidade}</strong>
        </span>
        <span>
          <Landmark size={15} />
          <small>Regime</small>
          <strong>{cliente.tipo}</strong>
        </span>
      </div>
    </div>
  );
};

interface BillingClientSelectProps {
  clientes: Company[];
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
}

export const BillingClientSelect = ({ clientes, value, onChange, isLoading }: BillingClientSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedCliente = useMemo(
    () => clientes.find((cliente) => cliente.id === value),
    [clientes, value],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredClientes = useMemo(() => {
    if (!normalizedSearch) return clientes;
    const searchDigits = onlyDigits(normalizedSearch);
    return clientes.filter((cliente) => {
      const haystack = [
        cliente.nome,
        cliente.razaoSocial,
        cliente.cnpj,
        cliente.tipoEstabelecimento,
        cliente.tipo,
        cliente.categoriaCliente,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch) || (searchDigits && onlyDigits(cliente.cnpj).includes(searchDigits));
    });
  }, [clientes, normalizedSearch]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  };

  const selectCliente = (clienteId: string) => {
    onChange(clienteId);
    const cliente = clientes.find((item) => item.id === clienteId);
    setSearch(cliente ? getBillingClientName(cliente) : '');
    setIsOpen(false);
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setIsOpen(true);
    if (value) onChange('');
  };

  return (
    <div className="faturamento-client-select" onBlur={handleBlur}>
      <div
        className={`faturamento-client-select-trigger ${selectedCliente ? 'has-value' : ''}`}
      >
        <span className="faturamento-client-select-avatar">
          {selectedCliente ? getBillingInitials(selectedCliente.nome || selectedCliente.razaoSocial) : <Search size={18} />}
        </span>
        <span className="faturamento-client-select-text">
          <input
            type="text"
            value={isOpen ? search : (selectedCliente ? getBillingClientName(selectedCliente) : search)}
            onChange={handleSearchChange}
            onFocus={() => {
              setSearch(selectedCliente ? getBillingClientName(selectedCliente) : search);
              setIsOpen(true);
            }}
            placeholder="Pesquisar parceiro por nome ou CNPJ..."
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="billing-client-options"
            autoComplete="off"
          />
          <small>{selectedCliente ? getBillingClientMeta(selectedCliente) : 'Nome, CNPJ, unidade e regime tributario'}</small>
        </span>
      </div>

      {isOpen && (
        <div id="billing-client-options" className="faturamento-client-options" role="listbox" tabIndex={-1}>
          {isLoading && <div className="faturamento-client-option muted">Carregando parceiros...</div>}
          {!isLoading && filteredClientes.length === 0 && <div className="faturamento-client-option muted">Nenhum parceiro encontrado.</div>}
          {!isLoading && filteredClientes.map((cliente) => (
            <button
              key={cliente.id}
              type="button"
              role="option"
              aria-selected={cliente.id === value}
              className={`faturamento-client-option ${cliente.id === value ? 'active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCliente(cliente.id)}
            >
              <span className="faturamento-client-option-avatar">{getBillingInitials(cliente.nome || cliente.razaoSocial)}</span>
              <span className="faturamento-client-option-text">
                <strong>{getBillingClientName(cliente)}</strong>
                <small>{getBillingClientMeta(cliente)}</small>
              </span>
              {cliente.id === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

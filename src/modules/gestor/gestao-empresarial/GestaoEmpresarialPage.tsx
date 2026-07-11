import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Edit3, LayoutGrid, Loader2, Plus, Search, ShieldAlert, Table } from 'lucide-react';
import { useGestaoEmpresarial } from './hooks/useGestaoEmpresarial';
import type { EmpresaDetailTab } from './hooks/useGestaoEmpresarial';
import type { Company } from './services/gestaoEmpresarialService';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import { SystemQuickModal } from '../components/SystemQuickModal';
import { ClienteDetail } from './components/ClienteDetail';
import { ClienteCard } from './components/ClienteCard';
import { ClienteAddForm } from './forms/ClienteAddForm';
import './GestaoEmpresarial.css';
import './GestaoEmpresarialLayoutFixes.css';
import '../shared/RegimeBadges.css';

interface GestaoEmpresarialPageProps {
  initialCompanyId?: string;
  initialDetailTab?: EmpresaDetailTab;
  onViewContextChange?: (context: InternalTabContext) => void;
}

const getRegimeClass = (regime: string) => {
  if (regime === 'MEI') return 'mei';
  if (regime === 'Simples Nacional') return 'simples';
  if (regime === 'Lucro Presumido') return 'presumido';
  if (regime === 'Lucro Real') return 'real';
  if (regime === 'PF') return 'pf';
  if (regime === 'Isenta') return 'isenta';
  return '';
};

export const GestaoEmpresarialPage: React.FC<GestaoEmpresarialPageProps> = ({
  initialCompanyId,
  initialDetailTab,
  onViewContextChange,
}) => {
  const [clienteToDelete, setClienteToDelete] = useState<Company | null>(null);
  const {
    filteredCompanies,
    searchQuery,
    setSearchQuery,
    selectedRegime,
    setSelectedRegime,
    activeStatusTab,
    setActiveStatusTab,
    viewMode,
    setViewMode,
    showFormModal,
    setShowFormModal,
    isSaving,
    successMsg,
    selectedCompany,
    setSelectedCompanyId,
    updateCompany,
    saveCompany,
    inativarCompany,
    reativarCompany,
    deleteCompany,
    searchCNPJ,
    activeDetailTab,
    isLoading,
  } = useGestaoEmpresarial({ initialCompanyId, initialDetailTab });

  useEffect(() => {
    if (isLoading) return; // Evita sobrescrever o contexto da aba com undefined durante o carregamento inicial
    onViewContextChange?.({
      titleSuffix: selectedCompany?.nome,
      data: { selectedCompanyId: selectedCompany?.id, activeDetailTab },
    });
  }, [activeDetailTab, onViewContextChange, selectedCompany, isLoading]);

  const orderedRegimes = ['Lucro Real', 'Lucro Presumido', 'Simples Nacional', 'MEI', 'PF', 'Isenta'] as const;

  const groupedCompanies = useMemo(() => {
    return filteredCompanies.reduce<Record<string, Company[]>>((acc, company) => {
      acc[company.tipo] = [...(acc[company.tipo] || []), company];
      return acc;
    }, {});
  }, [filteredCompanies]);

  const openAdd = () => {
    setShowFormModal(true);
  };

  const openEdit = (event: React.MouseEvent, company: Company) => {
    event.stopPropagation();
    setSelectedCompanyId(company.id);
  };

  const toggleCompanyStatus = (company: Company) => {
    if (company.status === 'Inativa') {
      reativarCompany(company.id);
      return;
    }
    inativarCompany(company.id);
  };

  const confirmDeleteCompany = async () => {
    if (!clienteToDelete) return;
    await deleteCompany(clienteToDelete.id);
    setClienteToDelete(null);
  };

  const hasNoResults = filteredCompanies.length === 0;

  if (selectedCompany) {
    return (
      <ClienteDetail
        company={selectedCompany}
        onBack={() => setSelectedCompanyId(null)}
        onUpdateCompany={updateCompany}
        onToggleStatus={toggleCompanyStatus}
      />
    );
  }

  const regimes = ['Todos', 'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'];

  return (
    <div className="gestao-empresarial-container animate-fade-in">
      <div className="gestao-empresarial-header-row">
        <div className="gestao-empresarial-title">
          <h1>Clientes</h1>
          <p>Cadastre clientes, consulte CNPJ, classifique regime, adicione logo e gerencie filiais.</p>
        </div>
        <button className="btn-add-user" onClick={openAdd}>
          <Plus size={16} /> Adicionar Cliente
        </button>
      </div>

      {successMsg && <div className="success-banner"><CheckCircle2 size={16} style={{ marginRight: 8 }} />{successMsg}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button className={`btn-filter-tab ${activeStatusTab === 'Ativos' ? 'active' : ''}`} onClick={() => setActiveStatusTab('Ativos')}>
          <CheckCircle2 size={14} /> Ativos
        </button>
        <button className={`btn-filter-tab ${activeStatusTab === 'Inativos' ? 'active' : ''}`} onClick={() => setActiveStatusTab('Inativos')}>
          <ShieldAlert size={14} /> Inativos
        </button>
      </div>

      <div className="gestao-controls-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input type="text" placeholder="Buscar por cliente, razão social ou CNPJ..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>
        <div className="category-filter-tabs">
          {regimes.map((regime) => (
            <button key={regime} className={`btn-filter-tab ${selectedRegime === regime ? 'active' : ''}`} onClick={() => setSelectedRegime(regime)}>
              {regime}
            </button>
          ))}
        </div>
        <div className="view-mode-toggles">
          <button className={`btn-view-toggle ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}><LayoutGrid size={18} /></button>
          <button className={`btn-view-toggle ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}><Table size={18} /></button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 className="animate-spin" /></div>
      ) : hasNoResults ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '56px 24px', color: '#111827', fontWeight: 700 }}>
          <Building2 size={22} />
          <span>Nenhum cliente cadastrado</span>
        </div>
      ) : viewMode === 'table' ? (
        <div className="table-responsive">
          <table className="config-table">
            <thead><tr><th>Cliente</th><th>CNPJ</th><th>Tipo</th><th>Cidade/UF</th><th>Contato</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>{filteredCompanies.map((company) => (
              <tr key={company.id} onClick={() => setSelectedCompanyId(company.id)} style={{ cursor: 'pointer' }}>
                <td><strong>{company.nome}</strong><br /><small>{company.razaoSocial}</small></td>
                <td>{company.cnpj}</td>
                <td><span className={`regime-badge ${getRegimeClass(company.tipo)}`}>{company.tipo}</span></td>
                <td>{company.cidade || '-'}{company.uf ? `/${company.uf}` : ''}</td>
                <td>{company.email || company.telefone || '-'}</td>
                <td>{company.status}</td>
                <td><button className="btn-icon-table" onClick={(event) => openEdit(event, company)}><Edit3 size={14} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="companies-regime-groups animate-fade-in">
          {orderedRegimes.map((regime) => {
            const companiesInRegime = groupedCompanies[regime];
            if (!companiesInRegime || companiesInRegime.length === 0) return null;

            return (
              <section key={regime} className="companies-regime-section">
                <h2 className="companies-regime-title">
                  {regime}
                  <span>
                    {companiesInRegime.length} {companiesInRegime.length === 1 ? 'cliente' : 'clientes'}
                  </span>
                </h2>
                <div className="companies-cards-grid">
                  {companiesInRegime.map((company) => (
                    <ClienteCard
                      key={company.id}
                      company={company}
                      onSelect={setSelectedCompanyId}
                      onEdit={openEdit}
                      onToggleStatus={(c) => c.status === 'Inativa' ? reativarCompany(c.id) : inativarCompany(c.id)}
                      onDelete={() => setClienteToDelete(company)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showFormModal && (
        <div 
          className="modal-overlay-custom" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            overflowY: 'auto'
          }}
          onClick={() => setShowFormModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '900px' }}>
            <ClienteAddForm
              onSave={saveCompany}
              onCancel={() => setShowFormModal(false)}
              onSearchCNPJ={searchCNPJ}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}

      <SystemQuickModal
        isOpen={!!clienteToDelete}
        title="Excluir Cliente"
        message={`Tem certeza de que deseja excluir o cliente "${clienteToDelete?.nome || ''}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmDeleteCompany}
        onClose={() => setClienteToDelete(null)}
      />
    </div>
  );
};

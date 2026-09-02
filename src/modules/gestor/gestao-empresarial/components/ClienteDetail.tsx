import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Camera,
  Edit3,
  FileText,
  FileCheck,
  Mail,
  MapPin,
  Phone,
  Search,
  Plus,
  ToggleLeft,
  ToggleRight,
  User,
} from 'lucide-react';
import type { ClientBranch, Company } from '../services/gestaoEmpresarialService';
import { cnpjLookupService } from '../services/cnpjLookupService';
import { ClienteEditForm } from '../forms/ClienteEditForm';
import { ClienteDetailData } from './ClienteDetailData';
import { FilialForm } from '../forms/FilialForm';
import { TabProtocolosEntregas } from './TabProtocolosEntregas';
import { uploadImageAsset } from '../../shared/uploadImageAsset';
import { normalizeCatalogLabel } from '../../shared/catalogLabel';
import { getEffectiveTaxRegime } from '../services/taxRegime';
import { isValidCnpj } from '../services/cnpjDocument';
import './ClienteDetail.css';

interface ClienteDetailProps {
  company: Company;
  isAccountingClient: boolean;
  onBack: () => void;
  onUpdateCompany: (company: Company) => Promise<void>;
  onToggleStatus: (company: Company) => void;
  onSyncCnae: (company: Company) => Promise<void>;
  onSaveBranch: (branch: ClientBranch) => Promise<void>;
  onDefineBranchStatus: (branch: ClientBranch, status: 'Ativa' | 'Inativa') => Promise<void>;
  isSavingBranch?: boolean;
}

type DetailTab = 'dados' | 'filiais' | 'protocolos';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const ClienteDetail: React.FC<ClienteDetailProps> = ({
  company,
  isAccountingClient,
  onBack,
  onUpdateCompany,
  onToggleStatus,
  onSyncCnae,
  onSaveBranch,
  onDefineBranchStatus,
  isSavingBranch = false,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('dados');
  const [isEditing, setIsEditing] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClientBranch | null>(null);
  const [branchActionError, setBranchActionError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [cnaeSyncMsg, setCnaeSyncMsg] = useState<string | null>(null);
  const [isSyncingCnae, setIsSyncingCnae] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtiva = company.status === 'Ativa';
  const displayDocumentLabel = company.tipo === 'PF' ? 'CPF' : 'CNPJ';
  const polos = company.polos || [];
  const canManageBranches = isAccountingClient
    && company.tipoEstabelecimento === 'Matriz'
    && company.tipo !== 'PF'
    && isValidCnpj(company.cnpj);

  useEffect(() => {
    if ((!isAccountingClient && activeTab !== 'dados') || (!canManageBranches && activeTab === 'filiais')) setActiveTab('dados');
  }, [activeTab, canManageBranches, isAccountingClient]);

  const handleLogoUpload = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploadingLogo(true);
    setLogoError(null);
    try {
      const publicUrl = await uploadImageAsset(file, 'cliente-logos', company.id || company.cnpj || company.nome);
      await onUpdateCompany({ ...company, logo: publicUrl });
    } catch (error: any) {
      setLogoError(error.message || 'Erro ao enviar logotipo.');
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveBranch = async (branch: ClientBranch) => {
    setBranchActionError(null);
    await onSaveBranch(branch);
  };

  const handleToggleBranch = async (branch: ClientBranch) => {
    setBranchActionError(null);
    try {
      await onDefineBranchStatus(branch, branch.ativo ? 'Inativa' : 'Ativa');
    } catch (error) {
      setBranchActionError(
        error instanceof Error ? error.message : 'Não foi possível alterar o status da filial.',
      );
    }
  };

  const handleOpenAddBranch = () => {
    setBranchActionError(null);
    setEditingBranch(null);
    setShowBranchForm(true);
  };

  const handleOpenEditBranch = (branch: ClientBranch) => {
    setBranchActionError(null);
    setEditingBranch(branch);
    setShowBranchForm(true);
  };

  const handleSyncCnae = async () => {
    setIsSyncingCnae(true);
    setCnaeSyncMsg(null);
    try {
      await onSyncCnae(company);
      setCnaeSyncMsg('CNAE atualizado com sucesso.');
      setTimeout(() => setCnaeSyncMsg(null), 3000);
    } catch (error: any) {
      setCnaeSyncMsg(error?.message || 'Não foi possível atualizar o CNAE.');
      setTimeout(() => setCnaeSyncMsg(null), 3000);
    } finally {
      setIsSyncingCnae(false);
    }
  };

  return (
    <div className="cliente-detail-container">
      <div className="cliente-detail-topbar">
        <div className="breadcrumb-wrapper">
          <button className="btn-back-style" onClick={onBack}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="breadcrumb-links">
            <span>Parceiros</span>
            <span className="divider">/</span>
            <span className="current">{company.nome}</span>
          </div>
        </div>

        <div className="topbar-actions">
          {displayDocumentLabel === 'CNPJ' && !company.cnae && (
            <button className="btn-edit-action" onClick={handleSyncCnae} disabled={isSyncingCnae}>
              <Search size={14} />
              {isSyncingCnae ? 'Sincronizando CNAE...' : 'Sincronizar CNAE'}
            </button>
          )}
          {activeTab === 'dados' && !isEditing && (
            <button className="btn-edit-action" onClick={() => setIsEditing(true)}>
              <Edit3 size={14} /> Editar Cadastro
            </button>
          )}
          <button className={`btn-status-toggle ${isAtiva ? 'active' : 'inactive'}`} onClick={() => onToggleStatus(company)}>
            {isAtiva ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            {isAtiva ? 'Inativar' : 'Reativar'}
          </button>
        </div>
      </div>

      <header className="cliente-header-card">
        <div className="header-card-layout">
          <div className="avatar-container" onClick={() => !isUploadingLogo && fileInputRef.current?.click()} title="Alterar Logotipo">
            {company.logo ? (
              <img src={company.logo} alt={company.nome} className="avatar-img" />
            ) : (
              <span className="avatar-initials">{getInitials(company.nome || company.razaoSocial)}</span>
            )}
            <div className="avatar-overlay">
              {isUploadingLogo ? <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>Enviando</span> : <Camera size={18} />}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void handleLogoUpload(e.target.files?.[0])}
          />

          {/* Dados Textuais */}
          <div className="header-card-info">
            <div className="company-title-row">
              <h2>{company.nome}</h2>
              <span className="regime-badge-clear">
                {normalizeCatalogLabel(getEffectiveTaxRegime(company.tipo))}
              </span>
              {isAccountingClient && (
                <span className="category-badge-clear">
                  {normalizeCatalogLabel(company.categoriaCliente || 'Sem categoria')}
                </span>
              )}
              <span className={`status-badge-clear ${isAtiva ? 'active' : 'inactive'}`}>
                <span className="status-dot"></span>
                {company.status}
              </span>
            </div>
            <div className="company-subtitle">{company.razaoSocial}</div>

            {/* Grid de contatos rápidos */}
            <div className="quick-contacts-grid">
              {company.email && (
                <div className="contact-item">
                  <Mail size={14} />
                  <span>{company.email}</span>
                </div>
              )}
              {company.telefone && (
                <div className="contact-item">
                  <Phone size={14} />
                  <span>{company.telefone}</span>
                </div>
              )}
              {(company.cidade || company.uf) && (
                <div className="contact-item">
                  <MapPin size={14} />
                  <span>{company.cidade}{company.uf ? `/${company.uf}` : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {cnaeSyncMsg && (
        <div className="form-alert-banner" style={{ marginTop: 10, marginBottom: 10 }}>
          <span>{cnaeSyncMsg}</span>
        </div>
      )}
      {logoError && <div className="error-banner" style={{ marginTop: 10 }}>{logoError}</div>}

      {/* Tabs */}
      <nav className="detail-tabs-bar">
        <button
          className={`tab-link-btn ${activeTab === 'dados' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('dados');
            setShowBranchForm(false);
          }}
        >
          <FileText size={16} /> Dados Cadastrais
        </button>
        {isAccountingClient ? (
          <>
            <button
              className={`tab-link-btn ${activeTab === 'protocolos' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('protocolos');
                setShowBranchForm(false);
              }}
            >
              <FileCheck size={16} /> Rotinas e Obrigações
            </button>
            {canManageBranches ? <button
              className={`tab-link-btn ${activeTab === 'filiais' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('filiais');
                setIsEditing(false);
              }}
            >
              <Building2 size={16} /> Filiais ({polos.length})
            </button> : null}
          </>
        ) : null}
      </nav>

      {/* Conteúdo Aba Dados Cadastrais */}
      {activeTab === 'dados' && (
        <div className="tab-pane-content">
          {isEditing ? (
            <div className="inline-form-card">
              <ClienteEditForm
                company={company}
                onSave={onUpdateCompany}
                onCancel={() => setIsEditing(false)}
                onSearchCNPJ={cnpjLookupService.lookup}
              />
            </div>
          ) : (
            <ClienteDetailData
              company={company}
              displayDocumentLabel={displayDocumentLabel}
              isAccountingClient={isAccountingClient}
            />
          )}
        </div>
      )}

      {isAccountingClient && activeTab === 'protocolos' && (
        <div className="tab-pane-content">
          <TabProtocolosEntregas company={company} />
        </div>
      )}

      {/* Conteúdo Aba Filiais */}
      {canManageBranches && activeTab === 'filiais' && (
        <div className="tab-pane-content">
          <div className="filiais-header-row">
            <div>
              <h3>Filiais Registradas</h3>
              <p>Gerencie as unidades filiais vinculadas ao cadastro principal desta empresa.</p>
            </div>
            {!showBranchForm && (
              <button className="btn-add-filial" onClick={handleOpenAddBranch}>
                <Plus size={15} /> Adicionar Filial
              </button>
            )}
          </div>

          {branchActionError ? (
            <div className="form-alert-banner error" role="alert">
              <span>{branchActionError}</span>
            </div>
          ) : null}

          {showBranchForm && (
            <div className="inline-form-card" style={{ marginBottom: '24px' }}>
              <FilialForm
                companyId={company.id}
                branch={editingBranch}
                onSave={handleSaveBranch}
                onCancel={() => {
                  setShowBranchForm(false);
                  setEditingBranch(null);
                }}
                onSearchCNPJ={cnpjLookupService.lookup}
                isSaving={isSavingBranch}
              />
            </div>
          )}

          {polos.length === 0 ? (
            <div className="filiais-empty-state-clear">
              <Building2 size={36} />
              <h4>Nenhuma filial cadastrada</h4>
              <p>Adicione estabelecimentos filiais secundários para este cliente contábil.</p>
              <button className="btn-add-filial" onClick={handleOpenAddBranch} style={{ marginTop: '8px' }}>
                <Plus size={14} /> Cadastrar Primeira Filial
              </button>
            </div>
          ) : (
            <div className="filiais-cards-grid-clear">
              {polos.map((branch) => (
                <div key={branch.id} className="filial-card-clear">
                  <div className="filial-card-header-row">
                    <div>
                      <h5>{branch.nome}</h5>
                      <span className="filial-cnpj">CNPJ: {branch.cnpj || '-'}</span>
                    </div>
                    <span className={`status-badge-clear ${branch.ativo ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>
                      {branch.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  <div className="filial-card-body-info">
                    {branch.contato && (
                      <div className="filial-info-row">
                        <User size={13} />
                        <span>{branch.contato}</span>
                      </div>
                    )}
                    {(branch.telefone || branch.email) && (
                      <div className="filial-info-row">
                        <Phone size={13} />
                        <span>{branch.telefone} {branch.email ? ` | ${branch.email}` : ''}</span>
                      </div>
                    )}
                    <div className="filial-info-row">
                      <MapPin size={13} />
                      <span>
                        {branch.endereco ? `${branch.endereco}, ` : ''}
                        {branch.bairro ? `${branch.bairro} - ` : ''}
                        {branch.cidade || ''}/{branch.uf || ''}
                      </span>
                    </div>
                  </div>

                  <div className="filial-card-footer-actions">
                    <button
                      type="button"
                      className="btn-action-small"
                      onClick={() => { void handleToggleBranch(branch); }}
                      disabled={isSavingBranch}
                      title={branch.ativo ? 'Inativar Filial' : 'Ativar Filial'}
                      aria-label={branch.ativo ? 'Inativar filial' : 'Ativar filial'}
                    >
                      {branch.ativo ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                    </button>
                    <button
                      type="button"
                      className="btn-action-small"
                      onClick={() => handleOpenEditBranch(branch)}
                      disabled={isSavingBranch}
                      title="Editar Dados da Filial"
                      aria-label="Editar dados da filial"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

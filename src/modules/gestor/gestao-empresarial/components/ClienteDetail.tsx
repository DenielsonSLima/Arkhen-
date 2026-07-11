import React, { useRef, useState } from 'react';
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
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
} from 'lucide-react';
import type { ClientBranch, Company } from '../services/gestaoEmpresarialService';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { cnpjLookupService } from '../services/cnpjLookupService';
import { ClienteEditForm } from '../forms/ClienteEditForm';
import { FilialForm } from '../forms/FilialForm';
import { TabProtocolosEntregas } from './TabProtocolosEntregas';
import { uploadImageAsset } from '../../shared/uploadImageAsset';
import './ClienteDetail.css';

interface ClienteDetailProps {
  company: Company;
  onBack: () => void;
  onUpdateCompany: (company: Company) => Promise<void>;
  onToggleStatus: (company: Company) => void;
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
  onBack,
  onUpdateCompany,
  onToggleStatus,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('dados');
  const [isEditing, setIsEditing] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClientBranch | null>(null);
  const [branchToRemove, setBranchToRemove] = useState<ClientBranch | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtiva = company.status === 'Ativa';
  const displayDocumentLabel = company.tipo === 'PF' ? 'CPF' : 'CNPJ';
  const polos = company.polos || [];

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
    const nextBranches = branch.id && polos.some((p) => p.id === branch.id)
      ? polos.map((p) => (p.id === branch.id ? branch : p))
      : [...polos, { ...branch, id: branch.id || `polo-${Date.now()}`, companyId: company.id }];
    
    await onUpdateCompany({ ...company, polos: nextBranches });
    setShowBranchForm(false);
    setEditingBranch(null);
  };

  const handleToggleBranch = async (branchId: string) => {
    const nextBranches = polos.map((p) =>
      p.id === branchId ? { ...p, ativo: !p.ativo } : p
    );
    await onUpdateCompany({ ...company, polos: nextBranches });
  };

  const confirmRemoveBranch = async () => {
    if (!branchToRemove) return;
    const nextBranches = polos.filter((p) => p.id !== branchToRemove.id);
    await onUpdateCompany({ ...company, polos: nextBranches });
    setBranchToRemove(null);
  };

  const handleOpenAddBranch = () => {
    setEditingBranch(null);
    setShowBranchForm(true);
  };

  const handleOpenEditBranch = (branch: ClientBranch) => {
    setEditingBranch(branch);
    setShowBranchForm(true);
  };

  return (
    <div className="cliente-detail-container">
      {/* Barra superior com Breadcrumb e Ações Rápidas */}
      <div className="cliente-detail-topbar">
        <div className="breadcrumb-wrapper">
          <button className="btn-back-style" onClick={onBack}>
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="breadcrumb-links">
            <span>Clientes</span>
            <span className="divider">/</span>
            <span className="current">{company.nome}</span>
          </div>
        </div>

        <div className="topbar-actions">
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

      {/* Header do Cliente (Layout Claro Luxuoso) */}
      <header className="cliente-header-card">
        <div className="header-card-layout">
          {/* Avatar com upload de logo */}
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
              <span className="regime-badge-clear">{company.tipo}</span>
              <span className="category-badge-clear">{company.categoriaCliente || 'Cliente Contábil'}</span>
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
        <button
          className={`tab-link-btn ${activeTab === 'protocolos' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('protocolos');
            setShowBranchForm(false);
          }}
        >
          <FileCheck size={16} /> Rotinas e Obrigações
        </button>
        <button
          className={`tab-link-btn ${activeTab === 'filiais' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('filiais');
            setIsEditing(false);
          }}
        >
          <Building2 size={16} /> Filiais ({polos.length})
        </button>
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
            <div className="details-blocks-layout">
              {/* Seção 1: Dados Fiscais */}
              <section className="detail-card-section">
                <div className="section-title-row">
                  <h4>Dados Fiscais & Contábeis</h4>
                </div>
                <div className="details-grid-layout">
                  <div className="detail-field-box">
                    <label>{displayDocumentLabel}</label>
                    <p>{company.cnpj || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Razão Social</label>
                    <p>{company.razaoSocial || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Nome Fantasia / Apelido</label>
                    <p>{company.nome || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Regime de Tributação</label>
                    <p>{company.tipo || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Categoria do Cliente</label>
                    <p>{company.categoriaCliente || 'Cliente Contábil'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Inscrição Estadual / IM</label>
                    <p>{company.inscricaoEstadual || '-'}</p>
                  </div>
                </div>
              </section>

              {/* Seção 2: Contatos */}
              <section className="detail-card-section">
                <div className="section-title-row">
                  <h4>Informações de Contato</h4>
                </div>
                <div className="details-grid-layout">
                  <div className="detail-field-box">
                    <label>Contato Responsável</label>
                    <p>{company.contato || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Telefone</label>
                    <p>{company.telefone || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>E-mail Corporativo</label>
                    <p>{company.email || '-'}</p>
                  </div>
                </div>
              </section>

              {/* Seção 3: Endereço */}
              <section className="detail-card-section">
                <div className="section-title-row">
                  <h4>Localização & Endereço</h4>
                </div>
                <div className="details-grid-layout">
                  <div className="detail-field-box">
                    <label>CEP</label>
                    <p>{company.cep || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Endereço</label>
                    <p>{company.endereco || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Bairro</label>
                    <p>{company.bairro || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>Cidade</label>
                    <p>{company.cidade || '-'}</p>
                  </div>
                  <div className="detail-field-box">
                    <label>UF</label>
                    <p>{company.uf || '-'}</p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {activeTab === 'protocolos' && (
        <div className="tab-pane-content">
          <TabProtocolosEntregas company={company} />
        </div>
      )}

      {/* Conteúdo Aba Filiais */}
      {activeTab === 'filiais' && (
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
                      className="btn-action-small"
                      onClick={() => handleToggleBranch(branch.id)}
                      title={branch.ativo ? 'Inativar Filial' : 'Ativar Filial'}
                    >
                      {branch.ativo ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                    </button>
                    <button
                      className="btn-action-small"
                      onClick={() => handleOpenEditBranch(branch)}
                      title="Editar Dados da Filial"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      className="btn-action-small btn-delete"
                      onClick={() => setBranchToRemove(branch)}
                      title="Remover Filial"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SystemQuickModal
        isOpen={!!branchToRemove}
        title="Excluir Filial"
        message={`Tem certeza de que deseja excluir a filial "${branchToRemove?.nome || ''}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmRemoveBranch}
        onClose={() => setBranchToRemove(null)}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { AlertCircle, Check, Loader2, Search } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import { ClienteLogoUpload } from './components/ClienteLogoUpload';
import { DocumentoTipoSelector } from './components/DocumentoTipoSelector';
import { NovaCategoriaClienteModal } from './components/NovaCategoriaClienteModal';
import './ClienteForm.css';

interface ClienteAddFormProps {
  onSave: (company: Company) => void;
  onCancel: () => void;
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  isSaving: boolean;
}

type DocumentType = 'CPF' | 'CNPJ';
type RegimeCliente = Company['tipo'];
type CategoriaCliente = string;

const regimes: RegimeCliente[] = ['PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'];

// Funções utilitárias de formatação
const formatCPF = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};

const formatCNPJ = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
};

const formatPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^\((\d{2})\)\s*(\d{4})(\d)/, '($1) $2-$3');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^\((\d{2})\)\s*(\d{5})(\d)/, '($1) $2-$3');
};

const formatCEP = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
};


export const ClienteAddForm: React.FC<ClienteAddFormProps> = ({ onSave, onCancel, onSearchCNPJ, isSaving }) => {
  const [docType, setDocType] = useState<DocumentType>('CNPJ');
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [tipo, setTipo] = useState<RegimeCliente>('Simples Nacional');
  const [categoria, setCategoria] = useState<CategoriaCliente>('Cliente Contábil');
  const [logo, setLogo] = useState('');
  
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatNome, setNewCatNome] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatError, setNewCatError] = useState('');
  
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [contato, setContato] = useState('');
  
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [ieIm, setIeIm] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const { availableCategories, addCategory, isAddingCategory } = useClienteCategorias();


  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    setErrorMsg(null);
    if (type === 'CPF') {
      setTipo('PF');
      setCategoria('Pessoa Física');
    } else {
      setTipo('Simples Nacional');
      setCategoria('Cliente Contábil');
    }
  };

  const handleLookup = async () => {
    if (docType !== 'CNPJ' || !cnpj) return;
    setIsSearching(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await onSearchCNPJ(cnpj);
      setRazaoSocial(data.razaoSocial);
      setNomeFantasia(data.nome);
      setEmail(data.email);
      setTelefone(data.telefone);
      setEndereco(data.endereco);
      setBairro(data.bairro);
      setCep(data.cep);
      setCidade(data.cidade);
      setUf(data.uf);
      setSuccessMsg('Dados do CNPJ obtidos com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao buscar dados do CNPJ.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activeDoc = docType === 'CNPJ' ? cnpj : cpf;
    const cleanDoc = activeDoc.replace(/\D/g, '');

    if (!cleanDoc) {
      setErrorMsg(`Por favor, informe o ${docType}.`);
      return;
    }
    if (docType === 'CNPJ' && cleanDoc.length !== 14) {
      setErrorMsg('CNPJ incompleto.');
      return;
    }
    if (docType === 'CPF' && cleanDoc.length !== 11) {
      setErrorMsg('CPF incompleto.');
      return;
    }
    if (!razaoSocial.trim()) {
      setErrorMsg(docType === 'CNPJ' ? 'A Razão Social é obrigatória.' : 'O Nome Completo é obrigatório.');
      return;
    }
    if (!nomeFantasia.trim()) {
      setErrorMsg(docType === 'CNPJ' ? 'O Nome Fantasia é obrigatório.' : 'O Apelido/Nome Fantasia é obrigatório.');
      return;
    }

    onSave({
      id: '',
      nome: nomeFantasia,
      razaoSocial,
      cnpj: activeDoc,
      tipo,
      categoriaCliente: categoria,
      tipoEstabelecimento: 'Matriz',
      logo,
      funcionariosCount: 0,
      status: 'Ativa',
      email,
      telefone,
      contato,
      endereco,
      bairro,
      cidade,
      uf,
      cep,
      inscricaoEstadual: ieIm,
      funcionarios: [],
      ferias: [],
      documentos: [],
      polos: [],
    });
  };

  const closeCategoryModal = () => {
    setShowAddCatModal(false);
    setNewCatNome('');
    setNewCatDesc('');
    setNewCatError('');
  };

  const handleAddCategory = async () => {
    const createdName = newCatNome.trim();
    if (!createdName) {
      setNewCatError('Nome da categoria é obrigatório.');
      return;
    }

    try {
      await addCategory({ nome: createdName, descricao: newCatDesc });
      setCategoria(createdName);
      closeCategoryModal();
    } catch (err) {
      setNewCatError(err instanceof Error ? err.message : 'Erro ao salvar categoria no Supabase.');
    }
  };

  return (
    <div className="cliente-form-container">
      <div className="cliente-form-header">
        <h2>Cadastrar Cliente</h2>
        <p>Preencha os dados do cliente principal para habilitar relatórios e filiais.</p>
      </div>

      {errorMsg && (
        <div className="form-alert-banner error">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="form-alert-banner">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="cliente-form-columns">
        <div className="cliente-form-sidebar">
          <ClienteLogoUpload logo={logo} onLogoChange={setLogo} />
          <DocumentoTipoSelector value={docType} onChange={handleDocTypeChange} />
        </div>

        <div className="cliente-form-main-fields">
          <div className="form-fields-section">
            <h4 className="form-fields-section-title">Identificação Básica</h4>
            <div className="fields-grid">
              <div className="input-container field-col-6">
                <label>{docType} *</label>
                {docType === 'CNPJ' ? (
                  <div className="cnpj-search-wrapper">
                    <input
                      type="text"
                      className="input-style"
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    />
                    <button
                      type="button"
                      className="cnpj-search-btn"
                      onClick={handleLookup}
                      disabled={isSearching || !cnpj}
                    >
                      {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      Buscar
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="input-style"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                  />
                )}
              </div>

              <div className="input-container field-col-6">
                <label>Regime / Tipo</label>
                <select
                  className="input-style"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as RegimeCliente)}
                  disabled={docType === 'CPF'}
                >
                  {regimes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="input-container field-col-6">
                <label>{docType === 'CNPJ' ? 'Razão Social *' : 'Nome Completo *'}</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder={docType === 'CNPJ' ? 'Ex: Tech Solutions Ltda' : 'Ex: João da Silva'}
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                />
              </div>

              <div className="input-container field-col-6">
                <label>{docType === 'CNPJ' ? 'Nome Fantasia *' : 'Apelido *'}</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder={docType === 'CNPJ' ? 'Ex: Tech Solutions' : 'Ex: João'}
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                />
              </div>

              <div className="input-container field-col-6">
                <label>Categoria do Cliente</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    className="input-style"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    disabled={docType === 'CPF'}
                    style={{ flex: 1 }}
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCatModal(true)}
                    disabled={docType === 'CPF'}
                    style={{
                      backgroundColor: 'rgba(197, 146, 53, 0.08)',
                      border: '1px solid var(--color-gold-primary)',
                      color: 'var(--color-gold-dark)',
                      borderRadius: '6px',
                      width: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: docType === 'CPF' ? 'not-allowed' : 'pointer',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    title="Criar nova categoria de cliente"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="input-container field-col-6">
                <label>IE / IM</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Inscrição Estadual ou Municipal"
                  value={ieIm}
                  onChange={(e) => setIeIm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Contatos */}
          <div className="form-fields-section">
            <h4 className="form-fields-section-title">Contatos Principais</h4>
            <div className="fields-grid">
              <div className="input-container field-col-4">
                <label>Contato Responsável</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Nome do contato"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                />
              </div>

              <div className="input-container field-col-4">
                <label>Telefone</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                />
              </div>

              <div className="input-container field-col-4">
                <label>E-mail</label>
                <input
                  type="email"
                  className="input-style"
                  placeholder="financeiro@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Endereço */}
          <div className="form-fields-section">
            <h4 className="form-fields-section-title">Localização / Endereço Fiscal</h4>
            <div className="fields-grid">
              <div className="input-container field-col-3">
                <label>CEP</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(formatCEP(e.target.value))}
                />
              </div>

              <div className="input-container field-col-6">
                <label>Endereço (Rua, Número, Comp.)</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Ex: Av. Paulista, 1200 - Apto 34"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </div>

              <div className="input-container field-col-3">
                <label>Bairro</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Ex: Bela Vista"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </div>

              <div className="input-container field-col-9">
                <label>Cidade</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Ex: São Paulo"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                />
              </div>

              <div className="input-container field-col-3">
                <label>UF</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="SP"
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          {/* Ações do Formulário */}
          <div className="form-footer-actions">
            <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              Salvar Cliente
            </button>
          </div>
        </div>
      </form>

      {showAddCatModal && (
        <NovaCategoriaClienteModal
          nome={newCatNome}
          descricao={newCatDesc}
          error={newCatError}
          isSaving={isAddingCategory}
          onNomeChange={setNewCatNome}
          onDescricaoChange={setNewCatDesc}
          onCancel={closeCategoryModal}
          onSubmit={handleAddCategory}
        />
      )}
    </div>
  );
};

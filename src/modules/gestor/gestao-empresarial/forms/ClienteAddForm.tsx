import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, FolderTree, Loader2, Search } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import {
  DEFAULT_PASTAS_DOCUMENTOS,
  expandFolderPaths,
} from '../../parametrizacao/pastas-padrao/services/pastasPadraoService';
import { useActivePastasPadraoQuery } from '../../parametrizacao/pastas-padrao/services/usePastasPadraoQueries';
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
type FormStep = 'identificacao' | 'contato' | 'endereco' | 'pastas';

const regimes: RegimeCliente[] = ['PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'];
const fallbackPastas = expandFolderPaths(DEFAULT_PASTAS_DOCUMENTOS.map((item) => item.caminho));
const formSteps: Array<{ id: FormStep; label: string; description: string }> = [
  { id: 'identificacao', label: '1. Identificação', description: 'Informe documento, regime, razão social e classificação do cliente.' },
  { id: 'contato', label: '2. Contatos', description: 'Cadastre o responsável, telefone e e-mail principal.' },
  { id: 'endereco', label: '3. Endereço fiscal', description: 'Preencha a localização fiscal da empresa ou pessoa física.' },
  { id: 'pastas', label: '4. Pastas padrão', description: 'Revise a estrutura de pastas que será criada em Documentos.' },
];

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
  const [step, setStep] = useState<FormStep>('identificacao');
  const [docType, setDocType] = useState<DocumentType>('CNPJ');
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnae, setCnae] = useState('');
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
  const [selectedPastas, setSelectedPastas] = useState<string[]>(fallbackPastas);
  const [pastasTouched, setPastasTouched] = useState(false);
  
  const { availableCategories, addCategory, isAddingCategory } = useClienteCategorias();
  const pastasPadraoQuery = useActivePastasPadraoQuery();

  const availablePastas = useMemo(() => {
    const paths = pastasPadraoQuery.data && pastasPadraoQuery.data.length > 0
      ? pastasPadraoQuery.data
      : fallbackPastas;
    return Array.from(new Set(paths));
  }, [pastasPadraoQuery.data]);

  useEffect(() => {
    if (pastasTouched || !availablePastas.length) return;
    setSelectedPastas(availablePastas);
  }, [availablePastas, pastasTouched]);


  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    setErrorMsg(null);
    if (type === 'CPF') {
      setTipo('PF');
      setCategoria('Pessoa Física');
      setCnae('');
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
      setCnae(data.cnae);
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

  const buildCompanyDraft = (): Company => {
    const activeDoc = docType === 'CNPJ' ? cnpj : cpf;

    return {
      id: '',
      nome: nomeFantasia,
      razaoSocial,
      cnpj: activeDoc,
      cnae,
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
      pastasDocumentos: expandFolderPaths(selectedPastas),
      polos: [],
    };
  };

  const validateIdentificacao = () => {
    const activeDoc = docType === 'CNPJ' ? cnpj : cpf;
    const cleanDoc = activeDoc.replace(/\D/g, '');

    if (!cleanDoc) return `Por favor, informe o ${docType}.`;
    if (docType === 'CNPJ' && cleanDoc.length !== 14) return 'CNPJ incompleto.';
    if (docType === 'CPF' && cleanDoc.length !== 11) return 'CPF incompleto.';
    if (!razaoSocial.trim()) return docType === 'CNPJ' ? 'A Razão Social é obrigatória.' : 'O Nome Completo é obrigatório.';
    if (!nomeFantasia.trim()) return docType === 'CNPJ' ? 'O Nome Fantasia é obrigatório.' : 'O Apelido/Nome Fantasia é obrigatório.';

    return null;
  };

  const currentStepIndex = formSteps.findIndex((item) => item.id === step);
  const currentStepInfo = formSteps[currentStepIndex] || formSteps[0];
  const isLastStep = step === 'pastas';

  const goToPreviousStep = () => {
    if (currentStepIndex <= 0) {
      onCancel();
      return;
    }
    setStep(formSteps[currentStepIndex - 1].id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'identificacao') {
      const validationError = validateIdentificacao();
      if (validationError) {
        setErrorMsg(validationError);
        return;
      }
    }

    setErrorMsg(null);

    if (!isLastStep) {
      setStep(formSteps[currentStepIndex + 1].id);
      return;
    }

    onSave(buildCompanyDraft());
  };

  const togglePasta = (path: string) => {
    setPastasTouched(true);
    setSelectedPastas((current) => (
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    ));
  };

  const selectAllPastas = () => {
    setPastasTouched(true);
    setSelectedPastas(availablePastas);
  };

  const clearPastas = () => {
    setPastasTouched(true);
    setSelectedPastas([]);
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
        <p>{currentStepInfo.description}</p>
      </div>

      <div className="cliente-form-steps" aria-label="Etapas do cadastro">
        {formSteps.map((item, index) => (
          <span
            key={item.id}
            className={step === item.id ? 'active' : index < currentStepIndex ? 'done' : ''}
          >
            {item.label}
          </span>
        ))}
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

      <form onSubmit={handleSubmit} className={`cliente-form-columns ${step === 'identificacao' ? '' : 'single-column'}`}>
        {step === 'identificacao' && (
          <div className="cliente-form-sidebar">
            <ClienteLogoUpload logo={logo} onLogoChange={setLogo} />
            <DocumentoTipoSelector value={docType} onChange={handleDocTypeChange} />
          </div>
        )}

        <div className="cliente-form-main-fields">
          {step === 'identificacao' && (
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

              {docType === 'CNPJ' && (
                <div className="input-container field-col-6">
                  <label>CNAE</label>
                  <input
                    type="text"
                    className="input-style"
                    placeholder="Ex: 62.01-5-01"
                    value={cnae}
                    onChange={(e) => setCnae(e.target.value)}
                  />
                </div>
              )}

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
          )}

          {step === 'contato' && (
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
          )}

          {step === 'endereco' && (
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
          )}

          {step === 'pastas' && (
            <div className="form-fields-section cliente-folder-step">
              <div className="cliente-folder-step-header">
                <div>
                  <h4 className="form-fields-section-title">Pastas da Empresa</h4>
                  <p>Essas pastas ficarão disponíveis na aba Documentos logo após salvar o cliente.</p>
                </div>
                <div className="cliente-folder-step-actions">
                  <button type="button" onClick={selectAllPastas}>Selecionar todas</button>
                  <button type="button" onClick={clearPastas}>Limpar</button>
                </div>
              </div>

              {pastasPadraoQuery.isLoading && (
                <div className="form-alert-banner">
                  <Loader2 size={15} className="animate-spin" />
                  <span>Carregando pastas padrão...</span>
                </div>
              )}

              <div className="cliente-folder-grid">
                {availablePastas.map((path) => {
                  const checked = selectedPastas.includes(path);
                  return (
                    <label key={path} className={`cliente-folder-option ${checked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePasta(path)}
                      />
                      <FolderTree size={16} />
                      <span>{path}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ações do Formulário */}
          <div className="form-footer-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={goToPreviousStep}
              disabled={isSaving}
            >
              {currentStepIndex > 0 ? <><ArrowLeft size={14} /> Voltar</> : 'Cancelar'}
            </button>
            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              {isLastStep ? 'Salvar Cliente' : 'Avançar'}
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

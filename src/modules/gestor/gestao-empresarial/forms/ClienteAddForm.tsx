import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, FolderTree, Loader2 } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import { usePartnerClassifications } from '../hooks/usePartnerClassifications';
import {
  DEFAULT_PASTAS_DOCUMENTOS,
  expandFolderPaths,
} from '../../parametrizacao/pastas-padrao/services/pastasPadraoService';
import { useActivePastasPadraoQuery } from '../../parametrizacao/pastas-padrao/services/usePastasPadraoQueries';
import { ClienteLogoUpload } from './components/ClienteLogoUpload';
import { ClienteAddressFields } from './components/ClienteAddressFields';
import { ClienteContactFields } from './components/ClienteContactFields';
import { ClienteIdentificationFields } from './components/ClienteIdentificationFields';
import { DocumentoTipoSelector } from './components/DocumentoTipoSelector';
import { NovaCategoriaClienteModal } from './components/NovaCategoriaClienteModal';
import {
  getDefaultCompanyTypeId,
  getActiveCategoryName,
  type DocumentType,
  type RegimeCliente,
} from './clienteFormModel';
import './ClienteForm.css';

interface ClienteAddFormProps {
  onSave: (company: Company) => Promise<void>;
  onCancel: () => void;
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  isSaving: boolean;
}

type FormStep = 'identificacao' | 'contato' | 'endereco' | 'pastas';

const fallbackPastas = expandFolderPaths(DEFAULT_PASTAS_DOCUMENTOS.map((item) => item.caminho));
const formSteps: Array<{ id: FormStep; label: string; description: string }> = [
  { id: 'identificacao', label: '1. Identificação', description: 'Informe documento, regime e classificações do parceiro.' },
  { id: 'contato', label: '2. Contatos', description: 'Cadastre o responsável, telefone e e-mail principal.' },
  { id: 'endereco', label: '3. Endereço fiscal', description: 'Preencha a localização fiscal da empresa ou pessoa física.' },
  { id: 'pastas', label: '4. Pastas padrão', description: 'Revise a estrutura de pastas que será criada em Documentos para o parceiro.' },
];

export const ClienteAddForm: React.FC<ClienteAddFormProps> = ({ onSave, onCancel, onSearchCNPJ, isSaving }) => {
  const [step, setStep] = useState<FormStep>('identificacao');
  const [docType, setDocType] = useState<DocumentType>('CNPJ');
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnae, setCnae] = useState('');
  const [tipo, setTipo] = useState<RegimeCliente>('Simples Nacional');
  const [categoria, setCategoria] = useState('');
  const [tipoParceiroId, setTipoParceiroId] = useState('');
  const [tipoEmpresaId, setTipoEmpresaId] = useState('');
  const [naturezaJuridicaId, setNaturezaJuridicaId] = useState('');
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
  const {
    partnerTypes,
    companyTypes,
    legalNatures,
    defaults: classificationDefaults,
    isLoading: isLoadingClassifications,
    isError: classificationsError,
    retry: retryClassifications,
  } = usePartnerClassifications();
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

  useEffect(() => {
    if (!tipoParceiroId && classificationDefaults.partnerType?.id) {
      setTipoParceiroId(classificationDefaults.partnerType.id);
    }
    if (!categoria && availableCategories.length) {
      setCategoria(getActiveCategoryName(
        availableCategories,
        classificationDefaults.clientCategory?.nome,
      ));
    }
    if (docType === 'CPF') {
      const pessoaFisicaId = getDefaultCompanyTypeId(companyTypes, 'PF');
      if (pessoaFisicaId && tipoEmpresaId !== pessoaFisicaId) {
        setTipoEmpresaId(pessoaFisicaId);
      }
    }
  }, [
    availableCategories,
    categoria,
    classificationDefaults,
    companyTypes,
    docType,
    tipoEmpresaId,
    tipoParceiroId,
  ]);


  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    setErrorMsg(null);
    if (type === 'CPF') {
      setTipo('PF');
      setCategoria(getActiveCategoryName(availableCategories, 'Pessoa Física'));
      setCnae('');
      setNaturezaJuridicaId('');
      setTipoEmpresaId(getDefaultCompanyTypeId(companyTypes, 'PF'));
    } else {
      setTipo('Simples Nacional');
      setCategoria(getActiveCategoryName(
        availableCategories,
        classificationDefaults.clientCategory?.nome,
      ));
      setTipoEmpresaId(getDefaultCompanyTypeId(companyTypes, 'Simples Nacional'));
      setNaturezaJuridicaId(classificationDefaults.legalNature?.id || '');
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
      tipoParceiroId,
      tipoEmpresaId: tipoEmpresaId || undefined,
      naturezaJuridicaId: naturezaJuridicaId || undefined,
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
    if (!availableCategories.includes(categoria)) return 'Selecione uma categoria ativa do parceiro.';
    if (!tipoParceiroId) return 'Selecione o tipo de parceiro.';
    if (docType === 'CNPJ' && !tipoEmpresaId) return 'Selecione o tipo de empresa.';
    if (docType === 'CNPJ' && !naturezaJuridicaId) return 'Selecione a natureza jurídica.';

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      await onSave(buildCompanyDraft());
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Erro ao salvar o parceiro.');
    }
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
      const normalizedName = await addCategory({ nome: createdName, descricao: newCatDesc });
      setCategoria(normalizedName);
      closeCategoryModal();
    } catch (err) {
      setNewCatError(err instanceof Error ? err.message : 'Erro ao salvar categoria no Supabase.');
    }
  };

  return (
    <div className="cliente-form-container">
      <div className="cliente-form-header">
        <h2>Cadastrar Parceiro</h2>
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

      {classificationsError && (
        <div className="form-alert-banner error" role="alert">
          <AlertCircle size={18} />
          <span>Não foi possível carregar as classificações obrigatórias.</span>
          <button type="button" onClick={() => { void retryClassifications(); }}>
            Tentar novamente
          </button>
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
            <ClienteIdentificationFields
              docType={docType}
              cnpj={cnpj}
              cpf={cpf}
              razaoSocial={razaoSocial}
              nomeFantasia={nomeFantasia}
              cnae={cnae}
              tipo={tipo}
              tipoParceiroId={tipoParceiroId}
              tipoEmpresaId={tipoEmpresaId}
              naturezaJuridicaId={naturezaJuridicaId}
              categoria={categoria}
              ieIm={ieIm}
              partnerTypes={partnerTypes}
              companyTypes={companyTypes}
              legalNatures={legalNatures}
              availableCategories={availableCategories}
              isClassificationsLoading={isLoadingClassifications || classificationsError}
              isSearching={isSearching}
              isDisabled={isSaving || classificationsError}
              showDetailedPlaceholders
              onCnpjChange={setCnpj}
              onCpfChange={setCpf}
              onRazaoSocialChange={setRazaoSocial}
              onNomeFantasiaChange={setNomeFantasia}
              onCnaeChange={setCnae}
              onTipoChange={setTipo}
              onTipoParceiroChange={setTipoParceiroId}
              onTipoEmpresaChange={setTipoEmpresaId}
              onNaturezaJuridicaChange={setNaturezaJuridicaId}
              onCategoriaChange={setCategoria}
              onIeImChange={setIeIm}
              onLookup={handleLookup}
              onOpenCategoryModal={() => setShowAddCatModal(true)}
            />
          )}

          {step === 'contato' && (
            <ClienteContactFields
              contato={contato}
              telefone={telefone}
              email={email}
              onContatoChange={setContato}
              onTelefoneChange={setTelefone}
              onEmailChange={setEmail}
            />
          )}

          {step === 'endereco' && (
            <ClienteAddressFields
              endereco={endereco}
              bairro={bairro}
              cep={cep}
              cidade={cidade}
              uf={uf}
              onEnderecoChange={setEndereco}
              onBairroChange={setBairro}
              onCepChange={setCep}
              onCidadeChange={setCidade}
              onUfChange={setUf}
            />
          )}

          {step === 'pastas' && (
            <div className="form-fields-section cliente-folder-step">
              <div className="cliente-folder-step-header">
                <div>
                  <h4 className="form-fields-section-title">Pastas do parceiro</h4>
                  <p>Essas pastas ficarão disponíveis na aba Documentos logo após salvar o parceiro.</p>
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
            <button
              type="submit"
              className="btn-submit"
              disabled={isSaving || isLoadingClassifications || classificationsError}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              {isLastStep ? 'Salvar Parceiro' : 'Avançar'}
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

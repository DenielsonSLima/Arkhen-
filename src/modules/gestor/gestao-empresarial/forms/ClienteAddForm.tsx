import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, FolderTree, Loader2 } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { isClienteContabilPartnerType } from '../services/partnerClassificationService';
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
import { ClienteFormSteps } from './components/ClienteFormSteps';
import { DocumentoTipoSelector } from './components/DocumentoTipoSelector';
import { FormLoadErrorBanner } from './components/FormLoadErrorBanner';
import { usePartnerQuickCreate } from './hooks/usePartnerQuickCreate';
import { useCnpjLookupFill } from './hooks/useCnpjLookupFill';
import { isValidCnpj, normalizeCnpj } from '../services/cnpjDocument';
import {
  getDefaultCompanyTypeId,
  isMeiCompanyType,
  isPessoaFisicaCompanyType,
  type DocumentType,
  type RegimeCliente,
  type RegimeClienteForm,
} from './clienteFormModel';
import { hasSelectedPartnerCategory } from './partnerClassificationOptions';
import { CLIENTE_FORM_STEPS, type ClienteFormStep } from './clienteFormStepsModel';
import './ClienteForm.css';
interface ClienteAddFormProps {
  onSave: (company: Company) => Promise<void>;
  onCancel: () => void;
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  isSaving: boolean;
}
const fallbackPastas = expandFolderPaths(DEFAULT_PASTAS_DOCUMENTOS.map((item) => item.caminho));
export const ClienteAddForm: React.FC<ClienteAddFormProps> = ({ onSave, onCancel, onSearchCNPJ, isSaving }) => {
  const [step, setStep] = useState<ClienteFormStep>('identificacao');
  const [docType, setDocType] = useState<DocumentType>('CNPJ');
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnae, setCnae] = useState('');
  const [cnaeDescricao, setCnaeDescricao] = useState('');
  const [capitalSocial, setCapitalSocial] = useState('');
  const [tipo, setTipo] = useState<RegimeClienteForm>('');
  const [categoria, setCategoria] = useState('');
  const [tipoParceiroId, setTipoParceiroId] = useState('');
  const [tipoEmpresaId, setTipoEmpresaId] = useState('');
  const [naturezaJuridicaId, setNaturezaJuridicaId] = useState('');
  const [logo, setLogo] = useState('');
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
  const [cnpjLookupSnapshot, setCnpjLookupSnapshot] = useState<CompanyLookupDraft>();
  const [selectedPastas, setSelectedPastas] = useState<string[]>(fallbackPastas);
  const [pastasTouched, setPastasTouched] = useState(false);
  const {
    availableCategoryOptions,
    addCategory,
    isAddingCategory,
    isLoading: isLoadingCategories,
    isError: categoriesError,
    retry: retryCategories,
  } = useClienteCategorias();
  const {
    partnerTypes,
    companyTypes,
    legalNatures,
    defaults: classificationDefaults,
    createClassification,
    isCreatingClassification,
    isLoading: isLoadingClassifications,
    isError: classificationsError,
    retry: retryClassifications,
  } = usePartnerClassifications();
  const pastasPadraoQuery = useActivePastasPadraoQuery();
  const isClienteContabilPartner = isClienteContabilPartnerType(
    partnerTypes.find((item) => item.id === tipoParceiroId),
  );
  const isMeiCompany = docType === 'CNPJ' && isMeiCompanyType(
    companyTypes.find((item) => item.id === tipoEmpresaId),
  );
  const requiredCategoryError = isClienteContabilPartner && categoriesError;
  const isLoadingRequiredCategories = isClienteContabilPartner && isLoadingCategories;
  const { openQuickCreate, quickCreateModal } = usePartnerQuickCreate({
    addCategory,
    createClassification,
    isAddingCategory,
    isCreatingClassification,
    onCreated: ({ target, id, name }) => {
      if (target === 'category') setCategoria(name);
      if (target === 'partnerType' && id) setTipoParceiroId(id);
      if (target === 'companyType' && id) setTipoEmpresaId(id);
      if (target === 'legalNature' && id) setNaturezaJuridicaId(id);
    },
  });
  const { isSearching, handleLookup } = useCnpjLookupFill({
    cnpj,
    knownCnpj: cnpjLookupSnapshot?.cnpj,
    companyTypes,
    legalNatures,
    onSearchCNPJ,
    successText: 'Dados cadastrais do CNPJ preenchidos',
    setters: {
      razaoSocial: setRazaoSocial,
      nomeFantasia: setNomeFantasia,
      cnae: setCnae,
      cnaeDescricao: setCnaeDescricao,
      email: setEmail,
      telefone: setTelefone,
      endereco: setEndereco,
      bairro: setBairro,
      cep: setCep,
      cidade: setCidade,
      uf: setUf,
      capitalSocial: setCapitalSocial,
      tipo: setTipo,
      tipoEmpresaId: setTipoEmpresaId,
      naturezaJuridicaId: setNaturezaJuridicaId,
      snapshot: setCnpjLookupSnapshot,
      error: setErrorMsg,
      success: setSuccessMsg,
    },
  });
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
    if (docType === 'CPF') {
      const pessoaFisicaId = getDefaultCompanyTypeId(companyTypes, 'PF');
      if (pessoaFisicaId && tipoEmpresaId !== pessoaFisicaId) {
        setTipoEmpresaId(pessoaFisicaId);
      }
    }
  }, [
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
      setCnpjLookupSnapshot(undefined);
      setTipo('PF');
      setCnae('');
      setCnaeDescricao('');
      setCapitalSocial('');
      setNaturezaJuridicaId('');
      setTipoEmpresaId(getDefaultCompanyTypeId(companyTypes, 'PF'));
    } else {
      setTipo('');
      setTipoEmpresaId('');
      setNaturezaJuridicaId('');
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
      cnaeDescricao: cnaeDescricao || undefined,
      // `tipo=MEI` ainda alimenta obrigações legadas. A interface apresenta o
      // regime correto (Simples) e o porte fica no catálogo de enquadramento.
      tipo: (isMeiCompany ? 'MEI' : tipo) as RegimeCliente,
      categoriaCliente: isClienteContabilPartner ? categoria : undefined,
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
      capitalSocial: capitalSocial === '' ? undefined : Number(capitalSocial),
      cnpjLookupSnapshot: docType === 'CNPJ'
        && cnpjLookupSnapshot
        && normalizeCnpj(cnpjLookupSnapshot.cnpj) === normalizeCnpj(cnpj)
        ? cnpjLookupSnapshot
        : undefined,
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
    if (docType === 'CNPJ' && !isValidCnpj(activeDoc)) return 'CNPJ inválido. Confira os 14 caracteres.';
    if (docType === 'CPF' && cleanDoc.length !== 11) return 'CPF incompleto.';
    if (!razaoSocial.trim()) return docType === 'CNPJ' ? 'A Razão Social é obrigatória.' : 'O Nome Completo é obrigatório.';
    if (!nomeFantasia.trim()) return docType === 'CNPJ' ? 'O Nome Fantasia é obrigatório.' : 'O Apelido/Nome Fantasia é obrigatório.';
    if (!tipo) return 'Selecione o regime tributário.';
    if (isMeiCompany && tipo !== 'Simples Nacional') return 'MEI deve usar o regime Simples Nacional.';
    if (isClienteContabilPartner && !hasSelectedPartnerCategory(availableCategoryOptions, categoria)) return 'Selecione uma categoria ativa do cliente.';
    if (!tipoParceiroId) return 'Selecione o tipo de parceiro.';
    if (docType === 'CNPJ' && !tipoEmpresaId) return 'Selecione o porte / enquadramento.';
    if (docType === 'CNPJ' && isPessoaFisicaCompanyType(
      companyTypes.find((item) => item.id === tipoEmpresaId),
    )) return 'Pessoa Física não é um porte válido para CNPJ.';
    if (docType === 'CNPJ' && !naturezaJuridicaId) return 'Selecione a natureza jurídica.';

    return null;
  };

  const currentStepIndex = CLIENTE_FORM_STEPS.findIndex((item) => item.id === step);
  const currentStepInfo = CLIENTE_FORM_STEPS[currentStepIndex] || CLIENTE_FORM_STEPS[0];
  const isLastStep = step === 'pastas';

  const goToPreviousStep = () => {
    if (currentStepIndex <= 0) {
      onCancel();
      return;
    }
    setStep(CLIENTE_FORM_STEPS[currentStepIndex - 1].id);
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
      setStep(CLIENTE_FORM_STEPS[currentStepIndex + 1].id);
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

  return (
    <div className="cliente-form-container">
      <div className="cliente-form-header">
        <h2>Cadastrar Parceiro</h2>
        <p>{currentStepInfo.description}</p>
      </div>

      <ClienteFormSteps currentStep={step} currentStepIndex={currentStepIndex} />

      {errorMsg && (
        <div className="form-alert-banner error">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <FormLoadErrorBanner
        visible={classificationsError}
        message="Não foi possível carregar as classificações obrigatórias."
        onRetry={() => { void retryClassifications(); }}
      />

      <FormLoadErrorBanner
        visible={requiredCategoryError}
        message="Não foi possível carregar as categorias dos clientes."
        onRetry={() => { void retryCategories(); }}
      />

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
              cnaeDescricao={cnaeDescricao}
              capitalSocial={capitalSocial}
              tipo={tipo}
              tipoParceiroId={tipoParceiroId}
              tipoEmpresaId={tipoEmpresaId}
              naturezaJuridicaId={naturezaJuridicaId}
              categoria={categoria}
              ieIm={ieIm}
              partnerTypes={partnerTypes}
              companyTypes={companyTypes}
              legalNatures={legalNatures}
              partnerCategories={availableCategoryOptions}
              isClienteContabilPartner={isClienteContabilPartner}
              isClassificationsLoading={
                isLoadingClassifications
                || classificationsError
                || isLoadingRequiredCategories
                || requiredCategoryError
              }
              isSearching={isSearching}
              isDisabled={isSaving || classificationsError || requiredCategoryError}
              showDetailedPlaceholders
              onCnpjChange={setCnpj}
              onCpfChange={setCpf}
              onRazaoSocialChange={setRazaoSocial}
              onNomeFantasiaChange={setNomeFantasia}
              onCnaeChange={setCnae}
              onCnaeDescricaoChange={setCnaeDescricao}
              onCapitalSocialChange={setCapitalSocial}
              onTipoChange={setTipo}
              onTipoParceiroChange={setTipoParceiroId}
              onTipoEmpresaChange={setTipoEmpresaId}
              onNaturezaJuridicaChange={setNaturezaJuridicaId}
              onCategoriaChange={setCategoria}
              onIeImChange={setIeIm}
              onLookup={handleLookup}
              onOpenQuickCreate={openQuickCreate}
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
              disabled={
                isSaving
                || isLoadingClassifications
                || classificationsError
                || isLoadingRequiredCategories
                || requiredCategoryError
              }
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              {isLastStep ? 'Salvar Parceiro' : 'Avançar'}
            </button>
          </div>
        </div>
      </form>

      {quickCreateModal}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { isClienteContabilPartnerType } from '../services/partnerClassificationService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import { usePartnerClassifications } from '../hooks/usePartnerClassifications';
import { ClienteLogoUpload } from './components/ClienteLogoUpload';
import { ClienteAddressFields } from './components/ClienteAddressFields';
import { ClienteContactFields } from './components/ClienteContactFields';
import { ClienteIdentificationFields } from './components/ClienteIdentificationFields';
import { DocumentoTipoSelector } from './components/DocumentoTipoSelector';
import { FormLoadErrorBanner } from './components/FormLoadErrorBanner';
import { usePartnerQuickCreate } from './hooks/usePartnerQuickCreate';
import { useCnpjLookupFill } from './hooks/useCnpjLookupFill';
import { isValidCnpj, normalizeCnpj } from '../services/cnpjDocument';
import {
  getDefaultCompanyTypeId,
  getDocumentType,
  isMeiCompanyType,
  isPessoaFisicaCompanyType,
  type DocumentType,
  type RegimeCliente,
  type RegimeClienteForm,
} from './clienteFormModel';
import { hasSelectedPartnerCategory } from './partnerClassificationOptions';
import './ClienteForm.css';

interface ClienteEditFormProps {
  company: Company;
  onSave: (company: Company) => Promise<void>;
  onCancel: () => void;
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  isSaving?: boolean;
}

export const ClienteEditForm: React.FC<ClienteEditFormProps> = ({ company, onSave, onCancel, onSearchCNPJ, isSaving = false }) => {
  const [docType, setDocType] = useState<DocumentType>(getDocumentType(company));
  const [cnpj, setCnpj] = useState(company.tipo !== 'PF' ? company.cnpj : '');
  const [cpf, setCpf] = useState(company.tipo === 'PF' ? company.cnpj : '');
  const [razaoSocial, setRazaoSocial] = useState(company.razaoSocial || '');
  const [nomeFantasia, setNomeFantasia] = useState(company.nome || '');
  const [cnae, setCnae] = useState(company.cnae || '');
  const [cnaeDescricao, setCnaeDescricao] = useState(company.cnaeDescricao || '');
  const [capitalSocial, setCapitalSocial] = useState(
    company.capitalSocial === undefined ? '' : String(company.capitalSocial),
  );
  const [tipo, setTipo] = useState<RegimeClienteForm>(
    company.tipo === 'MEI' ? 'Simples Nacional' : (company.tipo || 'Simples Nacional'),
  );
  const [categoria, setCategoria] = useState(company.categoriaCliente || '');
  const [tipoParceiroId, setTipoParceiroId] = useState(company.tipoParceiroId || '');
  const [tipoEmpresaId, setTipoEmpresaId] = useState(company.tipoEmpresaId || '');
  const [naturezaJuridicaId, setNaturezaJuridicaId] = useState(company.naturezaJuridicaId || '');
  const [logo, setLogo] = useState(company.logo || '');

  const [email, setEmail] = useState(company.email || '');
  const [telefone, setTelefone] = useState(company.telefone || '');
  const [contato, setContato] = useState(company.contato || '');
  
  const [endereco, setEndereco] = useState(company.endereco || '');
  const [bairro, setBairro] = useState(company.bairro || '');
  const [cep, setCep] = useState(company.cep || '');
  const [cidade, setCidade] = useState(company.cidade || '');
  const [uf, setUf] = useState(company.uf || '');
  const [ieIm, setIeIm] = useState(company.inscricaoEstadual || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cnpjLookupSnapshot, setCnpjLookupSnapshot] = useState(company.cnpjLookupSnapshot);
  const [savingState, setSavingState] = useState(false);
  
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
    knownCnpj: cnpjLookupSnapshot?.cnpj || company.cnpj,
    companyTypes,
    legalNatures,
    onSearchCNPJ,
    successText: 'Dados cadastrais do CNPJ atualizados',
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

  useEffect(() => {
    const nextDocType = getDocumentType(company);
    setDocType(nextDocType);
    setCnpj(company.tipo !== 'PF' ? company.cnpj : '');
    setCpf(company.tipo === 'PF' ? company.cnpj : '');
    setRazaoSocial(company.razaoSocial || '');
    setNomeFantasia(company.nome || '');
    setCnae(company.cnae || '');
    setCnaeDescricao(company.cnaeDescricao || '');
    setCapitalSocial(company.capitalSocial === undefined ? '' : String(company.capitalSocial));
    setTipo(company.tipo === 'MEI' ? 'Simples Nacional' : (company.tipo || 'Simples Nacional'));
    setCategoria(company.categoriaCliente || '');
    setTipoParceiroId(company.tipoParceiroId || '');
    setTipoEmpresaId(company.tipoEmpresaId || '');
    setNaturezaJuridicaId(company.naturezaJuridicaId || '');
    setLogo(company.logo || '');
    setEmail(company.email || '');
    setTelefone(company.telefone || '');
    setContato(company.contato || '');
    setEndereco(company.endereco || '');
    setBairro(company.bairro || '');
    setCep(company.cep || '');
    setCidade(company.cidade || '');
    setUf(company.uf || '');
    setIeIm(company.inscricaoEstadual || '');
    setCnpjLookupSnapshot(company.cnpjLookupSnapshot);
  }, [company]);

  useEffect(() => {
    if (!tipoParceiroId && classificationDefaults.partnerType?.id) {
      setTipoParceiroId(classificationDefaults.partnerType.id);
    }
    if (docType === 'CPF') {
      const pessoaFisicaId = getDefaultCompanyTypeId(companyTypes, 'PF');
      if (pessoaFisicaId && tipoEmpresaId !== pessoaFisicaId) {
        setTipoEmpresaId(pessoaFisicaId);
      }
      if (naturezaJuridicaId) setNaturezaJuridicaId('');
      return;
    }

  }, [classificationDefaults, companyTypes, docType, naturezaJuridicaId, tipoEmpresaId, tipoParceiroId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeDoc = docType === 'CNPJ' ? cnpj : cpf;
    const cleanDoc = activeDoc.replace(/\D/g, '');

    if (!cleanDoc) {
      setErrorMsg(`Por favor, informe o ${docType}.`);
      return;
    }
    if (docType === 'CNPJ' && !isValidCnpj(activeDoc)) {
      setErrorMsg('CNPJ inválido. Confira os 14 caracteres.');
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
    if (!tipo) {
      setErrorMsg('Selecione o regime tributário.');
      return;
    }
    if (isMeiCompany && tipo !== 'Simples Nacional') {
      setErrorMsg('MEI deve usar o regime Simples Nacional.');
      return;
    }
    if (isClienteContabilPartner && !hasSelectedPartnerCategory(availableCategoryOptions, categoria)) {
      setErrorMsg('Selecione uma categoria ativa do cliente.');
      return;
    }
    if (!tipoParceiroId) {
      setErrorMsg('Selecione o tipo de parceiro.');
      return;
    }
    if (docType === 'CNPJ' && !tipoEmpresaId) {
      setErrorMsg('Selecione o porte / enquadramento.');
      return;
    }
    if (docType === 'CNPJ' && isPessoaFisicaCompanyType(
      companyTypes.find((item) => item.id === tipoEmpresaId),
    )) {
      setErrorMsg('Pessoa Física não é um porte válido para CNPJ.');
      return;
    }
    if (docType === 'CNPJ' && !naturezaJuridicaId) {
      setErrorMsg('Selecione a natureza jurídica.');
      return;
    }

    setSavingState(true);
    setErrorMsg(null);
    try {
      await onSave({
        ...company,
        nome: nomeFantasia,
        razaoSocial,
        cnpj: activeDoc,
        cnae,
        cnaeDescricao: cnaeDescricao || undefined,
        // Preserva o discriminador operacional legado das obrigações de MEI.
        tipo: (isMeiCompany ? 'MEI' : tipo) as RegimeCliente,
        categoriaCliente: isClienteContabilPartner ? categoria : undefined,
        tipoParceiroId,
        tipoEmpresaId: tipoEmpresaId || undefined,
        naturezaJuridicaId: naturezaJuridicaId || undefined,
        logo,
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
      });
      setSuccessMsg('Dados do parceiro salvos com sucesso!');
      setTimeout(() => {
        setSuccessMsg(null);
        onCancel();
      }, 1000);
    } catch {
      setErrorMsg('Erro ao salvar as alterações do parceiro.');
    } finally {
      setSavingState(false);
    }
  };

  const isSavingFinal = isSaving || savingState;

  return (
    <div className="cliente-form-container" style={{ margin: 0, border: 'none', padding: 0, boxShadow: 'none' }}>
      {errorMsg && (
        <div className="form-alert-banner error" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <FormLoadErrorBanner
        visible={classificationsError}
        message="Não foi possível carregar as classificações obrigatórias."
        onRetry={() => { void retryClassifications(); }}
        withSpacing
      />

      <FormLoadErrorBanner
        visible={requiredCategoryError}
        message="Não foi possível carregar as categorias dos clientes."
        onRetry={() => { void retryCategories(); }}
        withSpacing
      />

      {successMsg && (
        <div className="form-alert-banner" style={{ marginBottom: 16 }}>
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
            isDisabled={isSavingFinal || classificationsError || requiredCategoryError}
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
          <ClienteContactFields
            contato={contato}
            telefone={telefone}
            email={email}
            onContatoChange={setContato}
            onTelefoneChange={setTelefone}
            onEmailChange={setEmail}
          />
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

          {/* Ações do Formulário */}
          <div className="form-footer-actions">
            <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSavingFinal}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={
                isSavingFinal
                || isLoadingClassifications
                || classificationsError
                || isLoadingRequiredCategories
                || requiredCategoryError
              }
            >
              {isSavingFinal ? <Loader2 size={16} className="animate-spin" /> : null}
              Salvar Alterações
            </button>
          </div>
        </div>
      </form>

      {quickCreateModal}
    </div>
  );
};

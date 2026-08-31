import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import { usePartnerClassifications } from '../hooks/usePartnerClassifications';
import { ClienteLogoUpload } from './components/ClienteLogoUpload';
import { ClienteAddressFields } from './components/ClienteAddressFields';
import { ClienteContactFields } from './components/ClienteContactFields';
import { ClienteIdentificationFields } from './components/ClienteIdentificationFields';
import { DocumentoTipoSelector } from './components/DocumentoTipoSelector';
import { NovaCategoriaClienteModal } from './components/NovaCategoriaClienteModal';
import {
  getDefaultCompanyTypeId,
  getDocumentType,
  type DocumentType,
  type RegimeCliente,
} from './clienteFormModel';
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
  const [tipo, setTipo] = useState<RegimeCliente>(company.tipo || 'Simples Nacional');
  const [categoria, setCategoria] = useState(company.categoriaCliente || 'Cliente Contábil');
  const [tipoParceiroId, setTipoParceiroId] = useState(company.tipoParceiroId || '');
  const [tipoEmpresaId, setTipoEmpresaId] = useState(company.tipoEmpresaId || '');
  const [naturezaJuridicaId, setNaturezaJuridicaId] = useState(company.naturezaJuridicaId || '');
  const [logo, setLogo] = useState(company.logo || '');

  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newCatNome, setNewCatNome] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatError, setNewCatError] = useState('');
  
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
  const [isSearching, setIsSearching] = useState(false);
  const [savingState, setSavingState] = useState(false);
  
  const { availableCategories, addCategory, isAddingCategory } = useClienteCategorias();
  const {
    partnerTypes,
    companyTypes,
    legalNatures,
    defaults: classificationDefaults,
    isLoading: isLoadingClassifications,
  } = usePartnerClassifications();

  useEffect(() => {
    const nextDocType = getDocumentType(company);
    setDocType(nextDocType);
    setCnpj(company.tipo !== 'PF' ? company.cnpj : '');
    setCpf(company.tipo === 'PF' ? company.cnpj : '');
    setRazaoSocial(company.razaoSocial || '');
    setNomeFantasia(company.nome || '');
    setCnae(company.cnae || '');
    setTipo(company.tipo || 'Simples Nacional');
    setCategoria(company.categoriaCliente || 'Cliente Contábil');
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

    if (!tipoEmpresaId) {
      setTipoEmpresaId(getDefaultCompanyTypeId(companyTypes, tipo));
    }
    if (!naturezaJuridicaId && classificationDefaults.legalNature?.id) {
      setNaturezaJuridicaId(classificationDefaults.legalNature.id);
    }
  }, [classificationDefaults, companyTypes, docType, naturezaJuridicaId, tipo, tipoEmpresaId, tipoParceiroId]);

  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    setErrorMsg(null);
    if (type === 'CPF') {
      setTipo('PF');
      setCategoria('Pessoa Física');
      setCnae('');
      setNaturezaJuridicaId('');
      setTipoEmpresaId(getDefaultCompanyTypeId(companyTypes, 'PF'));
    } else {
      setTipo('Simples Nacional');
      setCategoria('Cliente Contábil');
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
      setSuccessMsg('Dados do CNPJ atualizados pela busca!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao buscar dados do CNPJ.');
    } finally {
      setIsSearching(false);
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
    if (!tipoParceiroId) {
      setErrorMsg('Selecione o tipo de parceiro.');
      return;
    }
    if (docType === 'CNPJ' && !tipoEmpresaId) {
      setErrorMsg('Selecione o tipo de empresa.');
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
        tipo,
        categoriaCliente: categoria,
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
    <div className="cliente-form-container" style={{ margin: 0, border: 'none', padding: 0, boxShadow: 'none' }}>
      {errorMsg && (
        <div className="form-alert-banner error" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

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
            isClassificationsLoading={isLoadingClassifications}
            isSearching={isSearching}
            isDisabled={isSavingFinal}
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
            <button type="submit" className="btn-submit" disabled={isSavingFinal}>
              {isSavingFinal ? <Loader2 size={16} className="animate-spin" /> : null}
              Salvar Alterações
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

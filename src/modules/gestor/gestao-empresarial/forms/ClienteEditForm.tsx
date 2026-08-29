import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import { isClienteContabilTipo, useTiposParceiros } from '../hooks/useTiposParceiros';
import { ClienteLogoUpload } from './components/ClienteLogoUpload';
import { DocumentoTipoSelector } from './components/DocumentoTipoSelector';
import { NovaCategoriaClienteModal } from './components/NovaCategoriaClienteModal';
import { ClienteIdentificationFields } from './components/ClienteIdentificationFields';
import {
  ClienteAddressFields,
  ClienteContactFields,
} from './components/ClienteContactAddressFields';
import {
  validateClienteIdentification,
  type CategoriaCliente,
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
  const [docType, setDocType] = useState<DocumentType>(company.tipo === 'PF' ? 'CPF' : 'CNPJ');
  const [cnpj, setCnpj] = useState(company.tipo !== 'PF' ? company.cnpj : '');
  const [cpf, setCpf] = useState(company.tipo === 'PF' ? company.cnpj : '');
  const [razaoSocial, setRazaoSocial] = useState(company.razaoSocial || '');
  const [nomeFantasia, setNomeFantasia] = useState(company.nome || '');
  const [cnae, setCnae] = useState(company.cnae || '');
  const [tipo, setTipo] = useState<RegimeCliente>(company.tipo || 'Não informado');
  const [tipoParceiroId, setTipoParceiroId] = useState(company.tipoParceiroId || '');
  const [categoria, setCategoria] = useState<CategoriaCliente>(company.categoriaCliente || 'Cliente Contábil');
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
  const { tiposParceiros, isLoadingTiposParceiros } = useTiposParceiros();

  useEffect(() => {
    setDocType(company.tipo === 'PF' ? 'CPF' : 'CNPJ');
    setCnpj(company.tipo !== 'PF' ? company.cnpj : '');
    setCpf(company.tipo === 'PF' ? company.cnpj : '');
    setRazaoSocial(company.razaoSocial || '');
    setNomeFantasia(company.nome || '');
    setCnae(company.cnae || '');
    setTipo(company.tipo || 'Não informado');
    setTipoParceiroId(company.tipoParceiroId || '');
    setCategoria(company.categoriaCliente || 'Cliente Contábil');
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

  const handleDocTypeChange = (type: DocumentType) => {
    setDocType(type);
    setErrorMsg(null);
    if (type === 'CPF') {
      setTipo('PF');
      setCategoria('Pessoa Física');
      setCnae('');
    } else {
      setTipo('Não informado');
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
    const validationError = validateClienteIdentification(
      docType,
      activeDoc,
      razaoSocial,
      nomeFantasia,
    );
    if (validationError || !tipoParceiroId) {
      setErrorMsg(validationError || 'Selecione o tipo de relacionamento.');
      return;
    }

    setSavingState(true);
    setErrorMsg(null);
    try {
      const isClientPartner = isClienteContabilTipo(tiposParceiros.find((item) => item.id === tipoParceiroId));
      await onSave({
        ...company,
        nome: nomeFantasia,
        razaoSocial,
        cnpj: activeDoc,
        cnae,
        tipo,
        tipoParceiroId,
        categoriaCliente: isClientPartner ? categoria : undefined,
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
      setSuccessMsg('Dados salvos com sucesso!');
      setTimeout(() => {
        setSuccessMsg(null);
        onCancel();
      }, 1000);
    } catch {
      setErrorMsg('Erro ao salvar as alterações do cliente.');
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
            partnerTypes={tiposParceiros}
            isLoadingPartnerTypes={isLoadingTiposParceiros}
            categoria={categoria}
            ieIm={ieIm}
            availableCategories={availableCategories}
            isSearching={isSearching}
            isDisabled={isSavingFinal}
            onCnpjChange={setCnpj}
            onCpfChange={setCpf}
            onRazaoSocialChange={setRazaoSocial}
            onNomeFantasiaChange={setNomeFantasia}
            onCnaeChange={setCnae}
            onTipoChange={setTipo}
            onTipoParceiroChange={setTipoParceiroId}
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
            cep={cep}
            endereco={endereco}
            bairro={bairro}
            cidade={cidade}
            uf={uf}
            onCepChange={setCep}
            onEnderecoChange={setEndereco}
            onBairroChange={setBairro}
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

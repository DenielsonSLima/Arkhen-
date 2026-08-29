import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, FolderTree, Loader2 } from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { useClienteCategorias } from '../hooks/useClienteCategorias';
import { isClienteContabilTipo, useTiposParceiros } from '../hooks/useTiposParceiros';
import {
  DEFAULT_PASTAS_DOCUMENTOS,
  expandFolderPaths,
} from '../../parametrizacao/pastas-padrao/services/pastasPadraoService';
import { useActivePastasPadraoQuery } from '../../parametrizacao/pastas-padrao/services/usePastasPadraoQueries';
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

interface ClienteAddFormProps {
  onSave: (company: Company) => void;
  onCancel: () => void;
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  isSaving: boolean;
}

type FormStep = 'identificacao' | 'contato' | 'endereco' | 'pastas';

const fallbackPastas = expandFolderPaths(DEFAULT_PASTAS_DOCUMENTOS.map((item) => item.caminho));
const formSteps: Array<{ id: FormStep; label: string; description: string }> = [
  { id: 'identificacao', label: '1. Identificação', description: 'Informe documento, regime, razão social e classificação do cliente.' },
  { id: 'contato', label: '2. Contatos', description: 'Cadastre o responsável, telefone e e-mail principal.' },
  { id: 'endereco', label: '3. Endereço fiscal', description: 'Preencha a localização fiscal da empresa ou pessoa física.' },
  { id: 'pastas', label: '4. Pastas padrão', description: 'Revise a estrutura de pastas que será criada em Documentos.' },
];

export const ClienteAddForm: React.FC<ClienteAddFormProps> = ({ onSave, onCancel, onSearchCNPJ, isSaving }) => {
  const [step, setStep] = useState<FormStep>('identificacao');
  const [docType, setDocType] = useState<DocumentType>('CNPJ');
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnae, setCnae] = useState('');
  const [tipo, setTipo] = useState<RegimeCliente>('Não informado');
  const [tipoParceiroId, setTipoParceiroId] = useState('');
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
  const { tiposParceiros, isLoadingTiposParceiros } = useTiposParceiros();
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
    const isClientPartner = isClienteContabilTipo(tiposParceiros.find((item) => item.id === tipoParceiroId));

    return {
      id: '',
      nome: nomeFantasia,
      razaoSocial,
      cnpj: activeDoc,
      cnae,
      tipo,
      tipoParceiroId,
      categoriaCliente: isClientPartner ? categoria : undefined,
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
    return validateClienteIdentification(docType, activeDoc, razaoSocial, nomeFantasia)
      || (!tipoParceiroId ? 'Selecione o tipo de relacionamento.' : null);
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
              showDetailedPlaceholders
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
              cep={cep}
              endereco={endereco}
              bairro={bairro}
              cidade={cidade}
              uf={uf}
              showDetailedPlaceholders
              onCepChange={setCep}
              onEnderecoChange={setEndereco}
              onBairroChange={setBairro}
              onCidadeChange={setCidade}
              onUfChange={setUf}
            />
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

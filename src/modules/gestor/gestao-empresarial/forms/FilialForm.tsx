import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Loader2, Search } from 'lucide-react';
import type { ClientBranch } from '../services/gestaoEmpresarialService';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';
import { formatCnpj, normalizeCnpj } from '../services/cnpjDocument';
import { parseFilialForm } from './filialFormModel';
import './ClienteForm.css';

interface FilialFormProps {
  companyId: string;
  branch?: ClientBranch | null;
  onSave: (branch: ClientBranch) => Promise<void>;
  onCancel: () => void;
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  isSaving?: boolean;
}

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

export const FilialForm: React.FC<FilialFormProps> = ({
  companyId,
  branch,
  onSave,
  onCancel,
  onSearchCNPJ,
  isSaving = false,
}) => {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cnpjLookupSnapshot, setCnpjLookupSnapshot] = useState<CompanyLookupDraft>();
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [contato, setContato] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [savingState, setSavingState] = useState(false);

  useEffect(() => {
    if (branch) {
      setNome(branch.nome || '');
      setCnpj(branch.cnpj || '');
      setEmail(branch.email || '');
      setTelefone(branch.telefone || '');
      setContato(branch.contato || '');
      setEndereco(branch.endereco || '');
      setBairro(branch.bairro || '');
      setCep(branch.cep || '');
      setCidade(branch.cidade || '');
      setUf(branch.uf || '');
      setCnpjLookupSnapshot(branch.cnpjLookupSnapshot);
    } else {
      setNome('');
      setCnpj('');
      setEmail('');
      setTelefone('');
      setContato('');
      setEndereco('');
      setBairro('');
      setCep('');
      setCidade('');
      setUf('');
      setCnpjLookupSnapshot(undefined);
    }
  }, [branch]);

  const handleCnpjChange = (value: string) => {
    const nextCnpj = formatCnpj(value);
    setCnpj(nextCnpj);
    if (
      cnpjLookupSnapshot
      && normalizeCnpj(cnpjLookupSnapshot.cnpj) !== normalizeCnpj(nextCnpj)
    ) {
      setCnpjLookupSnapshot(undefined);
    }
  };

  const handleLookup = async () => {
    if (!cnpj) return;
    setIsSearching(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await onSearchCNPJ(cnpj);
      setCnpj(formatCnpj(data.cnpj));
      setCnpjLookupSnapshot(data);
      setNome(data.nome);
      setEmail(data.email);
      setTelefone(data.telefone);
      setEndereco(data.endereco);
      setBairro(data.bairro);
      setCep(data.cep);
      setCidade(data.cidade);
      setUf(data.uf);
      setSuccessMsg('Dados da filial preenchidos com base no CNPJ!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao buscar dados do CNPJ da filial.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let values: ReturnType<typeof parseFilialForm>;
    try {
      values = parseFilialForm({
        nome,
        cnpj,
        email,
        telefone,
        contato,
        endereco,
        bairro,
        cep,
        cidade,
        uf,
      });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Revise os dados da filial.');
      return;
    }

    setSavingState(true);
    setErrorMsg(null);
    try {
      await onSave({
        id: branch?.id || '',
        companyId,
        filialRef: branch?.filialRef,
        ...values,
        cnpjLookupSnapshot: cnpjLookupSnapshot
          && normalizeCnpj(cnpjLookupSnapshot.cnpj) === normalizeCnpj(values.cnpj)
          ? cnpjLookupSnapshot
          : undefined,
        ativo: branch ? branch.ativo : true,
        updatedAt: branch?.updatedAt,
      });
      setSuccessMsg('Filial salva com sucesso!');
      setTimeout(() => {
        setSuccessMsg(null);
        onCancel();
      }, 1000);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : 'Erro ao salvar os dados da filial.',
      );
    } finally {
      setSavingState(false);
    }
  };

  const isSavingFinal = isSaving || savingState;

  return (
    <div className="filial-form-card" style={{ padding: 20, backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(197, 146, 53, 0.12)', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
      <div className="cliente-form-header" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--color-gold-light)' }}>
          {branch ? 'Editar Filial' : 'Nova Filial'}
        </h3>
        <p style={{ fontSize: '0.82rem' }}>Preencha os dados cadastrais da unidade vinculada à matriz.</p>
      </div>

      {errorMsg && (
        <div className="form-alert-banner error" role="alert" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="form-alert-banner" role="status" aria-live="polite" style={{ marginBottom: 16 }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="cliente-form-main-fields">
        {/* Seção 1: Identificação */}
        <div className="form-fields-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div className="fields-grid">
            <div className="input-container field-col-6">
              <label htmlFor="filial-cnpj">CNPJ da Filial *</label>
              <div className="cnpj-search-wrapper">
                <input
                  type="text"
                  id="filial-cnpj"
                  name="cnpj"
                  className="input-style"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  required
                  disabled={isSearching || isSavingFinal}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                />
                <button
                  type="button"
                  className="cnpj-search-btn"
                  onClick={handleLookup}
                  disabled={isSearching || isSavingFinal || !cnpj}
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Buscar
                </button>
              </div>
            </div>

            <div className="input-container field-col-6">
              <label htmlFor="filial-nome">Nome da Filial *</label>
              <input
                type="text"
                id="filial-nome"
                name="nome"
                className="input-style"
                placeholder="Ex: Filial Campinas"
                value={nome}
                required
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="input-container field-col-4">
              <label htmlFor="filial-contato">Nome do Contato</label>
              <input
                type="text"
                id="filial-contato"
                name="contato"
                className="input-style"
                placeholder="Responsável pela filial"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
              />
            </div>

            <div className="input-container field-col-4">
              <label htmlFor="filial-telefone">Telefone</label>
              <input
                type="text"
                id="filial-telefone"
                name="telefone"
                className="input-style"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
              />
            </div>

            <div className="input-container field-col-4">
              <label htmlFor="filial-email">E-mail</label>
              <input
                type="email"
                id="filial-email"
                name="email"
                className="input-style"
                placeholder="filial@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Endereço */}
            <div className="input-container field-col-3">
              <label htmlFor="filial-cep">CEP</label>
              <input
                type="text"
                id="filial-cep"
                name="cep"
                className="input-style"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(formatCEP(e.target.value))}
              />
            </div>

            <div className="input-container field-col-6">
              <label htmlFor="filial-endereco">Endereço</label>
              <input
                type="text"
                id="filial-endereco"
                name="endereco"
                className="input-style"
                placeholder="Ex: Rua das Flores, 450"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>

            <div className="input-container field-col-3">
              <label htmlFor="filial-bairro">Bairro</label>
              <input
                type="text"
                id="filial-bairro"
                name="bairro"
                className="input-style"
                placeholder="Ex: Centro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
            </div>

            <div className="input-container field-col-9">
              <label htmlFor="filial-cidade">Cidade</label>
              <input
                type="text"
                id="filial-cidade"
                name="cidade"
                className="input-style"
                placeholder="Ex: Campinas"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>

            <div className="input-container field-col-3">
              <label htmlFor="filial-uf">UF</label>
              <input
                type="text"
                id="filial-uf"
                name="uf"
                className="input-style"
                placeholder="SP"
                maxLength={2}
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="form-footer-actions" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
          <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSavingFinal}>
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={isSavingFinal}>
            {isSavingFinal ? <Loader2 size={16} className="animate-spin" /> : null}
            Salvar Filial
          </button>
        </div>
      </form>
    </div>
  );
};

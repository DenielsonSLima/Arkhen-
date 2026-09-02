import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CatalogoItem } from '../../../parametrizacao/services/catalogosService';
import type { CompanyLookupDraft } from '../../services/cnpjLookupService';
import { normalizeCnpj } from '../../services/cnpjDocument';
import {
  getCompanyTypeIdByEnquadramento,
  getLegalNatureId,
  type RegimeClienteForm,
} from '../clienteFormModel';

type Setter<T> = Dispatch<SetStateAction<T>>;

interface CnpjLookupSetters {
  razaoSocial: Setter<string>;
  nomeFantasia: Setter<string>;
  cnae: Setter<string>;
  cnaeDescricao: Setter<string>;
  email: Setter<string>;
  telefone: Setter<string>;
  endereco: Setter<string>;
  bairro: Setter<string>;
  cep: Setter<string>;
  cidade: Setter<string>;
  uf: Setter<string>;
  capitalSocial: Setter<string>;
  tipo: Setter<RegimeClienteForm>;
  tipoEmpresaId: Setter<string>;
  naturezaJuridicaId: Setter<string>;
  snapshot: Setter<CompanyLookupDraft | undefined>;
  error: Setter<string | null>;
  success: Setter<string | null>;
}

interface UseCnpjLookupFillOptions {
  cnpj: string;
  knownCnpj?: string;
  companyTypes: CatalogoItem[];
  legalNatures: CatalogoItem[];
  onSearchCNPJ: (cnpj: string) => Promise<CompanyLookupDraft>;
  setters: CnpjLookupSetters;
  successText: string;
}

export const useCnpjLookupFill = ({
  cnpj,
  knownCnpj,
  companyTypes,
  legalNatures,
  onSearchCNPJ,
  setters,
  successText,
}: UseCnpjLookupFillOptions) => {
  const [isSearching, setIsSearching] = useState(false);
  const lookupSequenceRef = useRef(0);
  const successTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(() => () => {
    lookupSequenceRef.current += 1;
    if (successTimeoutRef.current) globalThis.clearTimeout(successTimeoutRef.current);
  }, []);

  const handleLookup = async () => {
    if (!cnpj) return;
    const sequence = lookupSequenceRef.current + 1;
    lookupSequenceRef.current = sequence;
    const requestedCnpj = normalizeCnpj(cnpj);
    const normalizedKnownCnpj = normalizeCnpj(knownCnpj || '');
    const preserveEmptyFields = !normalizedKnownCnpj || normalizedKnownCnpj === requestedCnpj;

    setIsSearching(true);
    setters.error(null);
    setters.success(null);

    try {
      const data = await onSearchCNPJ(cnpj);
      if (lookupSequenceRef.current !== sequence) return;

      const applyText = (value: string | undefined, setter: Setter<string>) => {
        if (value || !preserveEmptyFields) setter(value || '');
      };

      applyText(data.razaoSocial, setters.razaoSocial);
      applyText(data.nome, setters.nomeFantasia);
      applyText(data.cnae, setters.cnae);
      applyText(data.cnaeDescricao, setters.cnaeDescricao);
      applyText(data.email, setters.email);
      applyText(data.telefone, setters.telefone);
      applyText(data.endereco, setters.endereco);
      applyText(data.bairro, setters.bairro);
      applyText(data.cep, setters.cep);
      applyText(data.cidade, setters.cidade);
      applyText(data.uf, setters.uf);

      if (data.capitalSocial !== undefined) {
        setters.capitalSocial(String(data.capitalSocial));
      } else if (!preserveEmptyFields) {
        setters.capitalSocial('');
      }

      if (data.regimeTributario) {
        setters.tipo(data.regimeTributario);
      } else if (!preserveEmptyFields) {
        setters.tipo('');
      }

      const companyTypeId = getCompanyTypeIdByEnquadramento(companyTypes, data.enquadramento);
      const legalNatureId = getLegalNatureId(
        legalNatures,
        data.naturezaJuridicaCodigo,
        data.naturezaJuridica,
      );
      if (companyTypeId) setters.tipoEmpresaId(companyTypeId);
      else if (!preserveEmptyFields) setters.tipoEmpresaId('');
      if (legalNatureId) setters.naturezaJuridicaId(legalNatureId);
      else if (!preserveEmptyFields) setters.naturezaJuridicaId('');

      setters.snapshot(data);

      const reviewItems = [
        data.enquadramento && !companyTypeId ? `enquadramento ${data.enquadramento}` : '',
        data.naturezaJuridica && !legalNatureId ? `natureza ${data.naturezaJuridica}` : '',
      ].filter(Boolean);
      setters.success(reviewItems.length
        ? `${successText} Cadastre ou selecione manualmente: ${reviewItems.join(' e ')}.`
        : `${successText} com sucesso!`);
      if (successTimeoutRef.current) globalThis.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = globalThis.setTimeout(() => setters.success(null), 4_000);
    } catch (error) {
      if (lookupSequenceRef.current !== sequence) return;
      setters.error(error instanceof Error ? error.message : 'Falha ao buscar dados do CNPJ.');
    } finally {
      if (lookupSequenceRef.current === sequence) setIsSearching(false);
    }
  };

  return { isSearching, handleLookup };
};

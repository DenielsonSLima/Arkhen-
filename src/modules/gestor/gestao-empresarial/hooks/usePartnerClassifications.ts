import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  catalogosService,
  type CatalogoDefaultItem,
  type CatalogoItem,
} from '../../parametrizacao/services/catalogosService';
import {
  NATUREZAS_JURIDICAS_DEFAULTS,
  TIPOS_EMPRESA_DEFAULTS,
  TIPOS_PARCEIROS_DEFAULTS,
} from '../../parametrizacao/services/partnerClassificationCatalogDefaults';

export const partnerClassificationKeys = {
  partnerTypes: ['parametrizacao', 'catalogos', 'tipos_parceiros'] as const,
  companyTypes: ['parametrizacao', 'catalogos', 'tipos_empresa'] as const,
  legalNatures: ['parametrizacao', 'catalogos', 'naturezas_juridicas'] as const,
};

export type PartnerClassificationKind =
  | 'tipos_parceiros'
  | 'tipos_empresa'
  | 'naturezas_juridicas';

const CLASSIFICATION_QUERY_KEYS = {
  tipos_parceiros: partnerClassificationKeys.partnerTypes,
  tipos_empresa: partnerClassificationKeys.companyTypes,
  naturezas_juridicas: partnerClassificationKeys.legalNatures,
} as const;

const EMPTY_CATALOG_ITEMS: CatalogoItem[] = [];

const getActiveCatalogItems = async (
  tipo: 'tipos_parceiros' | 'tipos_empresa' | 'naturezas_juridicas',
  defaults: CatalogoDefaultItem[],
) => {
  const items = await catalogosService.list(tipo, defaults);
  return items.filter((item) => item.ativo);
};

const getCatalogDefault = (
  items: CatalogoItem[],
  preferredCodes: string[],
  preferredName: string,
) => (
  preferredCodes.map((code) => items.find((item) => item.codigo === code)).find(Boolean)
  || items.find((item) => item.nome === preferredName)
  || items.find((item) => item.sistema)
  || items[0]
  || null
);

export const usePartnerClassifications = () => {
  const queryClient = useQueryClient();
  const partnerTypesQuery = useQuery({
    queryKey: partnerClassificationKeys.partnerTypes,
    queryFn: () => getActiveCatalogItems('tipos_parceiros', TIPOS_PARCEIROS_DEFAULTS),
    staleTime: 5 * 60 * 1000,
  });
  const companyTypesQuery = useQuery({
    queryKey: partnerClassificationKeys.companyTypes,
    queryFn: () => getActiveCatalogItems('tipos_empresa', TIPOS_EMPRESA_DEFAULTS),
    staleTime: 5 * 60 * 1000,
  });
  const legalNaturesQuery = useQuery({
    queryKey: partnerClassificationKeys.legalNatures,
    queryFn: () => getActiveCatalogItems('naturezas_juridicas', NATUREZAS_JURIDICAS_DEFAULTS),
    staleTime: 5 * 60 * 1000,
  });
  const partnerTypes = partnerTypesQuery.data ?? EMPTY_CATALOG_ITEMS;
  const companyTypes = companyTypesQuery.data ?? EMPTY_CATALOG_ITEMS;
  const legalNatures = legalNaturesQuery.data ?? EMPTY_CATALOG_ITEMS;
  const createClassificationMutation = useMutation({
    mutationFn: ({
      tipo,
      nome,
      descricao,
    }: {
      tipo: PartnerClassificationKind;
      nome: string;
      descricao: string;
    }) => catalogosService.create({ tipo, nome, descricao }),
    onSuccess: async (_created, variables) => {
      await queryClient.invalidateQueries({
        queryKey: CLASSIFICATION_QUERY_KEYS[variables.tipo],
      });
    },
  });

  const defaults = useMemo(() => ({
    partnerType: getCatalogDefault(
      partnerTypes,
      ['cliente_contabil', 'tp-1'],
      'Cliente Contábil',
    ),
    // Porte e natureza não devem ser inferidos. Eles vêm do CNPJ ou da escolha
    // explícita do usuário; usar o primeiro catálogo criava dados incorretos.
    companyType: null,
    legalNature: null,
  }), [partnerTypes]);

  return {
    partnerTypes,
    companyTypes,
    legalNatures,
    defaults,
    createClassification: createClassificationMutation.mutateAsync,
    isCreatingClassification: createClassificationMutation.isPending,
    isLoading: (
      partnerTypesQuery.isLoading
      || companyTypesQuery.isLoading
      || legalNaturesQuery.isLoading
    ),
    isError: (
      partnerTypesQuery.isError
      || companyTypesQuery.isError
      || legalNaturesQuery.isError
    ),
    errors: {
      partnerTypes: partnerTypesQuery.error,
      companyTypes: companyTypesQuery.error,
      legalNatures: legalNaturesQuery.error,
    },
    retry: async () => {
      await Promise.all([
        partnerTypesQuery.refetch(),
        companyTypesQuery.refetch(),
        legalNaturesQuery.refetch(),
      ]);
    },
  };
};

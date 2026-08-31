import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  categoriaClienteKeys,
  categoriaClienteService,
  type CategoriaCliente,
} from '../../parametrizacao/services/categoriaClienteService';
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
  clientCategories: categoriaClienteKeys.all,
};

const EMPTY_CATALOG_ITEMS: CatalogoItem[] = [];
const EMPTY_CLIENT_CATEGORIES: CategoriaCliente[] = [];

const getActiveCatalogItems = async (
  tipo: 'tipos_parceiros' | 'tipos_empresa' | 'naturezas_juridicas',
  defaults: CatalogoDefaultItem[],
) => {
  const items = await catalogosService.list(tipo, defaults);
  return items.filter((item) => item.ativo);
};

const getCatalogDefault = (items: CatalogoItem[]) => (
  items.find((item) => item.sistema) || items[0] || null
);

const getCategoryDefault = (items: CategoriaCliente[]) => (
  items.find((item) => item.nome === 'Cliente Contábil')
  || items.find((item) => item.sistema)
  || items[0]
  || null
);

export const usePartnerClassifications = () => {
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
  const clientCategoriesQuery = useQuery({
    queryKey: partnerClassificationKeys.clientCategories,
    queryFn: categoriaClienteService.getAll,
    select: (items) => items.filter((item) => item.status === 'Ativa'),
    staleTime: 5 * 60 * 1000,
  });

  const partnerTypes = partnerTypesQuery.data ?? EMPTY_CATALOG_ITEMS;
  const companyTypes = companyTypesQuery.data ?? EMPTY_CATALOG_ITEMS;
  const legalNatures = legalNaturesQuery.data ?? EMPTY_CATALOG_ITEMS;
  const clientCategories = clientCategoriesQuery.data ?? EMPTY_CLIENT_CATEGORIES;

  const defaults = useMemo(() => ({
    partnerType: getCatalogDefault(partnerTypes),
    companyType: getCatalogDefault(companyTypes),
    legalNature: getCatalogDefault(legalNatures),
    clientCategory: getCategoryDefault(clientCategories),
  }), [clientCategories, companyTypes, legalNatures, partnerTypes]);

  return {
    partnerTypes,
    companyTypes,
    legalNatures,
    clientCategories,
    defaults,
    isLoading: (
      partnerTypesQuery.isLoading
      || companyTypesQuery.isLoading
      || legalNaturesQuery.isLoading
      || clientCategoriesQuery.isLoading
    ),
    isError: (
      partnerTypesQuery.isError
      || companyTypesQuery.isError
      || legalNaturesQuery.isError
      || clientCategoriesQuery.isError
    ),
    errors: {
      partnerTypes: partnerTypesQuery.error,
      companyTypes: companyTypesQuery.error,
      legalNatures: legalNaturesQuery.error,
      clientCategories: clientCategoriesQuery.error,
    },
  };
};

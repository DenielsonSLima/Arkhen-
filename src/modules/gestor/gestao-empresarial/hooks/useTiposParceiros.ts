import { useQuery } from '@tanstack/react-query';
import {
  catalogosService,
  type CatalogoDefaultItem,
} from '../../parametrizacao/services/catalogosService';

export interface TipoParceiroOption {
  id: string;
  codigo: string;
  nome: string;
}

export const isClienteContabilTipo = (tipo: Pick<TipoParceiroOption, 'codigo'> | undefined) => (
  tipo?.codigo === 'cliente_contabil' || tipo?.codigo === 'tp-1'
);

const DEFAULT_TIPOS_PARCEIROS: CatalogoDefaultItem[] = [
  { codigo: 'cliente_contabil', nome: 'Cliente Contábil', descricao: 'Empresa atendida diretamente pelo escritório.', sistema: true, ordem: 10 },
  { codigo: 'parceiro_comercial', nome: 'Parceiro Comercial', descricao: 'Origem de indicações e oportunidades comerciais.', sistema: true, ordem: 20 },
  { codigo: 'fornecedor', nome: 'Fornecedor', descricao: 'Prestador ou fornecedor vinculado às rotinas internas.', sistema: true, ordem: 30 },
  { codigo: 'correspondente', nome: 'Correspondente', descricao: 'Parceiro operacional para demandas locais.', sistema: true, ordem: 40 },
];

export const tipoParceiroKeys = {
  all: ['parametrizacao', 'catalogos', 'tipos_parceiros'] as const,
};

export const useTiposParceiros = () => {
  const tiposQuery = useQuery({
    queryKey: tipoParceiroKeys.all,
    queryFn: async (): Promise<TipoParceiroOption[]> => {
      const rows = await catalogosService.list('tipos_parceiros', DEFAULT_TIPOS_PARCEIROS);
      return rows
        .filter((item) => item.ativo)
        .map((item) => ({ id: item.id, codigo: item.codigo, nome: item.nome }));
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    tiposParceiros: tiposQuery.data || [],
    isLoadingTiposParceiros: tiposQuery.isLoading,
  };
};

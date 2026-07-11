import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriaClienteKeys, categoriaClienteService } from '../../parametrizacao/services/categoriaClienteService';

export const useClienteCategorias = () => {
  const queryClient = useQueryClient();

  const categoriasQuery = useQuery({
    queryKey: categoriaClienteKeys.all,
    queryFn: categoriaClienteService.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const addCategoryMutation = useMutation({
    mutationFn: ({ nome, descricao }: { nome: string; descricao: string }) => (
      categoriaClienteService.save(nome, descricao)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriaClienteKeys.all }),
  });

  const availableCategories = (categoriasQuery.data || [])
    .filter((category) => category.status === 'Ativa')
    .map((category) => category.nome);

  return {
    availableCategories,
    addCategory: addCategoryMutation.mutateAsync,
    isAddingCategory: addCategoryMutation.isPending,
  };
};

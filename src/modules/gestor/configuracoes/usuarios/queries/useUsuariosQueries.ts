import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import { usuariosService, type SaveUsuarioInput, type Usuario } from '../services/usuariosService';

export const useUsuariosQuery = () => (
  useQuery({
    queryKey: configuracoesKeys.usuarios(),
    queryFn: usuariosService.getUsuarios,
  })
);

export const useSaveUsuarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveUsuarioInput) => usuariosService.saveUsuario(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
  });
};

export const useInativarUsuarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usuariosService.inativarUsuario(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
  });
};

export const useExcluirUsuarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (usuario: Usuario) => usuariosService.excluirUsuario(usuario),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
  });
};

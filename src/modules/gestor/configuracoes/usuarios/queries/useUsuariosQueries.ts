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
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.perfisAcesso() }),
    ]),
  });
};

export const useInativarUsuarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usuariosService.inativarUsuario(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.perfisAcesso() }),
    ]),
  });
};

export const useRedefinirSenhaFuncionarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ usuarioId, password }: { usuarioId: string; password: string }) => (
      usuariosService.redefinirSenhaFuncionario(usuarioId, password)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
  });
};

export const useExcluirUsuarioMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (usuario: Usuario) => usuariosService.excluirUsuario(usuario),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
      queryClient.invalidateQueries({ queryKey: configuracoesKeys.perfisAcesso() }),
    ]),
  });
};

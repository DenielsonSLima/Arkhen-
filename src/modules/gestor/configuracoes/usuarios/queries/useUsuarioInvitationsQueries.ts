import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configuracoesKeys } from '../../queries/configuracoesKeys';
import type { Usuario } from '../services/usuariosService';
import { usuarioInvitationsService } from '../services/usuarioInvitationsService';

export const hasPendingEmailInvitation = (usuario: Usuario) => (
  usuario.formaAcesso === 'email'
  && usuario.status === 'Pendente'
  && usuario.mustChangePassword
  && Boolean(usuario.authUserId)
);

export const useUsuarioInvitationsQuery = (usuarios: Usuario[]) => {
  const pendingIds = usuarios.filter(hasPendingEmailInvitation).map((usuario) => usuario.id).sort();
  return useQuery({
    queryKey: [...configuracoesKeys.usuariosConvites(), pendingIds],
    queryFn: usuarioInvitationsService.list,
    enabled: pendingIds.length > 0,
    staleTime: 30_000,
    retry: false,
  });
};

export const useResendUsuarioInvitationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usuarioInvitationsService.resend,
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuarios() }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: configuracoesKeys.usuariosConvites() }),
  });
};

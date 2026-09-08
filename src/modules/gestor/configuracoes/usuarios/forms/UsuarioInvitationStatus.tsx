import type { Usuario } from '../services/usuariosService';
import type { UsuarioInvitation } from '../services/usuarioInvitationsService';
import { useResendUsuarioInvitationMutation } from '../queries/useUsuarioInvitationsQueries';
import './UsuarioInvitationStatus.css';

interface UsuarioInvitationStatusProps {
  usuario: Usuario;
  invitation?: UsuarioInvitation;
  isLoading: boolean;
  isError: boolean;
}

export const UsuarioInvitationStatus = ({
  usuario, invitation, isLoading, isError,
}: UsuarioInvitationStatusProps) => {
  const resend = useResendUsuarioInvitationMutation();
  const known = !isError && Boolean(invitation);
  const accepted = known && Boolean(invitation?.email_confirmed_at);
  const sentAt = invitation?.confirmation_sent_at || invitation?.invited_at;
  const sentDate = sentAt ? new Date(sentAt) : null;
  const validSentDate = sentDate && !Number.isNaN(sentDate.getTime());
  const label = isLoading
    ? 'Consultando convite...'
    : !known
      ? 'Status do convite indisponível'
      : accepted
        ? 'Convite aceito, senha pendente'
        : validSentDate
          ? `Enviado em ${sentDate.toLocaleString('pt-BR')}`
          : sentAt
            ? 'Data do envio indisponível'
            : 'Não enviado';

  return (
    <div className="usuario-invitation-status">
      <span className="usuario-invitation-label">{label}</span>
      <small>
        {accepted
          ? 'O usuário deve concluir a senha na página de ativação já aberta.'
          : 'O usuário cria a primeira senha pelo link do convite no e-mail.'}
      </small>
      {((known && Boolean(sentAt) && !accepted) || resend.isSuccess) && (
        <small className="usuario-invitation-delivery-note">
          Envio registrado; entrega na caixa de entrada não confirmada.
        </small>
      )}
      <button
        type="button"
        className="usuario-invitation-send"
        disabled={!known || accepted || isLoading || resend.isPending}
        onClick={(event) => {
          event.stopPropagation();
          resend.mutate(usuario.id);
        }}
      >
        {resend.isPending ? 'Enviando convite...' : sentAt ? 'Reenviar convite' : 'Enviar convite'}
      </button>
      {resend.isError && <span role="alert">{resend.error.message}</span>}
      {resend.isSuccess && <span role="status">Convite enviado para {usuario.email}.</span>}
    </div>
  );
};

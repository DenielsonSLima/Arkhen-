import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../../../../lib/supabase';

export interface UsuarioInvitation {
  usuario_id: string;
  invited_at: string | null;
  confirmation_sent_at: string | null;
  email_confirmed_at: string | null;
}

interface InvitationResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  invitations?: UsuarioInvitation[];
  invite_sent?: boolean;
}

const isInvitation = (value: unknown): value is UsuarioInvitation => {
  if (!value || typeof value !== 'object') return false;
  const invitation = value as Record<string, unknown>;
  return typeof invitation.usuario_id === 'string'
    && ['invited_at', 'confirmation_sent_at', 'email_confirmed_at'].every((field) => (
      invitation[field] === null
      || (typeof invitation[field] === 'string' && !Number.isNaN(Date.parse(invitation[field])))
    ));
};

const invokeInvitation = async (body: Record<string, string>): Promise<InvitationResponse> => {
  const { data, error } = await supabase.functions.invoke<InvitationResponse>(
    'manage-employee-user', { body },
  );
  if (error || !data?.ok) {
    let message = data?.error || data?.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const response = await error.context.clone().json() as InvitationResponse;
        message = response.error || response.message || message;
      } catch { /* Preserve a mensagem de fallback quando não houver JSON. */ }
    }
    throw new Error(message || 'Não foi possível consultar ou enviar o convite. Tente novamente.');
  }
  return data;
};

export const usuarioInvitationsService = {
  async list(): Promise<UsuarioInvitation[]> {
    const response = await invokeInvitation({ action: 'email_invitation_status' });
    if (!Array.isArray(response.invitations) || !response.invitations.every(isInvitation)) {
      throw new Error('O status dos convites não foi retornado.');
    }
    return response.invitations;
  },

  async resend(usuarioId: string): Promise<void> {
    const response = await invokeInvitation({ action: 'resend_email_invite', usuario_id: usuarioId });
    if (response.invite_sent !== true) {
      throw new Error('O envio do convite não foi confirmado. Consulte o status antes de tentar novamente.');
    }
  },
};

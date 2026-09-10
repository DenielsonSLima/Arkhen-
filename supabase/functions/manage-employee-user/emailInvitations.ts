import { isUuid } from './validation.ts';
import {
  HttpError,
  type JsonRecord,
  authenticateActor,
  createServiceClient,
  jsonResponse,
} from './runtime.ts';
import { inviteRedirectUrl } from './inviteConfiguration.ts';
import { invitationSendError } from './invitationErrors.ts';

type ServiceClient = ReturnType<typeof createServiceClient>;
type PendingInvitation = {
  id: string;
  empresa_id: string;
  auth_user_id: string;
  perfil_id: string;
  perfil_acesso_id: string;
  nome: string;
  email: string;
  auth_credential_version: string;
};

const pendingColumns =
  'id,empresa_id,auth_user_id,perfil_id,perfil_acesso_id,nome,email,auth_credential_version';

const invitationContext = async (request: Request) => {
  const client = createServiceClient();
  const actorUserId = await authenticateActor(request, client);
  const { data: empresaId, error } = await client.rpc('resolver_empresa_gestor_edge', {
    p_actor_user_id: actorUserId,
  });
  if (error?.code === '42501') throw new HttpError(403, 'Ação não autorizada.');
  if (error || !isUuid(empresaId)) {
    throw new HttpError(503, 'Não foi possível verificar os convites.');
  }
  return { client, empresaId };
};

const pendingUsers = (client: ServiceClient, empresaId: string) => client
  .from('configuracoes_usuarios')
  .select(pendingColumns)
  .eq('empresa_id', empresaId)
  .eq('login_method', 'email')
  .eq('status', 'Pendente')
  .eq('must_change_password', true);

const invitationRelations = async (client: ServiceClient, empresaId: string) => {
  const [memberships, profiles] = await Promise.all([
    client.from('perfis').select('id,user_id').eq('empresa_id', empresaId)
      .eq('ativo', false).eq('papel', 'membro'),
    client.from('configuracoes_perfis_acesso').select('id').eq('empresa_id', empresaId)
      .eq('ativo', true),
  ]);
  if (memberships.error || profiles.error) {
    throw new HttpError(503, 'Não foi possível verificar os convites.');
  }
  return {
    memberships: new Map((memberships.data ?? []).map((row) => [row.id, row.user_id])),
    profiles: new Set((profiles.data ?? []).map((row) => row.id)),
  };
};

const invitationAuth = async (
  client: ServiceClient,
  usuario: PendingInvitation,
  relations: Awaited<ReturnType<typeof invitationRelations>>,
) => {
  if (
    !isUuid(usuario.auth_user_id)
    || !isUuid(usuario.auth_credential_version)
    || typeof usuario.email !== 'string'
    || !usuario.email.trim()
    || relations.memberships.get(usuario.perfil_id) !== usuario.auth_user_id
    || !relations.profiles.has(usuario.perfil_acesso_id)
  ) return null;

  const { data, error } = await client.auth.admin.getUserById(usuario.auth_user_id);
  if (error) throw new HttpError(503, 'Não foi possível verificar os convites.');
  const authUser = data.user;
  if (
    !authUser
    || authUser.id !== usuario.auth_user_id
    || authUser.email?.toLowerCase() !== usuario.email.trim().toLowerCase()
    || authUser.app_metadata?.login_method !== 'email'
    || authUser.app_metadata?.account_type !== 'employee_email'
    || authUser.app_metadata?.credential_version !== usuario.auth_credential_version
  ) return null;
  return authUser;
};

export const getEmailInvitationStatus = async (request: Request): Promise<Response> => {
  const { client, empresaId } = await invitationContext(request);
  const { data, error } = await pendingUsers(client, empresaId);
  if (error) throw new HttpError(503, 'Não foi possível verificar os convites.');
  const usuarios = (data ?? []) as PendingInvitation[];
  if (!usuarios.length) return jsonResponse({ ok: true, invitations: [] });
  const relations = await invitationRelations(client, empresaId);
  const invitations: JsonRecord[] = [];
  // Limita consultas Auth simultaneas sem disparar uma rajada por funcionario.
  for (let offset = 0; offset < usuarios.length; offset += 4) {
    const batch = await Promise.all(usuarios.slice(offset, offset + 4).map(async (usuario) => {
      const authUser = await invitationAuth(client, usuario, relations);
      if (!authUser) return null;
      if (authUser.last_sign_in_at && !authUser.email_confirmed_at) return null;
      return {
        usuario_id: usuario.id,
        invited_at: authUser.invited_at ?? null,
        confirmation_sent_at: authUser.confirmation_sent_at ?? null,
        email_confirmed_at: authUser.email_confirmed_at ?? null,
      };
    }));
    for (const invitation of batch) if (invitation) invitations.push(invitation);
  }
  return jsonResponse({ ok: true, invitations });
};

export const resendEmailInvite = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  if (!isUuid(payload.usuario_id)) throw new HttpError(400, 'Usuário inválido.');
  const redirectTo = inviteRedirectUrl();
  const { client, empresaId } = await invitationContext(request);
  const { data, error } = await pendingUsers(client, empresaId)
    .eq('id', payload.usuario_id).maybeSingle();
  if (error) throw new HttpError(503, 'Não foi possível verificar o convite.');
  if (!data) throw new HttpError(404, 'Convite pendente não encontrado.');
  const usuario = data as PendingInvitation;
  const relations = await invitationRelations(client, empresaId);
  const authUser = await invitationAuth(client, usuario, relations);
  if (!authUser) throw new HttpError(403, 'Ação não autorizada.');
  if (authUser.email_confirmed_at || authUser.last_sign_in_at) {
    throw new HttpError(409, 'O convite já foi aceito. O usuário deve concluir a criação da senha.');
  }
  const { data: invited, error: inviteError } = await client.auth.admin.inviteUserByEmail(
    usuario.email,
    { redirectTo, data: { nome: usuario.nome, conta_gerenciada: true } },
  );
  if (inviteError || invited.user?.id !== usuario.auth_user_id) {
    throw invitationSendError(inviteError);
  }
  return jsonResponse({ ok: true, usuario_id: usuario.id, invite_sent: true });
};

import {
  InputValidationError,
  isUuid,
  isValidCpf,
  normalizeContactEmail,
  normalizeCpf,
  normalizeEmployeeName,
  normalizePhone,
  parseAccessConfig,
  validateEmployeeName,
  validatePassword,
} from './validation.ts';
import {
  HttpError,
  type JsonRecord,
  asRecord,
  authenticateActor,
  createServiceClient,
  jsonResponse,
  requireEnvironment,
} from './runtime.ts';

const publicEmployee = (value: unknown): JsonRecord => {
  const user = asRecord(value);
  return {
    id: user.id,
    empresa_id: user.empresa_id,
    auth_user_id: user.auth_user_id,
    perfil_id: user.perfil_id,
    perfil_acesso_id: user.perfil_acesso_id,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf ?? null,
    telefone: user.telefone ?? null,
    perfil: user.perfil,
    status: user.status,
    access_config: user.access_config,
    ultimo_acesso_em: user.ultimo_acesso_em ?? null,
    login_method: user.login_method,
    must_change_password: user.must_change_password,
    membership_id: user.membership_id,
    membership_papel: user.membership_papel,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

const throwRpcError = (
  error: { code?: string; message?: string } | null,
  fallback: string,
): never => {
  if (error?.code === '42501') throw new HttpError(403, 'Ação não autorizada.');
  if (error?.code === '23505') throw new HttpError(409, 'Não foi possível criar o usuário.');
  if (error?.code === '22023' || error?.code === '23514' || error?.code === 'P0002') {
    throw new HttpError(400, error.message || fallback);
  }
  throw new HttpError(500, fallback);
};

const inviteRedirectUrl = (): string => {
  let url: URL;
  try {
    url = new URL(requireEnvironment('APP_URL'));
  } catch {
    throw new HttpError(503, 'Serviço de convites temporariamente indisponível.');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new HttpError(503, 'Serviço de convites temporariamente indisponível.');
  }
  return new URL('/redefinir-senha', url.origin).toString();
};

const findProvisionedEmailUser = async (
  client: ReturnType<typeof createServiceClient>,
  authUserId: string,
): Promise<JsonRecord | null> => {
  const { data: user, error } = await client
    .from('configuracoes_usuarios')
    .select(
      'id,empresa_id,auth_user_id,perfil_id,perfil_acesso_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,login_method,must_change_password,created_at,updated_at',
    )
    .eq('auth_user_id', authUserId)
    .eq('login_method', 'email')
    .maybeSingle();
  if (error || !user) return null;

  const { data: membership, error: membershipError } = await client
    .from('perfis')
    .select('id,papel,ativo')
    .eq('id', user.perfil_id)
    .eq('user_id', authUserId)
    .eq('empresa_id', user.empresa_id)
    .maybeSingle();
  if (membershipError || !membership || membership.ativo !== false) return null;
  return publicEmployee({
    ...user,
    membership_id: membership.id,
    membership_papel: membership.papel,
  });
};

const compensateEmailProvisioning = async (
  client: ReturnType<typeof createServiceClient>,
  actorUserId: string,
  authUserId: string,
) => {
  const { error: rollbackError } = await client.rpc(
    'desfazer_provisionamento_funcionario_email',
    { p_actor_user_id: actorUserId, p_auth_user_id: authUserId },
  );
  if (rollbackError) {
    console.error('manage-employee-user: email database rollback failed', rollbackError.code);
    throw new HttpError(
      500,
      'O convite não foi concluído e requer reconciliação antes de uma nova tentativa.',
    );
  }
  const { error: authRollbackError } = await client.auth.admin.deleteUser(authUserId);
  if (authRollbackError) {
    console.error('manage-employee-user: email auth rollback failed', authRollbackError.code);
    throw new HttpError(
      500,
      'O convite não foi concluído e requer reconciliação antes de uma nova tentativa.',
    );
  }
};

export const inviteEmployeeByEmail = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  const nameError = validateEmployeeName(payload.nome);
  const profileId = payload.perfil_id ?? payload.perfilId;
  if (nameError) throw new InputValidationError(nameError);
  if (!isUuid(profileId)) throw new InputValidationError('Selecione um perfil válido.');

  const nome = normalizeEmployeeName(payload.nome);
  const email = normalizeContactEmail(payload.email);
  if (!email) throw new InputValidationError('Informe o e-mail que receberá o convite.');
  if (!isValidCpf(payload.cpf)) throw new InputValidationError('Informe um CPF válido.');
  const cpf = normalizeCpf(payload.cpf);
  const telefone = normalizePhone(payload.telefone);
  const accessConfig = parseAccessConfig(payload.access_config ?? payload.accessConfig);
  const credentialVersion = crypto.randomUUID();
  const rpcPayload = {
    nome,
    email,
    cpf,
    telefone,
    perfil_id: profileId,
    access_config: accessConfig,
    credential_version: credentialVersion,
  };

  const client = createServiceClient();
  const actorUserId = await authenticateActor(request, client);
  const { data: prepared, error: prepareError } = await client.rpc(
    'preparar_provisionamento_funcionario_email',
    { p_actor_user_id: actorUserId, p_payload: rpcPayload },
  );
  if (prepareError || !prepared) {
    throwRpcError(prepareError, 'Não foi possível validar o convite.');
  }

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { nome },
    app_metadata: {
      login_method: 'email',
      account_type: 'employee_email',
      credential_version: credentialVersion,
    },
  });
  if (createError || !created.user?.id) {
    throw new HttpError(409, 'Não foi possível enviar o convite para este e-mail.');
  }

  const authUserId = created.user.id;
  const { data: provisionedValue, error: provisionError } = await client.rpc(
    'provisionar_usuario_funcionario_email',
    {
      p_actor_user_id: actorUserId,
      p_auth_user_id: authUserId,
      p_payload: rpcPayload,
    },
  );
  let provisioned = provisionedValue ? publicEmployee(provisionedValue) : null;
  if (provisionError || !provisioned) {
    provisioned = await findProvisionedEmailUser(client, authUserId);
    if (!provisioned) {
      const { error: rollbackError } = await client.auth.admin.deleteUser(authUserId);
      if (rollbackError) {
        console.error('manage-employee-user: orphan email auth rollback failed', rollbackError.code);
        throw new HttpError(
          500,
          'O convite não foi concluído e requer reconciliação antes de uma nova tentativa.',
        );
      }
      throwRpcError(provisionError, 'Não foi possível vincular o convite à empresa.');
    }
  }

  const { error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectUrl(),
    data: { nome, conta_gerenciada: true },
  });
  if (inviteError) {
    await compensateEmailProvisioning(client, actorUserId, authUserId);
    throw new HttpError(503, 'Não foi possível enviar o e-mail de convite. Tente novamente.');
  }

  return jsonResponse({ ok: true, usuario: provisioned, invite_sent: true }, 201);
};

export const completeFirstAccess = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  const passwordError = validatePassword(payload.password);
  if (passwordError) throw new InputValidationError(passwordError);

  const client = createServiceClient();
  const actorUserId = await authenticateActor(request, client);
  const { data: preparedValue, error: prepareError } = await client.rpc(
    'preparar_primeiro_acesso_usuario_gerenciado',
    { p_actor_user_id: actorUserId },
  );
  if (prepareError || !preparedValue) {
    throwRpcError(prepareError, 'Não foi possível validar o primeiro acesso.');
  }
  const prepared = asRecord(preparedValue);
  const specificPasswordError = validatePassword(payload.password, prepared.cpf);
  if (specificPasswordError) throw new InputValidationError(specificPasswordError);

  let targetVersion = prepared.target_credential_version;
  if (prepared.transition_state === 'pending_database') {
    targetVersion = crypto.randomUUID();
    const { error: confirmError } = await client.rpc(
      'confirmar_primeiro_acesso_usuario_gerenciado',
      { p_actor_user_id: actorUserId, p_credential_version: targetVersion },
    );
    if (confirmError) {
      throwRpcError(confirmError, 'Não foi possível confirmar o primeiro acesso.');
    }
  } else if (prepared.transition_state !== 'pending_auth') {
    throw new HttpError(409, 'O primeiro acesso já foi concluído.');
  }
  if (!isUuid(targetVersion)) {
    throw new HttpError(500, 'Não foi possível concluir o primeiro acesso.');
  }

  const { data: currentUser, error: currentUserError } = await client.auth.admin.getUserById(
    actorUserId,
  );
  if (currentUserError || !currentUser.user) {
    throw new HttpError(500, 'Não foi possível concluir o primeiro acesso.');
  }
  const { error: updateError } = await client.auth.admin.updateUserById(actorUserId, {
    password: payload.password as string,
    app_metadata: {
      ...currentUser.user.app_metadata,
      credential_version: targetVersion,
    },
  });
  if (updateError) {
    throw new HttpError(503, 'Não foi possível salvar a nova senha. Tente novamente.');
  }

  return jsonResponse({
    ok: true,
    usuario_id: prepared.usuario_id,
    login_method: prepared.login_method,
    must_change_password: false,
  });
};

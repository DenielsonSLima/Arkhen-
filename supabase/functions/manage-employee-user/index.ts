import {
  InputValidationError,
  isUuid,
  normalizeContactEmail,
  normalizeCpf,
  normalizeEmployeeName,
  normalizePhone,
  parseAccessConfig,
  parseCpfLoginCredentials,
  parseEmployeeStatus,
  validateEmployeeName,
  validatePassword,
} from './validation.ts';
import {
  HttpError,
  type JsonRecord,
  asRecord,
  authenticateActor,
  corsHeaders,
  createLoginClient,
  createServiceClient,
  jsonResponse,
  readLimitedBody,
} from './runtime.ts';

const AUTH_ALIAS_PATTERN = /^[0-9a-f]{64}@[a-z0-9.-]+\.[a-z]{2,63}$/;

const throwRpcError = (
  error: { code?: string; message?: string } | null,
  fallback: string,
): never => {
  if (error?.code === '42501') throw new HttpError(403, 'Ação não autorizada.');
  if (error?.code === '23505') {
    throw new HttpError(409, 'Não foi possível criar o funcionário.');
  }
  if (error?.code === '22023' || error?.code === '23514' || error?.code === 'P0002') {
    throw new HttpError(400, error.message || fallback);
  }
  throw new HttpError(500, fallback);
};

const publicEmployee = (value: unknown): JsonRecord => {
  const user = asRecord(value);
  return {
    id: user.id,
    empresa_id: user.empresa_id,
    auth_user_id: user.auth_user_id,
    perfil_id: user.perfil_id,
    perfil_acesso_id: user.perfil_acesso_id,
    nome: user.nome,
    email: user.email ?? null,
    cpf: user.cpf,
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

const findProvisionedEmployee = async (
  client: ReturnType<typeof createServiceClient>,
  authUserId: string,
): Promise<{ usuario: JsonRecord | null; lookupFailed: boolean }> => {
  const { data: user, error: userError } = await client
    .from('configuracoes_usuarios')
    .select(
      'id,empresa_id,auth_user_id,perfil_id,perfil_acesso_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,login_method,must_change_password,created_at,updated_at',
    )
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (userError) return { usuario: null, lookupFailed: true };
  if (!user) return { usuario: null, lookupFailed: false };

  const { data: membership, error: membershipError } = await client
    .from('perfis')
    .select('id,papel')
    .eq('user_id', authUserId)
    .eq('empresa_id', user.empresa_id)
    .maybeSingle();
  if (membershipError || !membership || membership.papel !== 'membro') {
    return { usuario: null, lookupFailed: true };
  }

  return {
    usuario: publicEmployee({
      ...user,
      membership_id: membership.id,
      membership_papel: membership.papel,
    }),
    lookupFailed: false,
  };
};

const loginWithCpf = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  let credentials;
  try {
    credentials = parseCpfLoginCredentials(payload.cpf, payload.password);
  } catch {
    throw new HttpError(401, 'CPF ou senha inválidos.');
  }

  const serviceClient = createServiceClient();
  const { data: resolvedAlias, error: aliasError } = await serviceClient.rpc(
    'resolver_alias_autenticacao_funcionario_cpf',
    { p_cpf: credentials.cpf },
  );
  if (
    aliasError
    || typeof resolvedAlias !== 'string'
    || !AUTH_ALIAS_PATTERN.test(resolvedAlias)
  ) {
    throw new HttpError(503, 'Serviço temporariamente indisponível.');
  }
  const authAlias = resolvedAlias;

  const client = createLoginClient(request);
  const { data, error } = await client.auth.signInWithPassword({
    email: authAlias,
    password: credentials.password,
  });
  if (error || !data.session?.access_token || !data.session.refresh_token) {
    if (error?.status === 429) {
      throw new HttpError(429, 'CPF ou senha inválidos.');
    }
    if (error?.status && error.status >= 500) {
      throw new HttpError(503, 'Serviço temporariamente indisponível.');
    }
    throw new HttpError(401, 'CPF ou senha inválidos.');
  }

  const {
    data: context,
    error: contextError,
    status: contextStatus,
  } = await client.rpc('obter_contexto_usuario_atual');
  const validContext = (
    typeof context === 'object'
    && context !== null
    && !Array.isArray(context)
    && context.login_method === 'cpf'
    && context.auth_user_id === data.user.id
    && context.status === 'Ativo'
    && context.membership_papel === 'membro'
  );
  if (contextError || !validContext) {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      // Best effort: nunca sobrescreve o erro generico do login bloqueado.
    }
    if (contextStatus >= 500) {
      throw new HttpError(503, 'Serviço temporariamente indisponível.');
    }
    throw new HttpError(401, 'CPF ou senha inválidos.');
  }

  return jsonResponse({
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
};

const createEmployee = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  const cpf = normalizeCpf(payload.cpf);
  const passwordError = validatePassword(payload.password, cpf);
  const nameError = validateEmployeeName(payload.nome);
  const profileId = payload.perfil_id ?? payload.perfilId;
  if (nameError) throw new InputValidationError(nameError);
  if (passwordError) throw new InputValidationError(passwordError);
  if (!isUuid(profileId)) throw new InputValidationError('Selecione um perfil válido.');

  const nome = normalizeEmployeeName(payload.nome);
  const email = normalizeContactEmail(payload.email);
  const telefone = normalizePhone(payload.telefone);
  const status = parseEmployeeStatus(payload.status);
  const accessConfig = parseAccessConfig(payload.access_config ?? payload.accessConfig);
  const rpcPayload = {
    nome,
    cpf,
    email,
    telefone,
    status,
    perfil_id: profileId,
    access_config: accessConfig,
  };

  const client = createServiceClient();
  const actorUserId = await authenticateActor(request, client);
  const { data: preparedValue, error: prepareError } = await client.rpc(
    'preparar_provisionamento_funcionario_cpf',
    { p_actor_user_id: actorUserId, p_payload: rpcPayload },
  );
  if (prepareError || !preparedValue) {
    throwRpcError(prepareError, 'Não foi possível validar o cadastro.');
  }
  const prepared = asRecord(preparedValue);
  if (
    typeof prepared.perfil_nome !== 'string'
    || typeof prepared.auth_alias !== 'string'
    || !AUTH_ALIAS_PATTERN.test(prepared.auth_alias)
  ) {
    throw new HttpError(500, 'Não foi possível validar o cadastro.');
  }
  const authAlias = prepared.auth_alias;

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email: authAlias,
    password: payload.password as string,
    email_confirm: true,
    user_metadata: { nome, perfil: prepared.perfil_nome },
    app_metadata: { login_method: 'cpf', account_type: 'employee_cpf' },
  });
  if (createError || !created.user?.id) {
    throw new HttpError(409, 'Não foi possível criar o funcionário.');
  }

  const authUserId = created.user.id;
  const { data: provisioned, error: provisionError } = await client.rpc(
    'provisionar_usuario_funcionario_cpf',
    {
      p_actor_user_id: actorUserId,
      p_auth_user_id: authUserId,
      p_payload: rpcPayload,
    },
  );

  if (provisionError || !provisioned) {
    const recovered = await findProvisionedEmployee(client, authUserId);
    if (recovered.usuario) {
      return jsonResponse({ ok: true, usuario: recovered.usuario }, 201);
    }
    if (recovered.lookupFailed) {
      throw new HttpError(
        500,
        'Não foi possível confirmar o cadastro; nenhuma remoção automática foi executada.',
      );
    }

    const { error: rollbackError } = await client.auth.admin.deleteUser(authUserId);
    if (rollbackError) {
      console.error('manage-employee-user: auth rollback failed', rollbackError.code);
      throw new HttpError(
        500,
        'O cadastro não foi concluído e requer reconciliação antes de uma nova tentativa.',
      );
    }
    throwRpcError(provisionError, 'Não foi possível concluir o cadastro.');
  }

  return jsonResponse({ ok: true, usuario: publicEmployee(provisioned) }, 201);
};

const resetPassword = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  const userId = payload.usuario_id ?? payload.usuarioId;
  if (!isUuid(userId)) throw new InputValidationError('Funcionário inválido.');
  const initialPasswordError = validatePassword(payload.password);
  if (initialPasswordError) throw new InputValidationError(initialPasswordError);

  const client = createServiceClient();
  const actorUserId = await authenticateActor(request, client);
  const { data: preparedValue, error: prepareError } = await client.rpc(
    'preparar_reset_senha_funcionario_cpf',
    { p_actor_user_id: actorUserId, p_usuario_id: userId },
  );
  if (prepareError || !preparedValue) {
    throwRpcError(prepareError, 'Não foi possível validar a redefinição de senha.');
  }

  const prepared = asRecord(preparedValue);
  const passwordError = validatePassword(payload.password, prepared.cpf);
  if (passwordError) throw new InputValidationError(passwordError);
  if (!isUuid(prepared.auth_user_id)) {
    throw new HttpError(500, 'Não foi possível redefinir a senha.');
  }

  const { error: updateError } = await client.auth.admin.updateUserById(
    prepared.auth_user_id,
    { password: payload.password as string },
  );
  if (updateError) throw new HttpError(500, 'Não foi possível redefinir a senha.');

  const { error: confirmError } = await client.rpc(
    'confirmar_reset_senha_funcionario_cpf',
    { p_actor_user_id: actorUserId, p_usuario_id: userId },
  );
  if (confirmError) {
    throw new HttpError(500, 'Senha alterada, mas a auditoria não pôde ser confirmada.');
  }

  return jsonResponse({
    ok: true,
    usuario_id: userId,
    must_change_password: false,
  });
};

const changeOwnPassword = async (
  request: Request,
  payload: JsonRecord,
): Promise<Response> => {
  const initialPasswordError = validatePassword(payload.password);
  if (initialPasswordError) throw new InputValidationError(initialPasswordError);

  const client = createServiceClient();
  const actorUserId = await authenticateActor(request, client);
  const { data: preparedValue, error: prepareError } = await client.rpc(
    'preparar_alteracao_senha_propria_funcionario_cpf',
    { p_actor_user_id: actorUserId },
  );
  if (prepareError || !preparedValue) {
    throwRpcError(prepareError, 'Não foi possível validar a alteração de senha.');
  }

  const prepared = asRecord(preparedValue);
  const passwordError = validatePassword(payload.password, prepared.cpf);
  if (passwordError) throw new InputValidationError(passwordError);
  if (prepared.auth_user_id !== actorUserId || !isUuid(prepared.usuario_id)) {
    throw new HttpError(500, 'Não foi possível alterar a senha.');
  }

  const { error: updateError } = await client.auth.admin.updateUserById(
    actorUserId,
    { password: payload.password as string },
  );
  if (updateError) throw new HttpError(500, 'Não foi possível alterar a senha.');

  const { error: confirmError } = await client.rpc(
    'confirmar_alteracao_senha_propria_funcionario_cpf',
    { p_actor_user_id: actorUserId },
  );
  if (confirmError) {
    throw new HttpError(500, 'Senha alterada, mas a auditoria não pôde ser confirmada.');
  }

  return jsonResponse({
    ok: true,
    usuario_id: prepared.usuario_id,
    must_change_password: false,
  });
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405);
  }

  try {
    const payload = await readLimitedBody(request);
    if (payload.action === 'login') return await loginWithCpf(request, payload);
    if (payload.action === 'create') return await createEmployee(request, payload);
    if (payload.action === 'reset_password') return await resetPassword(request, payload);
    if (payload.action === 'change_own_password') {
      return await changeOwnPassword(request, payload);
    }
    throw new InputValidationError('Ação inválida.');
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ ok: false, error: error.message }, error.status);
    }
    if (error instanceof InputValidationError) {
      return jsonResponse({ ok: false, error: error.message }, 400);
    }
    return jsonResponse({ ok: false, error: 'Não foi possível processar a solicitação.' }, 500);
  }
});

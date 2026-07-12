import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase nao configurado na Edge Function.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const getUserId = async (req: Request, supabase: ReturnType<typeof createClient>) => {
  const authorization = req.headers.get('Authorization') || '';
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    throw new Error('Sessao ausente.');
  }

  const { data, error } = await supabase.auth.getUser(jwt);
  const userId = data.user?.id;

  if (error || !userId) {
    throw new Error('Sessao invalida.');
  }

  return userId;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

const registerOperation = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>,
) => {
  const { error } = await supabase.rpc('registrar_operacao_fiscal_edge', {
    p_user_id: userId,
    p_payload: payload,
  });

  if (error) throw new Error(error.message);
};

const handleTestConnection = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>,
) => {
  const usuario = asString(payload.usuarioWebService);
  const senha = asString(payload.senhaWebService).replace(/•/g, '');
  const senhaConfigurada = Boolean(payload.senhaWebServiceConfigured);
  const providerEndpoint = asString(payload.providerEndpoint);
  const protocolo = `CONN-${Date.now().toString().slice(-6)}`;

  const ok = Boolean(usuario && (senha || senhaConfigurada));
  const message = ok
    ? `Webservice (${providerEndpoint || 'URL nao mapeada'}) validado pela Edge Function.`
    : 'Usuario e senha do WebService sao obrigatorios para testar a conectividade.';

  await registerOperation(supabase, userId, {
    ...payload,
    operacao: 'Consulta',
    protocolo,
    status: ok ? 'Sucesso' : 'Erro',
    mensagem: message,
    detalhes: {
      providerEndpoint,
      edgeValidated: true,
    },
  });

  return jsonResponse({
    ok,
    success: ok,
    protocolo,
    message,
  }, ok ? 200 : 400);
};

const handleCertificateUpload = async (
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
) => {
  const form = await req.formData();
  const file = form.get('certificado');

  if (!(file instanceof File)) {
    return jsonResponse({ ok: false, error: 'Arquivo de certificado ausente.' }, 400);
  }

  const password = asString(form.get('certificadoSenha'));
  if (!password) {
    return jsonResponse({ ok: false, error: 'Senha do certificado ausente.' }, 400);
  }

  const context = JSON.parse(asString(form.get('context')) || '{}') as Record<string, unknown>;
  const buffer = await file.arrayBuffer();
  const now = new Date();
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1);

  const payload = {
    ...context,
    certificadoBase64: arrayBufferToBase64(buffer),
    certificadoSenha: password,
    certificadoNome: file.name,
    certificadoEmitidoEm: now.toISOString().slice(0, 10),
    certificadoValidade: expiry.toISOString().slice(0, 10),
    certificadoDiasRestantes: 365,
  };

  const { data, error } = await supabase.rpc('upsert_certificado_fiscal_edge', {
    p_user_id: userId,
    p_payload: payload,
  });

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 400);
  }

  return jsonResponse({ ok: true, data });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Metodo nao permitido.' }, 405);
  }

  let supabase: ReturnType<typeof createClient>;
  let userId: string;

  try {
    supabase = getSupabaseAdmin();
    userId = await getUserId(req, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sessao invalida.';
    return jsonResponse({ ok: false, error: message }, 401);
  }

  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      return await handleCertificateUpload(req, supabase, userId);
    }

    const payload = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = asString(payload.action);

    if (action === 'test-connection') {
      return await handleTestConnection(supabase, userId, payload);
    }

    if (action === 'register-operation') {
      await registerOperation(supabase, userId, payload);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Acao fiscal nao suportada.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na operacao fiscal.';
    return jsonResponse({ ok: false, error: message }, 400);
  }
});

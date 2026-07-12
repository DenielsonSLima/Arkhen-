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
const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const deleteAsaasPayment = async (baseUrl: string, apiKey: string, paymentId: string) => {
  const response = await fetch(`${baseUrl}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = Array.isArray(data?.errors)
      ? data.errors.map((item: Record<string, unknown>) => item.description || item.message).filter(Boolean).join('; ')
      : '';
    throw new Error(errors || data?.message || `Asaas retornou HTTP ${response.status}`);
  }

  return data as Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Metodo nao permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Supabase nao configurado na Edge Function.' }, 500);
  }

  const authorization = req.headers.get('Authorization') || '';
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    return jsonResponse({ ok: false, error: 'Sessao ausente.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  const userId = userData.user?.id;

  if (userError || !userId) {
    return jsonResponse({ ok: false, error: 'Sessao invalida.' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Payload JSON invalido.' }, 400);
  }

  const cobrancaId = asString(payload.cobranca_id);
  if (!cobrancaId) {
    return jsonResponse({ ok: false, error: 'Cobranca obrigatoria.' }, 400);
  }

  try {
    const { data: prepared, error: prepareError } = await supabase.rpc('preparar_baixa_manual_asaas', {
      p_user_id: userId,
      p_cobranca_id: cobrancaId,
    });

    if (prepareError) throw new Error(prepareError.message);

    const preparedData = asRecord(prepared);
    const shouldCancelAsaas = preparedData.cancelAsaas === true;
    const baseUrl = asString(preparedData.baseUrl);
    const apiKey = asString(preparedData.apiKey);
    const paymentId = asString(preparedData.paymentId);
    let asaasResult: Record<string, unknown> = { skipped: true, reason: 'asaas_payment_absent' };

    if (shouldCancelAsaas) {
      if (!baseUrl || !apiKey || !paymentId) {
        throw new Error('Dados Asaas incompletos para cancelar a cobranca.');
      }
      asaasResult = await deleteAsaasPayment(baseUrl, apiKey, paymentId);
    }

    const { data: saved, error: saveError } = await supabase.rpc('registrar_baixa_manual_financeira', {
      p_user_id: userId,
      p_cobranca_id: cobrancaId,
      p_asaas_payload: {
        cancelledAt: new Date().toISOString(),
        cancelAsaas: shouldCancelAsaas,
        paymentId,
        result: asaasResult,
      },
    });

    if (saveError) throw new Error(saveError.message);

    return jsonResponse({
      ok: true,
      asaasCancelled: shouldCancelAsaas,
      cobranca: saved as Record<string, unknown>,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao registrar baixa manual.';
    return jsonResponse({ ok: false, error: message }, 400);
  }
});

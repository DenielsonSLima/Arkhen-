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
const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toBillingType = (meioPagamento: string) => {
  const normalized = meioPagamento.toLowerCase();
  if (normalized === 'pix') return 'PIX';
  if (normalized === 'ambos') return 'BOLETO';
  return 'BOLETO';
};

const callAsaas = async (
  baseUrl: string,
  apiKey: string,
  path: string,
  payload?: Record<string, unknown>,
  method = 'POST',
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
    },
    body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
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

const getPixQrCodeWithRetry = async (baseUrl: string, apiKey: string, paymentId: string) => {
  const delays = [0, 400, 900, 1600];
  let lastError = '';

  for (const delay of delays) {
    if (delay > 0) await wait(delay);
    try {
      const pixQrCode = await callAsaas(baseUrl, apiKey, `/payments/${paymentId}/pixQrCode`, undefined, 'GET');
      if (asString(pixQrCode.payload)) return pixQrCode;
      lastError = 'Asaas retornou Pix sem copia e cola.';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Falha ao recuperar Pix.';
    }
  }

  return lastError ? { error: lastError } : {};
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

  try {
    const { data: prepared, error: prepareError } = await supabase.rpc('preparar_cobranca_asaas', {
      p_user_id: userId,
      p_payload: payload,
    });

    if (prepareError) throw new Error(prepareError.message);

    const preparedData = asRecord(prepared);
    const baseUrl = asString(preparedData.baseUrl);
    const apiKey = asString(preparedData.apiKey);
    const environment = asString(preparedData.environment);
    const cliente = asRecord(preparedData.cliente);
    const cobranca = asRecord(preparedData.cobranca);

    if (!baseUrl || !apiKey) {
      throw new Error('Credenciais Asaas incompletas.');
    }

    let asaasCustomerId = asString(cliente.asaasCustomerId);

    if (!asaasCustomerId) {
      const customerPayload: Record<string, unknown> = {
        name: asString(cliente.name),
        cpfCnpj: asString(cliente.cpfCnpj),
      };

      const email = asString(cliente.email);
      const phone = asString(cliente.phone);
      if (email) customerPayload.email = email;
      if (phone) customerPayload.mobilePhone = phone;

      const customer = await callAsaas(baseUrl, apiKey, '/customers', customerPayload);
      asaasCustomerId = asString(customer.id);
    }

    if (!asaasCustomerId) {
      throw new Error('Nao foi possivel criar cliente no Asaas.');
    }

    const billingType = toBillingType(asString(cobranca.meioPagamento));
    const descricao = asString(cobranca.descricao);
    const mensagemBoleto = asString(cobranca.mensagemBoleto);
    const descricaoAsaas = mensagemBoleto ? `${descricao}\n${mensagemBoleto}`.slice(0, 500) : descricao;
    const descontoPercentual = asNumber(cobranca.descontoPercentual);
    const jurosPercentual = asNumber(cobranca.jurosPercentual);
    const multaPercentual = asNumber(cobranca.multaPercentual);
    const paymentPayload: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType,
      value: Number(cobranca.valor || 0),
      dueDate: asString(cobranca.dataVencimento),
      description: descricaoAsaas,
      externalReference: asString(payload.external_reference) || crypto.randomUUID(),
    };

    if (descontoPercentual > 0) {
      paymentPayload.discount = {
        value: descontoPercentual,
        dueDateLimitDays: 0,
        type: 'PERCENTAGE',
      };
    }

    if (jurosPercentual > 0) {
      paymentPayload.interest = { value: jurosPercentual };
    }

    if (multaPercentual > 0) {
      paymentPayload.fine = {
        value: multaPercentual,
        type: 'PERCENTAGE',
      };
    }

    const payment = await callAsaas(baseUrl, apiKey, '/payments', paymentPayload);
    const paymentId = asString(payment.id);
    const pixQrCode = paymentId
      ? await getPixQrCodeWithRetry(baseUrl, apiKey, paymentId)
      : {};
    const paymentWithPix = Object.keys(pixQrCode).length > 0 ? { ...payment, pixQrCode } : payment;

    const { data: saved, error: saveError } = await supabase.rpc('registrar_cobranca_asaas', {
      p_user_id: userId,
      p_payload: {
        cliente_empresa_id: asString(cobranca.clienteEmpresaId),
        contrato_id: asString(cobranca.contratoId),
        descricao: asString(cobranca.descricao),
        categoria: asString(cobranca.categoria),
        valor: Number(cobranca.valor || 0),
        data_vencimento: asString(cobranca.dataVencimento),
        meio_pagamento: asString(cobranca.meioPagamento),
        ambiente: environment,
        asaas_customer_id: asaasCustomerId,
        regras: {
          desconto_percentual: descontoPercentual,
          juros_percentual: jurosPercentual,
          multa_percentual: multaPercentual,
          mensagem_boleto: mensagemBoleto,
        },
        payment: paymentWithPix,
      },
    });

    if (saveError) throw new Error(saveError.message);

    return jsonResponse({ ok: true, cobranca: saved as Record<string, unknown> });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar cobranca Asaas.';
    return jsonResponse({ ok: false, error: message }, 200);
  }
});

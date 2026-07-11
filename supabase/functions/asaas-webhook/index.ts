import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
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

  const accessToken = req.headers.get('asaas-access-token')?.trim();
  if (!accessToken) {
    return jsonResponse({ ok: false, error: 'Header asaas-access-token ausente.' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Payload JSON invalido.' }, 400);
  }

  const url = new URL(req.url);
  const ambiente = url.searchParams.get('ambiente') || url.searchParams.get('environment') || 'homologacao';

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.rpc('registrar_asaas_webhook_evento', {
    p_ambiente: ambiente,
    p_token: accessToken,
    p_payload: payload,
  });

  if (error) {
    const unauthorized = /token/i.test(error.message);
    return jsonResponse(
      { ok: false, error: error.message },
      unauthorized ? 401 : 500,
    );
  }

  return jsonResponse(data as Record<string, unknown>);
});

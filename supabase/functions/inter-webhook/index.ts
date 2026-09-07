import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/inter/http.ts";
import {
  createInterMtlsClient,
  getInterAccessToken,
  interApiRequest,
} from "../_shared/inter/client.ts";
import {
  assertOfficialInterEndpoints,
  getInterEndpoints,
} from "../_shared/inter/endpoints.ts";
import {
  asRecord,
  asString,
  parsePreparedConfig,
  readLimitedRequestText,
} from "../_shared/inter/validation.ts";
import {
  MAX_INTER_WEBHOOK_BYTES,
  parseInterWebhookPayload,
  parseWebhookRouteId,
} from "../_shared/inter/webhook.ts";
import { verifyInterWebhookBatch } from "../_shared/inter/webhook-verification.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ ok: false }, 405, false);
  if (
    !req.headers.get("content-type")?.toLowerCase().includes("application/json")
  ) {
    return jsonResponse({ ok: false }, 415, false);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false }, 503, false);
  }

  let webhookId: string;
  let ambiente: "producao" | "homologacao";
  let payload: ReturnType<typeof parseInterWebhookPayload>;
  try {
    const route = parseWebhookRouteId(req.url);
    webhookId = route.webhookId;
    ambiente = route.ambiente;
    const text = await readLimitedRequestText(req, MAX_INTER_WEBHOOK_BYTES);
    payload = parseInterWebhookPayload(text);
  } catch (error) {
    if (error instanceof Error && /limite/i.test(error.message)) {
      return jsonResponse({ ok: false }, 413, false);
    }
    return jsonResponse({ ok: false }, 400, false);
  }

  const account = asString(req.headers.get("x-conta-corrente"));
  if (account && !/^[0-9]{1,30}$/.test(account)) {
    return jsonResponse({ ok: false }, 400, false);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let client: Deno.HttpClient | null = null;
  try {
    const { data: prepared, error: preparationError } = await supabase.rpc(
      "preparar_inter_webhook",
      {
        p_webhook_id: webhookId,
        p_ambiente: ambiente,
        p_conta_corrente: account,
      },
    );
    if (preparationError || !prepared) {
      return jsonResponse({ ok: false }, 503, false);
    }
    const config = parsePreparedConfig(prepared);
    const endpoints = getInterEndpoints(
      ambiente === "producao" ? "producao" : "sandbox",
    );
    assertOfficialInterEndpoints(config, endpoints);
    config.baseUrl = endpoints.baseUrl;
    config.authUrl = endpoints.authUrl;
    client = createInterMtlsClient(config);
    const mtlsClient = client;
    // Never use the unauthenticated callback account header in a bank request.
    const verified = await verifyInterWebhookBatch(
      payload,
      endpoints,
      async (url, scopes) => {
        const token = await getInterAccessToken(config, mtlsClient, scopes);
        const response = await interApiRequest(
          url,
          token,
          config.contaCorrente,
          mtlsClient,
        );
        return await response.json();
      },
    );
    if (!verified.length) return jsonResponse({ ok: true }, 200, false);
    const { data, error } = await supabase.rpc(
      "registrar_inter_webhook_eventos",
      {
        p_webhook_id: webhookId,
        p_ambiente: ambiente,
        p_conta_corrente: config.contaCorrente,
        p_payload: verified,
      },
    );
    if (error) throw new Error("Falha ao persistir eventos verificados.");
    const response = asRecord(data);
    // A callback may race charge creation. Ask Inter to retry until it is linked.
    const ok = response.ok === true && Number(response.pendentes || 0) === 0;
    return jsonResponse({ ok }, ok ? 200 : 503, false);
  } catch {
    console.error("inter-webhook: verificacao ou persistencia indisponivel");
    return jsonResponse({ ok: false }, 503, false);
  } finally {
    client?.close();
  }
});

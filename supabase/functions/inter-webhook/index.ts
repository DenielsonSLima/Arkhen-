import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/inter/http.ts";
import {
  asString,
  readLimitedRequestText,
} from "../_shared/inter/validation.ts";
import {
  MAX_INTER_WEBHOOK_BYTES,
  parseInterWebhookPayload,
  parseWebhookRouteId,
} from "../_shared/inter/webhook.ts";

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
  if (!/^[1-9][0-9]*$/.test(account)) {
    return jsonResponse({ ok: false }, 401, false);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc(
    "registrar_inter_webhook_eventos",
    {
      p_webhook_id: webhookId,
      p_ambiente: ambiente,
      p_conta_corrente: account,
      p_payload: payload,
    },
  );

  if (error) {
    console.error("inter-webhook: falha ao persistir eventos");
    return jsonResponse({ ok: false }, 500, false);
  }

  const response = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : { ok: true };
  return jsonResponse({ ok: response.ok !== false }, 200, false);
});

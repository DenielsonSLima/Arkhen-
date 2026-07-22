import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBolePixCancelUrl } from "../_shared/inter/boleto-charge.ts";
import {
  createInterMtlsClient,
  getInterAccessToken,
  interApiRequest,
} from "../_shared/inter/client.ts";
import {
  assertOfficialInterEndpoints,
  getInterEndpoints,
} from "../_shared/inter/endpoints.ts";
import { corsHeaders, jsonResponse } from "../_shared/inter/http.ts";
import {
  asRecord,
  asString,
  parsePreparedConfig,
  readLimitedRequestText,
} from "../_shared/inter/validation.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Metodo nao permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: "Servico indisponivel." }, 503);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return jsonResponse({ ok: false, error: "Sessao ausente." }, 401);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  const userId = userData.user?.id;
  if (userError || !userId) return jsonResponse({ ok: false, error: "Sessao invalida." }, 401);

  let client: Deno.HttpClient | null = null;
  try {
    const body = asRecord(JSON.parse(await readLimitedRequestText(req, 16 * 1024)));
    const chargeId = asString(body.cobranca_id || body.cobrancaId);
    if (!UUID_PATTERN.test(chargeId)) throw new Error("Cobranca invalida.");
    const reason = (asString(body.motivo) || "Cancelamento solicitado no Arkhen").slice(0, 50);
    const { data, error } = await supabase.rpc("preparar_operacao_cobranca_inter", {
      p_user_id: userId,
      p_cobranca_id: chargeId,
    });
    if (error || !data) throw new Error(error?.message || "Cobranca indisponivel.");
    const prepared = asRecord(data);

    if (prepared.externa !== true) {
      const { data: cancelled, error: localError } = await supabase.rpc(
        "cancelar_cobranca_financeira",
        { p_cobranca_id: chargeId },
      );
      if (localError || !cancelled) throw new Error(localError?.message || "Cobranca nao cancelada.");
      return jsonResponse({ ok: true, externa: false });
    }

    const environment = asString(prepared.ambiente) === "producao" ? "producao" : "sandbox";
    const endpoints = getInterEndpoints(environment);
    const config = parsePreparedConfig(prepared);
    assertOfficialInterEndpoints(config, endpoints);
    config.baseUrl = endpoints.baseUrl;
    config.authUrl = endpoints.authUrl;
    const externalId = asString(prepared.externalId);
    if (!UUID_PATTERN.test(externalId)) throw new Error("Identificador Banco Inter invalido.");

    client = createInterMtlsClient(config);
    const token = await getInterAccessToken(config, client);
    const response = await interApiRequest(
      getBolePixCancelUrl(endpoints, externalId),
      token,
      config.contaCorrente,
      client,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivoCancelamento: reason }),
        acceptedStatuses: [200, 202, 204],
      },
    );
    const providerResult = response.status === 204
      ? { status: response.status }
      : asRecord(await response.json().catch(() => ({})));
    const { data: confirmed, error: confirmError } = await supabase.rpc(
      "confirmar_cancelamento_cobranca_inter",
      {
        p_user_id: userId,
        p_cobranca_id: chargeId,
        p_external_id: externalId,
        p_resultado: providerResult,
      },
    );
    if (confirmError || !confirmed) throw new Error("Banco cancelou, mas a confirmacao local falhou.");
    return jsonResponse({ ok: true, externa: true, externalId });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao cancelar cobranca.",
    }, 400);
  } finally {
    client?.close();
  }
});

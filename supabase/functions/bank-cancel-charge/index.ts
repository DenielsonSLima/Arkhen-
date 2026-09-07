import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertManagedCredentialVersion } from "../_shared/managed-auth.ts";
import { cancelInterCharge } from "../_shared/inter/cancel-charge.ts";
import {
  createInterMtlsClient,
  getInterAccessToken,
  getInterChargeScopes,
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "Servico indisponivel." }, 503);
  }

  const jwt = (req.headers.get("Authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  ).trim();
  if (!jwt) return jsonResponse({ ok: false, error: "Sessao ausente." }, 401);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  const user = userData.user;
  if (userError || !user?.id) {
    return jsonResponse({ ok: false, error: "Sessao invalida." }, 401);
  }
  try {
    assertManagedCredentialVersion(jwt, user);
  } catch {
    return jsonResponse({ ok: false, error: "Sessao invalida." }, 401);
  }
  const userId = user.id;

  let client: Deno.HttpClient | null = null;
  try {
    const body = asRecord(
      JSON.parse(await readLimitedRequestText(req, 16 * 1024)),
    );
    const chargeId = asString(body.cobranca_id || body.cobrancaId);
    if (!UUID_PATTERN.test(chargeId)) throw new Error("Cobranca invalida.");
    const reason =
      (asString(body.motivo) || "Cancelamento solicitado no Arkhen").slice(
        0,
        50,
      );
    const { data, error } = await supabase.rpc(
      "preparar_operacao_cobranca_inter",
      {
        p_user_id: userId,
        p_cobranca_id: chargeId,
      },
    );
    if (error || !data) {
      throw new Error(error?.message || "Cobranca indisponivel.");
    }
    const prepared = asRecord(data);

    if (prepared.externa !== true) {
      const userClient = createClient(supabaseUrl, serviceRoleKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: cancelled, error: localError } = await userClient.rpc(
        "cancelar_cobranca_financeira",
        { p_cobranca_id: chargeId },
      );
      if (localError || !cancelled) {
        throw new Error(localError?.message || "Cobranca nao cancelada.");
      }
      return jsonResponse({ ok: true, externa: false });
    }

    const environment = asString(prepared.ambiente) === "producao"
      ? "producao"
      : "sandbox";
    const endpoints = getInterEndpoints(environment);
    const config = parsePreparedConfig(prepared);
    assertOfficialInterEndpoints(config, endpoints);
    config.baseUrl = endpoints.baseUrl;
    config.authUrl = endpoints.authUrl;
    const externalId = asString(prepared.externalId);
    const storedType = asString(prepared.tipo);
    const tipo = storedType === "boleto" ? "bolepix" : storedType;
    if (tipo !== "pix" && tipo !== "bolepix") {
      throw new Error("Tipo da cobranca Banco Inter invalido.");
    }

    client = createInterMtlsClient(config);
    const token = await getInterAccessToken(
      config,
      client,
      getInterChargeScopes(tipo),
    );
    const providerResult = await cancelInterCharge({
      tipo,
      externalId,
      ambiente: asString(prepared.ambiente),
      endpoints,
      token,
      account: config.contaCorrente,
      client,
      reason,
    });
    const { data: confirmed, error: confirmError } = await supabase.rpc(
      providerResult.confirmado
        ? "confirmar_cancelamento_cobranca_inter"
        : "registrar_cancelamento_pendente_cobranca_inter",
      {
        p_user_id: userId,
        p_cobranca_id: chargeId,
        p_external_id: externalId,
        p_resultado: providerResult,
      },
    );
    if (confirmError || !confirmed) {
      throw new Error(
        "Resultado do cancelamento Inter nao foi salvo. Consulte novamente a cobranca.",
      );
    }
    return jsonResponse({
      ok: true,
      externa: true,
      externalId,
      cancelado: providerResult.confirmado,
      pendente: !providerResult.confirmado,
      message: providerResult.confirmado
        ? "Cobranca cancelada."
        : "Cancelamento aguardando confirmacao do Banco Inter.",
    }, providerResult.confirmado ? 200 : 202);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Falha ao cancelar cobranca.",
    }, 400);
  } finally {
    client?.close();
  }
});

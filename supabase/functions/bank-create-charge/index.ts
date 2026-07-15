import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildInterRegistrationPayload,
  createInterCharge,
} from "../_shared/inter/create-charge.ts";
import { corsHeaders, jsonResponse } from "../_shared/inter/http.ts";
import {
  asRecord,
  readLimitedRequestText,
} from "../_shared/inter/validation.ts";

const MAX_CHARGE_BODY_BYTES = 64 * 1024;

const parseChargeRequest = async (req: Request) => {
  const text = await readLimitedRequestText(req, MAX_CHARGE_BODY_BYTES);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Payload JSON invalido.");
  }
  const record = asRecord(payload);
  if (Object.keys(record).length === 0) throw new Error("Payload vazio.");
  return record;
};

const invokeAsaas = async (
  req: Request,
  supabaseUrl: string,
  payload: Record<string, unknown>,
) => {
  const authorization = req.headers.get("Authorization") || "";
  const apiKey = req.headers.get("apikey") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/asaas-create-payment`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          apikey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error("Nao foi possivel acionar a integracao Asaas.");
    }
    return asRecord(result);
  } finally {
    clearTimeout(timer);
  }
};

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

  const authorization = req.headers.get("Authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return jsonResponse({ ok: false, error: "Sessao ausente." }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return jsonResponse({ ok: false, error: "Sessao invalida." }, 401);
  }

  try {
    const payload = await parseChargeRequest(req);
    const { data: empresaId, error: companyError } = await supabase.rpc(
      "resolve_empresa_id_for_user",
      { p_user_id: userId },
    );
    if (companyError || typeof empresaId !== "string") {
      throw new Error("Usuario sem empresa ativa vinculada.");
    }

    const { data: integration, error: integrationError } = await supabase
      .from("configuracoes_integracao_bancaria")
      .select("provedor")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();
    if (integrationError || !integration?.provedor) {
      throw new Error("Selecione e valide um banco padrao antes de cobrar.");
    }

    if (integration.provedor === "asaas") {
      const result = await invokeAsaas(req, supabaseUrl, payload);
      return jsonResponse(result);
    }
    if (integration.provedor !== "inter") {
      throw new Error("Provedor bancario ativo nao suportado.");
    }

    const { error: providerError } = await supabase.rpc(
      "validar_provedor_bancario_ativo",
      { p_user_id: userId, p_provedor: "inter" },
    );
    if (providerError) throw new Error("Banco Inter nao esta ativo.");

    const { data: prepared, error: prepareError } = await supabase.rpc(
      "preparar_cobranca_inter",
      { p_user_id: userId, p_payload: payload },
    );
    if (prepareError || !prepared) {
      throw new Error(
        prepareError?.message || "Falha ao preparar cobranca Inter.",
      );
    }

    const execution = await createInterCharge(prepared, payload);
    const registration = buildInterRegistrationPayload(prepared, execution);
    const { data: saved, error: saveError } = await supabase.rpc(
      "registrar_cobranca_inter",
      { p_user_id: userId, p_payload: registration },
    );
    if (saveError) throw new Error(saveError.message);

    return jsonResponse({
      ok: true,
      provedor: "inter",
      cobranca: saved as Record<string, unknown>,
      integracao: {
        provedor: "inter",
        external_id: execution.externalId,
        tipo: execution.tipo,
        boleto_url: execution.invoiceUrl || null,
        pix_copia_cola: execution.pixCopiaECola || null,
        pix_qr_code: null,
        payload: execution.providerPayload,
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Falha ao gerar cobranca bancaria.";
    return jsonResponse({ ok: false, error: message }, 200);
  }
});

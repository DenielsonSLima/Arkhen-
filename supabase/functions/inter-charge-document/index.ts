import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBolePixPdfUrl } from "../_shared/inter/boleto-charge.ts";
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
} from "../_shared/inter/validation.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parsePublicToken = (url: string) => {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const index = parts.lastIndexOf("inter-charge-document");
  const token = index >= 0 ? parts[index + 1] || "" : "";
  if (!UUID_PATTERN.test(token)) throw new Error("Token invalido.");
  return token;
};

const decodeBase64 = (value: string) => {
  if (!value || value.length > 20 * 1024 * 1024) {
    throw new Error("Documento invalido.");
  }
  const binary = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "GET") return jsonResponse({ ok: false }, 405, false);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false }, 503, false);
  }

  let client: Deno.HttpClient | null = null;
  try {
    const publicToken = parsePublicToken(req.url);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc(
      "preparar_documento_cobranca_inter",
      {
        p_public_token: publicToken,
      },
    );
    if (error || !data) throw new Error("Cobranca indisponivel.");

    const prepared = asRecord(data);
    const environment = asString(prepared.ambiente) === "producao"
      ? "producao"
      : "sandbox";
    const externalId = asString(prepared.externalId);
    const config = parsePreparedConfig(prepared);
    const endpoints = getInterEndpoints(environment);
    assertOfficialInterEndpoints(config, endpoints);
    config.baseUrl = endpoints.baseUrl;
    config.authUrl = endpoints.authUrl;

    client = createInterMtlsClient(config);
    const token = await getInterAccessToken(config, client);
    const response = await interApiRequest(
      getBolePixPdfUrl(endpoints, externalId),
      token,
      config.contaCorrente,
      client,
    );
    const payload = asRecord(await response.json());
    const pdf = decodeBase64(asString(payload.pdf));
    return new Response(pdf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `inline; filename="boleto-inter-${externalId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return jsonResponse(
      { ok: false, error: "Documento indisponivel." },
      404,
      false,
    );
  } finally {
    client?.close();
  }
});

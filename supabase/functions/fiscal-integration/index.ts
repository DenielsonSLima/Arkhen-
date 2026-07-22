import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertCertificateMatchesCnpj,
  parseFiscalPkcs12,
} from "../_shared/webiss/certificate.ts";
import { validateWebIssWsdl } from "../_shared/webiss/connection.ts";
import { emitWebIssNfse } from "../_shared/webiss/emission.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } },
);
const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);
const asString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type RpcError = { message: string } | null;
type AdminClient = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error: RpcError;
    }>;
  };
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError }>;
};

const getAdmin = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Servico fiscal indisponivel.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as AdminClient;
};

const authenticate = async (req: Request, admin: AdminClient) => {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("Sessao ausente.");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user?.id) throw new Error("Sessao invalida.");
  return data.user.id;
};

const prepareWebIss = async (
  admin: AdminClient,
  userId: string,
  payload: Record<string, unknown>,
) => {
  const uf = asString(payload.uf).toUpperCase();
  const municipio = asString(payload.municipio).toLowerCase();
  const provider = asString(payload.provedor).toLowerCase();
  if (uf !== "SE" || municipio !== "itabaiana" || provider !== "webiss") {
    throw new Error("Esta operacao real esta habilitada somente para WebISS Itabaiana/SE.");
  }
  const rawClientId = asString(payload.cliente_id);
  const clientId = rawClientId && isUuid(rawClientId) ? rawClientId : null;
  const { data, error } = await admin.rpc("preparar_configuracao_webiss_itabaiana", {
    p_user_id: userId,
    p_cliente_id: clientId,
    p_ambiente: asString(payload.ambiente),
  });
  if (error || !data) throw new Error(error?.message || "Configuracao WebISS indisponivel.");
  return asRecord(data);
};

const logOperation = async (
  admin: AdminClient, userId: string, prepared: Record<string, unknown>,
  status: "Sucesso" | "Erro", message: string, details: Record<string, unknown>,
) => {
  await admin.rpc("registrar_operacao_fiscal_edge", {
    p_user_id: userId,
    p_payload: {
      fiscal_config_id: asString(prepared.fiscalConfigId),
      operacao: "Consulta",
      protocolo: `WEBISS-${Date.now().toString().slice(-8)}`,
      status,
      mensagem: message,
      detalhes: details,
    },
  });
};

const validatePreparedCertificate = (prepared: Record<string, unknown>) => {
  const certificate = parseFiscalPkcs12(
    asString(prepared.certificadoBase64),
    asString(prepared.certificadoSenha),
  );
  const metadata = asRecord(prepared.certificadoMetadata);
  assertCertificateMatchesCnpj(certificate, asString(metadata.certificadoCNPJ));
  return certificate;
};

const handleJsonAction = async (
  admin: AdminClient, userId: string, payload: Record<string, unknown>,
) => {
  const action = asString(payload.action);
  if (action === "emit-nfse") {
    const chargeId = asString(payload.cobranca_id || payload.cobrancaId);
    if (!isUuid(chargeId)) return jsonResponse({ ok: false, error: "Cobranca invalida." }, 400);
    const { data, error } = await admin.rpc("preparar_emissao_nfse_webiss", {
      p_user_id: userId,
      p_cobranca_id: chargeId,
    });
    if (error || !data) throw new Error(error?.message || "Emissao fiscal indisponivel.");
    const prepared = asRecord(data);
    if (prepared.jaEmitida === true) {
      return jsonResponse({ ok: true, success: true, nfseId: asString(prepared.nfseId), jaEmitida: true });
    }
    const certificate = validatePreparedCertificate(prepared);
    const result = await emitWebIssNfse(prepared, certificate);
    const { data: nfseId, error: confirmError } = await admin.rpc("confirmar_emissao_nfse_webiss", {
      p_user_id: userId,
      p_cobranca_id: chargeId,
      p_nfse_id: result.nfseId,
      p_protocolo: result.protocolo,
      p_payload: result.payload,
    });
    if (confirmError || !nfseId) throw new Error("NFS-e emitida, mas a confirmacao local falhou.");
    return jsonResponse({ ok: true, success: true, nfseId, protocolo: result.protocolo });
  }
  if (action === "register-operation") {
    const { error } = await admin.rpc("registrar_operacao_fiscal_edge", {
      p_user_id: userId,
      p_payload: payload,
    });
    if (error) throw new Error(error.message);
    return jsonResponse({ ok: true });
  }
  if (action !== "test-connection" && action !== "test-certificate") {
    return jsonResponse({ ok: false, error: "Acao fiscal nao suportada." }, 400);
  }

  const prepared = await prepareWebIss(admin, userId, payload);
  try {
    const certificate = validatePreparedCertificate(prepared);
    const baseResult = {
      certificateValidFrom: certificate.validFrom,
      certificateValidUntil: certificate.validUntil,
      certificateDaysRemaining: certificate.daysRemaining,
      certificateSubject: certificate.subject,
      certificateCnpj: certificate.cnpj,
    };
    if (action === "test-certificate") {
      const message = "Certificado A1 e chave privada validados para assinatura XML.";
      await logOperation(admin, userId, prepared, "Sucesso", message, baseResult);
      return jsonResponse({ ok: true, success: true, message, ...baseResult });
    }

    const wsdl = await validateWebIssWsdl(asString(prepared.wsdlUrl));
    const message = "WSDL oficial de Itabaiana e certificado A1 validados. Integração pronta para homologação do CeC.";
    await logOperation(admin, userId, prepared, "Sucesso", message, { ...baseResult, ...wsdl });
    return jsonResponse({ ok: true, success: true, message, endpoint: prepared.endpoint, ...baseResult, ...wsdl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na validacao WebISS.";
    await logOperation(admin, userId, prepared, "Erro", message, {}).catch(() => undefined);
    throw error;
  }
};

const handleCertificateUpload = async (
  req: Request, admin: AdminClient, userId: string,
) => {
  const form = await req.formData();
  const file = form.get("certificado");
  if (!(file instanceof File)) return jsonResponse({ ok: false, error: "Certificado ausente." }, 400);
  if (file.size <= 0 || file.size > 3 * 1024 * 1024) {
    return jsonResponse({ ok: false, error: "O certificado deve ter no maximo 3 MB." }, 400);
  }
  if (!/\.(pfx|p12)$/i.test(file.name)) {
    return jsonResponse({ ok: false, error: "Envie um certificado .pfx ou .p12." }, 400);
  }
  const password = asString(form.get("certificadoSenha"));
  const context = asRecord(JSON.parse(asString(form.get("context")) || "{}"));
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const base64 = btoa(binary);
  const certificate = parseFiscalPkcs12(base64, password);
  const configuredCnpj = asString(context.certificadoCNPJ);
  assertCertificateMatchesCnpj(certificate, configuredCnpj);

  const { data, error } = await admin.rpc("upsert_certificado_fiscal_edge", {
    p_user_id: userId,
    p_payload: {
      ...context,
      certificadoBase64: base64,
      certificadoSenha: password,
      certificadoNome: file.name,
      certificadoEmpresa: certificate.subject,
      certificadoCNPJ: certificate.cnpj || configuredCnpj,
      certificadoEmitidoEm: certificate.validFrom.slice(0, 10),
      certificadoValidade: certificate.validUntil.slice(0, 10),
      certificadoDiasRestantes: certificate.daysRemaining,
    },
  });
  if (error) throw new Error(error.message);
  return jsonResponse({ ok: true, data });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Metodo nao permitido." }, 405);
  try {
    const admin = getAdmin();
    const userId = await authenticate(req, admin);
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      return await handleCertificateUpload(req, admin, userId);
    }
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > 64 * 1024) {
      return jsonResponse({ ok: false, error: "Payload acima do limite." }, 413);
    }
    return await handleJsonAction(admin, userId, asRecord(JSON.parse(text || "{}")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na operacao fiscal.";
    const status = /Sessao/.test(message) ? 401 : 400;
    return jsonResponse({ ok: false, success: false, error: message }, status);
  }
});

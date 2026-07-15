import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { X509Certificate } from "node:crypto";
import {
  getBoletoHealthUrl,
  getBoletoWebhookUrl,
} from "../_shared/inter/boleto.ts";
import {
  createInterMtlsClient,
  getInterAccessToken,
  getInterScopes,
  InterApiError,
  interApiRequest,
} from "../_shared/inter/client.ts";
import {
  assertOfficialInterEndpoints,
  getInterEndpoints,
} from "../_shared/inter/endpoints.ts";
import { corsHeaders, jsonResponse } from "../_shared/inter/http.ts";
import { getPixHealthUrl, getPixWebhookUrl } from "../_shared/inter/pix.ts";
import type { InterConnectionResult } from "../_shared/inter/types.ts";
import {
  parsePreparedConfig,
  parseTestRequest,
} from "../_shared/inter/validation.ts";

interface CertificateMetadata {
  certificateValidFrom: string;
  certificateValidUntil: string;
  certificateDaysRemaining: number;
}

const readCertificateMetadata = (certificatePem: string): CertificateMetadata => {
  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(certificatePem);
  } catch {
    throw new Error("Certificado X.509 invalido ou corrompido.");
  }

  const validFrom = new Date(certificate.validFrom);
  const validUntil = new Date(certificate.validTo);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
    throw new Error("Nao foi possivel identificar a validade do certificado X.509.");
  }

  return {
    certificateValidFrom: validFrom.toISOString(),
    certificateValidUntil: validUntil.toISOString(),
    certificateDaysRemaining: Math.ceil(
      (validUntil.getTime() - Date.now()) / 86_400_000,
    ),
  };
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
    return jsonResponse({
      ok: false,
      error: "Servico temporariamente indisponivel.",
    }, 500);
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
  const userId = userData.user?.id;
  if (userError || !userId) {
    return jsonResponse({ ok: false, error: "Sessao invalida." }, 401);
  }

  let requestData: Awaited<ReturnType<typeof parseTestRequest>>;
  try {
    requestData = await parseTestRequest(req);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Payload invalido.",
    }, 400);
  }

  let mtlsClient: Deno.HttpClient | null = null;
  let certificateMetadata: CertificateMetadata | null = null;
  try {
    const { data: prepared, error: prepareError } = await supabase.rpc(
      "preparar_configuracao_inter",
      {
        p_user_id: userId,
        p_ambiente: requestData.ambiente,
        p_acao: requestData.acao,
      },
    );
    if (prepareError) {
      throw new Error("Configuracao do Banco Inter indisponivel.");
    }

    const config = parsePreparedConfig(prepared);
    const endpoints = getInterEndpoints(requestData.ambiente);
    assertOfficialInterEndpoints(config, endpoints);
    config.baseUrl = endpoints.baseUrl;
    config.authUrl = endpoints.authUrl;

    certificateMetadata = readCertificateMetadata(config.certificadoPem);
    if (certificateMetadata.certificateDaysRemaining < 0) {
      throw new Error(
        `Certificado mTLS expirado em ${certificateMetadata.certificateValidUntil}.`,
      );
    }

    mtlsClient = createInterMtlsClient(config);
    const token = await getInterAccessToken(config, mtlsClient);

    if (requestData.acao === "configurar_webhook") {
      if (!config.modulos.webhook) {
        throw new Error("Modulo de webhook do Banco Inter esta desabilitado.");
      }
      if (!/^[0-9a-f-]{36}$/i.test(config.webhookId || "")) {
        throw new Error("Rota de webhook do Banco Inter invalida.");
      }
      const ambienteRota = requestData.ambiente === "producao"
        ? "producao"
        : "homologacao";
      const webhookUrl =
        `${supabaseUrl}/functions/v1/inter-webhook/${config.webhookId}/${ambienteRota}`;
      const configuredModules: string[] = [];
      const ignoredModules: string[] = [];

      if (config.modulos.boleto) {
        await interApiRequest(
          getBoletoWebhookUrl(endpoints),
          token,
          config.contaCorrente,
          mtlsClient,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webhookUrl }),
            acceptedStatuses: [204],
          },
        );
        configuredModules.push("boleto");
      }
      if (config.modulos.pix) {
        const pixKey = config.chavePix?.trim() || "";
        if (!pixKey || pixKey.length > 77) {
          if (requestData.ambiente === "sandbox") {
            ignoredModules.push("pix");
          } else {
            throw new Error("Chave Pix ausente ou invalida para o webhook.");
          }
        } else {
          await interApiRequest(
            getPixWebhookUrl(endpoints, pixKey),
            token,
            config.contaCorrente,
            mtlsClient,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ webhookUrl }),
              acceptedStatuses: [204],
            },
          );
          configuredModules.push("pix");
        }
      }
      if (configuredModules.length === 0) {
        throw new Error("Ative Boleto ou Pix antes de configurar o webhook.");
      }
      return jsonResponse({
        ok: true,
        acao: "configurar_webhook",
        ambiente: requestData.ambiente,
        webhookUrl,
        modulosConfigurados: configuredModules,
        modulosIgnorados: ignoredModules,
        message: ignoredModules.length > 0
          ? "Webhook de BolePix configurado. O Pix foi ignorado no Sandbox porque nenhuma chave foi informada."
          : "Webhook configurado no Banco Inter.",
        configuradoEm: new Date().toISOString(),
      });
    }

    if (requestData.ambiente === "producao") {
      if (!config.modulos.boleto && !config.modulos.pix) {
        throw new Error(
          "Ative Boleto ou Pix antes de testar as APIs de producao.",
        );
      }
      if (
        config.modulos.boleto || (config.modulos.webhook && !config.modulos.pix)
      ) {
        await interApiRequest(
          getBoletoHealthUrl(endpoints),
          token,
          config.contaCorrente,
          mtlsClient,
          { acceptedStatuses: [200, 404] },
        );
      } else {
        await interApiRequest(
          getPixHealthUrl(endpoints),
          token,
          config.contaCorrente,
          mtlsClient,
        );
      }
    }

    const result: InterConnectionResult = {
      ok: true,
      ambiente: requestData.ambiente,
      autenticacao: "validada",
      api: requestData.ambiente === "sandbox" ? "oauth_validado" : "validada",
      modulos: config.modulos,
      scopes: getInterScopes(config),
      testadoEm: new Date().toISOString(),
      message: requestData.ambiente === "sandbox"
        ? "Credenciais mTLS e OAuth validadas no Sandbox do Banco Inter. Nenhuma chave Pix ou conta corrente foi exigida."
        : "Credenciais mTLS, OAuth e APIs de producao validadas no Banco Inter.",
      ...certificateMetadata,
    };
    const { error: registerError } = await supabase.rpc(
      "registrar_inter_teste_conexao",
      {
        p_user_id: userId,
        p_ambiente: requestData.ambiente,
        p_resultado: result,
      },
    );
    if (registerError) {
      throw new Error("Nao foi possivel registrar o resultado do teste.");
    }

    return jsonResponse(result as unknown as Record<string, unknown>);
  } catch (error) {
    const status = error instanceof InterApiError && error.status >= 400 &&
        error.status < 600
      ? error.status
      : 400;
    const message = error instanceof Error
      ? error.message
      : "Falha ao testar o Banco Inter.";
    const inconclusive = error instanceof InterApiError &&
      [502, 503, 504].includes(error.status);
    if (requestData.acao === "teste") {
      await supabase.rpc("registrar_inter_teste_conexao", {
        p_user_id: userId,
        p_ambiente: requestData.ambiente,
        p_resultado: {
          ok: false,
          erro: message,
          inconclusivo: inconclusive,
          testadoEm: new Date().toISOString(),
          ...(certificateMetadata || {}),
        },
      });
    }
    return jsonResponse({
      ok: false,
      error: message,
      inconclusivo: inconclusive,
      code: inconclusive
        ? "inter_temporariamente_indisponivel"
        : "inter_validacao_falhou",
      ...(certificateMetadata || {}),
    }, status);
  } finally {
    mtlsClient?.close();
  }
});

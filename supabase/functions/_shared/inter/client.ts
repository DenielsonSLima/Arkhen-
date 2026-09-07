import { getBoletoScopes } from "./boleto.ts";
import { getPixScopes } from "./pix.ts";
import { getWebhookScopes } from "./webhook.ts";
import type {
  InterAccessToken,
  InterPreparedConfig,
  InterRequestOptions,
} from "./types.ts";

const tokenCache = new Map<string, InterAccessToken>();
const pendingTokenRequests = new Map<string, Promise<InterAccessToken>>();
const TOKEN_EXPIRY_SAFETY_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 12_000;

export class InterApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "InterApiError";
    this.status = status;
  }
}

export const getInterScopes = (config: InterPreparedConfig) => [
  ...new Set([
    ...getBoletoScopes(config.modulos),
    ...getPixScopes(config.modulos),
    ...getWebhookScopes(config.modulos),
  ]),
];

export const getInterChargeScopes = (tipo: "pix" | "bolepix") => (
  tipo === "pix"
    ? ["cobv.read", "cobv.write"]
    : ["boleto-cobranca.read", "boleto-cobranca.write"]
);

const tokenCacheKey = async (
  authUrl: string,
  clientId: string,
  scopes: string[],
  certificate: string,
  clientSecret: string,
) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([certificate, clientSecret])),
  );
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${authUrl}|${clientId}|${scopes.join(" ")}|${fingerprint}`;
};

const safeInterError = (status: number) => {
  if (status === 401 || status === 403) {
    return "Banco Inter rejeitou as credenciais, o certificado ou os escopos.";
  }
  if (status === 429) return "Limite de requisicoes do Banco Inter atingido.";
  if (status >= 500) return "Banco Inter esta temporariamente indisponivel.";
  return `Banco Inter retornou HTTP ${status}.`;
};

const fetchWithTimeout = async (
  url: string,
  client: Deno.HttpClient,
  init: RequestInit & { client: Deno.HttpClient },
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, client, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new InterApiError(
        url.endsWith("/oauth/v2/token")
          ? "A autenticacao OAuth do Banco Inter ficou inconclusiva por falta de resposta. Tente novamente mais tarde."
          : "Banco Inter nao respondeu dentro do prazo. O resultado da operacao ficou inconclusivo; consulte a cobranca antes de repetir a solicitacao.",
        504,
      );
    }
    throw new InterApiError(
      "Falha segura na conexao mTLS com o Banco Inter.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
};

export const createInterMtlsClient = (config: InterPreparedConfig) => {
  try {
    return Deno.createHttpClient({
      cert: config.certificadoPem,
      key: config.chavePrivadaPem,
    });
  } catch {
    throw new InterApiError(
      "Certificado ou chave privada rejeitados pelo runtime.",
      400,
    );
  }
};

export const getInterAccessToken = async (
  config: InterPreparedConfig,
  client: Deno.HttpClient,
  scopesOverride?: string[],
) => {
  const scopes = [...new Set(scopesOverride ?? getInterScopes(config))].sort();
  const key = await tokenCacheKey(
    config.authUrl,
    config.clientId,
    scopes,
    config.certificadoPem,
    config.clientSecret,
  );
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_SAFETY_MS) {
    return cached;
  }
  const pending = pendingTokenRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: scopes.join(" "),
    });
    const response = await fetchWithTimeout(config.authUrl, client, {
      client,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    }, DEFAULT_TIMEOUT_MS);

    if (!response.ok) {
      throw new InterApiError(safeInterError(response.status), response.status);
    }

    const payload = await response.json().catch(() => ({})) as Record<
      string,
      unknown
    >;
    const accessToken = typeof payload.access_token === "string"
      ? payload.access_token.trim()
      : "";
    const expiresIn = Number(payload.expires_in);
    if (!accessToken) {
      throw new InterApiError("Banco Inter retornou um token invalido.", 502);
    }

    const token: InterAccessToken = {
      accessToken,
      expiresAt: Date.now() +
        (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
      scope: scopes.join(" "),
    };
    tokenCache.set(key, token);
    return token;
  })();
  pendingTokenRequests.set(key, request);
  try {
    return await request;
  } finally {
    pendingTokenRequests.delete(key);
  }
};

export const interApiRequest = async (
  url: string,
  token: InterAccessToken,
  account: string,
  client: Deno.HttpClient,
  options: InterRequestOptions = {},
) => {
  const response = await fetchWithTimeout(url, client, {
    client,
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token.accessToken}`,
      ...(account ? { "x-conta-corrente": account } : {}),
      ...options.headers,
    },
    body: options.body,
  }, options.timeoutMs || DEFAULT_TIMEOUT_MS);

  const acceptedStatuses = options.acceptedStatuses || [200, 201, 204];
  if (!acceptedStatuses.includes(response.status)) {
    if (response.status === 401) {
      for (const [key, cached] of tokenCache) {
        if (cached === token) tokenCache.delete(key);
      }
    }
    throw new InterApiError(safeInterError(response.status), response.status);
  }
  return response;
};

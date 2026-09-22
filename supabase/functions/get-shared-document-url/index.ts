import { createClient } from "https://esm.sh/@supabase/supabase-js@2.109.0";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const MAX_BODY_BYTES = 4096;
const MAX_SIGNED_URL_SECONDS = 300;

const configuredOrigin =
  (Deno.env.get("APP_URL") || "https://arkhen.vercel.app")
    .replace(/\/+$/, "");

const isAllowedOrigin = (origin: string) => {
  if (origin === configuredOrigin) return true;
  try {
    const url = new URL(origin);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:");
  } catch {
    return false;
  }
};

const responseHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin)
    ? origin
    : configuredOrigin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
});

const jsonResponse = (
  payload: Record<string, unknown>,
  status: number,
  origin: string | null,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(origin),
  });

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) => (
    byte.toString(16).padStart(2, "0")
  )).join("");
};

const getFingerprint = async (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",").at(-1)
    ?.trim();
  const remoteAddress = req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    forwardedFor ||
    "unknown";
  return await sha256(remoteAddress);
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse({ ok: false }, 403, origin);
    }
    return new Response(null, {
      status: 204,
      headers: responseHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Método não permitido." },
      405,
      origin,
    );
  }
  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse(
      { ok: false, error: "Origem não permitida." },
      403,
      origin,
    );
  }
  if (
    !req.headers.get("content-type")?.toLowerCase().includes("application/json")
  ) {
    return jsonResponse(
      { ok: false, error: "Conteúdo inválido." },
      415,
      origin,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: "Serviço indisponível." },
      503,
      origin,
    );
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(
      { ok: false, error: "Conteúdo excede o limite." },
      413,
      origin,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(rawBody));
  } catch {
    return jsonResponse({ ok: false, error: "JSON inválido." }, 400, origin);
  }

  const shareGroupId = typeof parsed.shareGroupId === "string"
    ? parsed.shareGroupId.trim()
    : "";
  const shareRowId = typeof parsed.shareRowId === "string"
    ? parsed.shareRowId.trim()
    : "";
  const passwordHash = typeof parsed.passwordHash === "string"
    ? parsed.passwordHash.trim().toLowerCase()
    : null;

  if (!UUID_PATTERN.test(shareGroupId) || !UUID_PATTERN.test(shareRowId)) {
    return jsonResponse(
      { ok: false, error: "Compartilhamento inválido." },
      400,
      origin,
    );
  }
  if (passwordHash !== null && !SHA256_PATTERN.test(passwordHash)) {
    return jsonResponse(
      { ok: false, error: "Credencial inválida." },
      400,
      origin,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fingerprint = await getFingerprint(req);
  const { data, error } = await adminClient.rpc(
    "resolve_public_document_share_access",
    {
      p_share_group_id: shareGroupId,
      p_share_row_id: shareRowId,
      p_password_hash: passwordHash,
      p_fingerprint: fingerprint,
    },
  );

  if (error) {
    console.error("get-shared-document-url: falha ao autorizar acesso");
    return jsonResponse(
      { ok: false, error: "Não foi possível validar o link." },
      500,
      origin,
    );
  }

  const result = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  if (result.rate_limited === true) {
    return jsonResponse(
      {
        ok: false,
        error: "Muitas tentativas. Aguarde 15 minutos e tente novamente.",
      },
      429,
      origin,
    );
  }
  if (
    result.access_granted !== true ||
    typeof result.storage_bucket !== "string" ||
    typeof result.storage_path !== "string" ||
    typeof result.expires_at !== "string"
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "Link, senha ou arquivo indisponível.",
      },
      404,
      origin,
    );
  }
  if (result.storage_bucket !== "documentos") {
    return jsonResponse(
      { ok: false, error: "Arquivo indisponível." },
      404,
      origin,
    );
  }

  const remainingSeconds = Math.floor(
    (new Date(result.expires_at).getTime() - Date.now()) / 1000,
  );
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    return jsonResponse({ ok: false, error: "Link expirado." }, 410, origin);
  }
  const signedUrlSeconds = Math.max(
    1,
    Math.min(MAX_SIGNED_URL_SECONDS, remainingSeconds),
  );
  const { data: signed, error: signError } = await adminClient.storage
    .from(result.storage_bucket)
    .createSignedUrl(result.storage_path, signedUrlSeconds);

  if (signError || !signed?.signedUrl) {
    console.error(
      "get-shared-document-url: falha ao assinar objeto autorizado",
    );
    return jsonResponse(
      { ok: false, error: "Arquivo indisponível." },
      503,
      origin,
    );
  }

  return jsonResponse(
    {
      ok: true,
      signedUrl: signed.signedUrl,
      expiresIn: signedUrlSeconds,
    },
    200,
    origin,
  );
});

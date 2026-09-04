import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.6';
import {
  InputValidationError,
  isUuid,
  parseDefaultSupabaseSecretKey,
  parseForwardedFor,
} from './validation.ts';

const MAX_BODY_BYTES = 16 * 1024;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export type JsonRecord = Record<string, unknown>;

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const jsonResponse = (body: JsonRecord, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

export const asRecord = (value: unknown): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InputValidationError('Payload JSON inválido.');
  }
  return value as JsonRecord;
};

export const readLimitedBody = async (request: Request): Promise<JsonRecord> => {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Payload excede o limite permitido.');
  }

  if (!request.body) throw new InputValidationError('Payload JSON inválido.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'Payload excede o limite permitido.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return asRecord(JSON.parse(text));
  } catch (error) {
    if (error instanceof InputValidationError) throw error;
    throw new InputValidationError('Payload JSON inválido.');
  }
};

export const requireEnvironment = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'Serviço temporariamente indisponível.');
  return value;
};

const bearerToken = (request: Request): string => {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw new HttpError(401, 'Sessão ausente ou inválida.');
  return match[1];
};

const decodeJwtPayload = (token: string): JsonRecord => {
  const payload = token.split('.')[1];
  if (!payload) throw new HttpError(401, 'Sessão ausente ou inválida.');
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return asRecord(JSON.parse(atob(padded)));
  } catch {
    throw new HttpError(401, 'Sessão ausente ou inválida.');
  }
};

const assertManagedCredentialVersion = (
  token: string,
  appMetadata: JsonRecord,
) => {
  const accountType = appMetadata.account_type;
  if (accountType !== 'employee_cpf' && accountType !== 'employee_email') return;

  const claims = decodeJwtPayload(token);
  const tokenMetadata = asRecord(claims.app_metadata);
  const tokenVersion = tokenMetadata.credential_version;
  const currentVersion = appMetadata.credential_version;
  if (
    !isUuid(tokenVersion)
    || !isUuid(currentVersion)
    || tokenVersion !== currentVersion
  ) {
    throw new HttpError(401, 'Sessão ausente ou inválida.');
  }
};

export const createServiceClient = () => createClient(
  requireEnvironment('SUPABASE_URL'),
  requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const createLoginClient = (request: Request) => {
  let secretKey: string;
  let forwardedFor: string;
  try {
    secretKey = parseDefaultSupabaseSecretKey(
      requireEnvironment('SUPABASE_SECRET_KEYS'),
    );
    forwardedFor = parseForwardedFor(request.headers.get('x-forwarded-for'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Serviço temporariamente indisponível.');
  }

  return createClient(
    requireEnvironment('SUPABASE_URL'),
    secretKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'sb-forwarded-for': forwardedFor } },
    },
  );
};

export const authenticateActor = async (
  request: Request,
  client: ReturnType<typeof createServiceClient>,
): Promise<string> => {
  const token = bearerToken(request);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new HttpError(401, 'Sessão ausente ou inválida.');
  }
  assertManagedCredentialVersion(token, asRecord(data.user.app_metadata));
  return data.user.id;
};

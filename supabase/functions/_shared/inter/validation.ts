import type {
  InterEnvironment,
  InterModules,
  InterPreparedConfig,
} from "./types.ts";

const MAX_TEST_BODY_BYTES = 16 * 1024;

export const readLimitedRequestText = async (
  req: Request,
  maxBytes: number,
) => {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Payload excede o limite permitido.");
  }

  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("Payload excede o limite permitido.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
};

export const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export const asString = (value: unknown) => (
  typeof value === "string" ? value.trim() : ""
);

const asBoolean = (value: unknown) => value === true;

const pickString = (
  record: Record<string, unknown>,
  camel: string,
  snake: string,
) => (
  asString(record[camel]) || asString(record[snake])
);

const normalizePem = (value: string) => {
  const normalized = value.includes("\\n") && !value.includes("\n")
    ? value.replaceAll("\\n", "\n")
    : value;
  return normalized.trim();
};

const assertLength = (label: string, value: string, maxLength: number) => {
  if (!value || value.length > maxLength || value.includes("\0")) {
    throw new Error(`${label} ausente ou invalido.`);
  }
};

export const parseInterEnvironment = (value: unknown): InterEnvironment => {
  const normalized = asString(value).toLowerCase();
  if (normalized === "producao" || normalized === "production") {
    return "producao";
  }
  if (normalized === "sandbox" || normalized === "homologacao") {
    return "sandbox";
  }
  throw new Error("Ambiente do Banco Inter invalido.");
};

export const parseTestRequest = async (req: Request) => {
  const text = await readLimitedRequestText(req, MAX_TEST_BODY_BYTES);

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(text));
  } catch {
    throw new Error("Payload JSON invalido.");
  }

  const action = asString(payload.acao || payload.action).toLowerCase();
  if (action !== "teste" && action !== "configurar_webhook") {
    throw new Error("Acao nao permitida.");
  }

  return {
    ambiente: parseInterEnvironment(payload.ambiente || payload.environment),
    acao: action as "teste" | "configurar_webhook",
  };
};

const parseModules = (value: unknown): InterModules => {
  const modules = asRecord(value);
  return {
    boleto: asBoolean(modules.boleto),
    pix: asBoolean(modules.pix),
    webhook: asBoolean(modules.webhook),
  };
};

export const parsePreparedConfig = (value: unknown): InterPreparedConfig => {
  const prepared = asRecord(value);
  const certificadoPem = normalizePem(
    pickString(prepared, "certificadoPem", "certificado_pem"),
  );
  const chavePrivadaPem = normalizePem(
    pickString(prepared, "chavePrivadaPem", "chave_privada_pem"),
  );
  const config: InterPreparedConfig = {
    baseUrl: pickString(prepared, "baseUrl", "base_url"),
    authUrl: pickString(prepared, "authUrl", "auth_url"),
    clientId: pickString(prepared, "clientId", "client_id"),
    clientSecret: pickString(prepared, "clientSecret", "client_secret"),
    certificadoPem,
    chavePrivadaPem,
    contaCorrente: pickString(prepared, "contaCorrente", "conta_corrente"),
    chavePix: pickString(prepared, "chavePix", "chave_pix"),
    webhookId: pickString(prepared, "webhookId", "webhook_id"),
    modulos: parseModules(prepared.modulos || prepared.modules),
  };

  assertLength("Client ID", config.clientId, 256);
  assertLength("Client Secret", config.clientSecret, 2048);
  assertLength("Certificado", config.certificadoPem, 256 * 1024);
  assertLength("Chave privada", config.chavePrivadaPem, 128 * 1024);

  if (
    !/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(
      config.certificadoPem,
    )
  ) {
    throw new Error("Certificado PEM invalido.");
  }

  if (
    !/^-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC )?PRIVATE KEY-----$/
      .test(config.chavePrivadaPem)
  ) {
    throw new Error("Chave privada PEM invalida.");
  }

  if (config.contaCorrente && !/^[1-9][0-9]*$/.test(config.contaCorrente)) {
    throw new Error(
      "Conta corrente invalida. Informe somente numeros, sem zero a esquerda.",
    );
  }

  if (
    !config.modulos.boleto && !config.modulos.pix && !config.modulos.webhook
  ) {
    throw new Error("Ative ao menos um modulo do Banco Inter antes do teste.");
  }

  return config;
};

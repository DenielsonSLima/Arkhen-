/** Public diagnostics: only this catalog and bounded provider codes may cross the worker boundary. */
const CATALOG = {
  PREPARE_FAILED: [
    "prepare",
    "Nao foi possivel preparar a consulta autorizada.",
  ],
  PREPARE_CONTEXT: [
    "prepare",
    "O contexto da consulta fiscal e invalido ou divergente.",
  ],
  PREPARE_TENANT: [
    "prepare",
    "A configuracao fiscal nao pertence a empresa autorizada.",
  ],
  PREPARE_CUSTOMER: ["prepare", "O tomador nao pertence a empresa autorizada."],
  PREPARE_PERMISSION: [
    "prepare",
    "O banco recusou a permissao de preparacao da consulta.",
  ],
  PREPARE_RPC_MISSING: [
    "prepare",
    "A funcao de preparacao nao esta disponivel no banco.",
  ],
  PREPARE_TIMEOUT: [
    "prepare",
    "O banco interrompeu a preparacao por tempo limite.",
  ],
  CERTIFICATE_FAILED: [
    "certificate",
    "Nao foi possivel preparar o certificado A1.",
  ],
  CERTIFICATE_MISSING: [
    "certificate",
    "Certificado ausente ou acima do limite permitido.",
  ],
  CERTIFICATE_PASSWORD: [
    "certificate",
    "A senha do certificado esta ausente ou invalida.",
  ],
  CERTIFICATE_DECODE: [
    "certificate",
    "O certificado esta corrompido ou a senha nao permite abri-lo.",
  ],
  CERTIFICATE_KEY: [
    "certificate",
    "O arquivo nao contem certificado A1 e chave privada utilizaveis.",
  ],
  CERTIFICATE_VALIDITY: [
    "certificate",
    "O certificado esta fora do periodo de validade.",
  ],
  CERTIFICATE_IDENTITY: [
    "certificate",
    "Nao foi possivel confirmar o CNPJ titular do certificado.",
  ],
  CERTIFICATE_MISMATCH: [
    "certificate",
    "O certificado nao corresponde ao CNPJ do emitente.",
  ],
  TRANSPORT_FAILED: ["transport", "Falha de conexao segura com o WebISS."],
  TRANSPORT_GATE: [
    "transport",
    "Nao foi possivel reservar o intervalo seguro para consultar o WebISS. Tente novamente mais tarde.",
  ],
  TRANSPORT_CLIENT: [
    "transport",
    "Nao foi possivel criar o cliente HTTP com certificado A1.",
  ],
  TRANSPORT_UNSUPPORTED: [
    "transport",
    "Este ambiente nao suporta a criacao do cliente HTTP com certificado A1.",
  ],
  TRANSPORT_TIMEOUT: [
    "transport",
    "A consulta WebISS excedeu o tempo limite de conexao ou leitura.",
  ],
  TRANSPORT_HTTP_AUTH: [
    "transport",
    "O endpoint WebISS recusou a autenticacao HTTP da consulta.",
  ],
  TRANSPORT_HTTP_CLIENT: [
    "transport",
    "O endpoint WebISS recusou a requisicao HTTP de consulta.",
  ],
  TRANSPORT_HTTP_SERVER: [
    "transport",
    "O endpoint WebISS respondeu com falha HTTP de servidor.",
  ],
  TRANSPORT_HTTP: [
    "transport",
    "O endpoint WebISS respondeu com status HTTP inesperado.",
  ],
  VALIDATE_REQUEST: [
    "validate",
    "Os parametros nao permitem montar uma consulta WebISS valida.",
  ],
  VALIDATE_RESPONSE: [
    "validate",
    "A resposta WebISS nao passou na validacao de estrutura, identidade ou periodo.",
  ],
  VALIDATE_EMPTY_MESSAGES: [
    "validate",
    "O WebISS retornou uma lista de mensagens vazia sem notas validaveis.",
  ],
  VALIDATE_SOAP: ["validate", "O WebISS retornou uma falha SOAP na consulta."],
  VALIDATE_PROVIDER: [
    "validate",
    "O WebISS rejeitou a consulta; nenhum resultado foi confirmado.",
  ],
  VALIDATE_CHANGED: [
    "validate",
    "Uma nota mudou durante a paginacao; a consulta nao foi salva.",
  ],
  SAVE_FAILED: [
    "save",
    "A consulta foi recebida, mas o historico local nao foi atualizado.",
  ],
} as const;
export type ConsultationCode = keyof typeof CATALOG;
export type ConsultationStage =
  | "prepare"
  | "certificate"
  | "transport"
  | "validate"
  | "save";
export function safeProviderCodes(values: readonly unknown[]) {
  return [
    ...new Set(
      values.filter((v): v is string =>
        typeof v === "string" && v === v.trim() &&
        /^(?:[A-Z]{1,4})?[0-9]{1,6}$/.test(v)
      ),
    ),
  ].slice(0, 5);
}
export class ConsultationError extends Error {
  readonly stage: ConsultationStage;
  readonly providerCodes: string[];
  constructor(
    readonly code: ConsultationCode,
    providerCodes: readonly unknown[] = [],
  ) {
    super(CATALOG[code][1]);
    this.name = "ConsultationError";
    this.stage = CATALOG[code][0];
    this.providerCodes = code === "VALIDATE_PROVIDER"
      ? safeProviderCodes(providerCodes)
      : [];
  }
}
const errorRecord = (error: unknown): Record<string, unknown> =>
  error && typeof error === "object" ? error as Record<string, unknown> : {};
export function preparationError(error: unknown) {
  const data = errorRecord(error);
  const messages: Record<string, ConsultationCode> = {
    "Contexto de consulta invalido.": "PREPARE_CONTEXT",
    "Contexto fiscal fora da empresa.": "PREPARE_TENANT",
    "Tomador fora da empresa.": "PREPARE_CUSTOMER",
  };
  const sqlCodes: Record<string, ConsultationCode> = {
    "42501": "PREPARE_PERMISSION",
    "42883": "PREPARE_RPC_MISSING",
    "57014": "PREPARE_TIMEOUT",
    "22023": "PREPARE_CONTEXT",
    "22P02": "PREPARE_CONTEXT",
  };
  const knownMessage =
    typeof data.message === "string" && Object.hasOwn(messages, data.message)
      ? messages[data.message]
      : undefined;
  const knownCode =
    typeof data.code === "string" && Object.hasOwn(sqlCodes, data.code)
      ? sqlCodes[data.code]
      : undefined;
  return new ConsultationError(knownMessage || knownCode || "PREPARE_FAILED");
}
export function certificateError(error: unknown) {
  const message = errorRecord(error).message;
  const known: Record<string, ConsultationCode> = {
    "Certificado ausente ou acima do limite de 3 MB.": "CERTIFICATE_MISSING",
    "Arquivo de certificado invalido.": "CERTIFICATE_DECODE",
    "Senha do certificado ausente ou invalida.": "CERTIFICATE_PASSWORD",
    "Certificado PFX/P12 corrompido ou senha incorreta.": "CERTIFICATE_DECODE",
    "PFX/P12 sem chave privada ou certificado A1.": "CERTIFICATE_KEY",
    "Certificado ainda nao e valido.": "CERTIFICATE_VALIDITY",
    "O CNPJ configurado para o emitente e invalido.": "CERTIFICATE_IDENTITY",
    "Nao foi possivel identificar o CNPJ titular do certificado.":
      "CERTIFICATE_IDENTITY",
    "O CNPJ do certificado nao corresponde ao emitente configurado.":
      "CERTIFICATE_MISMATCH",
  };
  const code = typeof message === "string" && Object.hasOwn(known, message)
    ? known[message]
    : typeof message === "string" &&
        /^Certificado expirado em \d{4}-\d{2}-\d{2}\.$/.test(message)
    ? "CERTIFICATE_VALIDITY"
    : "CERTIFICATE_FAILED";
  return new ConsultationError(code);
}
export function clientCreationError(error: unknown) {
  // Exact runtime messages only. Unknown errors remain generic; no substring extraction.
  const message = errorRecord(error).message;
  const unsupported = [
    "Deno.createHttpClient is not a function",
    "Deno.createHttpClient is not supported",
    "Deno.createHttpClient is not supported in this environment",
    "Deno.createHttpClient is not implemented",
    "Not implemented: Deno.createHttpClient",
    "Not supported",
  ].includes(typeof message === "string" ? message : "");
  return new ConsultationError(
    unsupported ? "TRANSPORT_UNSUPPORTED" : "TRANSPORT_CLIENT",
  );
}
export function safeConsultationDiagnostic(error: unknown) {
  if (
    !(error instanceof ConsultationError) || !Object.hasOwn(CATALOG, error.code)
  ) return null;
  // Reconstruct everything from the catalog, even if an Error instance was mutated.
  const safe = new ConsultationError(
    error.code,
    Array.isArray(error.providerCodes) ? error.providerCodes : [],
  );
  const suffix = safe.providerCodes.length
    ? ` (${safe.providerCodes.join(",")})`
    : "";
  return {
    stage: safe.stage,
    code: safe.code,
    message: `[${safe.stage}/${safe.code}] ${safe.message}${suffix}`,
  };
}

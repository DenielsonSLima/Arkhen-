import type {
  InterEndpoints,
  InterEnvironment,
  InterPreparedConfig,
} from "./types.ts";

const INTER_PRODUCTION_BASE_URL = "https://cdpj.partners.bancointer.com.br";
const INTER_SANDBOX_BASE_URL = "https://cdpj-sandbox.partners.uatinter.co";

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getInterEndpoints = (
  environment: InterEnvironment,
): InterEndpoints => {
  const baseUrl = environment === "producao"
    ? INTER_PRODUCTION_BASE_URL
    : INTER_SANDBOX_BASE_URL;

  return {
    baseUrl,
    authUrl: `${baseUrl}/oauth/v2/token`,
    boletoUrl: `${baseUrl}/cobranca/v3`,
    pixUrl: `${baseUrl}/pix/v2`,
  };
};

export const assertOfficialInterEndpoints = (
  config: InterPreparedConfig,
  endpoints: InterEndpoints,
) => {
  if (
    config.baseUrl && withoutTrailingSlash(config.baseUrl) !== endpoints.baseUrl
  ) {
    throw new Error("Endpoint base do Banco Inter nao permitido.");
  }

  if (
    config.authUrl && withoutTrailingSlash(config.authUrl) !== endpoints.authUrl
  ) {
    throw new Error("Endpoint OAuth do Banco Inter nao permitido.");
  }
};

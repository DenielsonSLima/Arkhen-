export type InterEnvironment = "producao" | "sandbox";

export interface InterModules {
  boleto: boolean;
  pix: boolean;
  webhook: boolean;
}

export interface InterPreparedConfig {
  baseUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  certificadoPem: string;
  chavePrivadaPem: string;
  contaCorrente: string;
  chavePix?: string;
  webhookId?: string;
  modulos: InterModules;
}

export interface InterEndpoints {
  baseUrl: string;
  authUrl: string;
  boletoUrl: string;
  pixUrl: string;
}

export interface InterAccessToken {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

export interface InterConnectionResult {
  ok: boolean;
  ambiente: InterEnvironment;
  autenticacao: "validada";
  api: "validada";
  modulos: InterModules;
  scopes: string[];
  testadoEm: string;
}

export interface InterWebhookEvent extends Record<string, unknown> {
  codigoSolicitacao?: string;
  situacao?: string;
  origemRecebimento?: string;
  txid?: string;
  endToEndId?: string;
}

export interface RpcResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export interface RpcClient {
  rpc(
    functionName: string,
    params: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
}

export interface InterRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  acceptedStatuses?: number[];
  timeoutMs?: number;
}

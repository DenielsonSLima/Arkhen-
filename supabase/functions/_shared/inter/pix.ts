import type { InterEndpoints, InterModules } from "./types.ts";

export const INTER_PIX_SCOPES = [
  "cob.read",
  "cob.write",
  "cobv.read",
  "cobv.write",
] as const;

export const getPixScopes = (modules: InterModules) => (
  modules.pix ? [...INTER_PIX_SCOPES] : []
);

export const getPixHealthUrl = (
  endpoints: InterEndpoints,
  now = new Date(),
) => {
  const end = now.toISOString();
  const start = new Date(now.getTime() - 60_000).toISOString();
  const query = new URLSearchParams({
    inicio: start,
    fim: end,
    "paginacao.paginaAtual": "0",
    "paginacao.itensPorPagina": "10",
  });
  return `${endpoints.pixUrl}/cob?${query.toString()}`;
};

export const getPixWebhookUrl = (endpoints: InterEndpoints, pixKey: string) => (
  `${endpoints.pixUrl}/webhook/${encodeURIComponent(pixKey)}`
);

import type { InterEndpoints, InterModules } from "./types.ts";

export const INTER_BOLETO_SCOPES = [
  "boleto-cobranca.read",
  "boleto-cobranca.write",
] as const;

export const getBoletoScopes = (modules: InterModules) => (
  modules.boleto || (modules.webhook && !modules.pix)
    ? [...INTER_BOLETO_SCOPES]
    : []
);

export const getBoletoHealthUrl = (endpoints: InterEndpoints) => (
  `${endpoints.boletoUrl}/cobrancas/webhook`
);

export const getBoletoWebhookUrl = (endpoints: InterEndpoints) => (
  `${endpoints.boletoUrl}/cobrancas/webhook`
);

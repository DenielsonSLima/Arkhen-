import { asRecord, asString } from "./validation.ts";
import type { InterEndpoints, InterWebhookEvent } from "./types.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXID = /^[a-zA-Z0-9]{26,35}$/;
const E2EID = /^[a-zA-Z0-9]{32}$/;
const BOLETO_STATUSES = new Set([
  "RECEBIDO",
  "A_RECEBER",
  "MARCADO_RECEBIDO",
  "ATRASADO",
  "CANCELADO",
  "EXPIRADO",
  "FALHA_EMISSAO",
  "EM_PROCESSAMENTO",
  "PROTESTO",
]);
const PIX_STATUSES = new Set([
  "ATIVA",
  "CONCLUIDA",
  "REMOVIDA_PELO_USUARIO_RECEBEDOR",
  "REMOVIDA_PELO_PSP",
]);

// Callbacks identify resources only. Financial state comes exclusively from
// authenticated Inter GET responses, using the tenant's configured mTLS account.
export type InterWebhookLookup = (
  url: string,
  scopes: string[],
) => Promise<unknown>;

export const verifyInterWebhookEvent = async (
  event: InterWebhookEvent,
  endpoints: InterEndpoints,
  lookup: InterWebhookLookup,
): Promise<InterWebhookEvent | null> => {
  const codigoSolicitacao = asString(event.codigoSolicitacao);
  if (codigoSolicitacao) {
    if (!UUID.test(codigoSolicitacao)) {
      throw new Error("Identificador invalido.");
    }
    const response = asRecord(
      await lookup(
        `${endpoints.boletoUrl}/cobrancas/${codigoSolicitacao}`,
        ["boleto-cobranca.read"],
      ),
    );
    const charge = asRecord(response.cobranca);
    const status = asString(charge.situacao);
    if (
      asString(charge.codigoSolicitacao).toLowerCase() !==
        codigoSolicitacao.toLowerCase() ||
      !BOLETO_STATUSES.has(status)
    ) throw new Error("Resposta de cobranca Inter divergente.");
    return {
      tipo: "BOLETO",
      codigoSolicitacao: codigoSolicitacao.toLowerCase(),
      situacao: status,
      status,
      dadosBanco: response,
      dataSituacao: charge.dataSituacao,
      valorTotalRecebido: charge.valorTotalRecebido,
      origemRecebimento: asString(charge.origemRecebimento),
    };
  }

  let txid = asString(event.txid);
  if (!txid || txid === "***") {
    const endToEndId = asString(event.endToEndId);
    if (!E2EID.test(endToEndId)) throw new Error("Identificador Pix invalido.");
    const received = asRecord(
      await lookup(
        `${endpoints.pixUrl}/pix/${endToEndId}`,
        ["pix.read"],
      ),
    );
    if (asString(received.endToEndId) !== endToEndId) {
      throw new Error("Resposta de recebimento Pix divergente.");
    }
    txid = asString(received.txid);
    // A Pix transfer without a charge must never settle a local charge.
    if (!txid || txid === "***") return null;
  }
  if (!TXID.test(txid)) {
    throw new Error("Identificador de cobranca Pix invalido.");
  }
  const charge = asRecord(
    await lookup(
      `${endpoints.pixUrl}/cobv/${txid}`,
      ["cobv.read"],
    ),
  );
  const status = asString(charge.status);
  if (asString(charge.txid) !== txid || !PIX_STATUSES.has(status)) {
    throw new Error("Resposta de cobranca Pix divergente.");
  }
  return {
    tipo: "PIX",
    txid,
    situacao: status,
    status,
    dadosBanco: charge,
  };
};

export const verifyInterWebhookBatch = async (
  events: InterWebhookEvent[],
  endpoints: InterEndpoints,
  lookup: InterWebhookLookup,
) => {
  const unique = [...new Map(events.map((event) => {
    const codigo = asString(event.codigoSolicitacao);
    const txid = asString(event.txid);
    const key = codigo
      ? `boleto:${codigo.toLowerCase()}`
      : TXID.test(txid)
      ? `pix:${txid}`
      : `recebimento:${asString(event.endToEndId)}`;
    return [key, event] as const;
  })).values()];
  const verified: InterWebhookEvent[] = [];
  const deadline = Date.now() + 90_000;
  // Bounded parallelism keeps callback batches within the Edge runtime budget.
  for (let index = 0; index < unique.length; index += 5) {
    if (Date.now() >= deadline) {
      throw new Error("Prazo de verificacao excedido.");
    }
    const batch = await Promise.all(
      unique.slice(index, index + 5).map((event) =>
        verifyInterWebhookEvent(event, endpoints, lookup)
      ),
    );
    for (const event of batch) if (event) verified.push(event);
  }
  return verified;
};

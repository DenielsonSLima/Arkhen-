import { asRecord, asString } from "./validation.ts";
import type { InterModules, InterWebhookEvent } from "./types.ts";

export const INTER_PIX_WEBHOOK_SCOPES = [
  "webhook.read",
  "webhook.write",
] as const;

export const MAX_INTER_WEBHOOK_BYTES = 256 * 1024;
const MAX_INTER_WEBHOOK_EVENTS = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getWebhookScopes = (modules: InterModules) => (
  modules.webhook && (modules.pix || !modules.boleto)
    ? [...INTER_PIX_WEBHOOK_SCOPES]
    : []
);

export const parseWebhookRouteId = (url: string) => {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const functionIndex = segments.lastIndexOf("inter-webhook");
  const webhookId = functionIndex >= 0 ? segments[functionIndex + 1] || "" : "";
  if (!UUID_PATTERN.test(webhookId)) {
    throw new Error("Rota de webhook invalida.");
  }
  const rawEnvironment = functionIndex >= 0
    ? (segments[functionIndex + 2] || "").toLowerCase()
    : "";
  const ambiente =
    rawEnvironment === "producao" || rawEnvironment === "production"
      ? "producao"
      : rawEnvironment === "homologacao" || rawEnvironment === "sandbox"
      ? "homologacao"
      : "";
  if (!ambiente) throw new Error("Ambiente do webhook invalido.");
  return { webhookId, ambiente } as const;
};

export const parseInterWebhookPayload = (text: string): InterWebhookEvent[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Payload JSON invalido.");
  }

  const parsedRecord = asRecord(parsed);
  const isBolePix = Array.isArray(parsed);
  const values = isBolePix ? parsed : parsedRecord.pix;
  if (
    !Array.isArray(values) || values.length === 0 ||
    values.length > MAX_INTER_WEBHOOK_EVENTS
  ) {
    throw new Error("Lista de eventos invalida.");
  }

  return values.map((value) => {
    const event = asRecord(value);
    if (isBolePix) {
      const codigoSolicitacao = asString(event.codigoSolicitacao);
      if (!UUID_PATTERN.test(codigoSolicitacao)) {
        throw new Error("Evento sem codigo de solicitacao valido.");
      }
      const origem = asString(event.origemRecebimento);
      if (origem && origem !== "BOLETO" && origem !== "PIX") {
        throw new Error("Origem de recebimento invalida.");
      }
      return event as InterWebhookEvent;
    }

    const endToEndId = asString(event.endToEndId);
    const txid = asString(event.txid);
    if ((!endToEndId && !txid) || endToEndId.length > 64 || txid.length > 35) {
      throw new Error("Evento Pix sem identificador valido.");
    }
    return { ...event, tipo: "PIX_RECEBIDO" } as InterWebhookEvent;
  });
};

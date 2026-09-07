import { getBolePixCancelUrl, getBolePixDetailUrl } from "./boleto-charge.ts";
import { InterApiError, interApiRequest } from "./client.ts";
import { getPixDueChargeUrl } from "./pix-charge.ts";
import type { InterAccessToken, InterEndpoints } from "./types.ts";
import { asRecord, asString } from "./validation.ts";

export type InterChargeType = "pix" | "bolepix";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TXID_PATTERN = /^[a-zA-Z0-9]{26,35}$/;

export const assertInterChargeId = (tipo: InterChargeType, id: string) => {
  if (!(tipo === "pix" ? TXID_PATTERN : UUID_PATTERN).test(id)) {
    throw new Error(
      "Identificador Banco Inter invalido para o tipo da cobranca.",
    );
  }
};

export const readInterCancellationState = (
  tipo: InterChargeType,
  externalId: string,
  payload: Record<string, unknown>,
) => {
  const detail = tipo === "pix"
    ? payload
    : asRecord(payload.cobranca || payload);
  const identity = asString(
    tipo === "pix" ? detail.txid : detail.codigoSolicitacao,
  );
  if (identity !== externalId) {
    throw new Error(
      "Consulta Inter retornou outra cobranca ou omitiu o identificador.",
    );
  }
  const status = asString(tipo === "pix" ? detail.status : detail.situacao);
  return {
    cancelled: tipo === "pix"
      ? ["REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP"].includes(
        status,
      )
      : status === "CANCELADO",
    paid: tipo === "pix"
      ? status === "CONCLUIDA"
      : ["RECEBIDO", "MARCADO_RECEBIDO"].includes(status),
  };
};

export const cancelInterCharge = async (options: {
  tipo: InterChargeType;
  externalId: string;
  ambiente: string;
  endpoints: InterEndpoints;
  token: InterAccessToken;
  account: string;
  client: Deno.HttpClient;
  reason: string;
}, request = interApiRequest) => {
  const {
    tipo,
    externalId,
    ambiente,
    endpoints,
    token,
    account,
    client,
    reason,
  } = options;
  assertInterChargeId(tipo, externalId);
  const detailUrl = tipo === "pix"
    ? getPixDueChargeUrl(endpoints, externalId)
    : getBolePixDetailUrl(endpoints, externalId);
  const consult = async () => {
    const response = await request(detailUrl, token, account, client);
    const payload = asRecord(await response.json());
    return {
      payload,
      ...readInterCancellationState(tipo, externalId, payload),
    };
  };
  // A retry after an ambiguous response must first recover the current bank state.
  const before = await consult();
  if (before.paid) {
    throw new Error("Cobranca paga no Banco Inter nao pode ser cancelada.");
  }
  const result = {
    tipo,
    externalId,
    ambiente,
    solicitado: true,
    confirmado: before.cancelled,
    consulta: before.payload,
    inconclusivo: false,
  };
  if (before.cancelled) return result;

  try {
    await request(
      tipo === "pix" ? detailUrl : getBolePixCancelUrl(endpoints, externalId),
      token,
      account,
      client,
      {
        method: tipo === "pix" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tipo === "pix"
            ? { status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" }
            : { motivoCancelamento: reason.slice(0, 50) },
        ),
        acceptedStatuses: tipo === "pix" ? [200] : [202],
      },
    );
  } catch (error) {
    if (!(error instanceof InterApiError) || error.status < 500) throw error;
    // The bank may have accepted the mutation even if its response was lost.
    result.inconclusivo = true;
  }
  try {
    const after = await consult();
    result.consulta = after.payload;
    result.confirmado = after.cancelled;
    result.inconclusivo = false;
  } catch {
    result.inconclusivo = true;
  }
  return result;
};

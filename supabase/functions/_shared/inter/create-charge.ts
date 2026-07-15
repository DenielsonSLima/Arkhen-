import {
  buildDeterministicReference,
  parsePreparedInterCharge,
} from "./charge-payload.ts";
import {
  buildBolePixPayload,
  getBolePixChargeUrl,
  getBolePixDetailUrl,
} from "./boleto-charge.ts";
import {
  createInterMtlsClient,
  getInterAccessToken,
  interApiRequest,
} from "./client.ts";
import {
  assertOfficialInterEndpoints,
  getInterEndpoints,
} from "./endpoints.ts";
import { buildPixDuePayload, getPixDueChargeUrl } from "./pix-charge.ts";
import { asRecord, asString } from "./validation.ts";

export interface InterChargeExecution {
  ambiente: "producao" | "homologacao";
  tipo: "bolepix" | "pix";
  externalId: string;
  providerPayload: Record<string, unknown>;
  pixCopiaECola?: string;
  invoiceUrl?: string;
}

const readProviderJson = async (response: Response) => {
  const result = await response.json().catch(() => ({}));
  return asRecord(result);
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const createInterCharge = async (
  preparedValue: unknown,
  sourcePayload: Record<string, unknown>,
): Promise<InterChargeExecution> => {
  const prepared = parsePreparedInterCharge(preparedValue);
  const { config, cobranca } = prepared;
  const endpoints = getInterEndpoints(prepared.ambienteApi);
  assertOfficialInterEndpoints(config, endpoints);
  config.baseUrl = endpoints.baseUrl;
  config.authUrl = endpoints.authUrl;

  const reference = await buildDeterministicReference(sourcePayload, prepared);
  let client: Deno.HttpClient | null = null;
  try {
    client = createInterMtlsClient(config);
    const token = await getInterAccessToken(config, client);

    if (cobranca.meioPagamento === "Pix") {
      if (!config.modulos.pix) {
        throw new Error("Modulo Pix do Banco Inter esta desabilitado.");
      }
      const txid = reference.slice(0, 32);
      const pixRequest = buildPixDuePayload(prepared);
      const response = await interApiRequest(
        getPixDueChargeUrl(endpoints, txid),
        token,
        config.contaCorrente,
        client,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pixRequest),
          acceptedStatuses: [201],
        },
      );
      const providerPayload = await readProviderJson(response);
      const responseTxid = asString(providerPayload.txid) || txid;
      return {
        ambiente: prepared.ambienteDb,
        tipo: "pix",
        externalId: responseTxid,
        providerPayload,
        pixCopiaECola: asString(providerPayload.pixCopiaECola),
        invoiceUrl: asString(providerPayload.location),
      };
    }

    if (!config.modulos.boleto) {
      throw new Error("Modulo Boleto do Banco Inter esta desabilitado.");
    }
    const boletoRequest = buildBolePixPayload(prepared, reference);
    const response = await interApiRequest(
      getBolePixChargeUrl(endpoints),
      token,
      config.contaCorrente,
      client,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boletoRequest),
        acceptedStatuses: [200],
      },
    );
    const creationPayload = await readProviderJson(response);
    const externalId = asString(creationPayload.codigoSolicitacao);
    if (!externalId) {
      throw new Error("Banco Inter nao retornou o codigo da cobranca BolePix.");
    }
    let detailPayload: Record<string, unknown> = {};
    for (const delay of [0, 300, 900]) {
      if (delay) await wait(delay);
      try {
        const detailResponse = await interApiRequest(
          getBolePixDetailUrl(endpoints, externalId),
          token,
          config.contaCorrente,
          client,
          { acceptedStatuses: [200, 404] },
        );
        if (detailResponse.status === 200) {
          detailPayload = await readProviderJson(detailResponse);
          break;
        }
      } catch {
        // A cobranca ja foi criada. A consulta de detalhes e apenas enriquecimento.
      }
    }
    const providerPayload = { ...creationPayload, ...detailPayload };
    const pix = asRecord(providerPayload.pix);
    return {
      ambiente: prepared.ambienteDb,
      tipo: "bolepix",
      externalId,
      providerPayload,
      pixCopiaECola: asString(pix.pixCopiaECola || pix.copiaECola),
    };
  } finally {
    client?.close();
  }
};

export const buildInterRegistrationPayload = (
  preparedValue: unknown,
  execution: InterChargeExecution,
) => {
  const prepared = parsePreparedInterCharge(preparedValue);
  const { cobranca } = prepared;
  return {
    cliente_empresa_id: cobranca.clienteEmpresaId,
    contrato_id: cobranca.contratoId,
    descricao: cobranca.descricao,
    categoria: cobranca.categoria,
    valor: cobranca.valor,
    data_vencimento: cobranca.dataVencimento,
    meio_pagamento: cobranca.meioPagamento,
    ambiente: execution.ambiente,
    tipo: execution.tipo,
    external_id: execution.externalId,
    provider_payload: execution.providerPayload,
    pix_copia_cola: execution.pixCopiaECola || "",
    invoice_url: execution.invoiceUrl || "",
  };
};

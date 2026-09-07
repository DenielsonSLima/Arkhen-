import {
  buildDeterministicReference,
  parsePreparedInterCharge,
  type PreparedInterCharge,
} from "./charge-payload.ts";
import {
  createInterMtlsClient,
  getInterAccessToken,
  interApiRequest,
} from "./client.ts";
import {
  assertOfficialInterEndpoints,
  getInterEndpoints,
} from "./endpoints.ts";
import { getBolePixChargeUrl, getBolePixDetailUrl } from "./boleto-charge.ts";
import { getPixDueChargeUrl } from "./pix-charge.ts";
import { asRecord, asString } from "./validation.ts";
import type { InterChargeExecution } from "./create-charge.ts";
import { assertInterChargeId } from "./cancel-charge.ts";

const uncertainMessage =
  "A emissão anterior ainda não pôde ser confirmada no Inter. Nenhuma nova cobrança foi enviada. Tente consultar novamente mais tarde.";

export const assertRecoveredCharge = (
  prepared: PreparedInterCharge,
  providerPayload: Record<string, unknown>,
  reference: string,
): InterChargeExecution => {
  const isPix = prepared.cobranca.meioPagamento === "Pix";
  const charge = isPix ? providerPayload : asRecord(providerPayload.cobranca);
  const debtor = asRecord(isPix ? charge.devedor : charge.pagador);
  const id = asString(isPix ? charge.txid : charge.codigoSolicitacao);
  const expectedReference = reference.slice(0, isPix ? 32 : 15);
  const document = asString(isPix ? debtor.cpf || debtor.cnpj : debtor.cpfCnpj)
    .replace(/[./-]/g, "").toUpperCase();
  const dueDate = asString(
    isPix
      ? asRecord(charge.calendario).dataDeVencimento
      : charge.dataVencimento,
  );
  const amount = Number(
    isPix ? asRecord(charge.valor).original : charge.valorNominal,
  );
  const actualReference = asString(isPix ? charge.txid : charge.seuNumero);
  assertInterChargeId(isPix ? "pix" : "bolepix", id);
  const referenceMatches = isPix
    ? actualReference === expectedReference
    : actualReference.toUpperCase() === expectedReference.toUpperCase();
  if (
    !referenceMatches ||
    document !== prepared.cliente.cpfCnpj ||
    dueDate !== prepared.cobranca.dataVencimento ||
    !Number.isFinite(amount) ||
    amount.toFixed(2) !== prepared.cobranca.valor.toFixed(2)
  ) {
    throw new Error(
      "A cobrança localizada no Inter não corresponde à emissão original. Reconciliação bloqueada.",
    );
  }
  const pix = isPix ? providerPayload : asRecord(providerPayload.pix);
  return {
    ambiente: prepared.ambienteDb,
    tipo: isPix ? "pix" : "bolepix",
    externalId: id,
    providerPayload,
    pixCopiaECola: asString(pix.pixCopiaECola || pix.copiaECola),
  };
};

// An uncertain attempt is recovered only by GET. Even 404 never triggers re-issuance.
export const recoverInterCharge = async (
  preparedValue: unknown,
  sourcePayload: Record<string, unknown>,
): Promise<InterChargeExecution> => {
  const prepared = parsePreparedInterCharge(preparedValue);
  const endpoints = getInterEndpoints(prepared.ambienteApi);
  const { config, cobranca } = prepared;
  assertOfficialInterEndpoints(config, endpoints);
  config.baseUrl = endpoints.baseUrl;
  config.authUrl = endpoints.authUrl;
  const reference = await buildDeterministicReference(sourcePayload, prepared);
  const isPix = cobranca.meioPagamento === "Pix";
  const client = createInterMtlsClient(config);
  try {
    const token = await getInterAccessToken(config, client, [
      isPix ? "cobv.read" : "boleto-cobranca.read",
    ]);
    const getJson = async (url: string) => {
      const response = await interApiRequest(
        url,
        token,
        config.contaCorrente,
        client,
        { acceptedStatuses: [200, 404] },
      );
      if (response.status === 404) throw new Error(uncertainMessage);
      return asRecord(await response.json());
    };
    if (isPix) {
      return assertRecoveredCharge(
        prepared,
        await getJson(getPixDueChargeUrl(endpoints, reference.slice(0, 32))),
        reference,
      );
    }
    const query = new URLSearchParams({
      dataInicial: cobranca.dataVencimento,
      dataFinal: cobranca.dataVencimento,
      filtrarDataPor: "VENCIMENTO",
      seuNumero: reference.slice(0, 15).toUpperCase(),
      cpfCnpjPessoaPagadora: prepared.cliente.cpfCnpj,
      "paginacao.paginaAtual": "0",
      "paginacao.itensPorPagina": "100",
    });
    const collection = await getJson(
      `${getBolePixChargeUrl(endpoints)}?${query}`,
    );
    const charges = Array.isArray(collection.cobrancas)
      ? collection.cobrancas
      : [];
    if (charges.length !== 1 || Number(collection.totalPaginas || 1) > 1) {
      throw new Error(uncertainMessage);
    }
    const id = asString(
      asRecord(asRecord(charges[0]).cobranca).codigoSolicitacao,
    );
    if (!id) throw new Error(uncertainMessage);
    return assertRecoveredCharge(
      prepared,
      await getJson(getBolePixDetailUrl(endpoints, id)),
      reference,
    );
  } finally {
    client.close();
  }
};

import { asRecord, descendants, direct, nodeText, parseXml, readLimitedXml, text, xmlEscape } from "./xml.ts";
import type { FiscalCertificate } from "./certificate.ts";
import { requireValidCnpj, normalizeFiscalDocument } from "../fiscal-document.ts";

export const ENDPOINTS = new Set([
  "https://itabaianase.webiss.com.br/ws/nfse.asmx",
  "https://homologacao.webiss.com.br/ws/nfse.asmx",
]);
export type WebIssOperation = "GerarNfse" | "ConsultarNfsePorRps";
export class WebIssError extends Error {
  constructor(message: string, public readonly definitiveRejection = false) { super(message); }
}
export function buildSoapEnvelope(operation: WebIssOperation, xml: string) {
  const header = '<cabecalho xmlns="http://www.abrasf.org.br/nfse.xsd" versao="2.02"><versaoDados>2.02</versaoDados></cabecalho>';
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    `<${operation}Request xmlns="http://nfse.abrasf.org.br">` +
    `<nfseCabecMsg xmlns="">${xmlEscape(header)}</nfseCabecMsg>` +
    `<nfseDadosMsg xmlns="">${xmlEscape(xml)}</nfseDadosMsg>` +
    `</${operation}Request></soap:Body></soap:Envelope>`;
}

function authorizedEmissionTimestamp(value: string): string | undefined {
  if (!value) return undefined;
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!parts || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59) {
    throw new WebIssError("Data de emissao retornada pelo WebISS invalida.");
  }
  const calendar = new Date(parts[1] + "T00:00:00Z");
  const timestamp = new Date(parts[5] ? value : value + "-03:00");
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== parts[1]
    || !Number.isFinite(timestamp.getTime())) throw new WebIssError("Data de emissao retornada pelo WebISS invalida.");
  return timestamp.toISOString();
}

export function parseWebIssResponse(soap: string, operation: WebIssOperation): { nfseId: string; protocolo: string; payload: {numero: string; codigoVerificacao: string; xml: string; dataEmissao?: string; situacao: "confirmada" | "cancelada" | "substituida"} } {
  const doc = parseXml(soap);
  const root = doc.documentElement;
  const fault = descendants(root, "Fault")[0];
  if (fault) throw new WebIssError(`Falha SOAP WebISS: ${nodeText(direct(fault, "faultstring")).slice(0, 500) || "resposta invalida"}`);
  const outputs = descendants(root, "outputXML");
  if (outputs.length !== 1) throw new WebIssError("WebISS nao retornou outputXML unico.");
  const output = nodeText(outputs[0]);
  const response = parseXml(output).documentElement;
  const expected = operation === "GerarNfse" ? "GerarNfseResposta" : "ConsultarNfseRpsResposta";
  if (response.localName !== expected) throw new WebIssError("Resposta WebISS nao corresponde a operacao solicitada.");
  const infos = descendants(response, "InfNfse");
  if (infos.length > 1) throw new WebIssError("WebISS retornou mais de uma NFS-e para o RPS.");
  if (!infos.length) {
    const messages = descendants(response, "MensagemRetorno").map((node) => {
      const code = nodeText(direct(node, "Codigo"));
      const message = nodeText(direct(node, "Mensagem"));
      const correction = nodeText(direct(node, "Correcao"));
      return [code, message, correction].filter(Boolean).join(": ");
    });
    throw new WebIssError(messages.length ? `WebISS: ${messages.join("; ").slice(0, 1800)}` : "WebISS nao retornou NFS-e nem rejeicao conclusiva.", messages.length > 0);
  }
  const situacao = descendants(response, "NfseSubstituicao").length ? "substituida"
    : descendants(response, "NfseCancelamento").length ? "cancelada" : "confirmada";
  const info = infos[0];
  const number = nodeText(direct(info, "Numero"));
  const verification = nodeText(direct(info, "CodigoVerificacao"));
  if (!/^\d{1,15}$/.test(number) || !verification) throw new WebIssError("NFS-e retornada sem numero ou codigo de verificacao valido.");
  return {
    nfseId: number, protocolo: verification,
    payload: { numero: number, codigoVerificacao: verification, xml: output, situacao,
      dataEmissao: authorizedEmissionTimestamp(nodeText(direct(info, "DataEmissao"))) },
  };
}

export async function requestWebIss(endpoint: string, operation: WebIssOperation, xml: string, certificate: FiscalCertificate) {
  if (!ENDPOINTS.has(endpoint)) throw new Error("Endpoint WebISS nao permitido.");
  const client = Deno.createHttpClient({ cert: certificate.certificatePem, key: certificate.privateKeyPem });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      client, method: "POST", redirect: "error", signal: controller.signal,
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"http://nfse.abrasf.org.br/${operation}"` },
      body: buildSoapEnvelope(operation, xml),
    });
    const soap = await readLimitedXml(response, 4 * 1024 * 1024);
    if (!response.ok) throw new WebIssError(`WebISS respondeu HTTP ${response.status}; consulte o RPS antes de qualquer reenvio.`);
    return parseWebIssResponse(soap, operation);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new WebIssError("WebISS nao respondeu em 30 segundos. Resultado incerto; consulte o RPS.");
    throw error;
  } finally { clearTimeout(timer); client.close(); }
}

export function buildRpsQuery(prepared: Record<string, unknown>) {
  const rps = asRecord(prepared.rps);
  const provider = asRecord(prepared.prestador);
  const cnpj = requireValidCnpj(provider.cnpj, "CNPJ do prestador WebISS");
  if (!/^[1-9][0-9]{0,14}$/.test(text(rps.numero)) || !/^[A-Za-z0-9]{1,5}$/.test(text(rps.serie))) throw new Error("Identificacao RPS invalida para consulta.");
  return '<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><IdentificacaoRps>' +
    `<Numero>${xmlEscape(rps.numero)}</Numero><Serie>${xmlEscape(rps.serie)}</Serie><Tipo>1</Tipo>` +
    `</IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj>` +
    `<InscricaoMunicipal>${xmlEscape(provider.inscricaoMunicipal)}</InscricaoMunicipal></Prestador></ConsultarNfseRpsEnvio>`;
}

export function assertResponseMatchesRps(payload: { xml: string }, prepared: Record<string, unknown>) {
  const root = parseXml(payload.xml).documentElement;
  const declarations = descendants(root, "InfDeclaracaoPrestacaoServico");
  if (declarations.length !== 1) throw new WebIssError("NFS-e retornada sem declaracao unica para validar o RPS.");
  const declaration = declarations[0];
  const rps = direct(declaration, "Rps");
  const identification = rps && direct(rps, "IdentificacaoRps");
  const provider = direct(declaration, "Prestador");
  const document = provider && direct(provider, "CpfCnpj");
  const expectedRps = asRecord(prepared.rps);
  const expectedProvider = asRecord(prepared.prestador);
  if (!identification || !document ||
    nodeText(direct(identification, "Numero")) !== text(expectedRps.numero) ||
    nodeText(direct(identification, "Serie")) !== text(expectedRps.serie) ||
    nodeText(direct(identification, "Tipo")) !== "1" ||
    nodeText(direct(document, "Cnpj")).toUpperCase() !== requireValidCnpj(expectedProvider.cnpj, "CNPJ do prestador") ||
    nodeText(provider && direct(provider, "InscricaoMunicipal")) !== text(expectedProvider.inscricaoMunicipal)) {
    throw new WebIssError("A NFS-e retornada nao corresponde ao prestador e RPS solicitados; reconciliacao bloqueada.");
  }
  const customer = direct(declaration, "TomadorServico") || direct(declaration, "Tomador");
  const customerId = customer && direct(customer, "IdentificacaoTomador");
  const customerDoc = customerId && direct(customerId, "CpfCnpj");
  const returnedDocument = normalizeFiscalDocument(nodeText(customerDoc && (direct(customerDoc, "Cnpj") || direct(customerDoc, "Cpf"))));
  const expectedDocument = normalizeFiscalDocument(asRecord(prepared.tomador).documento);
  const service = direct(declaration, "Servico");
  const values = service && direct(service, "Valores");
  if (!expectedDocument || returnedDocument !== expectedDocument ||
    canonicalAmount(nodeText(values && direct(values, "ValorServicos"))) !== canonicalAmount(asRecord(prepared.servico).valor)) {
    throw new WebIssError("A NFS-e retornada nao corresponde ao tomador e valor do snapshot; reconciliacao bloqueada.");
  }

}

/** Decimal comparison without floating point rounding or business recalculation. */
function canonicalAmount(value: unknown): string {
  const raw = text(value);
  if (!/^\d{1,15}(?:\.\d{1,2})?$/.test(raw)) throw new WebIssError("Valor fiscal ausente ou invalido na correlacao do retorno.");
  const [integer, fraction = ""] = raw.split(".");
  return `${BigInt(integer)}.${fraction.padEnd(2, "0")}`;
}

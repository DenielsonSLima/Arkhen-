import { SignedXml } from "npm:xml-crypto@6.1.2";
import type { FiscalCertificate } from "./certificate.ts";
import { buildUnsignedRps } from "./rps.ts";
export { buildUnsignedRps } from "./rps.ts";

const text = (value: unknown) => typeof value === "string" ? value.trim() : String(value ?? "").trim();
const xmlEscape = (value: unknown) => text(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const xmlUnescape = (value: string) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const signRps = (xml: string, certificate: FiscalCertificate) => {
  const signer = new SignedXml({ privateKey: certificate.privateKeyPem, publicCert: certificate.certificatePem });
  signer.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  signer.addReference({
    xpath: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']",
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  });
  signer.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']", action: "after" },
  });
  return signer.getSignedXml();
};

const buildSoapEnvelope = (signedXml: string) => {
  const header = `<?xml version="1.0" encoding="UTF-8"?><cabecalho xmlns="http://www.abrasf.org.br/nfse.xsd" versao="2.02"><versaoDados>2.02</versaoDados></cabecalho>`;
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soap:Body><GerarNfseRequest xmlns="http://nfse.abrasf.org.br">` +
        `<nfseCabecMsg xmlns="">${xmlEscape(header)}</nfseCabecMsg>` +
        `<nfseDadosMsg xmlns="">${xmlEscape(signedXml)}</nfseDadosMsg>` +
      `</GerarNfseRequest></soap:Body></soap:Envelope>`;
};

const responseTag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"));
  return match ? xmlUnescape(match[1].trim()) : "";
};

export const emitWebIssNfse = async (
  prepared: Record<string, unknown>, certificate: FiscalCertificate,
) => {
  const endpoint = text(prepared.endpoint);
  if (!new Set([
    "https://itabaianase.webiss.com.br/ws/nfse.asmx",
    "https://homologacao.webiss.com.br/ws/nfse.asmx",
  ]).has(endpoint)) throw new Error("Endpoint WebISS nao permitido.");
  const signedXml = signRps(buildUnsignedRps(prepared), certificate);
  const client = Deno.createHttpClient({ cert: certificate.certificatePem, key: certificate.privateKeyPem });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      client, method: "POST", signal: controller.signal,
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://nfse.abrasf.org.br/GerarNfse" },
      body: buildSoapEnvelope(signedXml),
    });
    const soap = await response.text();
    if (soap.length > 4 * 1024 * 1024) throw new Error("Resposta WebISS acima do limite.");
    if (!response.ok) throw new Error(`WebISS respondeu HTTP ${response.status}.`);
    const output = responseTag(soap, "outputXML") || soap;
    const errorCode = responseTag(output, "Codigo");
    const errorMessage = responseTag(output, "Mensagem");
    const infoNfse = output.match(/<(?:\w+:)?InfNfse(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?InfNfse>/i)?.[1] || "";
    const nfseId = responseTag(infoNfse, "Numero");
    if (!nfseId) throw new Error(errorMessage ? `WebISS ${errorCode || ""}: ${errorMessage}`.trim() : "WebISS nao retornou o numero da NFS-e.");
    return {
      nfseId,
      protocolo: responseTag(infoNfse, "CodigoVerificacao"),
      payload: { numero: nfseId, codigoVerificacao: responseTag(infoNfse, "CodigoVerificacao") },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("WebISS nao respondeu em 30 segundos.");
    throw error;
  } finally {
    clearTimeout(timer);
    client.close();
  }
};

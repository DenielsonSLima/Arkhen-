import { SignedXml } from "npm:xml-crypto@6.1.2";
import type { FiscalCertificate } from "./certificate.ts";

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);
const text = (value: unknown) => typeof value === "string" ? value.trim() : String(value ?? "").trim();
const digits = (value: unknown) => text(value).replace(/\D/g, "");
const xmlEscape = (value: unknown) => text(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const xmlUnescape = (value: string) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const optionalTag = (name: string, value: unknown) => text(value) ? `<${name}>${xmlEscape(value)}</${name}>` : "";

const buildUnsignedRps = (prepared: Record<string, unknown>) => {
  const rps = asRecord(prepared.rps);
  const provider = asRecord(prepared.prestador);
  const customer = asRecord(prepared.tomador);
  const service = asRecord(prepared.servico);
  const customerDocument = digits(customer.documento);
  const documentTag = customerDocument.length === 11 ? "Cpf" : "Cnpj";
  const rate = Number(text(service.aliquotaIss).replace(",", "."));
  const rateFraction = Number.isFinite(rate) && rate > 0 ? (rate / 100).toFixed(4) : "";
  const rpsId = `RPS${digits(rps.numero)}`;
  const infoId = `DPS${digits(rps.numero)}`;
  const regime = digits(service.regimeEspecial).slice(0, 1);

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">` +
      `<Rps><InfDeclaracaoPrestacaoServico Id="${infoId}">` +
        `<Rps><InfRps Id="${rpsId}"><IdentificacaoRps>` +
          `<Numero>${xmlEscape(rps.numero)}</Numero><Serie>${xmlEscape(rps.serie)}</Serie><Tipo>1</Tipo>` +
        `</IdentificacaoRps><DataEmissao>${xmlEscape(rps.data)}</DataEmissao><Status>1</Status></InfRps></Rps>` +
        `<Competencia>${xmlEscape(rps.data)}</Competencia><Servico><Valores>` +
          `<ValorServicos>${Number(service.valor).toFixed(2)}</ValorServicos>` +
          optionalTag("Aliquota", rateFraction) +
        `</Valores><IssRetido>${digits(service.issRetido).slice(0, 1) || "2"}</IssRetido>` +
          `<ItemListaServico>${xmlEscape(text(service.itemListaServico).replace(/[^0-9.]/g, ""))}</ItemListaServico>` +
          `<CodigoCnae>${xmlEscape(digits(service.codigoCnae))}</CodigoCnae>` +
          `<CodigoTributacaoMunicipio>${xmlEscape(service.codigoTributacaoMunicipio)}</CodigoTributacaoMunicipio>` +
          `<Discriminacao>${xmlEscape(text(service.descricao).slice(0, 2000))}</Discriminacao>` +
          `<CodigoMunicipio>${xmlEscape(service.codigoMunicipio)}</CodigoMunicipio>` +
          `<ExigibilidadeISS>${digits(service.exigibilidadeIss).slice(0, 1) || "1"}</ExigibilidadeISS>` +
          `<MunicipioIncidencia>${xmlEscape(service.codigoMunicipio)}</MunicipioIncidencia>` +
        `</Servico><Prestador><CpfCnpj><Cnpj>${xmlEscape(digits(provider.cnpj))}</Cnpj></CpfCnpj>` +
          `<InscricaoMunicipal>${xmlEscape(provider.inscricaoMunicipal)}</InscricaoMunicipal></Prestador>` +
        `<Tomador><IdentificacaoTomador><CpfCnpj><${documentTag}>${xmlEscape(customerDocument)}</${documentTag}>` +
          `</CpfCnpj></IdentificacaoTomador><RazaoSocial>${xmlEscape(customer.razaoSocial)}</RazaoSocial>` +
          `<Endereco>${optionalTag("Endereco", customer.endereco)}${optionalTag("Numero", customer.numero)}` +
            `${optionalTag("Bairro", customer.bairro)}${optionalTag("Uf", customer.uf)}${optionalTag("Cep", digits(customer.cep))}</Endereco>` +
          `<Contato>${optionalTag("Telefone", digits(customer.telefone))}${optionalTag("Email", customer.email)}</Contato>` +
        `</Tomador>${regime ? `<RegimeEspecialTributacao>${xmlEscape(regime)}</RegimeEspecialTributacao>` : ""}` +
        `<OptanteSimplesNacional>${regime === "4" ? "1" : "2"}</OptanteSimplesNacional>` +
        `<IncentivoFiscal>${digits(service.incentivoFiscal).slice(0, 1) || "2"}</IncentivoFiscal>` +
      `</InfDeclaracaoPrestacaoServico></Rps></GerarNfseEnvio>`;
};

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

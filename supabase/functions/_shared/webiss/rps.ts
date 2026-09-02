import {
  parseFiscalDocument,
  requireValidCnpj,
} from "../fiscal-document.ts";

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);
const text = (value: unknown) => (
  typeof value === "string" ? value.trim() : String(value ?? "").trim()
);
const digits = (value: unknown) => text(value).replace(/\D/g, "");
const xmlEscape = (value: unknown) => text(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const optionalTag = (name: string, value: unknown) => (
  text(value) ? `<${name}>${xmlEscape(value)}</${name}>` : ""
);

export const buildUnsignedRps = (prepared: Record<string, unknown>) => {
  const rps = asRecord(prepared.rps);
  const provider = asRecord(prepared.prestador);
  const customer = asRecord(prepared.tomador);
  const service = asRecord(prepared.servico);
  const providerDocument = requireValidCnpj(
    provider.cnpj,
    "CNPJ do prestador WebISS",
  );
  const parsedCustomerDocument = parseFiscalDocument(
    customer.documento,
    "CPF/CNPJ do tomador WebISS",
  );
  const customerDocument = parsedCustomerDocument.value;
  const documentTag = parsedCustomerDocument.kind === "cpf" ? "Cpf" : "Cnpj";
  const rate = Number(text(service.aliquotaIss).replace(",", "."));
  const rateFraction = Number.isFinite(rate) && rate > 0
    ? (rate / 100).toFixed(4)
    : "";
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
        `</Servico><Prestador><CpfCnpj><Cnpj>${xmlEscape(providerDocument)}</Cnpj></CpfCnpj>` +
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

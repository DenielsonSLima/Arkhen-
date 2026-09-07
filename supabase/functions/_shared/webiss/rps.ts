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
  const aliquota = text(service.aliquotaIss) ? rate.toFixed(4) : "";
  if (aliquota && (!Number.isFinite(rate) || rate < 0 || rate > 100)) throw new Error("Aliquota ISS invalida.");
  if (!Number.isFinite(Number(service.valor)) || Number(service.valor) <= 0 || Number(service.valor) >= 10_000_000_000_000) throw new Error("Valor do servico invalido.");
  if (!/^[1-9][0-9]{0,14}$/.test(text(rps.numero))) throw new Error("Numero RPS invalido.");
  if (!/^[A-Za-z0-9]{1,5}$/.test(text(rps.serie))) throw new Error("Serie RPS invalida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(rps.data)) || new Date(text(rps.data)).toISOString().slice(0, 10) !== text(rps.data)) throw new Error("Data RPS invalida.");
  if (!/^[12]$/.test(text(service.optanteSimplesNacional))) throw new Error("Informe separadamente a opcao pelo Simples Nacional.");
  if (!/^[12]$/.test(text(service.issRetido))) throw new Error("ISS retido invalido.");
  if (text(service.issRetido) === "1" && !/^[12]$/.test(text(service.responsavelRetencao))) throw new Error("Responsavel pela retencao obrigatorio.");
  if (!/^[1-7]$/.test(text(service.exigibilidadeIss))) throw new Error("Exigibilidade ISS invalida.");
  if (!/^[12]$/.test(text(service.incentivoFiscal))) throw new Error("Incentivo fiscal invalido.");
  if (!/^\d{7}$/.test(text(service.codigoMunicipio))) throw new Error("Codigo IBGE do servico invalido.");
  if (!/^\d{1,2}\.\d{2}$/.test(text(service.itemListaServico))) throw new Error("Item da lista de servico invalido.");
  if (!text(service.descricao) || text(service.descricao).length > 2000) throw new Error("Discriminacao deve conter de 1 a 2000 caracteres.");
  if (!text(provider.inscricaoMunicipal) || text(provider.inscricaoMunicipal).length > 15) throw new Error("Inscricao municipal invalida.");
  if (!text(customer.razaoSocial) || text(customer.razaoSocial).length > 150) throw new Error("Razao social do tomador invalida.");
  for (const [field, limit] of [["endereco", 125], ["numero", 10], ["bairro", 60], ["email", 80]] as const) {
    if (text(customer[field]).length > limit) throw new Error(`Campo ${field} do tomador excede ${limit} caracteres.`);
  }
  if (text(customer.uf) && !/^[A-Z]{2}$/.test(text(customer.uf))) throw new Error("UF do tomador invalida.");
  if (text(customer.cep) && !/^\d{8}$/.test(digits(customer.cep))) throw new Error("CEP do tomador invalido.");
  if (digits(customer.telefone).length > 20) throw new Error("Telefone do tomador excede 20 digitos.");
  if (text(customer.codigoMunicipio) && !/^\d{7}$/.test(text(customer.codigoMunicipio))) throw new Error("Codigo IBGE do tomador invalido.");
  if (text(service.codigoCnae) && !/^\d{7}$/.test(text(service.codigoCnae))) throw new Error("CNAE invalido.");
  if (text(service.codigoTributacaoMunicipio).length > 20) throw new Error("Codigo de tributacao municipal invalido.");
  const hasInvalidXmlCharacter = (value: unknown): boolean => {
    if (typeof value === "string") return Array.from(value).some((character) => {
      const code = character.codePointAt(0)!;
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 65534 || code === 65535;
    });
    return value !== null && typeof value === "object" && Object.values(value).some(hasInvalidXmlCharacter);
  };
  if ([rps, provider, customer, service].some(hasInvalidXmlCharacter)) throw new Error("Dados fiscais contem caracteres XML invalidos.");
  const rpsId = `RPS${digits(rps.numero)}`;
  const infoId = `DPS${digits(rps.numero)}`;
  const regime = text(service.regimeEspecial);
  if (regime && !/^[0-6]$/.test(regime)) throw new Error("Regime especial invalido.");

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">` +
      `<Rps><InfDeclaracaoPrestacaoServico Id="${infoId}">` +
        `<Rps Id="${rpsId}"><IdentificacaoRps>` +
          `<Numero>${xmlEscape(rps.numero)}</Numero><Serie>${xmlEscape(rps.serie)}</Serie><Tipo>1</Tipo>` +
        `</IdentificacaoRps><DataEmissao>${xmlEscape(rps.data)}</DataEmissao><Status>1</Status></Rps>` +
        `<Competencia>${xmlEscape(rps.data)}</Competencia><Servico><Valores>` +
          `<ValorServicos>${Number(service.valor).toFixed(2)}</ValorServicos>` +
          optionalTag("Aliquota", aliquota) +
        `</Valores><IssRetido>${digits(service.issRetido).slice(0, 1) || "2"}</IssRetido>` +
          optionalTag("ResponsavelRetencao", text(service.issRetido) === "1" ? service.responsavelRetencao : "") +
          `<ItemListaServico>${xmlEscape(text(service.itemListaServico).replace(/[^0-9.]/g, ""))}</ItemListaServico>` +
          optionalTag("CodigoCnae", digits(service.codigoCnae)) +
          optionalTag("CodigoTributacaoMunicipio", service.codigoTributacaoMunicipio) +
          `<Discriminacao>${xmlEscape(text(service.descricao).slice(0, 2000))}</Discriminacao>` +
          `<CodigoMunicipio>${xmlEscape(service.codigoMunicipio)}</CodigoMunicipio>` +
          `<ExigibilidadeISS>${digits(service.exigibilidadeIss).slice(0, 1) || "1"}</ExigibilidadeISS>` +
          `<MunicipioIncidencia>${xmlEscape(service.codigoMunicipio)}</MunicipioIncidencia>` +
        `</Servico><Prestador><CpfCnpj><Cnpj>${xmlEscape(providerDocument)}</Cnpj></CpfCnpj>` +
          `<InscricaoMunicipal>${xmlEscape(provider.inscricaoMunicipal)}</InscricaoMunicipal></Prestador>` +
        `<Tomador><IdentificacaoTomador><CpfCnpj><${documentTag}>${xmlEscape(customerDocument)}</${documentTag}>` +
          `</CpfCnpj></IdentificacaoTomador><RazaoSocial>${xmlEscape(customer.razaoSocial)}</RazaoSocial>` +
          `<Endereco>${optionalTag("Endereco", customer.endereco)}${optionalTag("Numero", customer.numero)}` +
            `${optionalTag("Bairro", customer.bairro)}${optionalTag("CodigoMunicipio", customer.codigoMunicipio)}${optionalTag("Uf", customer.uf)}${optionalTag("Cep", digits(customer.cep))}</Endereco>` +
          `<Contato>${optionalTag("Telefone", digits(customer.telefone))}${optionalTag("Email", customer.email)}</Contato>` +
        `</Tomador>${regime && regime !== "0" ? `<RegimeEspecialTributacao>${xmlEscape(regime)}</RegimeEspecialTributacao>` : ""}` +
        `<OptanteSimplesNacional>${xmlEscape(service.optanteSimplesNacional)}</OptanteSimplesNacional>` +
        `<IncentivoFiscal>${digits(service.incentivoFiscal).slice(0, 1) || "2"}</IncentivoFiscal>` +
      `</InfDeclaracaoPrestacaoServico></Rps></GerarNfseEnvio>`;
};

import { serializeWithNamespaceContext } from "./xml-context.ts";
import { normalizeFiscalDocument } from "../fiscal-document.ts";
import { descendants, direct, nodeText } from "./xml.ts";

export interface ConsultationContext {
  ambiente: string;
  endpoint: string;
  prestador: { cnpj: string; inscricaoMunicipal: string };
  tomador: { documento: string };
}
export interface ConsultationPeriod {
  inicio: string;
  fim: string;
}
export interface ConsultedNote {
  numero_nfse: string;
  codigo_verificacao: string;
  data_emissao: string;
  xml: string;
  hash_sha256: string;
  situacao: "confirmada" | "cancelada" | "substituida";
  dados: Record<string, string>;
  qualidade: { faltantes: string[]; bloqueios: string[]; limitacoes: string[] };
}
const leaf = (root: Element | undefined, name: string) =>
  root ? nodeText(direct(root, name)) : "";
const first = (root: Element | undefined, name: string) =>
  root ? descendants(root, name)[0] : undefined;

export function extractConsultedNote(
  comp: Element,
  context: ConsultationContext,
  period: ConsultationPeriod,
): ConsultedNote {
  const nfse = direct(comp, "Nfse");
  const inf = nfse && direct(nfse, "InfNfse");
  if (!inf || descendants(comp, "InfNfse").length !== 1) {
    throw new Error("Nota consultada ausente ou ambigua.");
  }
  const declaration = first(inf, "InfDeclaracaoPrestacaoServico");
  const service = declaration && direct(declaration, "Servico");
  const provider = direct(inf, "PrestadorServico");
  const providerId = provider && direct(provider, "IdentificacaoPrestador");
  const providerDoc = providerId && direct(providerId, "CpfCnpj");
  const customer = declaration &&
    (direct(declaration, "TomadorServico") || direct(declaration, "Tomador"));
  const customerId = customer && direct(customer, "IdentificacaoTomador");
  const customerDoc = customerId && direct(customerId, "CpfCnpj");
  if (
    normalizeFiscalDocument(leaf(providerDoc, "Cnpj")) !==
      normalizeFiscalDocument(context.prestador.cnpj) ||
    leaf(providerId, "InscricaoMunicipal") !==
      context.prestador.inscricaoMunicipal ||
    normalizeFiscalDocument(
        leaf(customerDoc, "Cnpj") || leaf(customerDoc, "Cpf"),
      ) !== normalizeFiscalDocument(context.tomador.documento)
  ) {
    throw new Error(
      "WebISS retornou nota de outro prestador ou tomador; consulta nao armazenada.",
    );
  }
  const generator = direct(inf, "OrgaoGerador");
  if (leaf(generator, "CodigoMunicipio") !== "2802908") {
    throw new Error(
      "Municipio gerador da nota nao corresponde a Itabaiana/SE.",
    );
  }
  const numero = leaf(inf, "Numero"),
    verification = leaf(inf, "CodigoVerificacao");
  const rawDate = leaf(inf, "DataEmissao");
  if (
    !/^\d{1,15}$/.test(numero) || !verification ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawDate)
  ) {
    throw new Error("Identificadores ou data da nota consultada invalidos.");
  }
  const timestamp = new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(rawDate) ? rawDate : rawDate + "-03:00",
  );
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error("Data da nota consultada invalida.");
  }
  const localDay = new Date(timestamp.getTime() - 3 * 3600000).toISOString()
    .slice(0, 10);
  if (localDay < period.inicio || localDay > period.fim) {
    throw new Error("WebISS retornou nota fora do periodo solicitado.");
  }
  const values = service && direct(service, "Valores");
  const authorized = direct(inf, "ValoresNfse");
  const address = customer && direct(customer, "Endereco");
  const dados: Record<string, string> = {
    valor: leaf(values, "ValorServicos"),
    descricao: leaf(service, "Discriminacao"),
    itemListaServico: leaf(service, "ItemListaServico"),
    codigoCnae: leaf(service, "CodigoCnae"),
    codigoTributacaoMunicipio: leaf(service, "CodigoTributacaoMunicipio"),
    aliquotaIss: leaf(authorized, "Aliquota") || leaf(values, "Aliquota"),
    issRetido: leaf(service, "IssRetido"),
    responsavelRetencao: leaf(service, "ResponsavelRetencao"),
    exigibilidadeIss: leaf(service, "ExigibilidadeISS"),
    codigoMunicipio: leaf(service, "CodigoMunicipio"),
    municipioIncidencia: leaf(service, "MunicipioIncidencia"),
    optanteSimplesNacional: leaf(declaration, "OptanteSimplesNacional"),
    regimeEspecial: leaf(declaration, "RegimeEspecialTributacao"),
    incentivoFiscal: leaf(declaration, "IncentivoFiscal"),
    codigoNbs: leaf(service, "CodigoNBS") || leaf(service, "CodigoNbs"),
    tomadorNumero: leaf(address, "Numero"),
    tomadorCodigoMunicipio: leaf(address, "CodigoMunicipio"),
  };
  const qualidade: ConsultedNote["qualidade"] = {
    faltantes: [],
    bloqueios: [],
    limitacoes: [],
  };
  for (
    const key of [
      "valor",
      "descricao",
      "itemListaServico",
      "codigoMunicipio",
      "exigibilidadeIss",
      "issRetido",
      "optanteSimplesNacional",
      "incentivoFiscal",
    ]
  ) {
    if (!dados[key]) qualidade.faltantes.push(key);
  }
  if (
    !/^\d{1,13}(?:\.\d{1,2})?$/.test(dados.valor) || Number(dados.valor) <= 0
  ) qualidade.bloqueios.push("Valor dos servicos ausente ou invalido.");
  for (
    const field of [
      "ValorPis",
      "ValorCofins",
      "ValorInss",
      "ValorIr",
      "ValorCsll",
      "OutrasRetencoes",
      "ValorDeducoes",
      "DescontoCondicionado",
      "DescontoIncondicionado",
    ]
  ) {
    const value = leaf(values, field);
    if (value && (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) !== 0)) {
      qualidade.bloqueios.push(
        `${field} exige traducao fiscal antes da copia.`,
      );
    }
  }
  for (
    const group of [
      "IBSCBS",
      "InfoPisCofins",
      "ConstrucaoCivil",
      "Intermediario",
      "IntermediarioServico",
      "NifTomador",
    ]
  ) {
    if (descendants(inf, group).length) {
      qualidade.bloqueios.push(`${group} nao e copiado automaticamente.`);
    }
  }
  for (const field of ["CodigoPais", "NumeroProcesso"]) {
    if (leaf(service, field)) {
      qualidade.bloqueios.push(`${field} exige traducao antes da copia.`);
    }
  }
  if (["6", "7"].includes(dados.exigibilidadeIss)) {
    qualidade.bloqueios.push(
      "Suspensao do ISS exige dados do processo antes da copia.",
    );
  }
  if (qualidade.faltantes.length) {
    qualidade.limitacoes.push(
      "Campos fiscais ausentes devem ser preenchidos e revisados no rascunho.",
    );
  }
  qualidade.limitacoes.push(
    "Datas, competencia, RPS, numero da nota e identificadores de autorizacao nao sao copiados.",
  );
  const situacao = direct(comp, "NfseSubstituicao")
    ? "substituida"
    : direct(comp, "NfseCancelamento")
    ? "cancelada"
    : "confirmada";
  return {
    numero_nfse: numero,
    codigo_verificacao: verification,
    data_emissao: timestamp.toISOString(),
    xml: serializeWithNamespaceContext(comp),
    hash_sha256: "",
    situacao,
    dados,
    qualidade,
  };
}

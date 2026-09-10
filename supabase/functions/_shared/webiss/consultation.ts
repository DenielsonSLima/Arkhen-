import type { FiscalCertificate } from "./certificate.ts";
import { parseFiscalDocument, requireValidCnpj } from "../fiscal-document.ts";
import {
  descendants,
  direct,
  nodeText,
  parseXml,
  readLimitedXml,
  xmlEscape,
} from "./xml.ts";
import {
  type ConsultationContext,
  type ConsultationPeriod,
  type ConsultedNote,
  extractConsultedNote,
} from "./consultation-data.ts";

export const CONSULTATION_OPERATION = "ConsultarNfseServicoPrestado";
const NS = "http://www.abrasf.org.br/nfse.xsd";
const ENDPOINTS: Record<string, string> = {
  homologacao: "https://homologacao.webiss.com.br/ws/nfse.asmx",
  producao: "https://itabaianase.webiss.com.br/ws/nfse.asmx",
};
export function validateConsultationPeriod(period: ConsultationPeriod) {
  const date = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("Periodo de consulta invalido.");
    }
    const parsed = new Date(value + "T00:00:00Z");
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) throw new Error("Periodo de consulta invalido.");
    return parsed.getTime();
  };
  const days = (date(period.fim) - date(period.inicio)) / 86400000;
  if (days < 0 || days > 365) {
    throw new Error("Consulte um intervalo de no maximo 366 dias.");
  }
}
export function buildConsultationXml(
  context: ConsultationContext,
  period: ConsultationPeriod,
  page: number,
) {
  validateConsultationPeriod(period);
  if (
    !ENDPOINTS[context.ambiente] ||
    context.endpoint !== ENDPOINTS[context.ambiente]
  ) throw new Error("Ambiente e endpoint de consulta divergentes.");
  if (!Number.isInteger(page) || page < 1 || page > 999999) {
    throw new Error("Pagina de consulta invalida.");
  }
  const cnpj = requireValidCnpj(context.prestador.cnpj);
  const customer = parseFiscalDocument(context.tomador.documento);
  const im = context.prestador.inscricaoMunicipal;
  if (!im || im.length > 15) {
    throw new Error("Inscricao municipal do prestador invalida.");
  }
  const tag = customer.kind === "cpf" ? "Cpf" : "Cnpj";
  return `<ConsultarNfseServicoPrestadoEnvio xmlns="${NS}"><Prestador><CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj>` +
    `<InscricaoMunicipal>${xmlEscape(im)}</InscricaoMunicipal></Prestador>` +
    `<PeriodoEmissao><DataInicial>${period.inicio}</DataInicial><DataFinal>${period.fim}</DataFinal></PeriodoEmissao>` +
    `<Tomador><CpfCnpj><${tag}>${customer.value}</${tag}></CpfCnpj></Tomador><Pagina>${page}</Pagina></ConsultarNfseServicoPrestadoEnvio>`;
}
export function parseConsultationResponse(
  soap: string,
  context: ConsultationContext,
  period: ConsultationPeriod,
  page: number,
) {
  const root = parseXml(soap).documentElement;
  if (descendants(root, "Fault").length) {
    throw new Error(
      "Falha SOAP na consulta WebISS; nenhuma emissao foi enviada.",
    );
  }
  const outputs = descendants(root, "outputXML");
  if (outputs.length !== 1) {
    throw new Error("Resposta de consulta sem outputXML unico.");
  }
  const response = parseXml(nodeText(outputs[0])).documentElement;
  if (
    response.localName !== "ConsultarNfseServicoPrestadoResposta" ||
    response.namespaceURI !== NS
  ) {
    throw new Error(
      "Resposta nao corresponde a consulta de servicos prestados.",
    );
  }
  const errors = direct(response, "ListaMensagemRetorno");
  if (errors) {
    const codes = descendants(errors, "MensagemRetorno").map((item) =>
      nodeText(direct(item, "Codigo"))
    ).filter((code) => /^[A-Za-z0-9-]{1,20}$/.test(code));
    throw new Error(
      `Consulta WebISS rejeitada${
        codes.length ? ` (${codes.join(", ")})` : ""
      }; nenhum resultado confirmado.`,
    );
  }
  const list = direct(response, "ListaNfse");
  if (!list) throw new Error("Lista de notas ausente na resposta WebISS.");
  const comps = Array.from(list.childNodes).filter((node) =>
    node.nodeType === 1 && (node as Element).localName === "CompNfse"
  ) as Element[];
  if (comps.length > 50) {
    throw new Error(
      "Pagina WebISS excedeu 50 documentos previstos no contrato.",
    );
  }
  const notes = comps.map((comp) =>
    extractConsultedNote(comp, context, period)
  );
  const rawNext = nodeText(direct(list, "ProximaPagina"));
  const next = rawNext ? Number(rawNext) : undefined;
  if (
    next !== undefined &&
    (!/^\d+$/.test(rawNext) || !Number.isInteger(next) || next <= page ||
      next > 999999)
  ) throw new Error("Paginacao WebISS repetida ou invalida.");
  // Manual table says Pagina, current XSD says ProximaPagina: do not infer legacy meaning.
  return {
    notes,
    next,
    ambiguous: !rawNext && Boolean(direct(list, "Pagina")),
  };
}
export async function requestConsultationPage(
  context: ConsultationContext,
  period: ConsultationPeriod,
  page: number,
  certificate: FiscalCertificate,
) {
  const xml = buildConsultationXml(context, period, page);
  const header =
    `<cabecalho xmlns="${NS}" versao="2.02"><versaoDados>2.02</versaoDados></cabecalho>`;
  const body =
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>` +
    `<${CONSULTATION_OPERATION}Request xmlns="http://nfse.abrasf.org.br"><nfseCabecMsg xmlns="">${
      xmlEscape(header)
    }</nfseCabecMsg>` +
    `<nfseDadosMsg xmlns="">${
      xmlEscape(xml)
    }</nfseDadosMsg></${CONSULTATION_OPERATION}Request></soap:Body></soap:Envelope>`;
  const client = Deno.createHttpClient({
    cert: certificate.certificatePem,
    key: certificate.privateKeyPem,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(context.endpoint, {
      client,
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"http://nfse.abrasf.org.br/${CONSULTATION_OPERATION}"`,
      },
      body,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Consulta WebISS respondeu HTTP ${response.status}.`);
    }
    return parseConsultationResponse(
      await readLimitedXml(response, 4 * 1024 * 1024),
      context,
      period,
      page,
    );
  } finally {
    clearTimeout(timer);
    client.close();
  }
}

export async function collectLatestConsultedNotes(
  context: ConsultationContext,
  period: ConsultationPeriod,
  certificate: FiscalCertificate,
  requestPage = requestConsultationPage,
) {
  validateConsultationPeriod(period);
  // Bounded work: at most 5 pages/250 documents in an explicit period, never full unbounded history.
  const records = new Map<string, ConsultedNote>();
  let page = 1, pagesRead = 0, complete = false;
  for (; pagesRead < 5;) {
    const result = await requestPage(context, period, page, certificate);
    pagesRead += 1;
    for (const note of result.notes) {
      const prior = records.get(note.numero_nfse);
      if (prior && prior.xml !== note.xml) {
        throw new Error(
          "Nota mudou durante paginacao; atualize a consulta antes de copiar.",
        );
      }
      records.set(note.numero_nfse, note);
    }
    if (result.ambiguous) break;
    if (!result.next) {
      complete = true;
      break;
    }
    page = result.next;
  }
  const notes = [...records.values()].sort((a, b) =>
    b.data_emissao.localeCompare(a.data_emissao) ||
    (BigInt(b.numero_nfse) > BigInt(a.numero_nfse)
      ? 1
      : BigInt(b.numero_nfse) < BigInt(a.numero_nfse)
      ? -1
      : 0)
  ).slice(0, 5);
  for (const note of notes) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(note.xml),
    );
    note.hash_sha256 = Array.from(
      new Uint8Array(digest),
      (value) => value.toString(16).padStart(2, "0"),
    ).join("");
  }
  return {
    notes,
    pagesRead,
    coverage: complete ? "complete" as const : "partial" as const,
    periodo: period,
    warning: complete
      ? undefined
      : "Consulta parcial: estas sao as notas mais recentes entre as paginas consultadas, nao necessariamente as ultimas do periodo. Reduza o intervalo.",
  };
}

import {
  buildConsultationXml,
  collectLatestConsultedNotes,
  parseConsultationResponse,
  validateConsultationPeriod,
} from "./consultation.ts";
import type { ConsultationContext } from "./consultation-data.ts";
import type { FiscalCertificate } from "./certificate.ts";
import { xmlEscape } from "./xml.ts";
import { safeConsultationDiagnostic } from "./consultation-error.ts";

const assert = (value: unknown, message = "Falha na verificacao") => {
  if (!value) throw new Error(message);
};
const rejects = async (fn: () => unknown) => {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  assert(failed, "Esperava rejeicao");
};
export const consultationContext: ConsultationContext = {
  ambiente: "homologacao",
  endpoint: "https://homologacao.webiss.com.br/ws/nfse.asmx",
  prestador: { cnpj: "35898750000107", inscricaoMunicipal: "5938914" },
  tomador: { documento: "28767294000109" },
};
export const consultationPeriod = { inicio: "2026-08-01", fim: "2026-09-30" };
const certificate = {} as FiscalCertificate;
export function noteFixture(number: number, day = "2026-09-09", extra = "") {
  return `<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd"><Nfse versao="2.02"><InfNfse Id="N${number}">` +
    `<Numero>${number}</Numero><CodigoVerificacao>ABCD</CodigoVerificacao><DataEmissao>${day}T12:00:00</DataEmissao>` +
    `<ValoresNfse><Aliquota>3.5100</Aliquota><ValorLiquidoNfse>390.78</ValorLiquidoNfse></ValoresNfse>` +
    `<PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>35898750000107</Cnpj></CpfCnpj><InscricaoMunicipal>5938914</InscricaoMunicipal></IdentificacaoPrestador></PrestadorServico>` +
    `<OrgaoGerador><CodigoMunicipio>2802908</CodigoMunicipio></OrgaoGerador><DeclaracaoPrestacaoServico><InfDeclaracaoPrestacaoServico>` +
    `<Servico><Valores><ValorServicos>405.00</ValorServicos>${extra}</Valores><IssRetido>2</IssRetido><Discriminacao>Servico teste</Discriminacao><ItemListaServico>17.03</ItemListaServico><CodigoMunicipio>2802908</CodigoMunicipio><ExigibilidadeISS>1</ExigibilidadeISS></Servico>` +
    `<TomadorServico><IdentificacaoTomador><CpfCnpj><Cnpj>28767294000109</Cnpj></CpfCnpj></IdentificacaoTomador></TomadorServico>` +
    `<OptanteSimplesNacional>1</OptanteSimplesNacional><IncentivoFiscal>2</IncentivoFiscal></InfDeclaracaoPrestacaoServico></DeclaracaoPrestacaoServico></InfNfse></Nfse></CompNfse>`;
}
export function consultationSoap(notes: string, next = "") {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><outputXML>${
    xmlEscape(
      `<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaNfse>${notes}${next}</ListaNfse></ConsultarNfseServicoPrestadoResposta>`,
    )
  }</outputXML></soap:Body></soap:Envelope>`;
}
const parse = (notes: string, next = "", page = 1) =>
  parseConsultationResponse(
    consultationSoap(notes, next),
    consultationContext,
    consultationPeriod,
    page,
  );

Deno.test("E212 sozinho sem documentos confirma ausencia; erro misto ou documento rejeita", async () => {
  const read = (codes: string[], notes = "") =>
    parseConsultationResponse(
      `<Envelope><outputXML>${
        xmlEscape(
          `<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaMensagemRetorno>${
            codes.map((code) =>
              `<MensagemRetorno><Codigo>${code}</Codigo><Mensagem>Resposta fiscal</Mensagem></MensagemRetorno>`
            ).join("")
          }</ListaMensagemRetorno>${
            notes ? `<ListaNfse>${notes}</ListaNfse>` : ""
          }</ConsultarNfseServicoPrestadoResposta>`,
        )
      }</outputXML></Envelope>`,
      consultationContext,
      consultationPeriod,
      2,
    );
  assert(
    read(["E212"]).notes.length === 0 &&
      read(["E212", "E212"]).next === undefined,
  );
  await rejects(() => read(["E212", "L999"]));
  await rejects(() => read(["E212"], noteFixture(292)));
  const events: string[] = [];
  const result = await collectLatestConsultedNotes(
    consultationContext,
    consultationPeriod,
    certificate,
    async (_context, _period, page) => {
      events.push(`page${page}`);
      return page === 1
        ? parse(noteFixture(292), "<ProximaPagina>2</ProximaPagina>")
        : read(["E212"]);
    },
    async () => {
      events.push("gate");
    },
  );
  assert(
    result.notes.length === 1 && result.notes[0].numero_nfse === "292" &&
      result.pagesRead === 2 && result.coverage === "complete",
  );
  assert(events.join(",") === "gate,page1,gate,page2");
});

Deno.test("gate falho impede SOAP e L999 nunca dispara retry automatico", async () => {
  let calls = 0;
  await rejects(() =>
    collectLatestConsultedNotes(
      consultationContext,
      consultationPeriod,
      certificate,
      async () => {
        calls++;
        return parse(noteFixture(1));
      },
      async () => {
        throw new Error("PRIVATE_SECRET");
      },
    )
  );
  assert(calls === 0);
  await rejects(() =>
    collectLatestConsultedNotes(
      consultationContext,
      consultationPeriod,
      certificate,
      async () => {
        calls++;
        throw new Error("L999");
      },
      async () => {},
    )
  );
  assert(calls === 1);
});

Deno.test("consulta tolera wrapper de mensagens vazio apenas com notas validadas", async () => {
  const wrap = (inside: string) =>
    `<Envelope><outputXML>${
      xmlEscape(
        `<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd">${inside}</ConsultarNfseServicoPrestadoResposta>`,
      )
    }</outputXML></Envelope>`;
  const read = (inside: string) =>
    parseConsultationResponse(
      wrap(inside),
      consultationContext,
      consultationPeriod,
      1,
    );
  const valid = `<ListaMensagemRetorno/><ListaNfse>${
    noteFixture(292)
  }</ListaNfse>`;
  assert(read(valid).notes[0].numero_nfse === "292");
  await rejects(() => read(valid.replace("35898750000107", "28767294000109")));
  for (
    const inside of [
      "<ListaMensagemRetorno/>",
      "<ListaMensagemRetorno/><ListaNfse/>",
      `<ListaMensagemRetorno>PRIVATE</ListaMensagemRetorno><ListaNfse>${
        noteFixture(292)
      }</ListaNfse>`,
    ]
  ) {
    let caught: unknown;
    try {
      read(inside);
    } catch (error) {
      caught = error;
    }
    assert(
      safeConsultationDiagnostic(caught)?.code === "VALIDATE_EMPTY_MESSAGES",
    );
  }
  for (const codigo of ["L001", "123", "PRIVATE_SECRET"]) {
    let caught: unknown;
    try {
      read(
        `<ListaMensagemRetorno><MensagemRetorno><Codigo>${codigo}</Codigo><Mensagem>PRIVATE</Mensagem></MensagemRetorno></ListaMensagemRetorno><ListaNfse>${
          noteFixture(292)
        }</ListaNfse>`,
      );
    } catch (error) {
      caught = error;
    }
    const diagnostic = safeConsultationDiagnostic(caught);
    assert(
      diagnostic?.code === "VALIDATE_PROVIDER" &&
        !diagnostic.message.includes("PRIVATE"),
    );
    if (codigo !== "PRIVATE_SECRET") {
      assert(diagnostic?.message.endsWith(`(${codigo})`));
    }
  }
  await rejects(() =>
    read(
      `<ListaMensagemRetorno><MensagemRetorno/></ListaMensagemRetorno><ListaNfse>${
        noteFixture(292)
      }</ListaNfse>`,
    )
  );
});

Deno.test("consulta cria somente XML de servicos prestados com prestador/tomador/periodo/pagina", () => {
  const xml = buildConsultationXml(consultationContext, consultationPeriod, 2);
  assert(
    xml.includes("<Pagina>2</Pagina>") && xml.includes("<PeriodoEmissao>") &&
      xml.includes("<Tomador><CpfCnpj><Cnpj>28767294000109"),
  );
  assert(
    !xml.includes("GerarNfse") && !xml.includes("CancelarNfse") &&
      !xml.includes("<Rps>"),
  );
});
Deno.test("consulta rejeita intervalo ilimitado/data inexistente/endpoint trocado", async () => {
  await rejects(() =>
    validateConsultationPeriod({ inicio: "2010-01-01", fim: "2026-09-09" })
  );
  await rejects(() =>
    validateConsultationPeriod({ inicio: "2026-02-30", fim: "2026-03-01" })
  );
  await rejects(() =>
    buildConsultationXml(
      { ...consultationContext, ambiente: "producao" },
      consultationPeriod,
      1,
    )
  );
});
Deno.test("consulta multi-nota preserva valor bruto e percentual, nunca copia RPS/identificadores", () => {
  const result = parse(noteFixture(1) + noteFixture(2));
  assert(result.notes.length === 2);
  const note = result.notes[0];
  assert(note.dados.valor === "405.00" && note.dados.aliquotaIss === "3.5100");
  assert(
    !("numero" in note.dados) && !("competencia" in note.dados) &&
      !("dataEmissao" in note.dados),
  );
  assert(
    note.xml.includes("<Numero>1</Numero>") &&
      !note.xml.includes("<Numero>2</Numero>"),
  );
});
Deno.test("consulta rejeita retorno de outro prestador, tomador, IM ou periodo", async () => {
  await rejects(() =>
    parse(noteFixture(1).replace("35898750000107", "28767294000109"))
  );
  await rejects(() =>
    parse(noteFixture(1).replace("28767294000109", "35898750000107"))
  );
  await rejects(() => parse(noteFixture(1).replace("5938914", "111")));
  await rejects(() => parse(noteFixture(1, "2025-09-09")));
});
Deno.test("consulta conserva cancelamento e sinaliza tributos que nao podem ser perdidos na copia", () => {
  const note = parse(
    noteFixture(1, "2026-09-09", "<ValorPis>10.00</ValorPis>").replace(
      "</CompNfse>",
      "<NfseCancelamento><Confirmacao/></NfseCancelamento></CompNfse>",
    ),
  ).notes[0];
  assert(
    note.situacao === "cancelada" &&
      note.qualidade.bloqueios.some((value) => value.includes("ValorPis")),
  );
});
Deno.test("consulta percorre ProximaPagina e ordena todas paginas antes do limite5", async () => {
  const called: number[] = [];
  const result = await collectLatestConsultedNotes(
    consultationContext,
    consultationPeriod,
    certificate,
    (_context, _period, page) => {
      called.push(page);
      return Promise.resolve(
        page === 1
          ? parse(
            [1, 2, 3, 4, 5].map((n) => noteFixture(n, "2026-08-01")).join(""),
            "<ProximaPagina>2</ProximaPagina>",
          )
          : parse(noteFixture(99, "2026-09-09"), "", 2),
      );
    },
  );
  assert(
    called.join(",") === "1,2" && result.coverage === "complete" &&
      result.notes.length === 5,
  );
  assert(
    result.notes[0].numero_nfse === "99" &&
      result.notes[0].hash_sha256.length === 64,
  );
});
Deno.test("consulta limita trabalho a5paginas e marca resultado parcial", async () => {
  const result = await collectLatestConsultedNotes(
    consultationContext,
    consultationPeriod,
    certificate,
    (_context, _period, page) =>
      Promise.resolve(
        parse(
          noteFixture(page),
          `<ProximaPagina>${page + 1}</ProximaPagina>`,
          page,
        ),
      ),
  );
  assert(
    result.pagesRead === 5 && result.coverage === "partial" && result.warning,
  );
});
Deno.test("consulta nao presume semantica do campo Pagina legado e rejeita ciclo", async () => {
  const result = await collectLatestConsultedNotes(
    consultationContext,
    consultationPeriod,
    certificate,
    () => Promise.resolve(parse(noteFixture(1), "<Pagina>1</Pagina>")),
  );
  assert(result.coverage === "partial" && result.pagesRead === 1);
  await rejects(() =>
    parse(noteFixture(1), "<ProximaPagina>1</ProximaPagina>")
  );
});
Deno.test("timeout de consulta interrompe fluxo sem repetir nem enviar RPS", async () => {
  let calls = 0;
  await rejects(() =>
    collectLatestConsultedNotes(
      consultationContext,
      consultationPeriod,
      certificate,
      () => {
        calls++;
        throw new Error("timeout");
      },
    )
  );
  assert(calls === 1);
});

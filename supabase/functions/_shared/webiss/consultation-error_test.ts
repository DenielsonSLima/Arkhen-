import {
  certificateError,
  clientCreationError,
  ConsultationError,
  preparationError,
  safeConsultationDiagnostic,
} from "./consultation-error.ts";
import { requestConsultationPage } from "./consultation.ts";
import type { FiscalCertificate } from "./certificate.ts";
const assert = (value: unknown) => {
  if (!value) throw new Error("Assertion failed");
};
const secret = "PRIVATE_CERTIFICATE_PASSWORD_XML";
Deno.test("safe diagnostics classify only exact preparation errors and known SQLSTATE", () => {
  assert(
    preparationError({ message: "Contexto fiscal fora da empresa." }).code ===
      "PREPARE_TENANT",
  );
  assert(
    preparationError({ message: secret, code: "42501", details: secret })
      .code === "PREPARE_PERMISSION",
  );
  for (
    const message of [
      secret,
      "Contexto fiscal fora da empresa. " + secret,
      "toString",
      "__proto__",
    ]
  ) {
    const error = preparationError({ message, code: secret });
    assert(
      error.code === "PREPARE_FAILED" &&
        !JSON.stringify(safeConsultationDiagnostic(error)).includes(secret),
    );
  }
});
Deno.test("safe diagnostics certificate and unsupported runtime messages never expose originals", () => {
  assert(
    certificateError(
      new Error("Certificado PFX/P12 corrompido ou senha incorreta."),
    ).code === "CERTIFICATE_DECODE",
  );
  assert(
    certificateError(new Error("Certificado expirado em 2026-01-01.")).code ===
      "CERTIFICATE_VALIDITY",
  );
  assert(certificateError(new Error(secret)).code === "CERTIFICATE_FAILED");
  assert(
    clientCreationError(new Error("Deno.createHttpClient is not a function"))
      .code === "TRANSPORT_UNSUPPORTED",
  );
  assert(
    clientCreationError(
      new Error("Deno.createHttpClient is not supported " + secret),
    ).code === "TRANSPORT_CLIENT",
  );
});
Deno.test("safe diagnostics refuse forged objects and reconstruct mutated errors", () => {
  assert(
    safeConsultationDiagnostic({ code: "SAVE_FAILED", message: secret }) ===
      null,
  );
  const error = new ConsultationError("VALIDATE_PROVIDER", [
    "E10",
    secret,
    "E9999999",
    "E123\r\n",
    "E123\n",
    "E1\nPRIVATE",
    "E1",
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
  ]);
  error.message = secret;
  Object.defineProperty(error, "stage", { value: secret });
  error.providerCodes.push("E123\r\n", secret);
  const diagnostic = safeConsultationDiagnostic(error);
  assert(
    diagnostic?.message.endsWith("(E10,E1,E2,E3,E4)") &&
      !diagnostic.message.includes(secret) && diagnostic.stage === "validate",
  );
  assert(safeConsultationDiagnostic(new Error(secret)) === null);
});
Deno.test("provider diagnostics accept bounded WebISS letter prefixes and numeric codes only", () => {
  const diagnostic = safeConsultationDiagnostic(
    new ConsultationError("VALIDATE_PROVIDER", [
      "L001",
      "123",
      "ABCD123456",
      "E999999",
      "ERROR123",
      "L001\r\n",
      "SECRET",
      "1.2",
      "1234567",
      "l001",
    ]),
  );
  assert(diagnostic?.message.endsWith("(L001,123,ABCD123456,E999999)"));
});
const context = {
  ambiente: "producao",
  endpoint: "https://itabaianase.webiss.com.br/ws/nfse.asmx",
  prestador: { cnpj: "35898750000107", inscricaoMunicipal: "5938914" },
  tomador: { documento: "28767294000109" },
};
const period = { inicio: "2026-08-20", fim: "2026-08-20" };
const certificate = {} as FiscalCertificate;
Deno.test("transport creation failure is safe and sends no request", async () => {
  const original = Deno.createHttpClient, originalFetch = globalThis.fetch;
  let fetched = false;
  Deno.createHttpClient = () => {
    throw new Error("Deno.createHttpClient is not a function");
  };
  globalThis.fetch = () => {
    fetched = true;
    throw new Error(secret);
  };
  try {
    let caught: unknown;
    try {
      await requestConsultationPage(context, period, 1, certificate);
    } catch (error) {
      caught = error;
    }
    assert(
      safeConsultationDiagnostic(caught)?.code === "TRANSPORT_UNSUPPORTED" &&
        !fetched,
    );
  } finally {
    Deno.createHttpClient = original;
    globalThis.fetch = originalFetch;
  }
});
Deno.test("transport and SOAP diagnostics separate HTTP, network, XML, provider with cleanup", async () => {
  const original = Deno.createHttpClient, originalFetch = globalThis.fetch;
  let closed = 0;
  Deno.createHttpClient = () => ({
    close() {
      closed++;
    },
  } as Deno.HttpClient);
  const xml =
    `<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaMensagemRetorno><MensagemRetorno><Codigo>E10</Codigo><Mensagem>${secret}</Mensagem></MensagemRetorno><MensagemRetorno><Codigo>${secret}</Codigo></MensagemRetorno></ListaMensagemRetorno></ConsultarNfseServicoPrestadoResposta>`;
  const soap = `<Envelope><outputXML>${
    xml.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  }</outputXML></Envelope>`;
  const cases: Array<[() => Promise<Response>, string]> = [
    [() => Promise.reject(new Error(secret)), "TRANSPORT_FAILED"],
    [
      () => Promise.resolve(new Response(secret, { status: 401 })),
      "TRANSPORT_HTTP_AUTH",
    ],
    [
      () => Promise.resolve(new Response(secret, { status: 403 })),
      "TRANSPORT_HTTP_AUTH",
    ],
    [
      () => Promise.resolve(new Response(secret, { status: 500 })),
      "TRANSPORT_HTTP_SERVER",
    ],
    [
      () =>
        Promise.resolve(
          new Response("<Envelope><Fault>" + secret + "</Fault></Envelope>"),
        ),
      "VALIDATE_SOAP",
    ],
    [() => Promise.resolve(new Response("<arbitrary/>")), "VALIDATE_RESPONSE"],
    [() => Promise.resolve(new Response(soap)), "VALIDATE_PROVIDER"],
  ];
  try {
    for (const [fetcher, code] of cases) {
      globalThis.fetch = fetcher;
      let caught: unknown;
      try {
        await requestConsultationPage(context, period, 1, certificate);
      } catch (error) {
        caught = error;
      }
      const diagnostic = safeConsultationDiagnostic(caught);
      assert(diagnostic?.code === code && !diagnostic.message.includes(secret));
      if (code === "VALIDATE_PROVIDER") {
        assert(diagnostic?.message.endsWith("(E10)"));
      }
    }
    assert(closed === cases.length);
  } finally {
    Deno.createHttpClient = original;
    globalThis.fetch = originalFetch;
  }
});

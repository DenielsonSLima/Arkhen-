import {
  privateConsultationDiagnostic,
  providerErrorFromResponse,
} from "./consultation-provider-error.ts";
import {
  ConsultationError,
  safeConsultationDiagnostic,
} from "./consultation-error.ts";
import { parseXml, xmlEscape } from "./xml.ts";
const assert = (value: unknown) => {
  if (!value) throw new Error("Assertion failed");
};
function providerError(message: string, correction = "", code = "L999") {
  const item = parseXml(
    `<MensagemRetorno><Codigo>${xmlEscape(code)}</Codigo><Mensagem>${
      xmlEscape(message)
    }</Mensagem><Correcao>${
      xmlEscape(correction)
    }</Correcao></MensagemRetorno>`,
  ).documentElement;
  return providerErrorFromResponse([item]);
}
Deno.test("provider reason comes only from fiscal message/correction and stays private", () => {
  const error = providerError(
    "Inscricao municipal nao habilitada.\n",
    "Verifique o cadastro no municipio.",
  );
  const stored = privateConsultationDiagnostic(error)!;
  assert(
    stored.includes("(L999)") &&
      stored.includes("Inscricao municipal nao habilitada.") &&
      stored.includes("Verifique o cadastro no municipio."),
  );
  assert(!safeConsultationDiagnostic(error)?.message.includes("habilitada"));
  assert(!JSON.stringify(error).includes("habilitada"));
});
Deno.test("provider reason rejects PEM private keys XML long base64 and JWT", () => {
  for (
    const value of [
      "-----BEGIN CERTIFICATE-----",
      "PRIVATE KEY sensitive",
      "PRI\u0001VATE KEY sensitive",
      "senha: sensitive",
      "<xml>sensitive</xml>",
      "&lt;xml&gt;sensitive",
      "a".repeat(128),
      "a".repeat(64) + "\n" + "b".repeat(64),
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk1234567890",
    ]
  ) {
    const error = providerError(value);
    assert(
      privateConsultationDiagnostic(error) ===
        safeConsultationDiagnostic(error)?.message,
    );
  }
});
Deno.test("provider reason ignores arbitrary exceptions mutable data and invalid provider code", () => {
  assert(privateConsultationDiagnostic(new Error("SECRET")) === null);
  const forged = new ConsultationError("VALIDATE_PROVIDER", ["L999"]);
  Object.assign(forged, {
    reason: "SECRET",
    providerReason: "SECRET",
    cause: new Error("SECRET"),
    message: "SECRET",
  });
  assert(!privateConsultationDiagnostic(forged)?.includes("SECRET"));
  assert(
    !privateConsultationDiagnostic(providerError("SECRET", "", "not a code"))
      ?.includes("SECRET"),
  );
  const original = providerError("Cadastro nao habilitado.");
  Object.assign(original, {
    reason: "SECRET",
    providerReason: "SECRET",
    message: "SECRET",
  });
  assert(
    privateConsultationDiagnostic(original)?.includes(
      "Cadastro nao habilitado.",
    ) && !privateConsultationDiagnostic(original)?.includes("SECRET"),
  );
});
Deno.test("provider reason removes controls enforces cap and rejects nested XML", () => {
  const error = providerError(
    "Cadastro\npendente\u0001 no municipio. " + "Texto fiscal. ".repeat(80),
  );
  const stored = privateConsultationDiagnostic(error)!;
  assert(
    stored.length <= 300 && !/[\u0000-\u001f]/.test(stored) &&
      stored.includes("Cadastro pendente no municipio."),
  );
  const nested = parseXml(
    "<MensagemRetorno><Codigo>L999</Codigo><Mensagem><secret>SECRET</secret></Mensagem></MensagemRetorno>",
  ).documentElement;
  assert(
    !privateConsultationDiagnostic(providerErrorFromResponse([nested]))
      ?.includes("SECRET"),
  );
});

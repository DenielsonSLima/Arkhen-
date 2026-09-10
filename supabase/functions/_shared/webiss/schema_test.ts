import { assertWebIssRpsSchema } from "./schema.ts";
import bundle from "./schema-bundle.json" with { type: "json" };
import { preparedFixture } from "./emission_test.ts";
import { createTestCertificate } from "./certificate_test.ts";
import { parseFiscalPkcs12 } from "./certificate.ts";
import { buildUnsignedRps } from "./rps.ts";
import { emitWebIssNfse, prepareSignedWebIssRps } from "./emission.ts";
import { verifySignedRps } from "./signature.ts";

const fails = (run: () => unknown) => {
  try { run(); } catch (error) {
    if (error instanceof Error && /XML.*WebISS|XSD WebISS/.test(error.message)) return;
    throw error;
  }
  throw new Error("XML fora do contrato foi aceito.");
};

Deno.test("Bundle XSD preserva os bytes e hashes dos schemas oficiais com import XMLDSig", async () => {
  for (const [name, file] of Object.entries(bundle.files)) {
    const bytes = new TextEncoder().encode(file.content);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== file.sha256) throw new Error(`Hash divergente: ${name}`);
    const source = await Deno.readFile(new URL(`../../../../docs/integrations/webiss/fontes/oficial/${name}`, import.meta.url));
    if (bytes.length !== source.length || bytes.some((byte, index) => byte !== source[index])) {
      throw new Error(`Schema divergente do acervo: ${name}`);
    }
  }
});

Deno.test("XSD real aceita cenarios CPF/CNPJ, competencia distinta, NBS e ISS retido", () => {
  const base = preparedFixture();
  for (const documento of ["52998224725", "00000000E08G12"]) {
    assertWebIssRpsSchema(buildUnsignedRps({
      ...base, tomador: { ...base.tomador, documento },
      servico: { ...base.servico, competencia: "2026-08-01", municipioIncidencia: "2800308",
        codigoNbs: "123456789", issRetido: "1", responsavelRetencao: "1", aliquotaIss: "3.51" },
    }));
  }
});

Deno.test("XSD real rejeita ausencia, ordem, grafia e estruturas nao previstas no schema", () => {
  const xml = buildUnsignedRps(preparedFixture());
  for (const bad of [
    xml.replace(/<Competencia>.*?<\/Competencia>/, ""),
    xml.replace("<Servico>", "<Servico><IBSCBS/>"),
    xml.replace("<Discriminacao>", "<CodigoNBS>123456789</CodigoNBS><Discriminacao>"),
    xml.replace("<IssRetido>2</IssRetido>", "<IssRetido>9</IssRetido>"),
    xml.replace("<Valores>", "<CodigoMunicipio>2802908</CodigoMunicipio><Valores>"),
    xml.replace("GerarNfseEnvio", "ConsultarNfseRpsEnvio"),
  ]) fails(() => assertWebIssRpsSchema(bad));
});

Deno.test("XSD bloqueia DTD, entidades e XML excessivo sem resolver rede ou disco", () => {
  fails(() => assertWebIssRpsSchema('<!DOCTYPE foo SYSTEM "file:///etc/passwd"><foo/>'));
  fails(() => assertWebIssRpsSchema('<!DOCTYPE foo SYSTEM "https://example.com/xxe"><foo/>'));
  fails(() => assertWebIssRpsSchema(" ".repeat(1024 * 1024 + 1)));
});

Deno.test("Preparacao valida XML final assinado e import XMLDSig rejeita assinatura estruturalmente invalida", async () => {
  const cert = parseFiscalPkcs12(createTestCertificate(), " senha ");
  const prepared = { ...preparedFixture(), endpoint: "https://homologacao.webiss.com.br/ws/nfse.asmx" };
  const signed = await prepareSignedWebIssRps(prepared, cert);
  assertWebIssRpsSchema(signed);
  verifySignedRps(signed, cert);
  fails(() => assertWebIssRpsSchema(signed.replace(/<SignedInfo>[\s\S]*?<\/SignedInfo>/, "")));
});

Deno.test("Emissao recusa XML preassinado invalido antes de criar conexao SOAP", async () => {
  const cert = parseFiscalPkcs12(createTestCertificate(), " senha ");
  const prepared = { ...preparedFixture(), endpoint: "https://homologacao.webiss.com.br/ws/nfse.asmx" };
  try {
    await emitWebIssNfse(prepared, cert, '<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"/>');
  } catch (error) {
    if (error instanceof Error && error.message.includes("XSD WebISS")) return;
    throw error;
  }
  throw new Error("Envio permitiu XML invalido.");
});

Deno.test("Envio legado sem competencia explicita e bloqueado mesmo com XML preassinado", async () => {
  const cert = parseFiscalPkcs12(createTestCertificate(), " senha ");
  const prepared = { ...preparedFixture(), endpoint: "https://homologacao.webiss.com.br/ws/nfse.asmx" };
  const signed = await prepareSignedWebIssRps(prepared, cert);
  prepared.servico.competencia = "";
  for (const operation of [() => prepareSignedWebIssRps(prepared, cert), () => emitWebIssNfse(prepared, cert, signed)]) {
    try { await operation(); } catch (error) {
      if (error instanceof Error && error.message.includes("competencia explicita")) continue;
      throw error;
    }
    throw new Error("Emissao sem competencia foi permitida.");
  }
});

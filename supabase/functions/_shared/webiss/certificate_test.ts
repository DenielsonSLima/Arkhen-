import forge from "npm:node-forge@1.3.1";
import { parseFiscalPkcs12 } from "./certificate.ts";
import { signRps, testCertificateSignature, verifySignedRps } from "./signature.ts";

export function createTestCertificate(offsetStart = -60_000, offsetEnd = 86_400_000) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() + offsetStart);
  cert.validity.notAfter = new Date(Date.now() + offsetEnd);
  cert.setSubject([{ name: "commonName", value: "TESTE:11222333000181" }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], " senha ", { algorithm: "3des" });
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
}

Deno.test("A1 assina XML com c14n inclusiva e detecta adulteracao", () => {
  const cert = parseFiscalPkcs12(createTestCertificate(), " senha ");
  if (cert.cnpj !== "11222333000181") throw new Error("CNPJ nao identificado");
  if (!testCertificateSignature(cert).signedXmlVerified) throw new Error("Assinatura nao verificada");
  const xml = signRps('<Rps xmlns="http://www.abrasf.org.br/nfse.xsd"><InfDeclaracaoPrestacaoServico Id="TESTE"><Competencia>2026-01-01</Competencia></InfDeclaracaoPrestacaoServico></Rps>', cert);
  if (!xml.includes('Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"')) throw new Error("Canonicalizacao incorreta");
  let failed = false;
  try { verifySignedRps(xml.replace("2026-01-01", "2026-02-01"), cert); } catch { failed = true; }
  if (!failed) throw new Error("Adulteracao nao detectada");
});

Deno.test("A1 rejeita certificado expirado hoje ou ainda nao vigente", () => {
  for (const [start, end] of [[-86_400_000, -1000], [86_400_000, 172_800_000]]) {
    let failed = false;
    try { parseFiscalPkcs12(createTestCertificate(start, end), " senha "); } catch { failed = true; }
    if (!failed) throw new Error("Certificado fora da validade aceito");
  }
});

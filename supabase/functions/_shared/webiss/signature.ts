import { SignedXml } from "npm:xml-crypto@6.1.2";
import type { FiscalCertificate } from "./certificate.ts";
import { descendants, parseXml } from "./xml.ts";

const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
export const signRps = (xml: string, certificate: FiscalCertificate) => {
  const signer = new SignedXml({ privateKey: certificate.privateKeyPem, publicCert: certificate.certificatePem });
  signer.canonicalizationAlgorithm = C14N;
  signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  signer.addReference({
    xpath: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']",
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", C14N],
  });
  signer.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='InfDeclaracaoPrestacaoServico']", action: "after" },
  });
  const signed = signer.getSignedXml();
  verifySignedRps(signed, certificate);
  return signed;
};

export function verifySignedRps(xml: string, certificate: FiscalCertificate) {
  const doc = parseXml(xml);
  const signatures = descendants(doc.documentElement, "Signature");
  if (signatures.length !== 1) throw new Error("Assinatura XML A1 ausente ou ambigua.");
  const verifier = new SignedXml({ publicCert: certificate.certificatePem, getCertFromKeyInfo: () => null });
  verifier.loadSignature(signatures[0]);
  if (!verifier.checkSignature(xml)) throw new Error("Falha na verificacao criptografica da assinatura XML A1.");
}

export function testCertificateSignature(certificate: FiscalCertificate) {
  signRps('<GerarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><Rps><InfDeclaracaoPrestacaoServico Id="DIAGNOSTICO"><Competencia>2026-01-01</Competencia></InfDeclaracaoPrestacaoServico></Rps></GerarNfseEnvio>', certificate);
  return { signedXmlVerified: true };
}

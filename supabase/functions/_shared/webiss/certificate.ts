import forge from "npm:node-forge@1.3.1";

export interface FiscalCertificate {
  certificatePem: string;
  privateKeyPem: string;
  validFrom: string;
  validUntil: string;
  daysRemaining: number;
  subject: string;
  cnpj: string;
}

const normalizeBase64 = (value: string) => value.replace(/^data:[^,]+,/, "").replace(/\s/g, "");

const decodeBase64 = (value: string) => {
  const normalized = normalizeBase64(value);
  if (!normalized || normalized.length > 4 * 1024 * 1024) {
    throw new Error("Certificado ausente ou acima do limite de 3 MB.");
  }
  try {
    return forge.util.decode64(normalized);
  } catch {
    throw new Error("Arquivo de certificado invalido.");
  }
};

const readAttribute = (certificate: forge.pki.Certificate, shortName: string) => {
  const attribute = certificate.subject.attributes.find(
    (item: { shortName?: string; value?: unknown }) => item.shortName === shortName,
  );
  return typeof attribute?.value === "string" ? attribute.value.trim() : "";
};

export const parseFiscalPkcs12 = (base64: string, password: string): FiscalCertificate => {
  if (!password || password.length > 512 || password.includes("\0")) {
    throw new Error("Senha do certificado ausente ou invalida.");
  }
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(decodeBase64(base64));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw new Error("Certificado PFX/P12 corrompido ou senha incorreta.");
  }

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
      [forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const key = keyBags.find((bag) => bag.key)?.key;
  const certificate = certBags.find(
    (bag: { cert?: forge.pki.Certificate }) => bag.cert,
  )?.cert;
  if (!key || !certificate) throw new Error("PFX/P12 sem chave privada ou certificado A1.");

  const validFrom = certificate.validity.notBefore;
  const validUntil = certificate.validity.notAfter;
  const daysRemaining = Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000);
  if (daysRemaining < 0) throw new Error(`Certificado expirado em ${validUntil.toISOString().slice(0, 10)}.`);

  const commonName = readAttribute(certificate, "CN");
  const organization = readAttribute(certificate, "O");
  const subject = commonName || organization || "Titular não identificado";
  const cnpjMatch = subject.replace(/\D/g, "").match(/\d{14}/);

  return {
    certificatePem: forge.pki.certificateToPem(certificate),
    privateKeyPem: forge.pki.privateKeyToPem(key),
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
    daysRemaining,
    subject,
    cnpj: cnpjMatch?.[0] || "",
  };
};

export const assertCertificateMatchesCnpj = (certificate: FiscalCertificate, configuredCnpj: string) => {
  const expected = configuredCnpj.replace(/\D/g, "");
  if (expected && certificate.cnpj && expected !== certificate.cnpj) {
    throw new Error("O CNPJ do certificado nao corresponde ao emitente configurado.");
  }
};

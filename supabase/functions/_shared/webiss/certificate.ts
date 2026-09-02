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

type ForgeCertificate = {
  subject: {
    attributes: Array<{
      shortName?: string;
      name?: string;
      type?: string;
      value?: unknown;
    }>;
  };
  validity: {
    notBefore: Date;
    notAfter: Date;
  };
};

type ForgePkcs12 = ReturnType<typeof forge.pkcs12.pkcs12FromAsn1>;

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

const readAttribute = (certificate: ForgeCertificate, shortName: string, oid?: string) => {
  const attribute = certificate.subject.attributes.find(
    (item: { shortName?: string; name?: string; type?: string; value?: unknown }) => (
      item.shortName === shortName || item.name === shortName || (oid && item.type === oid)
    ),
  );
  return typeof attribute?.value === "string" ? attribute.value.trim() : "";
};

const normalizeCnpj = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const CNPJ_PATTERN = /^[A-Z0-9]{12}[0-9]{2}$/;
const characterValue = (character: string) => character.charCodeAt(0) - 48;
const calculateDigit = (base: string, weights: number[]) => {
  const sum = weights.reduce(
    (total, weight, index) => total + characterValue(base[index]) * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};
const isValidCnpj = (value: string) => {
  const normalized = normalizeCnpj(value);
  if (!CNPJ_PATTERN.test(normalized) || /^(\d)\1{13}$/.test(normalized)) return false;
  const base = normalized.slice(0, 12);
  const first = calculateDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return normalized.endsWith(`${first}${second}`);
};

const extractCnpj = (certificate: ForgeCertificate, subject: string) => {
  const serialNumber = readAttribute(certificate, "serialNumber", "2.5.4.5");
  const sources = [serialNumber, ...subject.split(/[:;,]/).reverse()];
  for (const source of sources) {
    const normalized = normalizeCnpj(source);
    const candidates = normalized.length === 14
      ? [normalized]
      : [normalized.slice(-14), normalized.slice(0, 14)];
    const found = candidates.find((candidate) => isValidCnpj(candidate));
    if (found) return found;
  }
  return "";
};

export const parseFiscalPkcs12 = (base64: string, password: string): FiscalCertificate => {
  if (!password || password.length > 512 || password.includes("\0")) {
    throw new Error("Senha do certificado ausente ou invalida.");
  }
  let p12: ForgePkcs12;
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
    (bag: { cert?: ForgeCertificate }) => bag.cert,
  )?.cert;
  if (!key || !certificate) throw new Error("PFX/P12 sem chave privada ou certificado A1.");

  const validFrom = certificate.validity.notBefore;
  const validUntil = certificate.validity.notAfter;
  const daysRemaining = Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000);
  if (daysRemaining < 0) throw new Error(`Certificado expirado em ${validUntil.toISOString().slice(0, 10)}.`);

  const commonName = readAttribute(certificate, "CN");
  const organization = readAttribute(certificate, "O");
  const subject = commonName || organization || "Titular não identificado";

  return {
    certificatePem: forge.pki.certificateToPem(certificate),
    privateKeyPem: forge.pki.privateKeyToPem(key),
    validFrom: validFrom.toISOString(),
    validUntil: validUntil.toISOString(),
    daysRemaining,
    subject,
    cnpj: extractCnpj(certificate, subject),
  };
};

export const assertCertificateMatchesCnpj = (certificate: FiscalCertificate, configuredCnpj: string) => {
  const expected = normalizeCnpj(configuredCnpj);
  if (!expected) return;
  if (!isValidCnpj(expected)) throw new Error("O CNPJ configurado para o emitente e invalido.");
  if (!certificate.cnpj) {
    throw new Error("Nao foi possivel identificar o CNPJ titular do certificado.");
  }
  if (expected !== certificate.cnpj) {
    throw new Error("O CNPJ do certificado nao corresponde ao emitente configurado.");
  }
};

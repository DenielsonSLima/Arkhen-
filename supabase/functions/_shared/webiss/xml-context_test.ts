import { XMLSerializer } from "npm:@xmldom/xmldom@0.8.15";
import { SignedXml } from "npm:xml-crypto@6.1.2";
import { generateKeyPairSync } from "node:crypto";
import { descendants, parseXml } from "./xml.ts";
import { serializeWithNamespaceContext } from "./xml-context.ts";
const assert = (value: unknown) => {
  if (!value) throw new Error("Assertion failed");
};

Deno.test("detached XML preserves namespace scope shadowing without mutating source", () => {
  const doc = parseXml(
    '<Outer xmlns="urn:outer" xmlns:a="urn:old" xmlns:b="urn:inherited"><List xmlns:a="urn:nearest"><CompNfse xmlns="" xmlns:c="urn:own"><Nfse><Numero>1</Numero></Nfse></CompNfse></List></Outer>',
  );
  const before = new XMLSerializer().serializeToString(doc);
  const comp = descendants(doc.documentElement, "CompNfse")[0];
  const output = serializeWithNamespaceContext(comp);
  const root = parseXml(output).documentElement;
  assert(
    root.getAttribute("xmlns") === "" &&
      root.getAttribute("xmlns:a") === "urn:nearest",
  );
  assert(
    root.getAttribute("xmlns:b") === "urn:inherited" &&
      root.getAttribute("xmlns:c") === "urn:own",
  );
  assert(!output.includes("urn:old") && !output.includes("urn:outer"));
  assert(new XMLSerializer().serializeToString(doc) === before);
  assert(!comp.hasAttribute("xmlns:b"));
});

Deno.test("inclusive C14N signature survives detachment only with original namespace context", () => {
  // Ephemeral synthetic key and invoice: no tenant A1 or private customer XML is used.
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 1024,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  const c14n = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  const xml =
    '<Response xmlns="urn:nfse" xmlns:xsi="urn:synthetic:xsi" xmlns:xsd="urn:synthetic:xsd" xmlns:p="urn:old"><List xmlns:p="urn:nearest"><CompNfse><Nfse><InfNfse Id="test-note"><Numero>1</Numero></InfNfse></Nfse></CompNfse></List></Response>';
  const signer = new SignedXml({ privateKey, getKeyInfoContent: () => "" });
  signer.canonicalizationAlgorithm = c14n;
  signer.signatureAlgorithm =
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  signer.addReference({
    xpath: "//*[local-name(.)='InfNfse']",
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [c14n],
  });
  signer.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='CompNfse']", action: "append" },
  });
  const signed = signer.getSignedXml();
  const verify = (source: string) => {
    const doc = parseXml(source);
    const signature = descendants(doc.documentElement, "Signature")[0];
    const verifier = new SignedXml({
      publicCert: publicKey,
      getCertFromKeyInfo: () => null,
    });
    verifier.loadSignature(signature);
    return verifier.checkSignature(source) &&
      verifier.getSignedReferences().length === 1;
  };
  assert(verify(signed));
  const doc = parseXml(signed);
  const comp = descendants(doc.documentElement, "CompNfse")[0];
  assert(!verify(new XMLSerializer().serializeToString(comp)));
  const preserved = serializeWithNamespaceContext(comp);
  assert(verify(preserved));
  assert(
    descendants(parseXml(preserved).documentElement, "SignatureValue")[0]
      .textContent ===
      descendants(doc.documentElement, "SignatureValue")[0].textContent,
  );
});

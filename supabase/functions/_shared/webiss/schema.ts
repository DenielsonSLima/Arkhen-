import {
  ParseOption, XmlBufferInputProvider, XmlDocument, XsdValidator,
  xmlRegisterInputProvider,
} from "npm:libxml2-wasm@0.7.1";
import bundle from "./schema-bundle.json" with { type: "json" };

const NAMESPACE = "http://www.abrasf.org.br/nfse.xsd";
const SCHEMA_NAME = "nfse_v2_02-IBSCBS.xsd";
const encoder = new TextEncoder();

// The provider resolves only the two versioned, bundled schemas. It claims all
// other resource requests and rejects them, so libxml2 cannot fall back to IO.
const schemas = new XmlBufferInputProvider(Object.fromEntries(
  Object.entries(bundle.files).map(([name, file]) => [name, encoder.encode(file.content)]),
));
xmlRegisterInputProvider({
  match: () => true,
  open: (name) => schemas.match(name) ? schemas.open(name) : undefined,
  read: (fd, buffer) => schemas.read(fd, buffer),
  close: (fd) => schemas.close(fd),
});

let validator: XsdValidator | undefined;
function getValidator() {
  if (validator) return validator;
  const schema = XmlDocument.fromString(bundle.files[SCHEMA_NAME].content, {
    option: ParseOption.XML_PARSE_NONET,
  });
  try {
    validator = XsdValidator.fromDoc(schema);
    return validator;
  } finally { schema.dispose(); }
}

/** Validate without serializing: the signed bytes sent to WebISS stay intact. */
export function assertWebIssRpsSchema(xml: string) {
  if (!xml || encoder.encode(xml).byteLength > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("XML WebISS invalido: tamanho excedido ou declaracao externa proibida.");
  }
  let document: XmlDocument | undefined;
  try {
    document = XmlDocument.fromString(xml, { option: ParseOption.XML_PARSE_NONET });
    if (document.root.name !== "GerarNfseEnvio" || document.root.namespaceUri !== NAMESPACE) {
      throw new Error("Operacao XML incorreta.");
    }
    getValidator().validate(document);
  } catch {
    // Schema exceptions can echo certificate contents and fiscal values. Do not
    // persist them in attempt logs; retain a bounded, non-sensitive error.
    throw new Error("XML fora do XSD WebISS ABRASF 2.02 IBS/CBS. Revise os campos fiscais antes do envio.");
  } finally { document?.dispose(); }
}

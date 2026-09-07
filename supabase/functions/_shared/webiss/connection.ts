import { descendants, parseXml, readLimitedXml } from "./xml.ts";
const ALLOWED_WSDL = new Set([
  "https://itabaianase.webiss.com.br/ws/nfse.asmx?WSDL",
  "https://homologacao.webiss.com.br/ws/nfse.asmx?WSDL",
]);

export const validateWebIssWsdl = async (url: string) => {
  if (!ALLOWED_WSDL.has(url)) throw new Error("Endpoint WebISS nao permitido.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      redirect: "error",
      headers: { Accept: "application/wsdl+xml, text/xml, application/xml" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WebISS respondeu HTTP ${response.status}.`);
    const text = await readLimitedXml(response, 2 * 1024 * 1024);
    const doc = parseXml(text);
    if (doc.documentElement.localName !== "definitions" || doc.documentElement.namespaceURI !== "http://schemas.xmlsoap.org/wsdl/") throw new Error("Resposta nao e um WSDL valido.");
    const operations = descendants(doc.documentElement, "operation").map((node) => node.getAttribute("name"));
    if (text.length > 2 * 1024 * 1024) throw new Error("WSDL WebISS acima do limite permitido.");
    const requiredOperations = ["GerarNfse", "CancelarNfse", "ConsultarNfsePorRps"];
    const missing = requiredOperations.filter((operation) => !operations.includes(operation));
    if (missing.length) throw new Error(`WSDL WebISS sem operacoes esperadas: ${missing.join(", ")}.`);
    return { operations: requiredOperations, bytes: new TextEncoder().encode(text).byteLength };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("WebISS nao respondeu dentro de 15 segundos.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

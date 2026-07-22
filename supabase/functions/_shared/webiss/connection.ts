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
      headers: { Accept: "application/wsdl+xml, text/xml, application/xml" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WebISS respondeu HTTP ${response.status}.`);
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) throw new Error("WSDL WebISS acima do limite permitido.");
    const requiredOperations = ["GerarNfse", "CancelarNfse", "ConsultarNfsePorRps"];
    const missing = requiredOperations.filter((operation) => !text.includes(operation));
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

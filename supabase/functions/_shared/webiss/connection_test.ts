import { validateWebIssWsdl } from "./connection.ts";

Deno.test("Diagnostico WSDL verifica operacoes reais sem certificado e proibe redirects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    if (init?.redirect !== "error") throw new Error("Redirecionamento nao bloqueado");
    return Promise.resolve(new Response('<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"><portType><operation name="GerarNfse"/><operation name="CancelarNfse"/><operation name="ConsultarNfsePorRps"/></portType></definitions>'));
  }) as typeof fetch;
  try {
    const result = await validateWebIssWsdl("https://homologacao.webiss.com.br/ws/nfse.asmx?WSDL");
    if (result.operations.length !== 3) throw new Error("Operacoes nao identificadas");
  } finally { globalThis.fetch = originalFetch; }
});
Deno.test("Diagnostico WSDL recusa HTML contendo nomes das operacoes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response('<html><body>GerarNfse CancelarNfse ConsultarNfsePorRps</body></html>'))) as typeof fetch;
  let rejected = false;
  try { await validateWebIssWsdl("https://homologacao.webiss.com.br/ws/nfse.asmx?WSDL"); }
  catch { rejected = true; }
  finally { globalThis.fetch = originalFetch; }
  if (!rejected) throw new Error("HTML aceito como WSDL");
});

import { handleEmissionAction, type FiscalRpcClient } from "./emission-action.ts";
import type { FiscalCertificate } from "../_shared/webiss/certificate.ts";
import { WebIssError } from "../_shared/webiss/soap.ts";

const token = "12345678-1234-4123-8123-123456789012";
const certificate = { cnpj: "11222333000181" } as FiscalCertificate;
const result = { nfseId: "88", protocolo: "ABC", payload: { numero: "88", codigoVerificacao: "ABC", xml: "<Nfse/>" } };
function setup(options: { reconcile?: boolean; consultFails?: boolean; emitError?: Error; signFails?: boolean; confirmFails?: boolean; cnpj?: string; noToken?: boolean } = {}) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  let sends = 0;
  let queries = 0;
  const client: FiscalRpcClient = { rpc: async (name, args) => {
    calls.push({ name, args });
    if (name.startsWith("preparar_")) return { error: null, data: {
      tentativaId: options.noToken ? undefined : token, reconciliarPrimeiro: options.reconcile || false,
      ambiente: "homologacao", prestador: { cnpj: options.cnpj || "11222333000181" },
      certificadoBase64: "placeholder", certificadoSenha: " senha ",
    } };
    return { data: "88", error: options.confirmFails && name === "confirmar_emissao_nfse_webiss" ? { message: "db indisponivel" } : null };
  } };
  const deps = {
    parseCertificate: (_base64: string, password: string) => { if (password !== " senha ") throw new Error("Senha sofreu trim"); return certificate; },
    sign: () => { if (options.signFails) throw new Error("Assinatura invalida"); return "signed"; },
    emit: async () => { sends++; if (options.emitError) throw options.emitError; return result; },
    consult: async () => { queries++; if (options.consultFails) throw new WebIssError("E4: NFS-e nao encontrada", true); return result; },
  };
  return { calls, counts: () => ({ sends, queries }), run: (consult = false) => handleEmissionAction(client, "user", "charge", consult, deps) };
}
async function expectFailure(run: () => Promise<unknown>) { let failed = false; try { await run(); } catch { failed = true; } if (!failed) throw new Error("Esperava falha"); }
const finishStatus = (test: ReturnType<typeof setup>) => test.calls.find((call) => call.name === "finalizar_tentativa_nfse_webiss")?.args?.p_status;

Deno.test("Tentativa nova assina e envia uma vez, preserva token e homologacao", async () => {
  const test = setup();
  const response = await test.run();
  if (test.counts().sends !== 1 || test.counts().queries !== 0 || response.ambiente !== "homologacao") throw new Error("Fluxo incorreto");
  const payload = test.calls.find((call) => call.name === "confirmar_emissao_nfse_webiss")?.args?.p_payload as Record<string, unknown>;
  if (payload.tentativaId !== token) throw new Error("Token perdido");
  if (payload.cobrancaId !== "charge") throw new Error("Vinculo do XML com a cobranca perdido");
});
Deno.test("Tentativa incerta somente consulta; nao reenvia mesmo se municipio nao acha RPS", async () => {
  for (const consultFails of [false, true]) {
    const test = setup({ reconcile: true, consultFails });
    if (consultFails) await expectFailure(() => test.run()); else await test.run();
    if (test.counts().sends !== 0 || test.counts().queries !== 1) throw new Error("Reenvio duplicado");
    if (consultFails && finishStatus(test) !== "incerta") throw new Error("Incerteza perdida");
  }
});
Deno.test("Falha antes do envio, rejeicao municipal e timeout persistem estados diferentes", async () => {
  const scenarios = [
    { options: { signFails: true }, expected: "falha_pre_envio", sends: 0 },
    { options: { emitError: new WebIssError("rejeitado", true) }, expected: "rejeitada", sends: 1 },
    { options: { emitError: new Error("timeout") }, expected: "incerta", sends: 1 },
    { options: { confirmFails: true }, expected: "incerta", sends: 1 },
  ];
  for (const scenario of scenarios) {
    const test = setup(scenario.options);
    await expectFailure(() => test.run());
    if (finishStatus(test) !== scenario.expected || test.counts().sends !== scenario.sends) throw new Error(`Estado incorreto ${scenario.expected}`);
  }
});
Deno.test("Consulta explicita com erro nao altera lease de outra tentativa", async () => {
  const test = setup({ consultFails: true });
  await expectFailure(() => test.run(true));
  if (test.counts().sends !== 0 || finishStatus(test)) throw new Error("Consulta alterou tentativa");
});
Deno.test("Backend bloqueia certificado de outro CNPJ e RPC legado sem token", async () => {
  for (const options of [{ cnpj: "00000000E08G12" }, { noToken: true }]) {
    const test = setup(options);
    await expectFailure(() => test.run());
    if (test.counts().sends || test.counts().queries) throw new Error("Transmitiu dados sem contrato/certificado correto");
  }
});

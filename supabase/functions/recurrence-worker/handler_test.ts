import { handleRecurrenceWorker, type WorkerOptions } from "./handler.ts";
import type { FiscalRpcClient } from "../fiscal-integration/emission-action.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CONTRACT = "44444444-4444-4444-8444-444444444444";
const LEASE = "55555555-5555-4555-8555-555555555555";
const REQUEST = "66666666-6666-4666-8666-666666666666";
const CHARGE = "77777777-7777-4777-8777-777777777777";
const TOKEN = "a".repeat(64);
const assert = (condition: unknown, message = "Falha de assercao") => { if (!condition) throw new Error(message); };
const request = (body: unknown = { execucaoId: ID }, cron = false) => new Request("https://local/recurrence-worker", {
  method: "POST", headers: { "Content-Type": "application/json", ...(cron ? { "X-Arkhen-Recurrence-Key": TOKEN } : { Authorization: "Bearer test" }) },
  body: JSON.stringify(body),
});
const job = (etapa: string, extra: Record<string, unknown> = {}) => ({
  id: ID, empresaId: TENANT, userId: USER, contratoId: CONTRACT, leaseToken: LEASE, requestId: REQUEST,
  etapa, status: "processando", modoFiscal: "na_data", ambiente: "homologacao", rascunhoId: ID,
  chargePayload: { cliente_empresa_id: USER, contrato_id: CONTRACT, valor: 100, data_vencimento: "2026-09-10" },
  ...extra,
});

function setup(claims: Record<string, unknown>[] = []) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const chargePayloads: Record<string, unknown>[] = [];
  const fiscalCalls: unknown[][] = [];
  let consumed = false;
  let finalStatus = "pendente";
  const admin: FiscalRpcClient = { rpc(name, args = {}) {
    calls.push({ name, args });
    let data: unknown = true;
    if (name === "consumir_capacidade_recorrencia") { data = !consumed; consumed = true; }
    if (name === "reivindicar_execucao_recorrencia") data = claims.shift() || null;
    if (name === "preparar_rascunho_recorrencia") data = { rascunhoId: ID };
    if (name === "finalizar_etapa_recorrencia") {
      const result = args.p_resultado as Record<string, unknown>;
      data = { id: ID, etapa: result.etapa === "fiscal" ? "concluida" : "fiscal",
        status: result.etapa === "fiscal" ? "concluida" : finalStatus, cobrancaId: CHARGE, rascunhoId: ID,
        nfseId: result.nfseId || null, leaseToken: null };
    }
    return Promise.resolve({ data, error: null });
  } };
  const options: WorkerOptions = {
    authorize: async () => { assert(calls.length === 0, "Auth precisa ocorrer antes do service claim"); return { empresaId: TENANT }; },
    charge: async (_admin, actor, payload) => {
      assert(actor === USER); chargePayloads.push(payload);
      return { ok: true, provedor: "inter", cobranca: { id: CHARGE }, integracao: undefined };
    },
    fiscal: (async (...args: unknown[]) => {
      fiscalCalls.push(args);
      return { ok: true, success: true, nfseId: "2026001", ambiente: "homologacao", situacao: "confirmada", protocolo: "X", reconciliada: false, message: "ok" };
    }) as WorkerOptions["fiscal"],
  };
  return { admin, options, calls, chargePayloads, fiscalCalls, status: (value: string) => { finalStatus = value; } };
}

Deno.test("Worker verifica permissao antes de claim e rejeita contexto fornecido pelo cliente", async () => {
  const a = setup();
  a.options.authorize = async () => { throw new Error("no"); };
  assert((await handleRecurrenceWorker(request(), a.admin, a.options)).status === 403);
  assert(a.calls.length === 0);
  assert((await handleRecurrenceWorker(request({ execucaoId: ID, empresaId: TENANT }), a.admin, a.options)).status === 400);
  assert(a.calls.length === 0);
});

Deno.test("Worker cron consome capacidade unica antes de materializar e bloqueia replay", async () => {
  const a = setup();
  const first = await handleRecurrenceWorker(request({}, true), a.admin, a.options);
  assert(first.status === 200);
  assert(a.calls[0].name === "consumir_capacidade_recorrencia");
  assert(a.calls[1].name === "materializar_recorrencias_financeiras");
  const second = await handleRecurrenceWorker(request({}, true), a.admin, a.options);
  assert(second.status === 401);
  assert(a.calls.filter(call => call.name === "materializar_recorrencias_financeiras").length === 1);
});

Deno.test("Worker processa um ciclo com snapshot e requestId fixos, reclamando novo lease por etapa", async () => {
  const a = setup([job("cobranca"), job("rascunho"), job("fiscal")]);
  const response = await handleRecurrenceWorker(request(), a.admin, a.options);
  const result = await response.json();
  assert(result.ok && result.processed === 3 && result.execucao.status === "concluida");
  assert(a.chargePayloads.length === 1 && a.chargePayloads[0].request_id === REQUEST);
  assert(a.chargePayloads[0].data_vencimento === "2026-09-10");
  assert(a.calls.filter(c => c.name === "reivindicar_execucao_recorrencia").length === 3);
  assert(a.calls.filter(c => c.name === "reivindicar_execucao_recorrencia").every(c => c.args.p_execucao_id === ID));
  assert(a.fiscalCalls.length === 1 && a.fiscalCalls[0][1] === USER && a.fiscalCalls[0][2] === ID);
  assert(a.fiscalCalls[0][4] === false, "Producao nao deve ser habilitada implicitamente");
  assert(!JSON.stringify(result).includes("leaseToken") && !JSON.stringify(result).includes("chargePayload"));
});

Deno.test("Worker preserva etapa bancaria incerta e nao cria rascunho nem nota apos falha", async () => {
  const a = setup([job("cobranca")]);
  a.options.charge = async () => { throw new Error("provider credentials should never be echoed"); };
  const result = await (await handleRecurrenceWorker(request(), a.admin, a.options)).json();
  assert(!result.ok && result.processed === 0);
  assert(a.calls.some(c => c.name === "falhar_execucao_recorrencia" && c.args.p_lease_token === LEASE));
  assert(!a.calls.some(c => c.name === "preparar_rascunho_recorrencia" || c.name === "finalizar_etapa_recorrencia"));
  assert(!JSON.stringify(result).includes("credentials"));
});

Deno.test("Worker retoma etapa fiscal sem gerar novamente a cobranca", async () => {
  const a = setup([job("fiscal")]);
  await handleRecurrenceWorker(request(), a.admin, a.options);
  assert(a.chargePayloads.length === 0 && a.fiscalCalls.length === 1);
  assert(!a.calls.some(c => c.name === "preparar_rascunho_recorrencia"));
});

Deno.test("Worker sinaliza claim manual indisponivel sem afirmar que uma cobranca foi gerada", async () => {
  const a = setup();
  const result = await (await handleRecurrenceWorker(request(), a.admin, a.options)).json();
  assert(result.ok && result.pending && result.processed === 0 && !result.execucao);
  assert(a.chargePayloads.length === 0 && a.fiscalCalls.length === 0);
});

Deno.test("Worker respeita revisao manual e espera pagamento definidas pelo banco", async () => {
  for (const [mode, status] of [["rascunho", "aguardando_revisao"], ["no_pagamento", "aguardando_pagamento"]]) {
    const a = setup([job("rascunho", { modoFiscal: mode })]);
    a.status(status);
    const result = await (await handleRecurrenceWorker(request(), a.admin, a.options)).json();
    assert(result.ok && result.execucao.status === status && a.fiscalCalls.length === 0);
  }
});

Deno.test("Worker nao opera nem finaliza job fora do tenant autorizado", async () => {
  const a = setup([job("cobranca", { empresaId: CONTRACT })]);
  const result = await (await handleRecurrenceWorker(request(), a.admin, a.options)).json();
  assert(!result.ok && a.chargePayloads.length === 0 && a.calls.length === 1);
});

Deno.test("Worker rejeita retorno fiscal cancelado como conclusao de nova emissao", async () => {
  const a = setup([job("fiscal")]);
  a.options.fiscal = async () => ({ ok: true, success: true, nfseId: "2026001", situacao: "cancelada", ambiente: "homologacao", protocolo: "X", reconciliada: true, message: "cancelada" });
  const result = await (await handleRecurrenceWorker(request(), a.admin, a.options)).json();
  assert(!result.ok && a.calls.some(c => c.name === "falhar_execucao_recorrencia"));
  assert(!a.calls.some(c => c.name === "finalizar_etapa_recorrencia"));
});

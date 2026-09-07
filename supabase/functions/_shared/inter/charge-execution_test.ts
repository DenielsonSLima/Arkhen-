import { executeInterCharge } from "./charge-execution.ts";
import type { InterChargeExecution } from "./create-charge.ts";
import type { RpcClient } from "./types.ts";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const fixture = (action: string, options: { registration?: boolean; fail?: string; preflight?: boolean } = {}) => {
  const calls: string[] = [];
  const registration = { external_id: "charge-1", ambiente: "homologacao", tipo: "pix" };
  const rpc: RpcClient = {
    rpc(name, params) {
      calls.push(name);
      if (name === options.fail) return Promise.resolve({ data: null, error: { message: "Falha simulada" } });
      if (name === "preparar_tentativa_cobranca_inter") return Promise.resolve({
        data: { tentativaId: "attempt-1", leaseToken: "lease-1", requestId: "original-request", acao: action,
          prepared: {}, registration: options.registration ? registration : null,
          cobranca: action === "concluida" ? { id: "saved-1" } : null }, error: null,
      });
      if (name === "iniciar_envio_tentativa_cobranca_inter" || name === "registrar_resultado_tentativa_cobranca_inter") {
        assert(params.p_lease_token === "lease-1", "Lease não propagado");
      }
      return Promise.resolve({ data: name === "confirmar_tentativa_cobranca_inter" ? { id: "saved-1" } : true, error: null });
    },
  };
  const execution: InterChargeExecution = { ambiente: "homologacao", tipo: "pix", externalId: "charge-1", providerPayload: {} };
  const deps = {
    async create(_prepared: unknown, payload: Record<string, unknown>, beforeSend?: () => Promise<void>) {
      calls.push("prepare-provider");
      assert(payload.request_id === "original-request", "A referência original deve ser reutilizada");
      if (options.preflight) throw new Error("Credencial inválida");
      await beforeSend?.();
      calls.push("send-provider");
      return execution;
    },
    async recover(_prepared: unknown, payload: Record<string, unknown>) {
      assert(payload.request_id === "original-request", "Recovery alterou a referência");
      calls.push("recover-provider");
      return execution;
    },
    registration: () => registration,
  };
  return { calls, run: () => executeInterCharge(rpc, "user-1", { request_id: "new-request" }, deps) };
};

Deno.test("emissão registra dispatch antes da rede e resultado antes da confirmação", async () => {
  const f = fixture("emitir");
  await f.run();
  assert(f.calls.indexOf("iniciar_envio_tentativa_cobranca_inter") < f.calls.indexOf("send-provider"), "Envio antes de adquirir ownership");
  assert(f.calls.indexOf("registrar_resultado_tentativa_cobranca_inter") < f.calls.indexOf("confirmar_tentativa_cobranca_inter"), "Confirmação antes de resultado durável");
});

Deno.test("tentativa incerta somente consulta o banco e nunca reemite", async () => {
  const f = fixture("reconciliar");
  await f.run();
  assert(f.calls.includes("recover-provider") && !f.calls.includes("send-provider"), "Recovery não pode emitir");
});

Deno.test("resultado persistido sobrevive falha local sem nova chamada ao Inter", async () => {
  const f = fixture("reconciliar", { registration: true });
  await f.run();
  assert(f.calls.join(",") === "preparar_tentativa_cobranca_inter,confirmar_tentativa_cobranca_inter", "Deve confirmar exclusivamente o resultado persistido");
});

Deno.test("tentativa concluída retorna a mesma cobrança sem writes", async () => {
  const f = fixture("concluida", { registration: true });
  const result = await f.run();
  assert(result.ok && f.calls.length === 1, "Cobrança concluída deve ser reutilizada");
});

Deno.test("lease ocupado não dispara emissão concorrente", async () => {
  const f = fixture("ocupada");
  await f.run().then(() => { throw new Error("Deveria falhar"); }, () => {});
  assert(f.calls.length === 1, "Outra execução deve aguardar");
});

Deno.test("preflight falho libera apenas a reserva não enviada", async () => {
  const f = fixture("emitir", { preflight: true });
  await f.run().then(() => { throw new Error("Deveria falhar"); }, () => {});
  assert(!f.calls.includes("iniciar_envio_tentativa_cobranca_inter") && f.calls.includes("liberar_preparo_tentativa_cobranca_inter"), "Preflight nunca entra em dispatch");
});

Deno.test("lease rejeitado impede requisição bancária", async () => {
  const f = fixture("emitir", { fail: "iniciar_envio_tentativa_cobranca_inter" });
  await f.run().then(() => { throw new Error("Deveria falhar"); }, () => {});
  assert(!f.calls.includes("send-provider"), "Worker sem lease não pode enviar");
});

Deno.test("falha ao persistir resultado não provoca segunda emissão", async () => {
  const f = fixture("emitir", { fail: "registrar_resultado_tentativa_cobranca_inter" });
  await f.run().then(() => { throw new Error("Deveria falhar"); }, () => {});
  assert(f.calls.filter((c) => c === "send-provider").length === 1, "Não repetir emissão em falha de persistência");
  assert(!f.calls.includes("confirmar_tentativa_cobranca_inter"), "Sem resultado persistido não confirma");
});

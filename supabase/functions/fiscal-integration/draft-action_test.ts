import { draftRpcClient, handleDraftAction } from "./draft-action.ts";
import type { FiscalRpcClient } from "./emission-action.ts";

Deno.test("Rascunho adapta RPC sem criar cobranca e preserva identificador da tentativa", async () => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client: FiscalRpcClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: "88", error: null };
    },
  };
  await draftRpcClient(client).rpc("confirmar_emissao_nfse_webiss", {
    p_user_id: "user",
    p_cobranca_id: "draft",
    p_payload: { tentativaId: "token", cobrancaId: "draft", xml: "<Nfse/>" },
  });
  const call = calls[0];
  const payload = call.args?.p_payload as Record<string, unknown>;
  if (
    call.name !== "confirmar_emissao_rascunho_webiss" ||
    call.args?.p_rascunho_id !== "draft" ||
    "p_cobranca_id" in call.args || "cobrancaId" in payload ||
    payload.rascunhoId !== "draft" || payload.tentativaId !== "token"
  ) throw new Error("Mapeamento inseguro");
});
Deno.test("Emissao draft de producao bloqueada antes de reservar RPS", async () => {
  const calls: string[] = [];
  const client: FiscalRpcClient = {
    rpc: async (name) => {
      calls.push(name);
      return {
        data: { ambiente: "producao", rascunhoId: "draft" },
        error: null,
      };
    },
  };
  let blocked = false;
  try {
    await handleDraftAction(client, "user", "draft", false);
  } catch (error) {
    blocked = String(error).includes("nao liberada");
  }
  if (!blocked || calls.join() !== "obter_contexto_rascunho_webiss_edge") {
    throw new Error("Bloqueio de producao falhou");
  }
});
Deno.test("Consulta draft confirmada exige snapshot para revalidar e nao retorna cache", async () => {
  const calls: string[] = [];
  const client: FiscalRpcClient = {
    rpc: async (name) => {
      calls.push(name);
      return {
        data: { jaEmitida: true, nfseId: "88", ambiente: "producao" },
        error: null,
      };
    },
  };
  let failed = false;
  try { await handleDraftAction(client, "user", "draft", true); }
  catch (error) { failed = String(error).includes("Contrato de emissao segura ausente"); }
  if (!failed || calls.join() !== "preparar_consulta_rascunho_webiss") throw new Error("Consulta retornou cache como evidencia municipal");
});
Deno.test("Adaptador draft permite somente reserva global whitelist sem alterar contexto RPC", async () => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const client: FiscalRpcClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { aguardarMs: 0 }, error: null };
    },
  };
  const adapter = draftRpcClient(client);
  await adapter.rpc("reservar_intervalo_consulta_webiss", {
    p_ambiente: "producao",
    p_cobranca_id: "forged",
    p_payload: { xml: "PRIVATE" },
    action: "emit",
  });
  if (
    JSON.stringify(calls) !==
      JSON.stringify([{
        name: "reservar_intervalo_consulta_webiss",
        args: { p_ambiente: "producao" },
      }])
  ) throw new Error("Passthrough indevido");
  let failed = false;
  try {
    await adapter.rpc("qualquer_rpc_administrativa", {});
  } catch {
    failed = true;
  }
  if (!failed || calls.length !== 1) {
    throw new Error("RPC arbitraria permitida");
  }
});

Deno.test("Adaptador preserva XML final e tentativa ao arquivar envio do rascunho", async () => {
  let recorded: unknown;
  const adapter = draftRpcClient({ rpc: async (name, args) => { recorded = { name, args }; return { data: null, error: null }; } });
  await adapter.rpc("registrar_envio_nfse_webiss", { p_user_id: "user", p_cobranca_id: "draft", p_tentativa_id: "token", p_xml: "signed" });
  if (JSON.stringify(recorded) !== JSON.stringify({ name: "registrar_envio_rascunho_webiss", args: { p_user_id: "user", p_tentativa_id: "token", p_xml: "signed", p_rascunho_id: "draft" } })) throw new Error("Arquivo sem contexto");
});

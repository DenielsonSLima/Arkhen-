import { draftRpcClient, handleDraftAction } from "./draft-action.ts";
import type { FiscalRpcClient } from "./emission-action.ts";

Deno.test("Rascunho adapta RPC sem criar cobranca e preserva identificador da tentativa", async () => {
  const calls: Array<{name:string; args?:Record<string,unknown>}> = [];
  const client: FiscalRpcClient = { rpc: async(name,args) => { calls.push({name,args}); return {data:"88",error:null}; } };
  await draftRpcClient(client).rpc("confirmar_emissao_nfse_webiss", {
    p_user_id:"user",p_cobranca_id:"draft",p_payload:{tentativaId:"token",cobrancaId:"draft",xml:"<Nfse/>"},
  });
  const call=calls[0]; const payload=call.args?.p_payload as Record<string,unknown>;
  if(call.name!=="confirmar_emissao_rascunho_webiss" || call.args?.p_rascunho_id!=="draft"
    || "p_cobranca_id" in call.args || "cobrancaId" in payload || payload.rascunhoId!=="draft" || payload.tentativaId!=="token") throw new Error("Mapeamento inseguro");
});
Deno.test("Emissao draft de producao bloqueada antes de reservar RPS", async () => {
  const calls:string[]=[];
  const client: FiscalRpcClient = { rpc:async(name) => { calls.push(name); return {data:{ambiente:"producao",rascunhoId:"draft"},error:null}; } };
  let blocked=false;
  try {await handleDraftAction(client,"user","draft",false);} catch(error) {blocked=String(error).includes("nao liberada");}
  if(!blocked || calls.join()!=="obter_contexto_rascunho_webiss_edge") throw new Error("Bloqueio de producao falhou");
});
Deno.test("Consulta draft de producao confirmada permanece disponivel", async () => {
  const calls:string[]=[];
  const client: FiscalRpcClient = { rpc:async(name) => {calls.push(name);return {data:{jaEmitida:true,nfseId:"88",ambiente:"producao"},error:null};} };
  const result=await handleDraftAction(client,"user","draft",true);
  if(result.nfseId!=="88" || calls.join()!=="preparar_consulta_rascunho_webiss") throw new Error("Consulta indevidamente bloqueada");
});

import {
  type FiscalRpcClient,
  handleEmissionAction,
} from "./emission-action.ts";

// Reuse the established send/consult/finalize state machine with a fiscal draft ID.
// The adapter never creates financial charges or calls a banking service.
const draftRpcs: Record<string, string> = {
  registrar_envio_nfse_webiss: "registrar_envio_rascunho_webiss",
  preparar_emissao_nfse_webiss: "preparar_emissao_rascunho_webiss",
  preparar_consulta_nfse_webiss: "preparar_consulta_rascunho_webiss",
  confirmar_emissao_nfse_webiss: "confirmar_emissao_rascunho_webiss",
  finalizar_tentativa_nfse_webiss: "finalizar_tentativa_rascunho_webiss",
};
export function draftRpcClient(admin: FiscalRpcClient): FiscalRpcClient {
  return {
    rpc(name, args = {}) {
      // The only passthrough RPC: no draft/charge identifiers or arbitrary arguments.
      if (name === "reservar_intervalo_consulta_webiss") {
        return admin.rpc(name, { p_ambiente: args.p_ambiente });
      }
      const mappedName = draftRpcs[name];
      if (!mappedName) {
        throw new Error(
          "Operacao fiscal de rascunho nao permitida.",
        );
      }
      const { p_cobranca_id: draftId, ...rest } = args;
      if (rest.p_payload && typeof rest.p_payload === "object") {
        const { cobrancaId: _chargeId, ...payload } = rest.p_payload as Record<
          string,
          unknown
        >;
        rest.p_payload = { ...payload, rascunhoId: draftId };
      }
      return admin.rpc(mappedName, { ...rest, p_rascunho_id: draftId });
    },
  };
}
export async function handleDraftAction(
  admin: FiscalRpcClient,
  userId: string,
  draftId: string,
  consultOnly: boolean,
  productionEnabled = false,
) {
  if (!consultOnly) {
    const { data, error } = await admin.rpc(
      "obter_contexto_rascunho_webiss_edge",
      { p_user_id: userId, p_rascunho_id: draftId },
    );
    const context = data as { ambiente?: string; rascunhoId?: string } | null;
    if (
      error || !context || context.rascunhoId !== draftId ||
      !["homologacao", "producao"].includes(context.ambiente || "")
    ) {
      throw new Error(
        "Contexto fiscal indisponivel; nenhum RPS foi reservado.",
      );
    }
    if (context.ambiente === "producao" && !productionEnabled) {
      throw new Error(
        "Emissao de producao ainda nao liberada. Consultas permanecem disponiveis.",
      );
    }
  }
  return handleEmissionAction(
    draftRpcClient(admin),
    userId,
    draftId,
    consultOnly,
    undefined,
    (prepared) => {
      if (
        !consultOnly && prepared.ambiente === "producao" && !productionEnabled
      ) {
        throw new Error(
          "Emissao de producao ainda nao liberada. Nenhum envio foi realizado.",
        );
      }
    },
  );
}

import { buildInterRegistrationPayload, createInterCharge, type InterChargeExecution } from "./create-charge.ts";
import { recoverInterCharge } from "./recover-charge.ts";
import { asRecord, asString } from "./validation.ts";
import type { RpcClient } from "./types.ts";

interface ChargeDependencies {
  create: typeof createInterCharge;
  recover: typeof recoverInterCharge;
  registration: (prepared: unknown, execution: InterChargeExecution) => Record<string, unknown>;
}

const defaults: ChargeDependencies = {
  create: createInterCharge,
  recover: recoverInterCharge,
  registration: buildInterRegistrationPayload,
};

const responseFor = (saved: unknown, registration: Record<string, unknown>) => ({
  ok: true,
  provedor: "inter",
  cobranca: saved,
  integracao: Object.keys(registration).length ? {
    provedor: "inter",
    ambiente: registration.ambiente,
    external_id: registration.external_id,
    tipo: registration.tipo,
    boleto_url: registration.invoice_url || null,
    pix_copia_cola: registration.pix_copia_cola || null,
    pix_qr_code: null,
    payload: registration.provider_payload,
  } : undefined,
});

export const executeInterCharge = async (
  supabase: RpcClient,
  userId: string,
  payload: Record<string, unknown>,
  dependencies: ChargeDependencies = defaults,
) => {
  const rpc = async (name: string, params: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name, { p_user_id: userId, ...params });
    if (error) throw new Error(error.message);
    if (data === null || data === false) throw new Error("Operação bancária não confirmada pelo sistema.");
    return data;
  };
  const attempt = asRecord(await rpc("preparar_tentativa_cobranca_inter", { p_payload: payload }));
  const attemptId = asString(attempt.tentativaId);
  const requestId = asString(attempt.requestId);
  const action = asString(attempt.acao);
  if (action === "concluida" && attempt.cobranca) {
    return responseFor(attempt.cobranca, asRecord(attempt.registration));
  }
  if (action === "ocupada") throw new Error("A cobrança está sendo processada. Aguarde um momento e consulte novamente.");
  if (!attemptId || !requestId || !["emitir", "reconciliar"].includes(action)) {
    throw new Error("Tentativa de cobrança inválida.");
  }
  const lease = { p_tentativa_id: attemptId, p_lease_token: asString(attempt.leaseToken) };
  let registration = asRecord(attempt.registration);
  try {
    if (!Object.keys(registration).length) {
      const source = { ...payload, request_id: requestId };
      let execution: InterChargeExecution;
      if (action === "reconciliar") {
        execution = await dependencies.recover(attempt.prepared, source);
      } else {
        execution = await dependencies.create(attempt.prepared, source, async () => {
          await rpc("iniciar_envio_tentativa_cobranca_inter", lease);
        });
      }
      registration = dependencies.registration(attempt.prepared, execution);
      await rpc("registrar_resultado_tentativa_cobranca_inter", { ...lease, p_payload: registration });
    }
    const saved = await rpc("confirmar_tentativa_cobranca_inter", { p_tentativa_id: attemptId });
    return responseFor(saved, registration);
  } catch (error) {
    // The DB only releases a preparation that has never entered dispatch.
    await Promise.resolve(supabase.rpc("liberar_preparo_tentativa_cobranca_inter", { p_user_id: userId, ...lease })).catch(() => {});
    throw error;
  }
};

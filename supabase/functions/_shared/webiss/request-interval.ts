import { ConsultationError } from "./consultation-error.ts";
import { asRecord } from "./xml.ts";

type IntervalClient = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};
export type IntervalWait = (ms: number) => Promise<void>;
const sleep: IntervalWait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** One global environment slot for every SOAP operation, regardless of fiscal action. */
export async function awaitWebissInterval(
  admin: IntervalClient,
  ambiente: string,
  wait: IntervalWait = sleep,
) {
  try {
    if (!["homologacao", "producao"].includes(ambiente)) {
      throw new ConsultationError("TRANSPORT_GATE");
    }
    const reserved = await admin.rpc("reservar_intervalo_consulta_webiss", {
      p_ambiente: ambiente,
    });
    const delay = asRecord(reserved.data).aguardarMs;
    if (
      reserved.error || !Number.isInteger(delay) || Number(delay) < 0 ||
      Number(delay) > 60000
    ) throw new ConsultationError("TRANSPORT_GATE");
    await wait(Number(delay));
  } catch {
    throw new ConsultationError("TRANSPORT_GATE");
  }
}

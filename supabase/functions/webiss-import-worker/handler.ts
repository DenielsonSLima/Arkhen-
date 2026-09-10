import { handleConsultationAction } from "../fiscal-integration/consultation-action.ts";
import type { FiscalRpcClient } from "../fiscal-integration/emission-action.ts";
import { validateConsultationPeriod } from "../_shared/webiss/consultation.ts";
import { privateConsultationDiagnostic } from "../_shared/webiss/consultation-provider-error.ts";
import {
  ConsultationError,
  safeConsultationDiagnostic,
} from "../_shared/webiss/consultation-error.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const FAILED =
  "Nao foi possivel concluir a importacao WebISS. Nenhuma emissao foi solicitada.";
const CLAIM_UNAVAILABLE =
  "O servico de autorizacao da importacao esta temporariamente indisponivel. Verifique o job antes de iniciar outra consulta.";
const PARTIAL =
  "Consulta parcial; as notas importadas podem nao ser as ultimas do periodo. Reduza o intervalo antes de consultar novamente.";
const response = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

type Consult = (
  admin: FiscalRpcClient,
  userId: string,
  payload: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

async function readBody(req: Request) {
  if (
    !req.body ||
    !/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")
  ) throw new Error("invalid");
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let body = "", length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) {
        await reader.cancel();
        throw new Error("invalid");
      }
      body += decoder.decode(value, { stream: true });
    }
    return record(JSON.parse(body + decoder.decode()));
  } finally {
    reader.releaseLock();
  }
}

function trustedContext(value: unknown) {
  const data = record(value);
  const {
    userId,
    fiscalConfigId,
    clienteId,
    ambiente,
    dataInicial,
    dataFinal,
  } = data;
  if (
    ![userId, fiscalConfigId, clienteId].every((id) =>
      typeof id === "string" && UUID.test(id)
    ) ||
    !["producao", "homologacao"].includes(String(ambiente)) ||
    typeof dataInicial !== "string" || typeof dataFinal !== "string"
  ) throw new ConsultationError("PREPARE_CONTEXT");
  try {
    validateConsultationPeriod({ inicio: dataInicial, fim: dataFinal });
  } catch {
    throw new ConsultationError("PREPARE_CONTEXT");
  }
  return {
    userId: userId as string,
    fiscalConfigId: fiscalConfigId as string,
    clienteId: clienteId as string,
    ambiente: ambiente as string,
    dataInicial,
    dataFinal,
  };
}

function safeResult(
  value: unknown,
  context: ReturnType<typeof trustedContext>,
) {
  const data = record(value);
  if (
    data.ok !== true || data.success !== true ||
    !Number.isInteger(data.notesCount) || Number(data.notesCount) < 0 ||
    Number(data.notesCount) > 5 ||
    !Number.isInteger(data.pagesRead) || Number(data.pagesRead) < 1 ||
    Number(data.pagesRead) > 5 ||
    !["complete", "partial"].includes(String(data.coverage))
  ) throw new ConsultationError("VALIDATE_RESPONSE");
  return {
    notesCount: data.notesCount as number,
    pagesRead: data.pagesRead as number,
    coverage: data.coverage as "complete" | "partial",
    periodo: { inicio: context.dataInicial, fim: context.dataFinal },
    ...(data.coverage === "partial" ? { warning: PARTIAL } : {}),
  };
}

/** Capability authenticated read-only importer. No client-supplied fiscal context or dispatch action is accepted. */
export async function handleImportWorker(
  req: Request,
  admin: FiscalRpcClient,
  consult: Consult = handleConsultationAction,
): Promise<Response> {
  if (req.method !== "POST") {
    return response(405, { ok: false, error: "Metodo nao permitido." });
  }
  const token = req.headers.get("x-webiss-job-token") || "";
  if (!TOKEN.test(token)) {
    return response(403, { ok: false, error: "Importacao nao autorizada." });
  }
  let jobId: string;
  try {
    const body = await readBody(req);
    if (
      Object.keys(body).length !== 1 || typeof body.jobId !== "string" ||
      !UUID.test(body.jobId)
    ) throw new Error("invalid");
    jobId = body.jobId;
  } catch {
    return response(400, {
      ok: false,
      error: "Informe somente jobId valido no corpo JSON.",
    });
  }

  let claimed: unknown;
  try {
    const { data, error } = await admin.rpc("claim_webiss_import_job", {
      p_job_id: jobId,
      p_token: token,
    });
    if (error) return response(503, { ok: false, error: CLAIM_UNAVAILABLE });
    if (!data) {
      return response(403, {
        ok: false,
        error: "Importacao nao autorizada ou ja iniciada.",
      });
    }
    claimed = data;
  } catch {
    return response(503, {
      ok: false,
      error: CLAIM_UNAVAILABLE,
    });
  }

  let result: ReturnType<typeof safeResult>;
  try {
    const context = trustedContext(claimed);
    const { userId, ...payload } = context;
    result = safeResult(await consult(admin, userId, payload), context);
  } catch (error) {
    // Never persist/return a raw exception: certificate, RPC and transport errors may contain sensitive data.
    const diagnostic = safeConsultationDiagnostic(error);
    const message = diagnostic?.message || FAILED;
    try {
      await admin.rpc("finish_webiss_import_job", {
        p_job_id: jobId,
        p_result: null,
        p_error: privateConsultationDiagnostic(error) || message,
      });
    } catch { /* Job remains diagnosable without exposing the cause. */ }
    return response(500, {
      ok: false,
      error: message,
      ...(diagnostic ? { stage: diagnostic.stage, code: diagnostic.code } : {}),
    });
  }
  try {
    const { error } = await admin.rpc("finish_webiss_import_job", {
      p_job_id: jobId,
      p_result: result,
      p_error: null,
    });
    if (error) throw new Error("finish");
  } catch {
    return response(500, {
      ok: false,
      error:
        "Consulta concluida, mas o registro do trabalho falhou. Verifique o historico antes de iniciar outra importacao.",
    });
  }
  return response(200, { ok: true, success: true, ...result });
}

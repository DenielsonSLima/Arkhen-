import {
  assertCertificateMatchesCnpj,
  parseFiscalPkcs12,
} from "../_shared/webiss/certificate.ts";
import {
  collectLatestConsultedNotes,
  validateConsultationPeriod,
} from "../_shared/webiss/consultation.ts";
import type { ConsultationContext } from "../_shared/webiss/consultation-data.ts";
import { asRecord, text } from "../_shared/webiss/xml.ts";
import type { FiscalRpcClient } from "./emission-action.ts";
import {
  awaitWebissInterval,
  type IntervalWait,
} from "../_shared/webiss/request-interval.ts";
import {
  certificateError,
  ConsultationError,
  preparationError,
} from "../_shared/webiss/consultation-error.ts";

const dependencies = {
  collect: collectLatestConsultedNotes,
  parseCertificate: parseFiscalPkcs12,
  assertCertificate: assertCertificateMatchesCnpj,
};
export async function handleConsultationAction(
  admin: FiscalRpcClient,
  userId: string,
  payload: Record<string, unknown>,
  deps: typeof dependencies & { wait?: IntervalWait } = dependencies,
) {
  const fiscalConfigId = text(payload.fiscalConfigId),
    clienteId = text(payload.clienteId),
    ambiente = text(payload.ambiente);
  if (
    ![fiscalConfigId, clienteId].every((value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value)
    ) ||
    !["homologacao", "producao"].includes(ambiente)
  ) throw new ConsultationError("PREPARE_CONTEXT");
  const period = {
    inicio: text(payload.dataInicial),
    fim: text(payload.dataFinal),
  };
  try {
    validateConsultationPeriod(period);
  } catch {
    throw new ConsultationError("VALIDATE_REQUEST");
  }
  let data: unknown;
  try {
    const result = await admin.rpc("preparar_consulta_parceiro_webiss", {
      p_user_id: userId,
      p_fiscal_config_id: fiscalConfigId,
      p_cliente_id: clienteId,
      p_ambiente: ambiente,
    });
    if (result.error || !result.data) throw preparationError(result.error);
    data = result.data;
  } catch (error) {
    throw error instanceof ConsultationError ? error : preparationError(error);
  }
  const prepared = asRecord(data);
  if (
    text(prepared.fiscalConfigId) !== fiscalConfigId ||
    text(prepared.clienteId) !== clienteId ||
    text(prepared.ambiente) !== ambiente
  ) {
    throw new ConsultationError("PREPARE_CONTEXT");
  }
  const provider = asRecord(prepared.prestador),
    customer = asRecord(prepared.tomador);
  const context: ConsultationContext = {
    ambiente,
    endpoint: text(prepared.endpoint),
    prestador: {
      cnpj: text(provider.cnpj),
      inscricaoMunicipal: text(provider.inscricaoMunicipal),
    },
    tomador: { documento: text(customer.documento) },
  };
  let certificate: ReturnType<typeof deps.parseCertificate>;
  try {
    certificate = deps.parseCertificate(
      text(prepared.certificadoBase64),
      typeof prepared.certificadoSenha === "string"
        ? prepared.certificadoSenha
        : "",
    );
    deps.assertCertificate(certificate, context.prestador.cnpj);
  } catch (error) {
    throw certificateError(error);
  }
  let result: Awaited<ReturnType<typeof deps.collect>>;
  try {
    const beforeRequest = () =>
      awaitWebissInterval(admin, context.ambiente, deps.wait);
    result = await deps.collect(
      context,
      period,
      certificate,
      undefined,
      beforeRequest,
    );
  } catch (error) {
    throw error instanceof ConsultationError
      ? error
      : new ConsultationError("TRANSPORT_FAILED");
  }
  try {
    const { error: saveError } = await admin.rpc(
      "registrar_notas_consultadas_webiss",
      {
        p_user_id: userId,
        p_fiscal_config_id: fiscalConfigId,
        p_cliente_id: clienteId,
        p_ambiente: ambiente,
        p_notas: result.notes,
      },
    );
    if (saveError) throw new ConsultationError("SAVE_FAILED");
  } catch {
    throw new ConsultationError("SAVE_FAILED");
  }
  return {
    ok: true,
    success: true,
    notesCount: result.notes.length,
    periodo: result.periodo,
    coverage: result.coverage,
    pagesRead: result.pagesRead,
    warning: result.warning,
  };
}

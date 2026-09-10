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

const dependencies = {
  collect: collectLatestConsultedNotes,
  parseCertificate: parseFiscalPkcs12,
  assertCertificate: assertCertificateMatchesCnpj,
};
export async function handleConsultationAction(
  admin: FiscalRpcClient,
  userId: string,
  payload: Record<string, unknown>,
  deps = dependencies,
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
  ) throw new Error("Contexto de consulta fiscal invalido.");
  const period = {
    inicio: text(payload.dataInicial),
    fim: text(payload.dataFinal),
  };
  validateConsultationPeriod(period);
  const { data, error } = await admin.rpc("preparar_consulta_parceiro_webiss", {
    p_user_id: userId,
    p_fiscal_config_id: fiscalConfigId,
    p_cliente_id: clienteId,
    p_ambiente: ambiente,
  });
  if (error || !data) {
    throw new Error(
      "Configuracao ou permissao de consulta WebISS indisponivel.",
    );
  }
  const prepared = asRecord(data);
  if (
    text(prepared.fiscalConfigId) !== fiscalConfigId ||
    text(prepared.clienteId) !== clienteId ||
    text(prepared.ambiente) !== ambiente
  ) {
    throw new Error(
      "Contexto preparado nao corresponde a consulta solicitada.",
    );
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
  const certificate = deps.parseCertificate(
    text(prepared.certificadoBase64),
    typeof prepared.certificadoSenha === "string"
      ? prepared.certificadoSenha
      : "",
  );
  deps.assertCertificate(certificate, context.prestador.cnpj);
  const result = await deps.collect(context, period, certificate);
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
  if (saveError) {
    throw new Error(
      "Consulta recebida, mas o historico local nao foi atualizado. Nenhuma emissao foi enviada.",
    );
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

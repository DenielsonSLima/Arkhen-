import {
  assertCertificateMatchesCnpj,
  parseFiscalPkcs12,
} from "../_shared/webiss/certificate.ts";
import {
  consultWebIssNfse,
  emitWebIssNfse,
  prepareSignedWebIssRps,
} from "../_shared/webiss/emission.ts";
import { WebIssError } from "../_shared/webiss/soap.ts";
import { asRecord, text } from "../_shared/webiss/xml.ts";
import {
  awaitWebissInterval,
  type IntervalWait,
} from "../_shared/webiss/request-interval.ts";

export interface FiscalRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
const dependencies = {
  consult: consultWebIssNfse,
  emit: emitWebIssNfse,
  sign: prepareSignedWebIssRps,
  parseCertificate: parseFiscalPkcs12,
};

export async function handleEmissionAction(
  admin: FiscalRpcClient,
  userId: string,
  chargeId: string,
  consultOnly: boolean,
  deps: typeof dependencies & { wait?: IntervalWait } = dependencies,
  validatePrepared?: (prepared: Record<string, unknown>) => void,
) {
  const { data, error } = await admin.rpc(
    consultOnly
      ? "preparar_consulta_nfse_webiss"
      : "preparar_emissao_nfse_webiss",
    {
      p_user_id: userId,
      p_cobranca_id: chargeId,
    },
  );
  if (error || !data) {
    throw new Error(error?.message || "Emissao fiscal indisponivel.");
  }
  const prepared = asRecord(data);
  const ambiente = text(prepared.ambiente);
  if (prepared.jaEmitida === true) {
    return {
      ok: true,
      success: true,
      nfseId: text(prepared.nfseId),
      jaEmitida: true,
      ambiente,
    };
  }
  if (
    !/^[0-9a-f-]{36}$/i.test(text(prepared.tentativaId)) ||
    typeof prepared.reconciliarPrimeiro !== "boolean"
  ) {
    throw new Error(
      "Contrato de emissao segura ausente. Aplique a migration WebISS antes de transmitir notas.",
    );
  }
  let sent = false;
  const mustConsult = consultOnly || prepared.reconciliarPrimeiro === true;
  try {
    validatePrepared?.(prepared);
    const certificate = deps.parseCertificate(
      text(prepared.certificadoBase64),
      typeof prepared.certificadoSenha === "string"
        ? prepared.certificadoSenha
        : "",
    );
    assertCertificateMatchesCnpj(
      certificate,
      text(asRecord(prepared.prestador).cnpj),
    );
    let result;
    if (mustConsult) {
      await awaitWebissInterval(admin, ambiente, deps.wait);
      result = await deps.consult(prepared, certificate);
    } else {
      const signedXml = deps.sign(prepared, certificate);
      await awaitWebissInterval(admin, ambiente, deps.wait);
      sent = true;
      result = await deps.emit(prepared, certificate, signedXml);
    }
    const { data: nfseId, error: confirmError } = await admin.rpc(
      "confirmar_emissao_nfse_webiss",
      {
        p_user_id: userId,
        p_cobranca_id: chargeId,
        p_nfse_id: result.nfseId,
        p_protocolo: result.protocolo,
        p_payload: {
          ...result.payload,
          tentativaId: prepared.tentativaId,
          cobrancaId: chargeId,
        },
      },
    );
    if (confirmError || !nfseId) {
      throw new Error(
        "NFS-e localizada no WebISS, mas a confirmacao local falhou. Consulte o RPS para reconciliar; nao reenvie a emissao.",
      );
    }
    return {
      ok: true,
      success: true,
      nfseId,
      protocolo: result.protocolo,
      ambiente,
      reconciliada: mustConsult,
      message: ambiente === "homologacao"
        ? "NFS-e de homologacao registrada; sem efeito fiscal de producao."
        : "NFS-e confirmada no WebISS.",
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Falha na operacao WebISS.";
    // Read-only consultation must never release another request's active lease.
    if (!consultOnly && prepared.tentativaId) {
      const status = mustConsult
        ? "incerta"
        : !sent
        ? "falha_pre_envio"
        : error instanceof WebIssError && error.definitiveRejection
        ? "rejeitada"
        : "incerta";
      const { error: finishError } = await admin.rpc(
        "finalizar_tentativa_nfse_webiss",
        {
          p_user_id: userId,
          p_cobranca_id: chargeId,
          p_tentativa_id: prepared.tentativaId,
          p_status: status,
          p_mensagem: message,
        },
      );
      if (finishError) {
        throw new Error(
          `${message} Falha ao registrar o estado local; consulte o RPS antes de tentar novamente.`,
        );
      }
    }
    if (mustConsult) {
      throw new Error(
        `${message} Nenhuma nova emissao foi enviada. Resolva a situacao do RPS no WebISS antes de reenviar.`,
      );
    }
    throw error;
  }
}

import type { FiscalCertificate } from "./certificate.ts";
import { buildUnsignedRps } from "./rps.ts";
import { signRps, verifySignedRps } from "./signature.ts";
import { assertResponseMatchesRps, buildRpsQuery, ENDPOINTS, requestWebIss } from "./soap.ts";
import { asRecord, text } from "./xml.ts";
export { buildUnsignedRps } from "./rps.ts";

// Signing and validation happen before the handler marks the request as sent.
function requireExplicitCompetence(prepared: Record<string, unknown>) {
  if (!text(asRecord(prepared.servico).competencia)) {
    throw new Error("Prepare um rascunho com competencia explicita antes de emitir. A data do RPS nao define automaticamente a competencia fiscal.");
  }
}
export async function prepareSignedWebIssRps(prepared: Record<string, unknown>, certificate: FiscalCertificate) {
  if (!ENDPOINTS.has(text(prepared.endpoint))) throw new Error("Endpoint WebISS nao permitido.");
  requireExplicitCompetence(prepared);
  const { assertWebIssRpsSchema } = await import("./schema.ts");
  const unsigned = buildUnsignedRps(prepared);
  assertWebIssRpsSchema(unsigned);
  const signed = signRps(unsigned, certificate);
  assertWebIssRpsSchema(signed);
  return signed;
}
export async function emitWebIssNfse(prepared: Record<string, unknown>, certificate: FiscalCertificate, signedXml?: string) {
  requireExplicitCompetence(prepared);
  const xml = signedXml || await prepareSignedWebIssRps(prepared, certificate);
  if (signedXml) {
    // Even a persisted/prepared XML must not bypass the final preflight.
    const { assertWebIssRpsSchema } = await import("./schema.ts");
    assertWebIssRpsSchema(xml);
    verifySignedRps(xml, certificate);
  }
  const result = await requestWebIss(text(prepared.endpoint), "GerarNfse", xml, certificate);
  assertResponseMatchesRps(result.payload, prepared);
  return result;
}

export async function consultWebIssNfse(prepared: Record<string, unknown>, certificate: FiscalCertificate) {
  const result = await requestWebIss(text(prepared.endpoint), "ConsultarNfsePorRps", buildRpsQuery(prepared), certificate);
  assertResponseMatchesRps(result.payload, prepared);
  return result;
}

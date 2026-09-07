import type { FiscalCertificate } from "./certificate.ts";
import { buildUnsignedRps } from "./rps.ts";
import { signRps } from "./signature.ts";
import { assertResponseMatchesRps, buildRpsQuery, ENDPOINTS, requestWebIss } from "./soap.ts";
import { text } from "./xml.ts";
export { buildUnsignedRps } from "./rps.ts";

// Signing and validation happen before the handler marks the request as sent.
export function prepareSignedWebIssRps(prepared: Record<string, unknown>, certificate: FiscalCertificate) {
  if (!ENDPOINTS.has(text(prepared.endpoint))) throw new Error("Endpoint WebISS nao permitido.");
  return signRps(buildUnsignedRps(prepared), certificate);
}
export async function emitWebIssNfse(prepared: Record<string, unknown>, certificate: FiscalCertificate, signedXml?: string) {
  const result = await requestWebIss(text(prepared.endpoint), "GerarNfse", signedXml || prepareSignedWebIssRps(prepared, certificate), certificate);
  assertResponseMatchesRps(result.payload, prepared);
  return result;
}

export async function consultWebIssNfse(prepared: Record<string, unknown>, certificate: FiscalCertificate) {
  const result = await requestWebIss(text(prepared.endpoint), "ConsultarNfsePorRps", buildRpsQuery(prepared), certificate);
  assertResponseMatchesRps(result.payload, prepared);
  return result;
}

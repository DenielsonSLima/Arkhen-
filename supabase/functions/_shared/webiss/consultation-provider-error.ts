import {
  ConsultationError,
  safeConsultationDiagnostic,
  safeProviderCodes,
} from "./consultation-error.ts";
import { direct, nodeText } from "./xml.ts";

// Private provenance: arbitrary properties/cause on an Error never become a provider reason.
const reasons = new WeakMap<ConsultationError, string>();
function sanitizeReason(value: string) {
  // Inspect the entire original before truncation; never retain partial secrets.
  const scan = value.replace(
    /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,
    "",
  );
  if (
    /-----\s*(?:BEGIN|END)|PRIVATE\s*KEY|chave\s+privada|password|senha|authorization|bearer\s/i
      .test(scan) ||
    /<|>|&lt;|&gt;|&#(?:x0*3[cCeE]|0*6[02]);/i.test(scan) ||
    /[A-Za-z0-9+/_=-]{64,}/.test(scan) ||
    /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(scan)
  ) return "";
  return value.replace(
    /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g,
    " ",
  )
    .replace(/\s+/g, " ").trim();
}

/** Called only for MensagemRetorno nodes from the parsed provider outputXML. */
export function providerErrorFromResponse(messages: Element[]) {
  const valid = messages.filter((item) =>
    item.localName === "MensagemRetorno" &&
    safeProviderCodes([nodeText(direct(item, "Codigo"))]).length === 1
  ).slice(0, 5);
  const error = new ConsultationError(
    "VALIDATE_PROVIDER",
    valid.map((item) => nodeText(direct(item, "Codigo"))),
  );
  const texts: string[] = [];
  for (const item of valid) {
    for (const field of ["Mensagem", "Correcao"]) {
      const element = direct(item, field);
      if (
        !element ||
        Array.from(element.childNodes).some((node) => node.nodeType === 1)
      ) continue;
      const safe = sanitizeReason(nodeText(element));
      if (safe) texts.push(safe);
    }
  }
  const reason = texts.join(" | ").slice(0, 500);
  if (reason) reasons.set(error, reason);
  return error;
}

/** For private job.erro only. Never return this string in HTTP or log it. */
export function privateConsultationDiagnostic(error: unknown) {
  const diagnostic = safeConsultationDiagnostic(error);
  if (!diagnostic) return null;
  const reason =
    error instanceof ConsultationError && error.code === "VALIDATE_PROVIDER"
      ? reasons.get(error)
      : undefined;
  return (diagnostic.message + (reason ? ` Motivo WebISS: ${reason}` : ""))
    .slice(0, 300);
}

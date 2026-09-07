import { DOMParser } from "npm:@xmldom/xmldom@0.8.15";


export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const text = (value: unknown) => typeof value === "string" ? value.trim() : String(value ?? "").trim();
export const xmlEscape = (value: unknown) => text(value).replace(/&/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function parseXml(xml: string) {
  if (!xml.trim() || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML WebISS invalido ou com entidades proibidas.");
  const errors: string[] = [];
  const doc = new DOMParser({ errorHandler: {
    warning: (message) => errors.push(message), error: (message) => errors.push(message),
    fatalError: (message) => errors.push(message),
  } }).parseFromString(xml, "text/xml");
  if (errors.length || !doc.documentElement) throw new Error("XML WebISS malformado.");
  return doc;
}

export const descendants = (element: Element, name: string) =>
  Array.from(element.getElementsByTagNameNS("*", name));
export const direct = (element: Element, name: string) =>
  Array.from(element.childNodes).find((node) => node.nodeType === 1 && (node as Element).localName === name) as Element | undefined;
export const nodeText = (element: Element | undefined) => element?.textContent?.trim() || "";

export async function readLimitedXml(response: Response, maxBytes: number) {
  if (!response.body) throw new Error("WebISS retornou resposta vazia.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("Resposta WebISS acima do limite."); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

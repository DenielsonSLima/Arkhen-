import { XMLSerializer } from "npm:@xmldom/xmldom@0.8.15";

const XMLNS = "http://www.w3.org/2000/xmlns/";

/** Preserve inherited namespaces used by inclusive C14N when detaching signed XML. */
export function serializeWithNamespaceContext(element: Element): string {
  const namespaces = new Map<string, string>();
  // Nearest binding wins, including an explicit default-namespace undeclaration.
  for (
    let current: Node | null = element;
    current;
    current = current.parentNode
  ) {
    if (current.nodeType !== 1) continue;
    for (const attribute of Array.from((current as Element).attributes)) {
      if (
        attribute.namespaceURI !== XMLNS && attribute.name !== "xmlns" &&
        !attribute.name.startsWith("xmlns:")
      ) continue;
      if (!namespaces.has(attribute.name)) {
        namespaces.set(attribute.name, attribute.value);
      }
    }
  }
  const clone = element.cloneNode(true) as Element;
  for (const [name, value] of namespaces) {
    if (!clone.hasAttribute(name)) clone.setAttributeNS(XMLNS, name, value);
  }
  return new XMLSerializer().serializeToString(clone);
}

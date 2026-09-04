const MANAGED_ACCOUNT_TYPES = new Set([
  "employee_cpf",
  "employee_email",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuthUserWithAppMetadata = {
  app_metadata?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const decodeJwtPayload = (jwt: string): Record<string, unknown> => {
  const segments = jwt.split(".");
  const encodedPayload = segments.length === 3 ? segments[1] : "";
  if (
    !encodedPayload ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    encodedPayload.length % 4 === 1
  ) {
    throw new Error("Invalid JWT payload.");
  }

  const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");

  try {
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return asRecord(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    throw new Error("Invalid JWT payload.");
  }
};

export class ManagedCredentialVersionError extends Error {
  constructor() {
    super("Managed credential version mismatch.");
    this.name = "ManagedCredentialVersionError";
  }
}

export const assertManagedCredentialVersion = (
  jwt: string,
  user: AuthUserWithAppMetadata,
): void => {
  const currentAppMetadata = asRecord(user.app_metadata);
  const accountType = currentAppMetadata.account_type;
  if (typeof accountType !== "string" || !MANAGED_ACCOUNT_TYPES.has(accountType)) {
    return;
  }

  const currentVersion = currentAppMetadata.credential_version;
  const tokenAppMetadata = asRecord(decodeJwtPayload(jwt).app_metadata);
  const tokenVersion = tokenAppMetadata.credential_version;

  if (
    typeof currentVersion !== "string" ||
    typeof tokenVersion !== "string" ||
    !UUID_PATTERN.test(currentVersion) ||
    !UUID_PATTERN.test(tokenVersion) ||
    tokenVersion !== currentVersion
  ) {
    throw new ManagedCredentialVersionError();
  }
};

import { describe, expect, it } from "vitest";
import {
  assertManagedCredentialVersion,
  ManagedCredentialVersionError,
} from "./managed-auth.ts";

const CURRENT_VERSION = "8d080b9c-f3f7-4c92-9064-8f75104b2a47";
const OLD_VERSION = "7ab65112-f559-4dbc-a5b5-360d89ad30f3";

const encodeBase64Url = (value: unknown) => btoa(JSON.stringify(value))
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const createJwt = (appMetadata: Record<string, unknown>) => [
  encodeBase64Url({ alg: "HS256", typ: "JWT" }),
  encodeBase64Url({ sub: "user-id", app_metadata: appMetadata }),
  "validated-signature",
].join(".");

describe("assertManagedCredentialVersion", () => {
  it.each(["employee_cpf", "employee_email"])(
    "aceita %s quando a versão do token coincide com a versão atual",
    (accountType) => {
      const jwt = createJwt({
        account_type: accountType,
        credential_version: CURRENT_VERSION,
      });

      expect(() => assertManagedCredentialVersion(jwt, {
        app_metadata: {
          account_type: accountType,
          credential_version: CURRENT_VERSION,
        },
      })).not.toThrow();
    },
  );

  it("não altera o fluxo de contas não gerenciadas", () => {
    expect(() => assertManagedCredentialVersion("jwt-ja-validado", {
      app_metadata: { account_type: "customer" },
    })).not.toThrow();
  });

  it("rejeita token gerenciado emitido para uma versão anterior", () => {
    const jwt = createJwt({
      account_type: "employee_email",
      credential_version: OLD_VERSION,
    });

    expect(() => assertManagedCredentialVersion(jwt, {
      app_metadata: {
        account_type: "employee_email",
        credential_version: CURRENT_VERSION,
      },
    })).toThrow(ManagedCredentialVersionError);
  });

  it.each([
    ["token sem versão", {}, CURRENT_VERSION],
    ["usuário sem versão", { credential_version: CURRENT_VERSION }, undefined],
    ["versão inválida", { credential_version: "1" }, CURRENT_VERSION],
  ])("falha fechado para %s", (_case, tokenMetadata, currentVersion) => {
    const jwt = createJwt(tokenMetadata);

    expect(() => assertManagedCredentialVersion(jwt, {
      app_metadata: {
        account_type: "employee_cpf",
        credential_version: currentVersion,
      },
    })).toThrow(ManagedCredentialVersionError);
  });

  it("rejeita payload inválido para conta gerenciada", () => {
    expect(() => assertManagedCredentialVersion("jwt-invalido", {
      app_metadata: {
        account_type: "employee_cpf",
        credential_version: CURRENT_VERSION,
      },
    })).toThrow();
  });
});

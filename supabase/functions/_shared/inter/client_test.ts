import {
  getInterAccessToken,
  getInterChargeScopes,
  interApiRequest,
} from "./client.ts";
import type { InterPreparedConfig } from "./types.ts";

const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};
const config = (): InterPreparedConfig => ({
  baseUrl: "https://inter.invalid",
  authUrl: "https://inter.invalid/oauth/token",
  clientId: crypto.randomUUID(),
  clientSecret: "secret-one",
  certificadoPem: "certificate",
  chavePrivadaPem: "private-key",
  contaCorrente: "1234",
  modulos: { boleto: true, pix: true, webhook: true },
});

Deno.test("OAuth usa escopos contextuais e separa cache apos rotacao do segredo", async () => {
  const previousFetch = globalThis.fetch;
  const scopes: string[] = [];
  globalThis.fetch = (_input, init) => {
    scopes.push(new URLSearchParams(String(init?.body)).get("scope")!);
    return Promise.resolve(
      Response.json({
        access_token: `token-${scopes.length}`,
        expires_in: 3600,
      }),
    );
  };
  try {
    const prepared = config();
    const client = {} as Deno.HttpClient;
    const first = await getInterAccessToken(
      prepared,
      client,
      getInterChargeScopes("pix"),
    );
    const cached = await getInterAccessToken(prepared, client, [
      "cobv.write",
      "cobv.read",
      "cobv.read",
    ]);
    equal(cached.accessToken, first.accessToken);
    prepared.clientSecret = "secret-two";
    const rotated = await getInterAccessToken(
      prepared,
      client,
      getInterChargeScopes("pix"),
    );
    equal(rotated.accessToken, "token-2");
    equal(scopes, ["cobv.read cobv.write", "cobv.read cobv.write"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

Deno.test("HTTP 401 invalida token sem repetir automaticamente mutacao", async () => {
  const previousFetch = globalThis.fetch;
  let authCalls = 0;
  let mutationCalls = 0;
  globalThis.fetch = (input) => {
    if (String(input).includes("oauth")) {
      authCalls++;
      return Promise.resolve(
        Response.json({ access_token: `token-${authCalls}`, expires_in: 3600 }),
      );
    }
    mutationCalls++;
    return Promise.resolve(new Response(null, { status: 401 }));
  };
  try {
    const prepared = config();
    const client = {} as Deno.HttpClient;
    const token = await getInterAccessToken(prepared, client, [
      "boleto-cobranca.write",
    ]);
    let rejected = false;
    try {
      await interApiRequest(
        "https://inter.invalid/cobrancas",
        token,
        "1234",
        client,
        { method: "POST" },
      );
    } catch {
      rejected = true;
    }
    equal(rejected, true);
    equal(mutationCalls, 1);
    const refreshed = await getInterAccessToken(prepared, client, [
      "boleto-cobranca.write",
    ]);
    equal(refreshed.accessToken, "token-2");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

Deno.test("Timeout de operacao financeira informa resultado inconclusivo", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  try {
    let message = "";
    try {
      await interApiRequest(
        "https://inter.invalid/cobrancas",
        { accessToken: "token", expiresAt: 0, scope: "" },
        "1234",
        {} as Deno.HttpClient,
        { method: "POST", timeoutMs: 1 },
      );
    } catch (error) {
      message = (error as Error).message;
    }
    equal(message.includes("inconclusivo"), true);
    equal(message.includes("OAuth"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

Deno.test("Cinco consultas simultaneas compartilham uma unica autenticacao OAuth", async () => {
  const previousFetch = globalThis.fetch;
  let authCalls = 0;
  globalThis.fetch = async () => {
    authCalls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ access_token: "shared-token", expires_in: 3600 });
  };
  try {
    const prepared = config();
    const tokens = await Promise.all(
      Array.from(
        { length: 5 },
        () =>
          getInterAccessToken(prepared, {} as Deno.HttpClient, ["cobv.read"]),
      ),
    );
    equal(authCalls, 1);
    equal(
      tokens.map((token) => token.accessToken),
      Array(5).fill("shared-token"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

Deno.test("Timeout OAuth informa autenticacao inconclusiva sem sugerir consulta de cobranca", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.reject(new DOMException("Aborted", "AbortError"));
  try {
    const prepared = config();
    prepared.authUrl = "https://inter.invalid/oauth/v2/token";
    let message = "";
    try {
      await getInterAccessToken(prepared, {} as Deno.HttpClient, ["cobv.read"]);
    } catch (error) {
      message = (error as Error).message;
    }
    equal(message.includes("OAuth"), true);
    equal(message.includes("inconclusiva"), true);
    equal(message.includes("cobranca"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

Deno.test("Falha OAuth compartilhada libera pendencia para a proxima tentativa", async () => {
  const previousFetch = globalThis.fetch;
  let authCalls = 0;
  globalThis.fetch = async () => {
    authCalls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return authCalls === 1
      ? new Response(null, { status: 503 })
      : Response.json({ access_token: "recovered-token", expires_in: 3600 });
  };
  try {
    const prepared = config();
    const results = await Promise.allSettled(
      Array.from(
        { length: 5 },
        () =>
          getInterAccessToken(prepared, {} as Deno.HttpClient, ["cobv.read"]),
      ),
    );
    equal(authCalls, 1);
    equal(results.every((result) => result.status === "rejected"), true);
    const token = await getInterAccessToken(prepared, {} as Deno.HttpClient, [
      "cobv.read",
    ]);
    equal(authCalls, 2);
    equal(token.accessToken, "recovered-token");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

import { handleImportWorker } from "./handler.ts";
import { ConsultationError } from "../_shared/webiss/consultation-error.ts";
import { providerErrorFromResponse } from "../_shared/webiss/consultation-provider-error.ts";
import { parseXml } from "../_shared/webiss/xml.ts";
import type { FiscalRpcClient } from "../fiscal-integration/emission-action.ts";
const assert = (value: unknown) => {
  if (!value) throw new Error("Assertion failed");
};
const jobId = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(64);
const context = {
  userId: "22222222-2222-4222-8222-222222222222",
  fiscalConfigId: "33333333-3333-4333-8333-333333333333",
  clienteId: "44444444-4444-4444-8444-444444444444",
  ambiente: "producao",
  dataInicial: "2026-08-20",
  dataFinal: "2026-08-20",
};
const success = {
  ok: true,
  success: true,
  notesCount: 1,
  pagesRead: 1,
  coverage: "complete",
};
const request = (body: unknown = { jobId }, capability = token) =>
  new Request("https://worker.example.invalid", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webiss-job-token": capability,
    },
    body: JSON.stringify(body),
  });
function fakeAdmin() {
  let claimed = false;
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const admin: FiscalRpcClient = {
    rpc(name, args) {
      calls.push({ name, args });
      if (name === "claim_webiss_import_job") {
        if (claimed) return Promise.resolve({ data: null, error: null });
        claimed = true;
        return Promise.resolve({ data: context, error: null });
      }
      if (name !== "finish_webiss_import_job") {
        throw new Error("Unexpected RPC");
      }
      return Promise.resolve({ data: true, error: null });
    },
  };
  return { admin, calls };
}
Deno.test("worker denies missing/invalid capability before any RPC", async () => {
  const { admin, calls } = fakeAdmin();
  let consulted = false;
  for (const capability of ["", "abc", "a".repeat(63), "g".repeat(64)]) {
    const result = await handleImportWorker(
      request({ jobId }, capability),
      admin,
      async () => {
        consulted = true;
        return success;
      },
    );
    assert(result.status === 403);
  }
  assert(calls.length === 0 && !consulted);
});
Deno.test("worker rejects action and context overrides, malformed/oversized payload", async () => {
  const { admin, calls } = fakeAdmin();
  for (
    const body of [
      { jobId, action: "emit-nfse" },
      { jobId, ambiente: "homologacao" },
      { jobId, clienteId: context.clienteId },
      { jobId: "invalid" },
      { jobId, extra: "x".repeat(2048) },
      [],
      null,
    ]
  ) {
    assert(
      (await handleImportWorker(request(body), admin, async () => success))
        .status === 400,
    );
  }
  assert(calls.length === 0);
});
Deno.test("worker uses only claimed context, returns safe summary and cannot replay", async () => {
  const { admin, calls } = fakeAdmin();
  let consulted = 0;
  const consult = async (
    _admin: FiscalRpcClient,
    userId: string,
    payload: Record<string, unknown>,
  ) => {
    consulted++;
    const { userId: expectedUser, ...expected } = context;
    assert(
      userId === expectedUser &&
        JSON.stringify(payload) === JSON.stringify(expected),
    );
    return {
      ...success,
      certificadoSenha: "PRIVATE_SECRET",
      xml: "PRIVATE_XML",
      token,
      warning: "PRIVATE_SECRET",
      periodo: { inicio: "PRIVATE_SECRET" },
    };
  };
  const result = await handleImportWorker(request(), admin, consult);
  const responseText = await result.text();
  assert(
    result.status === 200 && !responseText.includes("PRIVATE") &&
      !responseText.includes(token),
  );
  assert(
    calls.length === 2 && calls[1].name === "finish_webiss_import_job" &&
      !JSON.stringify(calls[1]).includes("PRIVATE"),
  );
  assert(
    (await handleImportWorker(request(), admin, consult)).status === 403 &&
      consulted === 1,
  );
});
Deno.test("worker sanitizes consultation exceptions before storing or returning", async () => {
  const { admin, calls } = fakeAdmin();
  const result = await handleImportWorker(request(), admin, () => {
    throw new Error("PRIVATE_SECRET " + token);
  });
  assert(
    result.status === 500 && !(await result.text()).includes("PRIVATE_SECRET"),
  );
  assert(
    calls[1].args?.p_result === null &&
      !JSON.stringify(calls[1]).includes("PRIVATE_SECRET") &&
      !JSON.stringify(calls[1]).includes(token),
  );
});
Deno.test("worker persists only catalog diagnostic even when typed error is mutated", async () => {
  const { admin, calls } = fakeAdmin();
  const result = await handleImportWorker(request(), admin, () => {
    const error = new ConsultationError("CERTIFICATE_DECODE");
    error.message = "PRIVATE_SECRET " + token;
    throw error;
  });
  const body = await result.json();
  assert(body.code === "CERTIFICATE_DECODE" && body.stage === "certificate");
  assert(
    calls[1].args?.p_error === body.error &&
      !body.error.includes("PRIVATE_SECRET") && !body.error.includes(token),
  );
});
Deno.test("worker provider reason is persisted privately and excluded from HTTP", async () => {
  const { admin, calls } = fakeAdmin();
  const result = await handleImportWorker(request(), admin, () => {
    const node = parseXml(
      "<MensagemRetorno><Codigo>L999</Codigo><Mensagem>Emitente sem habilitacao no municipio.</Mensagem><Correcao>Verifique o cadastro.</Correcao></MensagemRetorno>",
    ).documentElement;
    throw providerErrorFromResponse([node]);
  });
  const body = await result.text();
  const stored = String(calls[1].args?.p_error);
  assert(stored.includes("Emitente sem habilitacao") && stored.length <= 300);
  assert(
    !body.includes("habilitacao") && !body.includes("Verifique o cadastro") &&
      body.includes("VALIDATE_PROVIDER"),
  );
});
Deno.test("worker records partial coverage with constant warning, never raw provider text", async () => {
  const { admin, calls } = fakeAdmin();
  const result = await handleImportWorker(
    request(),
    admin,
    async () => ({
      ...success,
      coverage: "partial",
      warning: "PRIVATE_SECRET",
    }),
  );
  const body = await result.json();
  assert(
    body.coverage === "partial" && body.warning &&
      !body.warning.includes("PRIVATE_SECRET"),
  );
  assert(
    (calls[1].args?.p_result as Record<string, unknown>).coverage === "partial",
  );
});
Deno.test("worker refuses invalid trusted context and invalid summaries", async () => {
  let consulted = false;
  const admin: FiscalRpcClient = {
    rpc: () =>
      Promise.resolve({ data: { ...context, userId: "bad" }, error: null }),
  };
  assert(
    (await handleImportWorker(request(), admin, async () => {
          consulted = true;
          return success;
        })).status === 500 && !consulted,
  );
  const fake = fakeAdmin();
  assert(
    (await handleImportWorker(
      request(),
      fake.admin,
      async () => ({ ...success, notesCount: 100 }),
    )).status === 500,
  );
});
Deno.test("worker claim RPC error or exception returns 503 without retry persistence or consultation", async () => {
  for (const throws of [false, true]) {
    const calls: string[] = [];
    const admin: FiscalRpcClient = {
      rpc: (name) => {
        calls.push(name);
        if (throws) throw new Error("PRIVATE_SECRET PGRST303");
        return Promise.resolve({
          data: null,
          error: { message: "PRIVATE_SECRET PGRST303" },
        });
      },
    };
    let consulted = false;
    const result = await handleImportWorker(request(), admin, async () => {
      consulted = true;
      return success;
    });
    const body = await result.text();
    assert(
      result.status === 503 && !consulted && !body.includes("PRIVATE_SECRET") &&
        !body.includes("PGRST303"),
    );
    assert(calls.join() === "claim_webiss_import_job");
  }
});
Deno.test("worker null claim without RPC error remains unauthorized without mutating job", async () => {
  const calls: string[] = [];
  let consulted = false;
  const admin: FiscalRpcClient = {
    rpc: async (name) => {
      calls.push(name);
      return { data: null, error: null };
    },
  };
  const result = await handleImportWorker(request(), admin, async () => {
    consulted = true;
    return success;
  });
  assert(
    result.status === 403 && !consulted &&
      calls.join() === "claim_webiss_import_job",
  );
});
Deno.test("worker completion failure never retries consultation", async () => {
  let consulted = 0;
  const admin: FiscalRpcClient = {
    rpc: (name) =>
      Promise.resolve(
        name === "claim_webiss_import_job"
          ? { data: context, error: null }
          : { data: null, error: { message: "PRIVATE_SECRET" } },
      ),
  };
  const result = await handleImportWorker(request(), admin, async () => {
    consulted++;
    return success;
  });
  assert(
    result.status === 500 && consulted === 1 &&
      !(await result.text()).includes("PRIVATE_SECRET"),
  );
});

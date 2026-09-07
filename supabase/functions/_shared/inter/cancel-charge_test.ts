import { assertInterChargeId, cancelInterCharge } from "./cancel-charge.ts";
import { InterApiError, interApiRequest } from "./client.ts";
import { getInterEndpoints } from "./endpoints.ts";

const pixId = "abc123def456abc123def456abc123de";
const boletoId = "45db84c9-d90d-4b75-9b5e-99bd76e37150";
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Esperado ${JSON.stringify(expected)}, recebido ${
        JSON.stringify(actual)
      }`,
    );
  }
};
const options = (tipo: "pix" | "bolepix") => ({
  tipo,
  externalId: tipo === "pix" ? pixId : boletoId,
  ambiente: "sandbox",
  endpoints: getInterEndpoints("sandbox"),
  token: { accessToken: "test", expiresAt: 9999999999999, scope: "test" },
  account: "12345",
  client: {} as Deno.HttpClient,
  reason: "Solicitado pelo usuario",
});
const pix = (status: string, txid = pixId) => ({ txid, status });
const boleto = (situacao: string) => ({
  cobranca: { codigoSolicitacao: boletoId, situacao },
});
const mockSequence = (
  ...steps: Array<Record<string, unknown> | number | Error>
) => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const request: typeof interApiRequest = async (
    url,
    _token,
    _account,
    _client,
    opts = {},
  ) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body });
    const step = steps.shift();
    if (step instanceof Error) throw step;
    if (step === undefined) throw new Error("Requisicao extra inesperada.");
    return typeof step === "number"
      ? new Response(null, { status: step })
      : Response.json(step);
  };
  return { calls, request };
};

Deno.test("Pix cancela via PATCH cobv e confirma somente pela consulta posterior", async () => {
  const mock = mockSequence(
    pix("ATIVA"),
    pix("REMOVIDA_PELO_USUARIO_RECEBEDOR"),
    pix("REMOVIDA_PELO_USUARIO_RECEBEDOR"),
  );
  const result = await cancelInterCharge(options("pix"), mock.request);
  equal(result.confirmado, true);
  equal(mock.calls.map((call) => call.method), ["GET", "PATCH", "GET"]);
  equal(mock.calls[1].url.endsWith(`/cobv/${pixId}`), true);
  equal(JSON.parse(mock.calls[1].body!), {
    status: "REMOVIDA_PELO_USUARIO_RECEBEDOR",
  });
});

Deno.test("Boleto HTTP 202 permanece pendente quando consulta ainda A_RECEBER", async () => {
  const mock = mockSequence(boleto("A_RECEBER"), 202, boleto("A_RECEBER"));
  const result = await cancelInterCharge(options("bolepix"), mock.request);
  equal(result.confirmado, false);
  equal(mock.calls.map((call) => call.method), ["GET", "POST", "GET"]);
  equal(mock.calls[1].url.endsWith(`/cobrancas/${boletoId}/cancelar`), true);
});

Deno.test("Retentativa recupera boleto ja cancelado sem reenviar cancelamento", async () => {
  const mock = mockSequence(boleto("CANCELADO"));
  equal(
    (await cancelInterCharge(options("bolepix"), mock.request)).confirmado,
    true,
  );
  equal(mock.calls.length, 1);
});

Deno.test("Consulta bancaria impede cancelamento de cobranca paga", async () => {
  for (const tipo of ["pix", "bolepix"] as const) {
    const mock = mockSequence(
      tipo === "pix" ? pix("CONCLUIDA") : boleto("RECEBIDO"),
    );
    let message = "";
    try {
      await cancelInterCharge(options(tipo), mock.request);
    } catch (error) {
      message = (error as Error).message;
    }
    equal(message.includes("paga"), true);
    equal(mock.calls.length, 1);
  }
});

Deno.test("Timeout da mutacao pode ser reconciliado sem repetir envio", async () => {
  const mock = mockSequence(
    pix("ATIVA"),
    new InterApiError("timeout", 504),
    pix("REMOVIDA_PELO_USUARIO_RECEBEDOR"),
  );
  const result = await cancelInterCharge(options("pix"), mock.request);
  equal(result.confirmado, true);
  equal(result.inconclusivo, false);
  equal(mock.calls.length, 3);
});

Deno.test("Consulta indisponivel apos aceite conserva pendencia", async () => {
  const mock = mockSequence(
    boleto("A_RECEBER"),
    202,
    new InterApiError("timeout", 504),
  );
  const result = await cancelInterCharge(options("bolepix"), mock.request);
  equal(result.confirmado, false);
  equal(result.inconclusivo, true);
});

Deno.test("Consulta com outro identificador nunca confirma o cancelamento", async () => {
  const mock = mockSequence(
    pix("ATIVA"),
    pix("REMOVIDA_PELO_USUARIO_RECEBEDOR"),
    pix("REMOVIDA_PELO_USUARIO_RECEBEDOR", "outra"),
  );
  const result = await cancelInterCharge(options("pix"), mock.request);
  equal(result.confirmado, false);
  equal(result.inconclusivo, true);
});

Deno.test("Identificadores externos sao validados conforme API utilizada", () => {
  assertInterChargeId("pix", pixId);
  assertInterChargeId("bolepix", boletoId);
  for (
    const [tipo, id] of [["pix", boletoId], ["bolepix", pixId], [
      "pix",
      "../cobv",
    ]] as const
  ) {
    let failed = false;
    try {
      assertInterChargeId(tipo, id);
    } catch {
      failed = true;
    }
    equal(failed, true);
  }
});

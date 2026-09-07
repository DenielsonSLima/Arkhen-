import { getInterEndpoints } from "./endpoints.ts";
import { parseInterWebhookPayload } from "./webhook.ts";
import {
  verifyInterWebhookBatch,
  verifyInterWebhookEvent,
} from "./webhook-verification.ts";

const endpoints = getInterEndpoints("sandbox");
const codigoSolicitacao = "183e982a-34e5-4bc0-9643-def5432aabcd";
const txid = "arkhen1234567890123456789012345678";
const endToEndId = "E105735212026021113145VE1RX4kbc6";
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Esperado ${JSON.stringify(expected)}, recebido ${
        JSON.stringify(actual)
      }`,
    );
  }
};
const rejects = async (operation: () => Promise<unknown>) => {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error("Era esperado rejeitar a verificacao.");
};

Deno.test("callback forjado nao determina status nem valor da cobranca", async () => {
  const result = await verifyInterWebhookEvent(
    {
      codigoSolicitacao,
      situacao: "RECEBIDO",
      valorTotalRecebido: "99999.00",
      pixCopiaECola: "conteudo-forjado",
      empresa_id: "outro-tenant",
    },
    endpoints,
    (url, scopes) => {
      equal(url, `${endpoints.boletoUrl}/cobrancas/${codigoSolicitacao}`);
      equal(scopes, ["boleto-cobranca.read"]);
      return Promise.resolve({
        cobranca: { codigoSolicitacao, situacao: "A_RECEBER" },
      });
    },
  );
  equal(result?.situacao, "A_RECEBER");
  equal(result?.valorTotalRecebido, undefined);
  equal(result?.pixCopiaECola, undefined);
  equal(result?.empresa_id, undefined);
});

Deno.test("resposta bancaria deve corresponder ao identificador solicitado e estado oficial", async () => {
  for (
    const cobranca of [
      {
        codigoSolicitacao: "283e982a-34e5-4bc0-9643-def5432aabcd",
        situacao: "RECEBIDO",
      },
      { codigoSolicitacao, situacao: "NAO_RECEBIDO" },
    ]
  ) {
    await rejects(() =>
      verifyInterWebhookEvent(
        { codigoSolicitacao },
        endpoints,
        () => Promise.resolve({ cobranca }),
      )
    );
  }
});

Deno.test("Pix aceita CONCLUIDA confirmado em cobv e ignora estado do callback", async () => {
  const parsed = parseInterWebhookPayload(
    JSON.stringify({ pix: [{ txid, endToEndId, status: "ATIVA" }] }),
  );
  const result = await verifyInterWebhookBatch(
    parsed,
    endpoints,
    (url, scopes) => {
      equal(url, `${endpoints.pixUrl}/cobv/${txid}`);
      equal(scopes, ["cobv.read"]);
      return Promise.resolve({
        txid,
        status: "CONCLUIDA",
        pix: [{ endToEndId, valor: "100.00" }],
      });
    },
  );
  equal(result[0].situacao, "CONCLUIDA");
  equal(result[0].tipo, "PIX");
  equal(result[0].endToEndId, undefined);
});

Deno.test("Pix sem txid so usa identificador de cobranca retornado pelo banco", async () => {
  const calls: string[] = [];
  const result = await verifyInterWebhookEvent(
    { endToEndId },
    endpoints,
    (url) => {
      calls.push(url);
      return Promise.resolve(
        url.includes("/pix/E")
          ? { endToEndId, txid }
          : { txid, status: "CONCLUIDA" },
      );
    },
  );
  equal(result?.txid, txid);
  equal(calls, [
    `${endpoints.pixUrl}/pix/${endToEndId}`,
    `${endpoints.pixUrl}/cobv/${txid}`,
  ]);
  equal(
    await verifyInterWebhookEvent(
      { endToEndId },
      endpoints,
      () => Promise.resolve({ endToEndId }),
    ),
    null,
  );
  equal(
    await verifyInterWebhookEvent(
      { endToEndId, txid: "***" },
      endpoints,
      () => Promise.resolve({ endToEndId, txid: "***" }),
    ),
    null,
  );
});

Deno.test("identificadores maliciosos e resposta Pix divergente sao recusados", async () => {
  let calls = 0;
  await rejects(() =>
    verifyInterWebhookEvent({ txid: "../saldo" }, endpoints, () => {
      calls++;
      return Promise.resolve({});
    })
  );
  equal(calls, 0);
  await rejects(() =>
    verifyInterWebhookEvent(
      { txid },
      endpoints,
      () => Promise.resolve({ txid: "outro", status: "CONCLUIDA" }),
    )
  );
  await rejects(() =>
    verifyInterWebhookEvent(
      { endToEndId },
      endpoints,
      () => Promise.resolve({ endToEndId: "outro", txid }),
    )
  );
});

Deno.test("falha do banco aborta verificacao e duplicados consultam somente uma vez", async () => {
  await rejects(() =>
    verifyInterWebhookBatch(
      [{ codigoSolicitacao }],
      endpoints,
      () => Promise.reject(new Error("503")),
    )
  );
  let calls = 0;
  const result = await verifyInterWebhookBatch(
    [{ txid }, { txid, status: "CONCLUIDA" }],
    endpoints,
    () => {
      calls++;
      return Promise.resolve({ txid, status: "ATIVA" });
    },
  );
  equal(calls, 1);
  equal(result.length, 1);
  equal(result[0].situacao, "ATIVA");
});

Deno.test("recebimentos com txid asteriscos nao colapsam E2E distintos", async () => {
  const secondId = "E205735212026021113145VE1RX4kbc6";
  const calls: string[] = [];
  const result = await verifyInterWebhookBatch(
    [{ txid: "***", endToEndId }, { txid: "***", endToEndId: secondId }],
    endpoints,
    (url) => {
      calls.push(url);
      return Promise.resolve({ endToEndId: url.split("/").pop(), txid: "***" });
    },
  );
  equal(calls.length, 2);
  equal(result.length, 0);
});

import { assertRecoveredCharge } from "./recover-charge.ts";
import type { PreparedInterCharge } from "./charge-payload.ts";

const reference =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const boletoId = "45db84c9-d90d-4b75-9b5e-99bd76e37150";
const prepared = (meioPagamento: "Pix" | "Boleto"): PreparedInterCharge => ({
  ambienteApi: "sandbox",
  ambienteDb: "homologacao",
  config: {
    baseUrl: "",
    authUrl: "",
    clientId: "",
    clientSecret: "",
    certificadoPem: "",
    chavePrivadaPem: "",
    contaCorrente: "1234",
    chavePix: "pix@example.com",
    modulos: { pix: true, boleto: true, webhook: false },
  },
  cliente: {
    id: "cliente",
    name: "Cliente",
    cpfCnpj: "52998224725",
    email: "",
    phone: "",
    endereco: "Rua A",
    numero: "10",
    bairro: "Centro",
    cidade: "Maceio",
    uf: "AL",
    cep: "57000000",
  },
  cobranca: {
    clienteEmpresaId: "cliente",
    contratoId: "contrato",
    descricao: "Honorarios",
    categoria: "Faturamento",
    valor: 500,
    dataVencimento: "2026-10-10",
    meioPagamento,
    descontoPercentual: 10,
    jurosPercentual: 1,
    multaPercentual: 2,
    mensagemBoleto: "",
  },
});
const pix = () => ({
  txid: reference.slice(0, 32),
  status: "CONCLUIDA",
  valor: { original: "500.00" },
  calendario: { dataDeVencimento: "2026-10-10" },
  devedor: { cpf: "52998224725" },
  pixCopiaECola: "qr-code",
});
const boleto = () => ({
  cobranca: {
    codigoSolicitacao: boletoId,
    seuNumero: reference.slice(0, 15).toUpperCase(),
    situacao: "RECEBIDO",
    valorNominal: 500,
    dataVencimento: "2026-10-10",
    pagador: { cpfCnpj: "52998224725" },
  },
});
const equal = (actual: unknown, expected: unknown) => {
  if (actual !== expected) throw new Error(`${actual} != ${expected}`);
};
const rejects = (operation: () => unknown) => {
  let rejected = false;
  try {
    operation();
  } catch {
    rejected = true;
  }
  equal(rejected, true);
};

Deno.test("Recuperacao preserva identidade, status pago e QR da resposta bancaria", () => {
  const execution = assertRecoveredCharge(prepared("Pix"), pix(), reference);
  equal(execution.externalId, reference.slice(0, 32));
  equal(execution.providerPayload.status, "CONCLUIDA");
  equal(execution.pixCopiaECola, "qr-code");
  equal(execution.ambiente, "homologacao");
});

Deno.test("Recuperacao Pix rejeita txid com letras de caixa diferente", () => {
  const payload = pix();
  payload.txid = payload.txid.toUpperCase();
  rejects(() => assertRecoveredCharge(prepared("Pix"), payload, reference));
});

Deno.test("Recuperacao boleto valida codigo UUID mesmo com seuNumero correspondente", () => {
  const payload = boleto();
  equal(
    assertRecoveredCharge(prepared("Boleto"), payload, reference).externalId,
    boletoId,
  );
  payload.cobranca.codigoSolicitacao = "codigo-invalido";
  rejects(() => assertRecoveredCharge(prepared("Boleto"), payload, reference));
});

Deno.test("Recuperacao bloqueia pagador, valor, vencimento ou referencia divergentes", () => {
  const variations = [
    { pagador: { cpfCnpj: "12345678901" } },
    { valorNominal: 501 },
    { dataVencimento: "2026-10-11" },
    { seuNumero: "OUTRAREFERENCIA" },
  ];
  for (const variation of variations) {
    const payload = boleto();
    Object.assign(payload.cobranca, variation);
    rejects(() =>
      assertRecoveredCharge(prepared("Boleto"), payload, reference)
    );
  }
});

import { buildPixDuePayload } from "./pix-charge.ts";
import { buildBolePixPayload } from "./boleto-charge.ts";
import type { PreparedInterCharge } from "./charge-payload.ts";

const fixture = (): PreparedInterCharge => ({
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
    chavePix: "cobrancas@example.com",
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
    meioPagamento: "Pix",
    descontoPercentual: 10,
    jurosPercentual: 1,
    multaPercentual: 2,
    mensagemBoleto: "",
  },
});
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};

Deno.test("Pix de R$500 preserva desconto 10% e juros mensais iguais ao boleto", () => {
  const prepared = fixture();
  const pix = buildPixDuePayload(prepared);
  equal(pix.valor.original, "500.00");
  equal(pix.valor.multa, { modalidade: 2, valorPerc: "2.00" });
  equal(pix.valor.juros, { modalidade: 3, valorPerc: "1.00" });
  equal(pix.valor.desconto, {
    modalidade: "2",
    descontoDataFixa: [{ data: "2026-10-10", valorPerc: "10.00" }],
  });
  const boleto = buildBolePixPayload(prepared, "abcdef0123456789");
  equal(boleto.mora, { codigo: "TAXAMENSAL", taxa: 1 });
  equal(boleto.desconto, {
    codigo: "PERCENTUALDATAINFORMADA",
    taxa: 10,
    quantidadeDias: 0,
  });
});

Deno.test("Pix sem encargos ou desconto omite objetos opcionais", () => {
  const prepared = fixture();
  prepared.cobranca.multaPercentual = 0;
  prepared.cobranca.jurosPercentual = 0;
  prepared.cobranca.descontoPercentual = 0;
  equal(buildPixDuePayload(prepared).valor, { original: "500.00" });
});

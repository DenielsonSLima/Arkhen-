import {
  parsePreparedInterCharge,
} from "./charge-payload.ts";
import { buildBolePixPayload } from "./boleto-charge.ts";
import { buildPixDuePayload } from "./pix-charge.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (actual !== expected) {
    throw new Error(`Esperado ${String(expected)}, recebido ${String(actual)}.`);
  }
};

const assertThrows = (operation: () => unknown, message: string) => {
  try {
    operation();
  } catch (error) {
    if (error instanceof Error && error.message.includes(message)) return;
    throw error;
  }
  throw new Error(`Era esperado erro contendo: ${message}`);
};

const preparedFixture = () => ({
  ambiente: "homologacao",
  baseUrl: "https://cdpj-sandbox.partners.uatinter.co",
  authUrl: "https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token",
  clientId: "client-id",
  clientSecret: "client-secret",
  certificadoPem: "-----BEGIN CERTIFICATE-----\nTESTE\n-----END CERTIFICATE-----",
  chavePrivadaPem: "-----BEGIN PRIVATE KEY-----\nTESTE\n-----END PRIVATE KEY-----",
  chavePix: "financeiro@example.com",
  modulos: { boleto: true, pix: true, webhook: true },
  cliente: {
    id: "cliente-1",
    name: "Empresa Alpha",
    cpfCnpj: "00.000.000/e08g-12",
    email: "financeiro@example.com",
    phone: "(79) 99999-9999",
    endereco: "Rua A",
    numero: "10",
    bairro: "Centro",
    cidade: "Itabaiana",
    uf: "SE",
    cep: "49.500-000",
  },
  cobranca: {
    clienteEmpresaId: "cliente-1",
    contratoId: "contrato-1",
    descricao: "Honorarios",
    categoria: "Faturamento",
    valor: 100,
    dataVencimento: "2026-10-10",
    meioPagamento: "Ambos",
    descontoPercentual: 0,
    jurosPercentual: 0,
    multaPercentual: 0,
    mensagemBoleto: "Honorarios contabeis",
  },
});

Deno.test("payload Inter preserva CNPJ alfanumerico no BolePix e no Pix", () => {
  const parsed = parsePreparedInterCharge(preparedFixture());
  assertEquals(parsed.cliente.cpfCnpj, "00000000E08G12");

  const boleto = buildBolePixPayload(parsed, "ABCDEF0123456789") as {
    pagador: Record<string, unknown>;
  };
  assertEquals(boleto.pagador.cpfCnpj, "00000000E08G12");
  assertEquals(boleto.pagador.tipoPessoa, "JURIDICA");

  parsed.cobranca.meioPagamento = "Pix";
  const pix = buildPixDuePayload(parsed) as {
    devedor: Record<string, unknown>;
  };
  assertEquals(pix.devedor.cnpj, "00000000E08G12");
});

Deno.test("payload Inter aceita CPF formatado e rejeita documento truncavel", () => {
  const cpfPrepared = preparedFixture();
  cpfPrepared.cliente.cpfCnpj = "529.982.247-25";
  cpfPrepared.cobranca.meioPagamento = "Pix";
  const parsed = parsePreparedInterCharge(cpfPrepared);
  assertEquals(parsed.cliente.cpfCnpj, "52998224725");

  const pix = buildPixDuePayload(parsed) as {
    devedor: Record<string, unknown>;
  };
  assertEquals(pix.devedor.cpf, "52998224725");

  const invalid = preparedFixture();
  invalid.cliente.cpfCnpj = "00.000.000/E08G-13";
  assertThrows(
    () => parsePreparedInterCharge(invalid),
    "CPF/CNPJ do pagador para o Banco Inter invalido",
  );

  const withUnexpectedCharacter = preparedFixture();
  withUnexpectedCharacter.cliente.cpfCnpj = "00000000E08G12!";
  assertThrows(
    () => parsePreparedInterCharge(withUnexpectedCharacter),
    "CPF/CNPJ do pagador para o Banco Inter invalido",
  );
});

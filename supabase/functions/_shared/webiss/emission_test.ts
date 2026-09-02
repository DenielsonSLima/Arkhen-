import { buildUnsignedRps } from "./rps.ts";

const assertIncludes = (value: string, expected: string) => {
  if (!value.includes(expected)) {
    throw new Error(`XML nao contem: ${expected}`);
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
  rps: { numero: "101", serie: "A", data: "2026-09-02" },
  prestador: {
    cnpj: "00.000.000/e08g-12",
    inscricaoMunicipal: "12345",
  },
  tomador: {
    documento: "00.000.000/E08G-12",
    razaoSocial: "Empresa Alpha",
    endereco: "Rua A",
    numero: "10",
    bairro: "Centro",
    cidade: "Itabaiana",
    uf: "SE",
    cep: "49.500-000",
    email: "financeiro@example.com",
    telefone: "(79) 99999-9999",
  },
  servico: {
    valor: 100,
    descricao: "Honorarios contabeis",
    itemListaServico: "17.19",
    codigoCnae: "6920601",
    codigoTributacaoMunicipio: "1719",
    aliquotaIss: "5",
    issRetido: "2",
    exigibilidadeIss: "1",
    regimeEspecial: "0",
    incentivoFiscal: "2",
    codigoMunicipio: "2802908",
  },
});

Deno.test("XML WebISS preserva CNPJ alfanumerico do prestador e tomador", () => {
  const xml = buildUnsignedRps(preparedFixture());
  assertIncludes(xml, "<Prestador><CpfCnpj><Cnpj>00000000E08G12</Cnpj>");
  assertIncludes(xml, "<CpfCnpj><Cnpj>00000000E08G12</Cnpj></CpfCnpj>");
});

Deno.test("XML WebISS usa tag CPF para tomador pessoa fisica", () => {
  const prepared = preparedFixture();
  prepared.tomador.documento = "529.982.247-25";
  const xml = buildUnsignedRps(prepared);
  assertIncludes(xml, "<CpfCnpj><Cpf>52998224725</Cpf></CpfCnpj>");
});

Deno.test("XML WebISS falha antes do envio quando o documento e invalido", () => {
  const invalidProvider = preparedFixture();
  invalidProvider.prestador.cnpj = "00.000.000/E08G-13";
  assertThrows(
    () => buildUnsignedRps(invalidProvider),
    "CNPJ do prestador WebISS invalido",
  );

  const invalidCustomer = preparedFixture();
  invalidCustomer.tomador.documento = "00000000E08G12!";
  assertThrows(
    () => buildUnsignedRps(invalidCustomer),
    "CPF/CNPJ do tomador WebISS invalido",
  );
});

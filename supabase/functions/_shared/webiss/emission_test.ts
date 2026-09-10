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

export const preparedFixture = () => ({
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
    competencia: "2026-09-01",
    valor: 100,
    descricao: "Honorarios contabeis",
    itemListaServico: "17.19",
    codigoCnae: "6920601",
    codigoTributacaoMunicipio: "1719",
    aliquotaIss: "5",
    issRetido: "2",
    exigibilidadeIss: "1",
    regimeEspecial: "0",
    optanteSimplesNacional: "2",
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

Deno.test("RPS segue ABRASF 2.02 sem InfRps extra e aliquota percentual", () => {
  const xml = buildUnsignedRps(preparedFixture());
  assertIncludes(xml, '<Rps Id="RPS101"><IdentificacaoRps>');
  if (xml.includes("InfRps")) throw new Error("InfRps nao existe no schema ABRASF");
  assertIncludes(xml, "<Aliquota>5.0000</Aliquota>");
  if (xml.includes("<RegimeEspecialTributacao>0")) throw new Error("Regime zero deve ser omitido");
  assertIncludes(xml, "<OptanteSimplesNacional>2</OptanteSimplesNacional>");
});

Deno.test("Simples Nacional nao e inferido do regime especial", () => {
  const prepared = preparedFixture();
  prepared.servico.regimeEspecial = "4";
  assertIncludes(buildUnsignedRps(prepared), "<OptanteSimplesNacional>2</OptanteSimplesNacional>");
  prepared.servico.optanteSimplesNacional = "";
  assertThrows(() => buildUnsignedRps(prepared), "Simples Nacional");
});

Deno.test("RPS rejeita valor invalido e retencao incompleta antes de assinar", () => {
  const prepared = preparedFixture();
  prepared.servico.valor = Number.NaN;
  assertThrows(() => buildUnsignedRps(prepared), "Valor do servico invalido");
  prepared.servico.valor = 100;
  prepared.servico.issRetido = "1";
  assertThrows(() => buildUnsignedRps(prepared), "Responsavel pela retencao");
});

Deno.test("RPS rejeita dados maiores que o XSD e nao gera tags opcionais vazias", () => {
  const prepared = preparedFixture();
  prepared.tomador.endereco = "A".repeat(126);
  assertThrows(() => buildUnsignedRps(prepared), "endereco");
  prepared.tomador.endereco = "Rua A";
  prepared.tomador.cep = "12";
  assertThrows(() => buildUnsignedRps(prepared), "CEP");
  prepared.tomador.cep = "49500000";
  prepared.servico.valor = 10_000_000_000_000;
  assertThrows(() => buildUnsignedRps(prepared), "Valor do servico");
  prepared.servico.valor = 100;
  prepared.servico.codigoCnae = "";
  prepared.servico.codigoTributacaoMunicipio = "";
  const xml = buildUnsignedRps(prepared);
  if (xml.includes("<CodigoCnae>") || xml.includes("<CodigoTributacaoMunicipio>")) throw new Error("Tags opcionais vazias");
});

Deno.test("Rascunho preserva competencia distinta, incidencia separada e NBS opcional", () => {
  const base=preparedFixture();
  const xml=buildUnsignedRps({...base,servico:{...base.servico,competencia:"2026-08-01",municipioIncidencia:"2800308",codigoNbs:"123456789"}});
  assertIncludes(xml,"<DataEmissao>2026-09-02</DataEmissao>");
  assertIncludes(xml,"<Competencia>2026-08-01</Competencia>");
  assertIncludes(xml,"<CodigoMunicipio>2802908</CodigoMunicipio>");
  assertIncludes(xml,"<MunicipioIncidencia>2800308</MunicipioIncidencia>");
  assertIncludes(xml,"<CodigoNbs>123456789</CodigoNbs>");
  assertThrows(()=>buildUnsignedRps({...base,servico:{...base.servico,competencia:"2026-02-30"}}),"Competencia");
});

Deno.test("RPS bloqueia tributos e grupos nao implementados em vez de omiti-los", () => {
  const base = preparedFixture();
  for (const extra of [{ valorPis: 1 }, { ValorCofins: "3,00" }, { descontoIncondicionado: 10 },
    { IBSCBS: { CST: "000" } }, { intermediario: { documento: "11222333000181" } },
    { codigoTributarioDesconhecido: "000" }]) {
    assertThrows(() => buildUnsignedRps({ ...base, servico: { ...base.servico, ...extra } }), "nao suportados");
  }
  assertThrows(() => buildUnsignedRps({ ...base, IBSCBS: { CST: "000" } }), "nao suportado");
});

Deno.test("RPS aceita ausencia e zeros explicitos de tributos e descontos nao utilizados", () => {
  const base = preparedFixture();
  const xml = buildUnsignedRps({ ...base, servico: { ...base.servico,
    valorPis: 0, ValorCofins: "0,00", valorInss: null, descontoIncondicionado: "0.0000", IBSCBS: undefined,
  } });
  assertIncludes(xml, "<ValorServicos>100.00</ValorServicos>");
  if (xml.includes("ValorPis") || xml.includes("IBSCBS")) throw new Error("Grupo vazio nao deve ser emitido.");
});

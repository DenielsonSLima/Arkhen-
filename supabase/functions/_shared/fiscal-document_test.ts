import {
  isValidCnpj,
  normalizeFiscalDocument,
  parseFiscalDocument,
  requireValidCnpj,
} from "./fiscal-document.ts";

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

Deno.test("normaliza somente formatacao e preserva as letras do CNPJ", () => {
  assertEquals(
    normalizeFiscalDocument(" 00.000.000/e08g-12 "),
    "00000000E08G12",
  );
  assertEquals(
    normalizeFiscalDocument("00000000E08G12!"),
    "00000000E08G12!",
  );
});

Deno.test("valida CNPJ numerico e alfanumerico pelo modulo 11", () => {
  assertEquals(isValidCnpj("00.000.000/E08G-12"), true);
  assertEquals(isValidCnpj("11.444.777/0001-61"), true);
  assertEquals(isValidCnpj("00.000.000/E08G-13"), false);
  assertEquals(isValidCnpj("00.000.000/0000-00"), false);
});

Deno.test("classifica CPF numerico e CNPJ sem truncar entradas invalidas", () => {
  const cpf = parseFiscalDocument("529.982.247-25");
  assertEquals(cpf.kind, "cpf");
  assertEquals(cpf.value, "52998224725");

  const cnpj = parseFiscalDocument("00.000.000/e08g-12");
  assertEquals(cnpj.kind, "cnpj");
  assertEquals(cnpj.value, "00000000E08G12");

  assertThrows(() => parseFiscalDocument("A29.982.247-25"), "invalido");
  assertThrows(() => requireValidCnpj("00000000E08G12!"), "invalido");
});

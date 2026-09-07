import { assertResponseMatchesRps, buildRpsQuery, buildSoapEnvelope, parseWebIssResponse, requestWebIss, WebIssError } from "./soap.ts";
import { parseXml, readLimitedXml, xmlEscape } from "./xml.ts";

const xml = '<GerarNfseResposta xmlns="http://www.abrasf.org.br/nfse.xsd"><ListaNfse><CompNfse><Nfse><InfNfse><Numero>88</Numero><CodigoVerificacao>ABC</CodigoVerificacao><DeclaracaoPrestacaoServico><InfDeclaracaoPrestacaoServico><Rps><IdentificacaoRps><Numero>10</Numero><Serie>A</Serie><Tipo>1</Tipo></IdentificacaoRps></Rps><Prestador><CpfCnpj><Cnpj>11222333000181</Cnpj></CpfCnpj><InscricaoMunicipal>15</InscricaoMunicipal></Prestador></InfDeclaracaoPrestacaoServico></DeclaracaoPrestacaoServico></InfNfse></Nfse></CompNfse></ListaNfse></GerarNfseResposta>';
const soap = (output: string, cdata = false) => `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><GerarNfseResponse xmlns="http://nfse.abrasf.org.br"><outputXML xmlns="">${cdata ? `<![CDATA[${output}]]>` : xmlEscape(output)}</outputXML></GerarNfseResponse></s:Body></s:Envelope>`;
const prepared = { rps: { numero: "10", serie: "A" }, prestador: { cnpj: "11222333000181", inscricaoMunicipal: "15" } };
function assertThrows(fn: () => unknown) { let threw = false; try { fn(); } catch { threw = true; } if (!threw) throw new Error("Esperava rejeicao"); }

Deno.test("SOAP aceita outputXML escaped ou CDATA e correlaciona prestador/RPS", () => {
  for (const cdata of [true, false]) {
    const result = parseWebIssResponse(soap(xml, cdata), "GerarNfse");
    if (result.nfseId !== "88") throw new Error("Numero inesperado");
    assertResponseMatchesRps(result.payload, prepared);
    assertThrows(() => assertResponseMatchesRps(result.payload, { ...prepared, rps: { numero: "11", serie: "A" } }));
  }
});
Deno.test("SOAP rejeita faults, respostas duplicadas, XML malformado e entidades", () => {
  assertThrows(() => parseWebIssResponse('<Envelope><Body><Fault><faultstring>erro</faultstring></Fault></Body></Envelope>', "GerarNfse"));
  assertThrows(() => parseWebIssResponse(soap(xml).replace('</s:Body>', '<outputXML>x</outputXML></s:Body>'), "GerarNfse"));
  assertThrows(() => parseXml('<root><broken></root>'));
  assertThrows(() => parseXml('<!DOCTYPE root [<!ENTITY x SYSTEM "file:///etc/passwd">]><root>&x;</root>'));
});
Deno.test("SOAP somente classifica retorno municipal de erro como rejeicao conclusiva", () => {
  const rejection = '<GerarNfseResposta><ListaMensagemRetorno><MensagemRetorno><Codigo>E10</Codigo><Mensagem>RPS rejeitado</Mensagem><Correcao>Corrija cadastro</Correcao></MensagemRetorno></ListaMensagemRetorno></GerarNfseResposta>';
  try { parseWebIssResponse(soap(rejection), "GerarNfse"); } catch (error) {
    if (error instanceof WebIssError && error.definitiveRejection && error.message.includes("Corrija cadastro")) return;
    throw error;
  }
  throw new Error("Rejeicao nao identificada");
});
Deno.test("Consulta usa root ABRASF correto e SOAP parametros unqualified", () => {
  const envelope = buildSoapEnvelope("ConsultarNfsePorRps", buildRpsQuery(prepared));
  if (!envelope.includes('<ConsultarNfsePorRpsRequest xmlns="http://nfse.abrasf.org.br">') || !envelope.includes('<nfseDadosMsg xmlns="">&lt;ConsultarNfseRpsEnvio')) throw new Error("Contrato SOAP incorreto");
});
Deno.test("Transporte bloqueia endpoint arbitrario antes de abrir cliente e limita streaming", async () => {
  try { await requestWebIss("https://example.com", "GerarNfse", "", {} as never); throw new Error("endpoint aceito"); }
  catch (error) { if (!(error instanceof Error) || !error.message.includes("nao permitido")) throw error; }
  try { await readLimitedXml(new Response("abcdef"), 3); throw new Error("payload aceito"); }
  catch (error) { if (!(error instanceof Error) || !error.message.includes("limite")) throw error; }
});

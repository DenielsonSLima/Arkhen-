import type { NfseFiscalData, XmlFiscalParty } from '../shared/xmlFiscalTypes';

type Root = Document | Element | undefined;
const nodes = (root: Root) => root ? Array.from(root.getElementsByTagName('*')) : [];
const element = (root: Root, ...names: string[]) => nodes(root).find((node) => names.includes(node.localName));
const child = (root: Element | undefined, name: string) => Array.from(root?.children || []).find((node) => node.localName === name);
const text = (root: Root, ...names: string[]) => {
  for (const name of names) {
    const value = element(root, name)?.textContent?.trim();
    if (value) return value;
  }
  return '';
};
const money = (value: string) => value && Number.isFinite(Number(value))
  ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value;
// WebISS Itabaiana usa pontos percentuais (manual v5.2, tsAliquota).
// Outros provedores mantêm o contrato anterior; nunca inferir escala pelo valor.
const percent = (value: string, webiss: boolean) => {
  if (!/^\d+(\.\d+)?$/.test(value)) return value;
  const [whole, fraction = ''] = value.split('.');
  if (webiss) return `${whole},${fraction.padEnd(4, '0')}%`;
  const digits = fraction.padEnd(6, '0');
  return `${String(BigInt(whole + digits.slice(0, 2)))},${digits.slice(2, 6)}%`;
};
const municipality = (value: string) => ({ '2802908': 'Itabaiana - SE', '2800308': 'Aracaju - SE' }[value] || value);
const date = (value: string) => {
  if (!value) return '';
  // Dates without an offset already represent the provider's local time.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return value.replace(/^(\d{4})-(\d{2})-(\d{2})(?:T(.*))?$/, '$3/$2/$1 $4').trim();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(', ', ' ');
};

function party(root: Element | undefined): XmlFiscalParty {
  const address = child(root, 'Endereco');
  const code = text(address, 'CodigoMunicipio');
  const city = text(address, 'Municipio', 'xMun') || municipality(code);
  const uf = text(address, 'Uf', 'UF');
  const cep = text(address, 'Cep', 'CEP');
  const formattedCep = cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return {
    nome: text(root, 'RazaoSocial', 'NomeRazaoSocial', 'Nome', 'xNome'),
    nomeFantasia: text(root, 'NomeFantasia'),
    documento: text(root, 'Cnpj', 'CNPJ', 'Cpf', 'CPF'),
    inscricaoMunicipal: text(root, 'InscricaoMunicipal'), inscricaoEstadual: text(root, 'InscricaoEstadual'),
    endereco: [[text(address, 'Endereco', 'Logradouro', 'xLgr'), text(address, 'Numero', 'nro')].filter(Boolean).join(', '),
      text(address, 'Complemento'), text(address, 'Bairro'), cep ? `CEP: ${formattedCep}` : '', city,
      uf && !city.endsWith(`- ${uf}`) ? uf : ''].filter(Boolean).join(' - '),
    codigoMunicipio: code, municipio: city.replace(/ - [A-Z]{2}$/, ''), uf, cep,
    telefone: text(root, 'Telefone', 'fone'), email: text(root, 'Email', 'email'),
  };
}

export function buildNfseData(xml: Document): NfseFiscalData | undefined {
  const inf = element(xml, 'InfNfse');
  if (!inf) return undefined;
  const declaration = element(inf, 'InfDeclaracaoPrestacaoServico') || inf;
  const service = element(declaration, 'Servico');
  const declared = child(service, 'Valores');
  const authorized = child(inf, 'ValoresNfse');
  const prestador = party(child(inf, 'PrestadorServico'));
  const codigoMunicipioGerador = text(child(inf, 'OrgaoGerador'), 'CodigoMunicipio');
  const webiss = (codigoMunicipioGerador || prestador.codigoMunicipio) === '2802908';
  const competencia = text(declaration, 'Competencia');
  const rtc = nodes(inf).filter((node) => node.localName === 'IBSCBS');
  return {
    numero: child(inf, 'Numero')?.textContent?.trim() || '',
    codigoVerificacao: text(inf, 'CodigoVerificacao'), dataEmissao: date(child(inf, 'DataEmissao')?.textContent?.trim() || ''),
    competencia: competencia.replace(/^(\d{4})-(\d{2}).*$/, '$2/$1'),
    codigoMunicipioGerador,
    municipioPrestacao: municipality(text(service, 'MunicipioPrestacao', 'CodigoMunicipio')),
    municipioIncidencia: municipality(text(service, 'MunicipioIncidencia')),
    naturezaOperacao: text(declaration, 'NaturezaOperacao'), exigibilidadeIss: text(service, 'ExigibilidadeISS'),
    regimeTributacao: text(declaration, 'RegimeEspecialTributacao'), optanteSimples: text(declaration, 'OptanteSimplesNacional'),
    incentivadorCultural: text(declaration, 'IncentivoFiscal', 'IncentivadorCultural'),
    prestador, tomador: party(element(declaration, 'TomadorServico', 'Tomador')),
    discriminacao: text(service, 'Discriminacao'), codigoServico: text(service, 'CodigoTributacaoMunicipio', 'CodigoServico'),
    descricaoServico: text(service, 'DescricaoCodigoTributacaoMunicipio', 'DescricaoItemListaServico', 'DescricaoServico'),
    itemListaServico: text(service, 'ItemListaServico'), cnae: text(service, 'CodigoCnae'), nbs: text(service, 'CodigoNbs', 'CodigoNBS', 'cNBS'),
    valorServicos: money(text(declared, 'ValorServicos')), deducoes: money(text(declared, 'ValorDeducoes')),
    descontos: money(text(declared, 'DescontoCondicionado', 'DescontoIncondicionado')),
    descontoCondicionado: money(text(declared, 'DescontoCondicionado')), descontoIncondicionado: money(text(declared, 'DescontoIncondicionado')),
    baseCalculo: money(text(authorized, 'BaseCalculo') || text(declared, 'BaseCalculo')),
    aliquota: percent(text(authorized, 'Aliquota') || text(declared, 'Aliquota'), webiss),
    valorIss: money(text(authorized, 'ValorIss') || text(declared, 'ValorIss')),
    valorIssRetido: money(text(declared, 'ValorIssRetido')), issRetido: text(service, 'IssRetido'),
    valorLiquido: money(text(authorized, 'ValorLiquidoNfse') || text(declared, 'ValorLiquidoNfse')),
    pis: money(text(declared, 'ValorPis')), cofins: money(text(declared, 'ValorCofins')), inss: money(text(declared, 'ValorInss')),
    ir: money(text(declared, 'ValorIr')), csll: money(text(declared, 'ValorCsll')), outrasRetencoes: money(text(declared, 'OutrasRetencoes')),
    chaveAcesso: text(inf, 'ChaveAcesso'), outrasInformacoes: text(inf, 'OutrasInformacoes', 'InformacoesComplementares'),
    // No synthetic QR payload. Only keep a link actually supplied in the XML.
    qrPayload: text(inf, 'LinkNfse', 'UrlNfse', 'QrCode', 'QRCode'),
    complementoTributario: rtc.flatMap((root, index) => nodes(root).filter((node) => node.children.length === 0 && node.textContent?.trim()).map((node) => {
      const path = [node.localName];
      let parent = node.parentElement;
      while (parent && parent !== root) { path.unshift(parent.localName); parent = parent.parentElement; }
      return { label: `IBS/CBS ${index + 1} / ${path.join(' / ')}`, value: node.textContent!.trim() };
    })),
  };
}

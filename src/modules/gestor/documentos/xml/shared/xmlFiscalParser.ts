import type { NfseFiscalData, XmlFiscalField, XmlFiscalKind, XmlFiscalParty, XmlFiscalSummary } from './xmlFiscalTypes';

const KIND_LABELS: Record<XmlFiscalKind, string> = {
  nfse: 'NFS-e',
  nfce: 'NFC-e',
  nfe: 'NF-e',
  cte: 'CT-e',
  mdfe: 'MDF-e',
  cancelado: 'XML cancelado',
  desconhecido: 'XML fiscal',
};

const getElements = (xml: Document, localName: string) => (
  Array.from(xml.getElementsByTagName('*')).filter((node) => node.localName === localName)
);

const firstText = (xml: Document, names: string[]) => {
  for (const name of names) {
    const value = getElements(xml, name)[0]?.textContent?.trim();
    if (value) return value;
  }
  return '';
};

const firstTextInside = (node: Element | undefined, names: string[]) => {
  if (!node) return '';
  const descendants = Array.from(node.getElementsByTagName('*'));
  for (const name of names) {
    const value = descendants.find((item) => item.localName === name)?.textContent?.trim();
    if (value) return value;
  }
  return '';
};

const firstElement = (xml: Document, names: string[]) => {
  for (const name of names) {
    const node = getElements(xml, name)[0] as Element | undefined;
    if (node) return node;
  }
  return undefined;
};

const firstChildElement = (node: Element | undefined, names: string[]) => {
  if (!node) return undefined;
  const children = Array.from(node.children);
  for (const name of names) {
    const child = children.find((item) => item.localName === name) as Element | undefined;
    if (child) return child;
  }
  return undefined;
};

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const joinAddress = (node: Element | undefined) => {
  if (!node) return '';
  const endereco = firstChildElement(node, ['Endereco']) || node;
  const logradouro = firstTextInside(endereco, ['Endereco', 'Logradouro', 'xLgr']);
  const numero = firstTextInside(endereco, ['Numero', 'NumeroEndereco', 'nro']);
  const bairro = firstTextInside(endereco, ['Bairro', 'xBairro']);
  const municipio = firstTextInside(endereco, ['Municipio', 'xMun']);
  const uf = firstTextInside(endereco, ['Uf', 'UF']);
  const cep = firstTextInside(endereco, ['Cep', 'CEP']);
  return [logradouro, numero, bairro, municipio && uf ? `${municipio}/${uf}` : municipio || uf, cep ? `CEP ${cep}` : '']
    .filter(Boolean)
    .join(' - ');
};

const formatMoney = (value: string) => {
  if (!value) return '';
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value: string) => {
  if (!value) return '';
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  const percent = number <= 1 ? number * 100 : number;
  return `${percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
};

const fields = (items: XmlFiscalField[]) => items.filter((field) => field.value);

const classify = (xml: Document): XmlFiscalKind => {
  const tpEvento = firstText(xml, ['tpEvento']);
  const descEvento = firstText(xml, ['descEvento']).toLowerCase();
  if (tpEvento === '110111' || descEvento.includes('cancelamento') || getElements(xml, 'procEventoNFe').length > 0) {
    return 'cancelado';
  }

  if (getElements(xml, 'InfNfse').length > 0 || getElements(xml, 'CompNfse').length > 0) return 'nfse';
  if (getElements(xml, 'infCte').length > 0) return 'cte';
  if (getElements(xml, 'infMDFe').length > 0) return 'mdfe';
  if (getElements(xml, 'infNFe').length > 0) {
    return firstText(xml, ['mod']) === '65' ? 'nfce' : 'nfe';
  }

  return 'desconhecido';
};

const buildNfseParty = (node: Element | undefined): XmlFiscalParty => ({
  nome: firstTextInside(node, ['RazaoSocial', 'NomeRazaoSocial', 'Nome', 'xNome']),
  documento: firstTextInside(node, ['Cnpj', 'CNPJ', 'Cpf', 'CPF']),
  inscricaoMunicipal: firstTextInside(node, ['InscricaoMunicipal']),
  inscricaoEstadual: firstTextInside(node, ['InscricaoEstadual']),
  endereco: joinAddress(node),
  municipio: firstTextInside(node, ['Municipio', 'xMun']),
  uf: firstTextInside(node, ['Uf', 'UF']),
  cep: firstTextInside(node, ['Cep', 'CEP']),
  telefone: firstTextInside(node, ['Telefone', 'fone']),
  email: firstTextInside(node, ['Email', 'email']),
});

const buildNfseData = (xml: Document): NfseFiscalData | undefined => {
  const infNfse = firstElement(xml, ['InfNfse']);
  const servico = firstElement(xml, ['Servico']);
  const valores = firstElement(xml, ['Valores']);
  const prestador = firstElement(xml, ['PrestadorServico']);
  const tomador = firstElement(xml, ['TomadorServico']);
  if (!infNfse && !servico && !prestador && !tomador) return undefined;

  const numero = firstText(xml, ['Numero']);
  const codigoVerificacao = firstText(xml, ['CodigoVerificacao']);
  const dataEmissaoRaw = firstText(xml, ['DataEmissao']);
  const municipio = firstTextInside(servico, ['MunicipioIncidencia', 'MunicipioPrestacao', 'CodigoMunicipio']) || firstTextInside(prestador, ['Municipio']);

  return {
    numero,
    codigoVerificacao,
    dataEmissao: formatDate(dataEmissaoRaw),
    competencia: firstText(xml, ['Competencia']),
    municipioPrestacao: municipio,
    naturezaOperacao: firstText(xml, ['NaturezaOperacao']),
    regimeTributacao: firstText(xml, ['RegimeEspecialTributacao']),
    optanteSimples: firstText(xml, ['OptanteSimplesNacional']),
    incentivadorCultural: firstText(xml, ['IncentivadorCultural']),
    prestador: buildNfseParty(prestador),
    tomador: buildNfseParty(tomador),
    discriminacao: firstTextInside(servico, ['Discriminacao']),
    codigoServico: firstTextInside(servico, ['CodigoTributacaoMunicipio', 'CodigoServico']),
    itemListaServico: firstTextInside(servico, ['ItemListaServico']),
    cnae: firstTextInside(servico, ['CodigoCnae']),
    valorServicos: formatMoney(firstTextInside(valores, ['ValorServicos'])),
    deducoes: formatMoney(firstTextInside(valores, ['ValorDeducoes'])),
    descontos: formatMoney(firstTextInside(valores, ['DescontoCondicionado', 'DescontoIncondicionado'])),
    baseCalculo: formatMoney(firstTextInside(valores, ['BaseCalculo'])),
    aliquota: formatPercent(firstTextInside(valores, ['Aliquota'])),
    valorIss: formatMoney(firstTextInside(valores, ['ValorIss', 'ValorIssRetido'])),
    issRetido: firstTextInside(valores, ['IssRetido']),
    valorLiquido: formatMoney(firstTextInside(valores, ['ValorLiquidoNfse'])),
    pis: formatMoney(firstTextInside(valores, ['ValorPis'])),
    cofins: formatMoney(firstTextInside(valores, ['ValorCofins'])),
    inss: formatMoney(firstTextInside(valores, ['ValorInss'])),
    ir: formatMoney(firstTextInside(valores, ['ValorIr'])),
    csll: formatMoney(firstTextInside(valores, ['ValorCsll'])),
    outrasInformacoes: firstText(xml, ['OutrasInformacoes', 'InformacoesComplementares']),
    qrPayload: [numero, codigoVerificacao, dataEmissaoRaw, firstTextInside(prestador, ['Cnpj', 'CNPJ']), firstTextInside(tomador, ['Cnpj', 'CNPJ', 'Cpf', 'CPF'])]
      .filter(Boolean)
      .join('|'),
  };
};

const buildSummary = (xml: Document, rawXml: string): XmlFiscalSummary => {
  const kind = classify(xml);
  const emit = firstElement(xml, ['emit', 'PrestadorServico']);
  const dest = firstElement(xml, ['dest', 'TomadorServico', 'rem']);
  const prot = firstElement(xml, ['infProt', 'retEvento']);

  const number = firstText(xml, ['Numero', 'nNF', 'nCT', 'nMDF']);
  const key = firstText(xml, ['chNFe', 'chCTe', 'chMDFe']);
  const date = formatDate(firstText(xml, ['DataEmissao', 'dhEmi', 'dhEvento']));
  const total = formatMoney(firstText(xml, ['ValorServicos', 'vNF', 'vTPrest', 'vCarga']));
  const status = firstTextInside(prot, ['xMotivo', 'cStat']) || (kind === 'desconhecido' ? 'Tipo não identificado' : 'Sem protocolo no XML');
  const nfse = kind === 'nfse' ? buildNfseData(xml) : undefined;

  return {
    kind,
    label: KIND_LABELS[kind],
    title: number ? `${KIND_LABELS[kind]} ${number}` : KIND_LABELS[kind],
    subtitle: key || firstText(xml, ['CodigoVerificacao', 'Id']) || 'Arquivo XML fiscal',
    status,
    isCanceled: kind === 'cancelado',
    nfse,
    rawXml,
    sections: [
      {
        title: 'Identificação',
        fields: fields([
          { label: 'Número', value: number },
          { label: 'Modelo', value: firstText(xml, ['mod']) },
          { label: 'Série', value: firstText(xml, ['serie']) },
          { label: 'Emissão/evento', value: date },
          { label: 'Valor informado', value: total },
        ]),
      },
      {
        title: 'Emitente / Prestador',
        fields: fields([
          { label: 'Nome', value: firstTextInside(emit, ['xNome', 'RazaoSocial']) },
          { label: 'CNPJ', value: firstTextInside(emit, ['CNPJ', 'Cnpj']) },
          { label: 'Município', value: firstTextInside(emit, ['xMun', 'Municipio']) },
          { label: 'UF', value: firstTextInside(emit, ['UF', 'Uf']) },
        ]),
      },
      {
        title: kind === 'cte' ? 'Remetente / Destinatário' : 'Destinatário / Tomador',
        fields: fields([
          { label: 'Nome', value: firstTextInside(dest, ['xNome', 'RazaoSocial']) },
          { label: 'Documento', value: firstTextInside(dest, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']) },
          { label: 'Município', value: firstTextInside(dest, ['xMun', 'Municipio']) },
          { label: 'UF', value: firstTextInside(dest, ['UF', 'Uf']) },
        ]),
      },
      {
        title: 'Protocolo',
        fields: fields([
          { label: 'Protocolo', value: firstText(xml, ['nProt']) },
          { label: 'Status', value: firstText(xml, ['cStat']) },
          { label: 'Motivo', value: status },
          { label: 'Justificativa', value: firstText(xml, ['xJust']) },
        ]),
      },
    ].filter((section) => section.fields.length > 0),
  };
};

export const parseFiscalXml = (rawXml: string): XmlFiscalSummary => {
  const xml = new DOMParser().parseFromString(rawXml, 'application/xml');
  const parserError = xml.getElementsByTagName('parsererror')[0];

  if (parserError) {
    return {
      kind: 'desconhecido',
      label: 'XML inválido',
      title: 'XML inválido',
      subtitle: 'Não foi possível interpretar este arquivo.',
      status: parserError.textContent?.trim() || 'Erro de leitura',
      isCanceled: false,
      sections: [],
      rawXml,
    };
  }

  return buildSummary(xml, rawXml);
};

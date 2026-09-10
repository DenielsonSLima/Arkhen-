import { formatCpfOrCnpj } from '../../../../../../../lib/cnpj';
import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';
import { booleanLabel, exigibilidadeLabel, isItabaiana, regimeLabel, validationUrl, type NfseModeloOptions } from './modelo';
import { createPdfLayout } from './pdfLayout';
import { drawValidationPanel } from './quadroValidacao';
import { descricaoEnquadramento } from './servicos';

const amount = (value?: string) => value?.replace(/^R\$\s*/, '');
export function gerarNfsePdf(nfse: NfseFiscalData, options: NfseModeloOptions) {
  if (!isItabaiana(nfse)) throw new Error('O modelo de Itabaiana/SE não corresponde ao município gerador deste XML.');
  if (!nfse.numero || !nfse.codigoVerificacao || !nfse.prestador.documento) {
    throw new Error('O XML não contém número, código de verificação e prestador da NFS-e.');
  }
  const layout = createPdfLayout({ ...options, empresaNome: options.empresaNome || nfse.prestador.nome }, nfse.numero);
  const { pdf, row, section, paragraph, left, width: contentWidth } = layout;
  const top = layout.getY();
  if (options.brasaoImagem) {
    const props = pdf.getImageProperties(options.brasaoImagem);
    const height = 21, width = height * props.width / props.height;
    pdf.addImage(options.brasaoImagem, props.fileType, left + 2 + (21 - width) / 2, top, width, height, 'brasao-itabaiana', 'FAST');
  }
  pdf.setFont('helvetica', 'bold').setFontSize(14).text('MUNICÍPIO DE ITABAIANA', left + 27, top + 4);
  pdf.setFont('helvetica', 'normal').setFontSize(11).text('Secretaria Municipal da Fazenda', left + 27, top + 11);
  pdf.setFontSize(8).text(['Departamento Tributário - Rua Francisco Santos, Nº 160 - Centro', 'CEP: 49.500-000 - Itabaiana/SE Telefone: (79) 3431-9711'], left + 27, top + 15);
  drawValidationPanel(pdf, nfse, options, top);
  pdf.setDrawColor('#888888').setLineWidth(0.3).line(left, top + 23, 156, top + 23);
  pdf.setFont('helvetica', 'bold').setFontSize(left > 4 ? 10.8 : 11.5).text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e', (left + 156) / 2, top + 28, { align: 'center' });
  layout.setY(top + 32);
  row([{ label: 'Emissão (Horário de Brasília)', value: nfse.dataEmissao, weight: 2.2 },
    { label: 'Período de Competência', value: nfse.competencia },
    { label: 'Município de Prestação do Serviço', value: nfse.municipioPrestacao }], 156 - left);
  row([{ label: 'Reg. Especial Tributação', value: regimeLabel(nfse.regimeTributacao), weight: 2.2 },
    { label: 'Exigibilidade do ISS', value: [exigibilidadeLabel(nfse.exigibilidadeIss),
      nfse.municipioIncidencia ? `em ${nfse.municipioIncidencia}` : ''].filter(Boolean).join(' '), weight: 2 }], 156 - left);
  layout.setY(Math.max(layout.getY(), top + 60));
  const prestador = nfse.prestador;
  section('Prestador de serviços');
  row([{ label: 'Razão Social', value: prestador.nome }]);
  row([{ label: 'Nome Fantasia', value: prestador.nomeFantasia, weight: 2 }, { label: 'Email', value: prestador.email }]);
  row([{ label: 'CPF/CNPJ', value: formatCpfOrCnpj(prestador.documento), weight: 1.9 },
    { label: 'Inscrição Municipal', value: prestador.inscricaoMunicipal }, { label: 'Inscrição Estadual', value: prestador.inscricaoEstadual },
    { label: 'Simples Nacional', value: booleanLabel(nfse.optanteSimples), weight: 0.9 },
    { label: 'Incentivador Cultural', value: booleanLabel(nfse.incentivadorCultural), weight: 1.1 },
    { label: 'Fone/Fax', value: prestador.telefone, weight: 1.6 }]);
  row([{ label: 'Endereço', value: prestador.endereco, italic: true }]);
  const tomador = nfse.tomador;
  section('Tomador de serviços');
  row([{ label: 'Nome/Razão Social', value: tomador.nome }]);
  row([{ label: 'CPF/CNPJ', value: formatCpfOrCnpj(tomador.documento), weight: 1.8 },
    { label: 'Inscrição Municipal', value: tomador.inscricaoMunicipal }, { label: 'Inscrição Estadual', value: tomador.inscricaoEstadual },
    { label: 'Fone/Fax', value: tomador.telefone, weight: 1.3 }, { label: 'E-mail', value: tomador.email, weight: 1.8 }]);
  row([{ label: 'Endereço', value: tomador.endereco, italic: true }]);
  section('Serviço prestado');
  paragraph([descricaoEnquadramento(nfse), nfse.cnae ? `CNAE: ${nfse.cnae}.` : '', nfse.nbs ? `NBS: ${nfse.nbs}.` : ''].filter(Boolean).join(' '), 12, 'bold', 7.5);
  section('Descrição dos serviços');
  // Mantém a área ampla da referência; conteúdo extenso continua nas páginas seguintes.
  paragraph(nfse.discriminacao, Math.max(24, 220 - layout.getY()), 'normal', 8.5);
  // Mantém o quadro financeiro unido quando a discriminação ocupa várias páginas.
  layout.ensure(44);
  section('Tributos federais');
  row([{ label: 'INSS (R$)', value: amount(nfse.inss) }, { label: 'IR (R$)', value: amount(nfse.ir) },
    { label: 'PIS (R$)', value: amount(nfse.pis) }, { label: 'COFINS (R$)', value: amount(nfse.cofins) },
    { label: 'CSLL (R$)', value: amount(nfse.csll) }, { label: 'Outras Retenções (R$)', value: amount(nfse.outrasRetencoes), weight: 2 }], contentWidth, 'right');
  section('Valores');
  row([{ label: 'Deduções (R$)', value: amount(nfse.deducoes) }, { label: 'Desc. Cond. (R$)', value: amount(nfse.descontoCondicionado) },
    { label: 'Desc. Incond. (R$)', value: amount(nfse.descontoIncondicionado) }, { label: 'Base de Cálculo ISS (R$)', value: amount(nfse.baseCalculo), weight: 1.4 },
    { label: 'Alíquota ISS (%)', value: nfse.aliquota.replace(/%$/, ''), weight: 1.4 }], contentWidth, 'right');
  row([{ label: 'Valor dos Serviços (R$)', value: amount(nfse.valorServicos) }, { label: 'ISS (R$)', value: amount(nfse.valorIss), weight: 0.7 },
    { label: `ISS Retido: ${booleanLabel(nfse.issRetido)} (R$)`, value: amount(nfse.valorIssRetido), weight: 0.9 },
    { label: 'Valor Líquido (R$)', value: amount(nfse.valorLiquido) },
    // Total bruto explicitamente definido; não recalcula descontos ou usa o líquido.
    { label: 'Valor Total da Nota (R$)\nBruto dos serviços', value: amount(nfse.valorServicos), weight: 1.2, emphasis: true }], contentWidth, 'right');
  section('Outras informações');
  paragraph(nfse.outrasInformacoes || '-', 0, 'normal', 7);
  if (nfse.chaveAcesso) paragraph(`Chave de Acesso da NFS-e Nacional: ${nfse.chaveAcesso}`, 0, 'normal', 7);
  if (nfse.complementoTributario?.length) {
    section('Informações complementares IBS / CBS');
    nfse.complementoTributario.forEach((field) => row([field]));
  }
  pdf.setProperties({ title: `NFS-e ${nfse.numero} - ${options.ambiente}`, subject: 'Representação auxiliar do XML WebISS', author: nfse.prestador.nome });
  return layout.finish(validationUrl(options.ambiente));
}

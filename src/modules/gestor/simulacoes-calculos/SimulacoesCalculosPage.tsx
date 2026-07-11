import React, { useState, useEffect } from 'react';
import {
  Users, FileX2, Briefcase, Receipt, FileText, AlertTriangle, Calculator,
  Calendar, History, Landmark, UserCheck, Percent, DollarSign,
  Download, Share2, Trash2, X, Clock, Check, Copy, FileDown
} from 'lucide-react';
import { SystemQuickModal } from '../components/SystemQuickModal';
import { useSimulacoesCalculos, type AbaCalculo } from './hooks/useSimulacoesCalculos';
import { SimuladorFolha } from './folha/SimuladorFolha';
import { SimuladorRescisao } from './rescisao/SimuladorRescisao';
import { SimuladorProLabore } from './prolabore/SimuladorProLabore';
import { SimuladorDAS } from './das/SimuladorDAS';
import { SimuladorPisCofins } from './pis-cofins/SimuladorPisCofins';
import { SimuladorMultas } from './multas/SimuladorMultas';

// Novos componentes
import { SimuladorFerias } from './ferias/SimuladorFerias';
import { SimuladorTempoEmpresa } from './tempo-empresa/SimuladorTempoEmpresa';
import { SimuladorEncargos } from './encargos-trabalhistas/SimuladorEncargos';
import { SimuladorContratacao } from './simulacao-contratacao/SimuladorContratacao';
import { SimuladorComparativoRegime } from './comparativo-regime/SimuladorComparativoRegime';
import { SimuladorImposto } from './simulacao-imposto/SimuladorImposto';
import { SimuladorCustos } from './simulacao-custos/SimuladorCustos';

import { empresaService } from '../configuracoes/empresa/services/empresaService';
import { marcaDaguaService } from '../configuracoes/marca-dagua/services/marcaDaguaService';
import { parseCurrencyInputValue } from '../shared/currencyInputUtils';
import { formatCurrency, formatPercent } from './services/calculos.service';
import {
  ComparativoRegimePdfModelo,
  ContratacaoPdfModelo,
  CustosPdfModelo,
  DasPdfModelo,
  EncargosPdfModelo,
  FeriasPdfModelo,
  FolhaPdfModelo,
  MultasPdfModelo,
  PisCofinsPdfModelo,
  ProLaborePdfModelo,
  RescisaoPdfModelo,
  SimulacaoImpostoPdfModelo,
  TempoEmpresaPdfModelo,
} from './pdf-modelos';

import './SimulacoesCalculos.css';

interface NavItem {
  id: AbaCalculo;
  label: string;
  icon: React.ReactNode;
  desc: string;
}

const TRABALHISTA_NAV: NavItem[] = [
  { id: 'simulacao-contratacao', label: 'CLT vs PJ vs Estágio', icon: <UserCheck size={15} />, desc: 'Comparativo contratações' },
  { id: 'encargos-trabalhistas', label: 'Encargos da Folha', icon: <Landmark size={15} />, desc: 'RAT, FAP e Previdência' },
  { id: 'ferias', label: 'Férias & Abono', icon: <Calendar size={15} />, desc: 'Simulador de Férias CLT' },
  { id: 'folha', label: 'Folha de Pagamento', icon: <Users size={15} />, desc: 'INSS, IRRF e FGTS' },
  { id: 'prolabore', label: 'Pró-Labore', icon: <Briefcase size={15} />, desc: 'INSS do sócio' },
  { id: 'rescisao', label: 'Rescisão', icon: <FileX2 size={15} />, desc: 'Verbas rescisórias' },
  { id: 'tempo-empresa', label: 'Tempo de Empresa', icon: <History size={15} />, desc: 'Provisões acumuladas' },
];

const FISCAL_NAV: NavItem[] = [
  { id: 'simulacao-custos', label: 'Custos & Break-even', icon: <DollarSign size={15} />, desc: 'Ponto de equilíbrio' },
  { id: 'das', label: 'DAS Simples', icon: <Receipt size={15} />, desc: 'Simples Nacional' },
  { id: 'multas', label: 'Multas e Juros', icon: <AlertTriangle size={15} />, desc: 'DARF em atraso' },
  { id: 'piscofins', label: 'PIS / COFINS', icon: <FileText size={15} />, desc: 'Débito e crédito' },
  { id: 'comparativo-regime', label: 'Regimes Tributários', icon: <Landmark size={15} />, desc: 'Simples vs LP vs LR' },
  { id: 'simulacao-imposto', label: 'Simular Impostos', icon: <Percent size={15} />, desc: 'Alíquotas e faturamento' },
];

const PAGE_TITLES: Record<AbaCalculo, { title: string; desc: string }> = {
  folha: { title: 'Simulador de Folha de Pagamento', desc: 'Calcule INSS, IRRF, FGTS e custo total ao empregador.' },
  rescisao: { title: 'Calculadora de Rescisão', desc: 'Verbas rescisórias: saldo, 13º, férias, aviso e multa FGTS.' },
  prolabore: { title: 'Simulador de Pró-Labore', desc: 'Calcule o INSS e IRRF do sócio-administrador.' },
  ferias: { title: 'Simulador de Férias', desc: 'Calcule o valor das férias com o terço constitucional, abonos e deduções.' },
  'tempo-empresa': { title: 'Provisões por Tempo de Empresa', desc: 'Veja o passivo acumulado de férias, 13º e FGTS de um contrato.' },
  'encargos-trabalhistas': { title: 'Calculadora de Encargos Patronais', desc: 'Simule o custo de encargos previdenciários e trabalhistas sobre a folha.' },
  'simulacao-contratacao': { title: 'Comparativo de Formas de Contratação', desc: 'Compare os custos e rendimentos entre CLT, PJ e Estagiários.' },
  das: { title: 'Calculadora DAS — Simples Nacional', desc: 'Identifique a faixa e calcule o DAS do mês.' },
  piscofins: { title: 'Calculadora PIS / COFINS', desc: 'Débito, créditos e saldo a recolher nos regimes cumulativo e não-cumulativo.' },
  multas: { title: 'Calculadora de Multas e Juros', desc: 'Calcule acréscimos de DARFs vencidos com multa 0,33%/dia + Selic.' },
  'comparativo-regime': { title: 'Comparativo de Regimes Tributários', desc: 'Projete impostos e escolha entre Simples Nacional, Lucro Presumido e Lucro Real.' },
  'simulacao-imposto': { title: 'Simulação Mensal de Impostos', desc: 'Estime a carga tributária do faturamento de acordo com a atividade.' },
  'simulacao-custos': { title: 'Análise de Custos e Break-even', desc: 'Determine o ponto de equilíbrio operacional e metas de faturamento.' },
};

const formatCnpj = (value: string) => {
  if (!value) return '';
  const clean = value.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return value;
};

const formatCompetencia = (value: string) => {
  if (!value) return '';
  const regexYyyyMm = /^(\d{4})-(\d{2})$/;
  const match = value.match(regexYyyyMm);
  if (match) {
    const ano = match[1];
    const mesNum = match[2];
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const mesIndex = parseInt(mesNum, 10) - 1;
    if (mesIndex >= 0 && mesIndex < 12) {
      return `${meses[mesIndex]}/${ano}`;
    }
  }
  return value;
};

const SYSTEM_NAME = 'Arkhen Gestão Contábil';

const formatGeneratedDateTime = (date: Date) => (
  date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
);

const normalizePdfText = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
);

const escapePdfText = (value: string) => normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const encodeBase64Ascii = (value: string) => btoa(value);

const encodeBase64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const getShareExpiryDate = (value: string, start: Date) => {
  const durations: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  if (value === 'never') return new Date('2999-12-31T23:59:00');
  return new Date(start.getTime() + (durations[value] || durations['24h']));
};

const formatShareExpiryLabel = (value: string) => {
  const labels: Record<string, string> = {
    '15m': '15 minutos',
    '1h': '1 hora',
    '24h': '24 horas',
    '7d': '7 dias',
    never: 'Sem expiração',
  };
  return labels[value] || value;
};

const buildSimplePdfDataUrl = (lines: string[]) => {
  const safeLines = lines.map((line) => escapePdfText(line)).slice(0, 44);
  const textCommands = safeLines.map((line, index) => (
    index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`
  )).join('\n');
  const stream = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${textCommands}\nET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return `data:application/pdf;base64,${encodeBase64Ascii(pdf)}`;
};

export const SimulacoesCalculosPage: React.FC = () => {
  const {
    abaAtiva, setAbaAtiva,
    folhaParams, setFolhaParams, resultadoFolha,
    rescisaoParams, setRescisaoParams, resultadoRescisao, tiposRescisao,
    prolaboreValor, setProlaboreValor, resultadoProLabore,
    dasParams, setDasParams, resultadoDAS, anexosDas,
    pisParams, setPisParams, resultadoPisCofins, regimesPisCofins,
    multasParams, setMultasParams, resultadoMultas,
    
    // Novas calculadoras
    feriasParams, setFeriasParams, resultadoFerias,
    tempoEmpresaParams, setTempoEmpresaParams, resultadoTempoEmpresa,
    encargosParams, setEncargosParams, resultadoEncargos,
    contratacaoParams, setContratacaoParams, resultadoContratacao,
    comparativoRegimeParams, setComparativoRegimeParams, resultadoComparativoRegime,
    simulacaoImpostoParams, setSimulacaoImpostoParams, resultadoSimulacaoImposto,
    simulacaoCustosParams, setSimulacaoCustosParams, resultadoCustos,
    tiposEmpresaAtivos,
    naturezasJuridicasAtivas,
    activeTipoEmpresa,
    activeNaturezaJuridica,
  } = useSimulacoesCalculos();

  const { title, desc } = PAGE_TITLES[abaAtiva];

  // Estados do Modal de PDF e exportação
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);
  const [marcaDagua, setMarcaDagua] = useState<any>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [shareExpires, setShareExpires] = useState('24h');
  const [sharePasswordRequired, setSharePasswordRequired] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadState, setDownloadState] = useState<'idle' | 'generating' | 'done'>('idle');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pdfGeneratedAt, setPdfGeneratedAt] = useState(() => new Date());
  const [shareNotice, setShareNotice] = useState('');

  useEffect(() => {
    empresaService.getDadosEmpresa().then(setEmpresa).catch(console.error);
    marcaDaguaService.getMarcaDaguaConfig().then(setMarcaDagua).catch(console.error);
  }, []);

  const getPdfMetricLines = () => {
    switch (abaAtiva) {
      case 'folha':
        return [
          `Salario liquido estimado: ${formatCurrency(resultadoFolha.salarioLiquido)}`,
          `Custo empregador: ${formatCurrency(resultadoFolha.custoEmpregador)}`,
          `Descontos funcionario: ${formatCurrency(resultadoFolha.descontosFuncionario)}`,
        ];
      case 'rescisao':
        return [
          `Total liquido estimado: ${formatCurrency(resultadoRescisao.totalLiquido)}`,
          `Total bruto: ${formatCurrency(resultadoRescisao.totalBruto)}`,
          `Salario base de calculo: ${formatCurrency(resultadoRescisao.salarioBaseCalculo)}`,
        ];
      case 'prolabore':
        return [
          `Liquido do socio: ${formatCurrency(resultadoProLabore.liquido)}`,
          `INSS retido: ${formatCurrency(resultadoProLabore.inss)}`,
          `IRRF retido: ${formatCurrency(resultadoProLabore.irrf)}`,
        ];
      case 'ferias':
        return [
          `Total liquido de ferias: ${formatCurrency(resultadoFerias.totalLiquido)}`,
          `Total bruto: ${formatCurrency(resultadoFerias.totalBruto)}`,
          `Custo empresa: ${formatCurrency(resultadoFerias.custoEmpresa)}`,
        ];
      case 'tempo-empresa':
        return [
          `Tempo apurado: ${resultadoTempoEmpresa.anos} anos, ${resultadoTempoEmpresa.meses} meses e ${resultadoTempoEmpresa.dias} dias`,
          `Custo acumulado: ${formatCurrency(resultadoTempoEmpresa.custoTotalAcumulado)}`,
          `FGTS acumulado: ${formatCurrency(resultadoTempoEmpresa.fgtsAcumulado)}`,
        ];
      case 'encargos-trabalhistas':
        return [
          `Total encargos: ${formatCurrency(resultadoEncargos.totalEncargosValor)}`,
          `Percentual total: ${formatPercent(resultadoEncargos.totalPercentual)}`,
          `Regime informado: ${encargosParams.regimeEmpresa}`,
        ];
      case 'simulacao-contratacao':
        return [
          `Custo CLT mensal: ${formatCurrency(resultadoContratacao.custoCltMensal)}`,
          `Custo PJ mensal: ${formatCurrency(resultadoContratacao.custoPjMensal)}`,
          `Custo estagio mensal: ${formatCurrency(resultadoContratacao.custoEstagioMensal)}`,
        ];
      case 'das':
        return [
          `DAS estimado: ${formatCurrency(resultadoDAS.valorDAS)}`,
          `Aliquota efetiva: ${formatPercent(resultadoDAS.aliquotaEfetiva)}`,
          `Faixa: ${resultadoDAS.faixaNumero}`,
        ];
      case 'piscofins':
        return [
          `Total PIS/COFINS a recolher: ${formatCurrency(resultadoPisCofins.totalPagar)}`,
          `Saldo PIS: ${formatCurrency(resultadoPisCofins.saldoPIS)}`,
          `Saldo COFINS: ${formatCurrency(resultadoPisCofins.saldoCOFINS)}`,
        ];
      case 'multas':
        return [
          `Total a pagar: ${formatCurrency(resultadoMultas.totalPagar)}`,
          `Dias de atraso: ${resultadoMultas.diasAtraso}`,
          `Acrescimos: ${formatCurrency(resultadoMultas.multaValor + resultadoMultas.jurosValor)}`,
        ];
      case 'comparativo-regime':
        return [
          `Melhor opcao estimada: ${resultadoComparativoRegime.melhorOpcao}`,
          `Simples Nacional: ${formatCurrency(resultadoComparativoRegime.simplesNacional)}`,
          `Lucro Presumido: ${formatCurrency(resultadoComparativoRegime.lucroPresumido)}`,
          `Lucro Real: ${formatCurrency(resultadoComparativoRegime.lucroReal)}`,
        ];
      case 'simulacao-imposto':
        return [
          `Imposto total: ${formatCurrency(resultadoSimulacaoImposto.impostoTotal)}`,
          `Aliquota efetiva: ${formatPercent(resultadoSimulacaoImposto.aliquotaEfetiva)}`,
          `Atividade: ${simulacaoImpostoParams.tipoAtividade}`,
        ];
      case 'simulacao-custos':
        return [
          `Ponto de equilibrio: ${formatCurrency(resultadoCustos.pontoEquilibrio)}`,
          `Faturamento alvo: ${formatCurrency(resultadoCustos.faturamentoAlvo)}`,
          `Lucro estimado: ${formatCurrency(resultadoCustos.lucroEstimado)}`,
        ];
      default:
        return [];
    }
  };

  const getPdfSummaryLines = (generatedAt: Date) => [
    `${SYSTEM_NAME} - ${title}`,
    `Gerado em: ${formatGeneratedDateTime(generatedAt)}`,
    `Empresa emissora: ${empresa?.razaoSocial || empresa?.nomeFantasia || SYSTEM_NAME}`,
    `CNPJ: ${empresa?.cnpj || 'Nao informado'}`,
    '',
    `Modulo: Simulacoes e Calculos`,
    `Calculadora: ${title}`,
    ...getPdfMetricLines(),
    '',
    'SIMULACAO GERENCIAL',
    'Este arquivo e uma simulacao gerencial gerada pelo Arkhen Gestao Contabil.',
    'Os valores podem sofrer variacoes conforme dados oficiais, CCT/ACT, tabelas vigentes e conferencia final.',
  ].filter(Boolean);

  const handleOpenPdfModal = () => {
    const now = new Date();
    setPdfGeneratedAt(now);
    setGeneratedLink('');
    setShareNotice('');
    setIsSharing(false);
    setIsPdfModalOpen(true);
  };

  const handleGenerateShareLink = () => {
    const now = new Date();
    const randomId = `${abaAtiva}_${Math.random().toString(36).substring(2, 10)}`;
    const durationLabel = formatShareExpiryLabel(shareExpires);
    const expiresAt = getShareExpiryDate(shareExpires, now);
    const pdfDataUrl = buildSimplePdfDataUrl(getPdfSummaryLines(now));
    const payload = {
      id: randomId,
      documento: `Simulacao_${abaAtiva}_${now.toISOString().slice(0, 10)}.pdf`,
      empresa: empresa?.razaoSocial || empresa?.nomeFantasia || SYSTEM_NAME,
      tempoLimite: durationLabel,
      dataGeracao: formatGeneratedDateTime(now),
      dataExpiracao: formatGeneratedDateTime(expiresAt),
      arquivoUrl: pdfDataUrl,
    };
    const encodedPayload = encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)));
    const link = `${window.location.origin}/shared/d/${randomId}#${encodedPayload}`;
    setGeneratedLink(link);
    setShareNotice(sharePasswordRequired
      ? 'Link criado. A proteção por senha ainda não é aplicada em simulações; use compartilhamento de documentos para senha real.'
      : 'Link interno criado para visualização pública do relatório.');
    setCopiedLink(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setDownloadState('generating');
    const docName = `Simulacao_${abaAtiva}_Arkhen.pdf`;
    const downloadFallbackPdf = () => {
      const url = buildSimplePdfDataUrl(getPdfSummaryLines(pdfGeneratedAt));
      const link = document.createElement('a');
      link.href = url;
      link.download = docName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    try {
      const element = document.getElementById('simulation-pdf-document');
      if (!element) {
        downloadFallbackPdf();
        return;
      }

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        height: element.scrollHeight,
        scale: 2,
        useCORS: true,
        width: element.scrollWidth,
        windowHeight: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let remainingHeight = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      remainingHeight -= pageHeight;

      while (remainingHeight > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        remainingHeight -= pageHeight;
      }

      pdf.save(docName);
    } catch (error) {
      console.error('Erro ao gerar PDF visual, usando fallback textual.', error);
      downloadFallbackPdf();
    } finally {
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 2000);
    }
  };

  const handleDiscardPdf = () => {
    setShowDiscardConfirm(true);
  };

  const confirmDiscardPdf = () => {
    setIsPdfModalOpen(false);
    setGeneratedLink('');
    setShareNotice('');
    setIsSharing(false);
    setSharePasswordRequired(false);
    setSharePassword('');
    setShowDiscardConfirm(false);
  };

  const renderPdfContent = () => {
    if (abaAtiva === 'folha') {
      return <FolhaPdfModelo params={folhaParams} resultado={resultadoFolha} />;
    }
    if (abaAtiva === 'rescisao') {
      return <RescisaoPdfModelo params={rescisaoParams} resultado={resultadoRescisao} />;
    }
    if (abaAtiva === 'prolabore') {
      return <ProLaborePdfModelo valor={prolaboreValor} resultado={resultadoProLabore} />;
    }
    if (abaAtiva === 'ferias') {
      return <FeriasPdfModelo params={feriasParams} resultado={resultadoFerias} />;
    }
    if (abaAtiva === 'tempo-empresa') {
      return <TempoEmpresaPdfModelo params={tempoEmpresaParams} resultado={resultadoTempoEmpresa} />;
    }
    if (abaAtiva === 'encargos-trabalhistas') {
      return <EncargosPdfModelo params={encargosParams} resultado={resultadoEncargos} />;
    }
    if (abaAtiva === 'simulacao-contratacao') {
      return <ContratacaoPdfModelo params={contratacaoParams} resultado={resultadoContratacao} />;
    }
    if (abaAtiva === 'das') {
      return <DasPdfModelo params={dasParams} resultado={resultadoDAS} />;
    }
    if (abaAtiva === 'piscofins') {
      return <PisCofinsPdfModelo params={pisParams} resultado={resultadoPisCofins} />;
    }
    if (abaAtiva === 'multas') {
      return <MultasPdfModelo params={multasParams} resultado={resultadoMultas} />;
    }
    if (abaAtiva === 'comparativo-regime') {
      return <ComparativoRegimePdfModelo params={comparativoRegimeParams} resultado={resultadoComparativoRegime} />;
    }
    if (abaAtiva === 'simulacao-imposto') {
      return <SimulacaoImpostoPdfModelo params={simulacaoImpostoParams} resultado={resultadoSimulacaoImposto} />;
    }
    if (abaAtiva === 'simulacao-custos') {
      return <CustosPdfModelo params={simulacaoCustosParams} resultado={resultadoCustos} />;
    }

    switch (abaAtiva) {
      case 'folha':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DADOS DA SIMULAÇÃO</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ paddingTop: '6px', paddingBottom: '6px', fontWeight: 600, color: '#64748b' }}>Tipo de Funcionário</th><td style={{ paddingTop: '6px', paddingBottom: '6px', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{folhaParams.tipoFuncionario.toUpperCase()}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ paddingTop: '6px', paddingBottom: '6px', fontWeight: 600, color: '#64748b' }}>Competência</th><td style={{ paddingTop: '6px', paddingBottom: '6px', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCompetencia(folhaParams.competencia)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ paddingTop: '6px', paddingBottom: '6px', fontWeight: 600, color: '#64748b' }}>Região</th><td style={{ paddingTop: '6px', paddingBottom: '6px', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{folhaParams.regiao.toUpperCase()}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ paddingTop: '6px', paddingBottom: '6px', fontWeight: 600, color: '#64748b' }}>Salário Bruto</th><td style={{ paddingTop: '6px', paddingBottom: '6px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(folhaParams.salarioBruto))}</td></tr>
                {resultadoFolha.adicionalTempoServico > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ paddingTop: '6px', paddingBottom: '6px', fontWeight: 600, color: '#64748b' }}>Adicional Tempo Serviço</th><td style={{ paddingTop: '6px', paddingBottom: '6px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(resultadoFolha.adicionalTempoServico)}</td></tr>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ paddingTop: '6px', paddingBottom: '6px', fontWeight: 600, color: '#64748b' }}>Dependentes</th><td style={{ paddingTop: '6px', paddingBottom: '6px', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{folhaParams.dependentes}</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>DEMONSTRATIVO DE PROVENTOS E DESCONTOS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}><th style={{ padding: '6px 8px', fontWeight: 700, color: '#475569' }}>Rubrica / Descrição</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Proventos</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Descontos</th></tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>Salário Base</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(parseCurrencyInputValue(folhaParams.salarioBruto))}</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td></tr>
                {resultadoFolha.adicionalTempoServico > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>Adicional Tempo Serviço</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(resultadoFolha.adicionalTempoServico)}</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td></tr>
                )}
                {resultadoFolha.salarioFamilia > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>Salário Família</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(resultadoFolha.salarioFamilia)}</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td></tr>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>INSS Retido</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td><td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultadoFolha.inss)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>IRRF Retido</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td><td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultadoFolha.irrf)}</td></tr>
                {resultadoFolha.faltas > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>Desconto Faltas</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td><td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultadoFolha.faltas)}</td></tr>
                )}
                {resultadoFolha.valeTransporteDesconto > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>VT Desconto</td><td style={{ padding: '8px', textAlign: 'right', color: '#94a3b8' }}>-</td><td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{formatCurrency(resultadoFolha.valeTransporteDesconto)}</td></tr>
                )}
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 600, color: '#64748b' }}>Salário Líquido:</span><span style={{ fontWeight: 700, color: '#10b981', fontSize: '0.88rem' }}>{formatCurrency(resultadoFolha.salarioLiquido)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 600, color: '#64748b' }}>Encargos Empresa (FGTS/SAT/FAP):</span><span style={{ fontWeight: 600, color: '#334155' }}>{formatCurrency(resultadoFolha.encargosEmpresa)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}><span style={{ fontWeight: 700, color: '#334155' }}>Custo Total Empregador:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '0.88rem' }}>{formatCurrency(resultadoFolha.custoEmpregador)}</span></div>
            </div>
          </div>
        );

      case 'rescisao':
        return (
          <RescisaoPdfModelo params={rescisaoParams} resultado={resultadoRescisao} />
        );

      case 'prolabore':
        const estimatedCpp = resultadoProLabore.valorProLabore * 0.20;
        const estimatedCustoTotal = resultadoProLabore.valorProLabore * 1.20;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DADOS DO PRÓ-LABORE</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Pró-Labore Bruto</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(resultadoProLabore.valorProLabore)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>INSS Retido (11%)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>-{formatCurrency(resultadoProLabore.inss)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>IRRF Retido</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>-{formatCurrency(resultadoProLabore.irrf)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Líquido a Receber pelo Sócio:</span><span style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{formatCurrency(resultadoProLabore.liquido)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 600, color: '#64748b' }}>Previdência Patronal (CPP 20%):</span><span style={{ fontWeight: 500, color: '#334155' }}>{formatCurrency(estimatedCpp)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}><span style={{ fontWeight: 700, color: '#334155' }}>Custo Total para a Empresa:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1rem' }}>{formatCurrency(estimatedCustoTotal)}</span></div>
            </div>
          </div>
        );

      case 'das':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>PLANEJAMENTO TRIBUTÁRIO - SIMPLES NACIONAL</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Mensal Simulado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(dasParams.faturamentoMensal))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Acumulado (12 Meses)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoDAS.faturamento12Meses)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Anexo Enquadrado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#c59235' }}>Anexo {dasParams.anexo}</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>DETALHAMENTO DO IMPOSTO DAS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Alíquota Nominal da Faixa</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatPercent(resultadoDAS.aliquotaNominal * 100)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Parcela a Deduzir da Faixa</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoDAS.valorDeduzir)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fef3c7' }}><th style={{ padding: '8px', fontWeight: 700, color: '#78350f' }}>Alíquota Efetiva Calculada</th><td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#c59235' }}>{formatPercent(resultadoDAS.aliquotaEfetiva * 100)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Valor do DAS Guia Unificada:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1.1rem' }}>{formatCurrency(resultadoDAS.valorDAS)}</span></div>
            </div>
          </div>
        );

      case 'piscofins':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>SIMULAÇÃO DE PIS E COFINS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Regime do Cálculo</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{pisParams.regime.toUpperCase()}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Bruto</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(resultadoPisCofins.faturamento)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Créditos de Entrada de Insumos</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(pisParams.creditosEntrada))}</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>APURAÇÃO DOS TRIBUTOS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}><th style={{ padding: '6px 8px', fontWeight: 700, color: '#475569' }}>Imposto</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Débito</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Créditos</th><th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Saldo a Pagar</th></tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>PIS</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(resultadoPisCofins.debitoPIS)}</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(resultadoPisCofins.debitoPIS - resultadoPisCofins.saldoPIS)}</td><td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{formatCurrency(resultadoPisCofins.saldoPIS)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px', fontWeight: 500, color: '#334155' }}>COFINS</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(resultadoPisCofins.debitoCOFINS)}</td><td style={{ padding: '8px', textAlign: 'right', color: '#334155' }}>{formatCurrency(resultadoPisCofins.debitoCOFINS - resultadoPisCofins.saldoCOFINS)}</td><td style={{ padding: '8px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{formatCurrency(resultadoPisCofins.saldoCOFINS)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 600, color: '#64748b' }}>Total de Créditos de Insumos:</span><span style={{ fontWeight: 500, color: '#334155' }}>{formatCurrency(resultadoPisCofins.creditosApurados)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}><span style={{ fontWeight: 700, color: '#334155' }}>Total de Impostos PIS/COFINS a Recolher:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1rem' }}>{formatCurrency(resultadoPisCofins.totalPagar)}</span></div>
            </div>
          </div>
        );

      case 'multas':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>CÁLCULO DE DARF EM ATRASO</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Valor Original da Guia</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(resultadoMultas.valorOriginal)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Data de Vencimento</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{multasParams.dataVencimento}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Data de Pagamento</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{multasParams.dataPagamento}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Dias de Atraso</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{resultadoMultas.diasAtraso} dias</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>ACRÉSCIMOS LEGAIS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Multa de Mora ({formatPercent(resultadoMultas.multaPercentual)})</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>{formatCurrency(resultadoMultas.multaValor)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Juros de Mora SELIC ({formatPercent(resultadoMultas.jurosPercentual)})</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>{formatCurrency(resultadoMultas.jurosValor)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Total Consolidado a Pagar:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1.1rem' }}>{formatCurrency(resultadoMultas.totalPagar)}</span></div>
            </div>
          </div>
        );

      case 'ferias':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DADOS DE FÉRIAS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Salário Bruto</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(feriasParams.salarioBruto))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Dias de Férias</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{feriasParams.diasFerias} dias</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Abono Pecuniário</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{feriasParams.abonoPecuniario ? 'Sim' : 'Não'}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Adiantamento 13º</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{feriasParams.adiantamento13 ? 'Sim' : 'Não'}</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>VERBAS CONSTITUCIONAIS E DESCONTOS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Valor das Férias</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoFerias.valorFerias)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Terço Constitucional (1/3)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoFerias.tercoConstitucional)}</td></tr>
                {resultadoFerias.abonoPecuniario > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Abono Pecuniário</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoFerias.abonoPecuniario)}</td></tr>
                )}
                {resultadoFerias.tercoAbono > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Terço do Abono</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoFerias.tercoAbono)}</td></tr>
                )}
                {resultadoFerias.adiantamento13 > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Adiantamento 13º Salário</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoFerias.adiantamento13)}</td></tr>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>INSS Retido</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>-{formatCurrency(resultadoFerias.inss)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>IRRF Retido</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>-{formatCurrency(resultadoFerias.irrf)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Líquido de Férias a Receber:</span><span style={{ fontWeight: 800, color: '#10b981', fontSize: '1.1rem' }}>{formatCurrency(resultadoFerias.totalLiquido)}</span></div>
            </div>
          </div>
        );

      case 'tempo-empresa':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DADOS CONTRATUAIS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Salário Base</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(tempoEmpresaParams.salarioBase))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Data de Admissão</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{tempoEmpresaParams.dataAdmissao}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Data de Referência</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{tempoEmpresaParams.dataReferencia}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Tempo Decorrido</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#334155' }}>{resultadoTempoEmpresa.anos} anos, {resultadoTempoEmpresa.meses} meses, {resultadoTempoEmpresa.dias} dias</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>PROVISÕES ACUMULADAS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Provisão de 13º Salário</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoTempoEmpresa.provisao13)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Provisão de Férias (+ 1/3)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoTempoEmpresa.provisaoFerias + resultadoTempoEmpresa.provisaoTerco)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>FGTS Acumulado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoTempoEmpresa.fgtsAcumulado)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Multa FGTS Projetada</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>{formatCurrency(resultadoTempoEmpresa.multaFgtsProjetada)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Total do Passivo Acumulado:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1.1rem' }}>{formatCurrency(resultadoTempoEmpresa.custoTotalAcumulado)}</span></div>
            </div>
          </div>
        );

      case 'encargos-trabalhistas':
        const totalMensalComEncargos = parseCurrencyInputValue(encargosParams.salarioBruto) + resultadoEncargos.totalEncargosValor;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>PARÂMETROS DA EMPRESA</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Salário Bruto Analisado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(encargosParams.salarioBruto))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Regime de Enquadramento</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{encargosParams.regimeEmpresa.toUpperCase()}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Alíquota RAT / FAP / Terceiros</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{encargosParams.rat}% / {encargosParams.fap} / {encargosParams.terceiros}%</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>DETALHAMENTO DOS ENCARGOS PATRONAIS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>FGTS (Fundo de Garantia)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoEncargos.fgts)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>INSS Patronal Previdenciário</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoEncargos.inssPatronal)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>RAT Ajustado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoEncargos.ratAjustado)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Outras Entidades (Terceiros)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoEncargos.terceirosValor)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Provisões (Férias, 13º e Encargos)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoEncargos.provisaoFerias13)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 600, color: '#64748b' }}>Total de Encargos ({resultadoEncargos.totalPercentual.toFixed(2)}%):</span><span style={{ fontWeight: 600, color: '#334155' }}>{formatCurrency(resultadoEncargos.totalEncargosValor)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}><span style={{ fontWeight: 700, color: '#334155' }}>Custo Mensal Consolidado:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1rem' }}>{formatCurrency(totalMensalComEncargos)}</span></div>
            </div>
          </div>
        );

      case 'simulacao-contratacao':
        const diffCltPj = resultadoContratacao.custoCltMensal - resultadoContratacao.custoPjMensal;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>CUSTOS PROPOSTOS E BENEFÍCIOS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Salário Bruto Proposto</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(contratacaoParams.salarioProposto))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Benefícios (VT/VR/Saúde)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(contratacaoParams.valeTransporte) + parseCurrencyInputValue(contratacaoParams.valeAlimentacao) + parseCurrencyInputValue(contratacaoParams.planoSaude))}</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>COMPARAÇÃO DE CUSTO REAL MENSAL</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Custo CLT Total (Com Encargos)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(resultadoContratacao.custoCltMensal)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Custo Prestador de Serviços PJ</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{formatCurrency(resultadoContratacao.custoPjMensal)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Custo Estagiário</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(resultadoContratacao.custoEstagioMensal)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Diferencial CLT vs PJ:</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1.1rem' }}>{formatCurrency(diffCltPj)} / mês</span></div>
            </div>
          </div>
        );

      case 'comparativo-regime':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>PROJEÇÕES ANUAIS DA EMPRESA</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Projetado Anual</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(comparativoRegimeParams.faturamentoAnual))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Compras e Insumos Anual</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(comparativoRegimeParams.comprasInsumosAnual))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Folha de Pagamento Anual</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(comparativoRegimeParams.folhaAnual))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Margem Operacional</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{comparativoRegimeParams.margemLucro}%</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>COMPARAÇÃO DE CARGA TRIBUTÁRIA CONSOLIDADA</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Simples Nacional (Imposto Anual)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{formatCurrency(resultadoComparativoRegime.simplesNacional)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Lucro Presumido (Imposto Anual)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{formatCurrency(resultadoComparativoRegime.lucroPresumido)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Lucro Real (Imposto Anual)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{formatCurrency(resultadoComparativoRegime.lucroReal)}</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>REGIME TRIBUTÁRIO RECOMENDADO:</span><span style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{resultadoComparativoRegime.melhorOpcao.toUpperCase()}</span></div>
            </div>
          </div>
        );

      case 'simulacao-imposto':
        const faturamentoLiquido = parseCurrencyInputValue(simulacaoImpostoParams.faturamentoMensal) - resultadoSimulacaoImposto.impostoTotal;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DETALHES DO FATURAMENTO MENSAL</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Bruto Mensal</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(simulacaoImpostoParams.faturamentoMensal))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Tipo de Atividade</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{simulacaoImpostoParams.tipoAtividade.toUpperCase()}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Alíquota Estimada</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{simulacaoImpostoParams.aliquotaEstimada}%</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>IMPOSTOS ESTIMADOS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Imposto Total Mensal</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(resultadoSimulacaoImposto.impostoTotal)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Líquido Mensal</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatCurrency(faturamentoLiquido)}</td></tr>
              </tbody>
            </table>
          </div>
        );

      case 'simulacao-custos':
        const faturamentoMinimoDiario = resultadoCustos.pontoEquilibrio / 30;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DETALHES DE GASTOS OPERACIONAIS</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Custos Fixos Mensais</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(parseCurrencyInputValue(simulacaoCustosParams.custosFixos))}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Custos Variáveis (%)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{simulacaoCustosParams.custosVariaveisPercentual}%</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Markup Desejado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{simulacaoCustosParams.markupDesejado}%</td></tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>ESTUDO DE VIABILIDADE FINANCEIRA</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Margem de Contribuição</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{formatPercent(resultadoCustos.margemContribuicaoPercentual)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Faturamento Mínimo Diário (Est.)</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{formatCurrency(faturamentoMinimoDiario)}</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Markup Desejado Aplicado</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{simulacaoCustosParams.markupDesejado}%</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}><span style={{ fontWeight: 700, color: '#334155' }}>Ponto de Equilíbrio (Break-Even Mensal):</span><span style={{ fontWeight: 800, color: '#c59235', fontSize: '1.1rem' }}>{formatCurrency(resultadoCustos.pontoEquilibrio)}</span></div>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: 0 }}>DETALHAMENTO DOS PARÂMETROS</h4>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}>
              <p style={{ color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Relatório de simulação para a aba <strong>{title}</strong>. Todos os cálculos foram computados de acordo com as diretrizes fiscais e trabalhistas parametrizadas no sistema.
              </p>
            </div>
            
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px', margin: '12px 0 0 0' }}>INDICADORES DE PROJEÇÃO</h4>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Status do Documento</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>PROCESSADO</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Origem</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>MÓDULO SIMULAÇÕES</td></tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}><th style={{ padding: '8px 0', fontWeight: 600, color: '#64748b' }}>Escritório Emissor</th><td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, color: '#0f172a' }}>{empresa?.nomeFantasia || SYSTEM_NAME}</td></tr>
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="simulacoes-container animate-fade-in" style={{ flexDirection: 'row-reverse' }}>
      <div className="simulacoes-sidebar" style={{ width: '220px', borderLeft: '1px solid #e2e8f0', background: '#fff', overflowY: 'auto', paddingTop: '20px', flexShrink: 0, paddingLeft: '12px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 14px', lineHeight: '1.3' }}>
            Trabalhistas &<br/>Operacionais
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {TRABALHISTA_NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setAbaAtiva(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px',
                  border: 'none', background: abaAtiva === item.id ? '#f1f5f9' : 'transparent',
                  color: abaAtiva === item.id ? '#0f172a' : '#64748b',
                  fontWeight: abaAtiva === item.id ? 600 : 500,
                  fontSize: '0.80rem', cursor: 'pointer', textAlign: 'left',
                  borderRadius: '16px 0 0 16px', borderRight: abaAtiva === item.id ? '3px solid #c59235' : '3px solid transparent',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ color: abaAtiva === item.id ? '#c59235' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(0.95)' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 14px', lineHeight: '1.3' }}>
            Fiscais &<br/>Planejamento
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {FISCAL_NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setAbaAtiva(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px',
                  border: 'none', background: abaAtiva === item.id ? '#f1f5f9' : 'transparent',
                  color: abaAtiva === item.id ? '#0f172a' : '#64748b',
                  fontWeight: abaAtiva === item.id ? 600 : 500,
                  fontSize: '0.80rem', cursor: 'pointer', textAlign: 'left',
                  borderRadius: '16px 0 0 16px', borderRight: abaAtiva === item.id ? '3px solid #c59235' : '3px solid transparent',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ color: abaAtiva === item.id ? '#c59235' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(0.95)' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="simulacoes-main">
        <div className="simulacoes-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              <Calculator size={20} style={{ color: '#c59235' }} />
              {title}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>{desc}</p>
          </div>
          <button
            onClick={handleOpenPdfModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#c59235',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(197, 146, 53, 0.15)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#a67a2b';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#c59235';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <FileDown size={16} />
            Exportar PDF
          </button>
        </div>

        <div key={abaAtiva} style={{ animation: 'fadeInTab 0.22s ease' }}>
          {abaAtiva === 'folha' && (
            <SimuladorFolha params={folhaParams} setParams={setFolhaParams} resultado={resultadoFolha} />
          )}
          {abaAtiva === 'rescisao' && (
            <SimuladorRescisao params={rescisaoParams} setParams={setRescisaoParams} resultado={resultadoRescisao} tiposRescisao={tiposRescisao} />
          )}
          {abaAtiva === 'prolabore' && (
            <SimuladorProLabore valor={prolaboreValor} setValor={setProlaboreValor} resultado={resultadoProLabore} />
          )}
          {abaAtiva === 'das' && (
            <SimuladorDAS params={dasParams} setParams={setDasParams} resultado={resultadoDAS} anexosDas={anexosDas} />
          )}
          {abaAtiva === 'piscofins' && (
            <SimuladorPisCofins params={pisParams} setParams={setPisParams} resultado={resultadoPisCofins} regimesPisCofins={regimesPisCofins} />
          )}
          {abaAtiva === 'multas' && (
            <SimuladorMultas params={multasParams} setParams={setMultasParams} resultado={resultadoMultas} />
          )}
          
          {/* Novas abas */}
          {abaAtiva === 'ferias' && (
            <SimuladorFerias
              salarioBruto={feriasParams.salarioBruto} setSalarioBruto={(v) => setFeriasParams({...feriasParams, salarioBruto: v})}
              diasFerias={feriasParams.diasFerias} setDiasFerias={(v) => setFeriasParams({...feriasParams, diasFerias: v})}
              abonoPecuniario={feriasParams.abonoPecuniario} setAbonoPecuniario={(v) => setFeriasParams({...feriasParams, abonoPecuniario: v})}
              adiantamento13={feriasParams.adiantamento13} setAdiantamento13={(v) => setFeriasParams({...feriasParams, adiantamento13: v})}
              dependentes={feriasParams.dependentes} setDependentes={(v) => setFeriasParams({...feriasParams, dependentes: v})}
              resultado={resultadoFerias}
            />
          )}
          {abaAtiva === 'tempo-empresa' && (
            <SimuladorTempoEmpresa
              dataAdmissao={tempoEmpresaParams.dataAdmissao} setDataAdmissao={(v) => setTempoEmpresaParams({...tempoEmpresaParams, dataAdmissao: v})}
              dataReferencia={tempoEmpresaParams.dataReferencia} setDataReferencia={(v) => setTempoEmpresaParams({...tempoEmpresaParams, dataReferencia: v})}
              salarioBase={tempoEmpresaParams.salarioBase} setSalarioBase={(v) => setTempoEmpresaParams({...tempoEmpresaParams, salarioBase: v})}
              resultado={resultadoTempoEmpresa}
            />
          )}
          {abaAtiva === 'encargos-trabalhistas' && (
            <SimuladorEncargos
              salarioBruto={encargosParams.salarioBruto} setSalarioBruto={(v) => setEncargosParams({...encargosParams, salarioBruto: v})}
              regimeEmpresa={encargosParams.regimeEmpresa} setRegimeEmpresa={(v) => setEncargosParams({...encargosParams, regimeEmpresa: v})}
              rat={encargosParams.rat} setRat={(v) => setEncargosParams({...encargosParams, rat: v})}
              fap={encargosParams.fap} setFap={(v) => setEncargosParams({...encargosParams, fap: v})}
              terceiros={encargosParams.terceiros} setTerceiros={(v) => setEncargosParams({...encargosParams, terceiros: v})}
              resultado={resultadoEncargos}
            />
          )}
          {abaAtiva === 'simulacao-contratacao' && (
            <SimuladorContratacao
              salarioProposto={contratacaoParams.salarioProposto} setSalarioProposto={(v) => setContratacaoParams({...contratacaoParams, salarioProposto: v})}
              valeTransporte={contratacaoParams.valeTransporte} setValeTransporte={(v) => setContratacaoParams({...contratacaoParams, valeTransporte: v})}
              valeAlimentacao={contratacaoParams.valeAlimentacao} setValeAlimentacao={(v) => setContratacaoParams({...contratacaoParams, valeAlimentacao: v})}
              planoSaude={contratacaoParams.planoSaude} setPlanoSaude={(v) => setContratacaoParams({...contratacaoParams, planoSaude: v})}
              resultado={resultadoContratacao}
            />
          )}
          {abaAtiva === 'comparativo-regime' && (
            <SimuladorComparativoRegime
              faturamentoAnual={comparativoRegimeParams.faturamentoAnual} setFaturamentoAnual={(v) => setComparativoRegimeParams({...comparativoRegimeParams, faturamentoAnual: v})}
              comprasInsumosAnual={comparativoRegimeParams.comprasInsumosAnual} setComprasInsumosAnual={(v) => setComparativoRegimeParams({...comparativoRegimeParams, comprasInsumosAnual: v})}
              folhaAnual={comparativoRegimeParams.folhaAnual} setFolhaAnual={(v) => setComparativoRegimeParams({...comparativoRegimeParams, folhaAnual: v})}
              margemLucro={comparativoRegimeParams.margemLucro} setMargemLucro={(v) => setComparativoRegimeParams({...comparativoRegimeParams, margemLucro: v})}
              tipoEmpresa={activeTipoEmpresa} setTipoEmpresa={(v) => setComparativoRegimeParams({...comparativoRegimeParams, tipoEmpresa: v})}
              naturezaJuridica={activeNaturezaJuridica} setNaturezaJuridica={(v) => setComparativoRegimeParams({...comparativoRegimeParams, naturezaJuridica: v})}
              tiposEmpresaOptions={tiposEmpresaAtivos}
              naturezasJuridicasOptions={naturezasJuridicasAtivas}
              resultado={resultadoComparativoRegime}
            />
          )}
          {abaAtiva === 'simulacao-imposto' && (
            <SimuladorImposto
              faturamentoMensal={simulacaoImpostoParams.faturamentoMensal} setFaturamentoMensal={(v) => setSimulacaoImpostoParams({...simulacaoImpostoParams, faturamentoMensal: v})}
              tipoAtividade={simulacaoImpostoParams.tipoAtividade} setTipoAtividade={(v) => setSimulacaoImpostoParams({...simulacaoImpostoParams, tipoAtividade: v})}
              aliquotaEstimada={simulacaoImpostoParams.aliquotaEstimada} setAliquotaEstimada={(v) => setSimulacaoImpostoParams({...simulacaoImpostoParams, aliquotaEstimada: v})}
              resultado={resultadoSimulacaoImposto}
            />
          )}
          {abaAtiva === 'simulacao-custos' && (
            <SimuladorCustos
              custosFixos={simulacaoCustosParams.custosFixos} setCustosFixos={(v) => setSimulacaoCustosParams({...simulacaoCustosParams, custosFixos: v})}
              custosVariaveisPercentual={simulacaoCustosParams.custosVariaveisPercentual} setCustosVariaveisPercentual={(v) => setSimulacaoCustosParams({...simulacaoCustosParams, custosVariaveisPercentual: v})}
              markupDesejado={simulacaoCustosParams.markupDesejado} setMarkupDesejado={(v) => setSimulacaoCustosParams({...simulacaoCustosParams, markupDesejado: v})}
              resultado={resultadoCustos}
            />
          )}
        </div>

        {/* Modal Imersivo de Exportação de PDF e Compartilhamento */}
        {isPdfModalOpen && (
          <div className="simulation-export-backdrop">
            <div
              className="simulation-export-modal"
              style={{ animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              
              {/* Painel Esquerdo: Visualização do PDF gerado com Cabeçalho e Marca D'água */}
              <div className="simulation-export-preview">
              <div id="simulation-pdf-document" className="simulation-pdf-page">
                
                {/* Marca d'água Configurada */}
                {marcaDagua?.habilitado && (marcaDagua.fileUrlRetrato || marcaDagua.fileUrlPaisagem || marcaDagua.fileUrl) && (() => {
                  const watermarkUrl = marcaDagua.fileUrlRetrato || marcaDagua.fileUrl || marcaDagua.fileUrlPaisagem;
                  const sizeVal = marcaDagua.tamanhoRetrato ?? marcaDagua.tamanho ?? 35;
                  const activePos = marcaDagua.posicaoRetrato ?? marcaDagua.posicao ?? 'centro';
                  const activeOpacity = marcaDagua.opacidadeRetrato ?? marcaDagua.opacidade ?? 15;
                  
                  let positionStyle: React.CSSProperties = {};
                  if (activePos === 'centro' || !activePos) {
                    positionStyle = {
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      maxWidth: `${sizeVal}%`,
                      maxHeight: `${sizeVal}%`,
                    };
                  } else if (activePos === 'topo-esquerda') {
                    positionStyle = {
                      top: '24px',
                      left: '24px',
                      maxWidth: `${sizeVal * 0.6}%`,
                      maxHeight: `${sizeVal * 0.6}%`,
                    };
                  } else if (activePos === 'topo-direita') {
                    positionStyle = {
                      top: '24px',
                      right: '24px',
                      maxWidth: `${sizeVal * 0.6}%`,
                      maxHeight: `${sizeVal * 0.6}%`,
                    };
                  } else if (activePos === 'rodape-direita') {
                    positionStyle = {
                      bottom: '24px',
                      right: '24px',
                      maxWidth: `${sizeVal * 0.6}%`,
                      maxHeight: `${sizeVal * 0.6}%`,
                    };
                  }

                  return (
                    <img 
                      src={watermarkUrl!} 
                      alt="Marca d'Água" 
                      style={{
                        position: 'absolute',
                        opacity: activeOpacity / 100,
                        pointerEvents: 'none',
                        objectFit: 'contain',
                        mixBlendMode: 'multiply',
                        zIndex: 0,
                        ...positionStyle
                      }}
                    />
                  );
                })()}

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
                  {/* Cabeçalho do PDF */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    borderBottom: '2px solid #c59235',
                    paddingBottom: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'stretch', gap: '18px', width: '100%' }}>
                      {empresa?.logoUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <img
                            src={empresa.logoUrl}
                            alt="Logo da Empresa"
                            style={{
                              height: `${empresa.logoTamanho ?? 80}px`,
                              maxHeight: '110px',
                              maxWidth: '180px',
                              objectFit: 'contain',
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ width: '96px', minHeight: '80px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fffaf0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#c59235', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', textAlign: 'center', lineHeight: 1.05 }}>
                            <Landmark size={26} />
                            <span>ARKHEN<br />CONTÁBIL</span>
                          </div>
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '0.58rem', color: '#c59235', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                              Escritório emissor
                            </div>
                            <h1 style={{ fontSize: '1.08rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '0', textTransform: 'uppercase', lineHeight: 1.15 }}>
                              {empresa?.razaoSocial || SYSTEM_NAME}
                            </h1>
                          </div>
                          <div style={{ textAlign: 'right', border: '1px solid #e2e8f0', borderRadius: '9px', padding: '7px 9px', background: '#f8fafc', minWidth: '118px' }}>
                            <div style={{ fontSize: '0.56rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Emitido em</div>
                            <div style={{ fontSize: '0.68rem', color: '#0f172a', fontWeight: 850 }}>{formatGeneratedDateTime(pdfGeneratedAt)}</div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', fontSize: '0.62rem' }}>
                          <span style={{ color: '#475569' }}><strong style={{ color: '#0f172a' }}>CNPJ:</strong> {formatCnpj(empresa?.cnpj || '12.345.678/0001-90')}</span>
                          <span style={{ color: '#475569' }}><strong style={{ color: '#0f172a' }}>Telefone:</strong> {empresa?.telefone || '(11) 4567-8901'}</span>
                          <span style={{ color: '#475569' }}><strong style={{ color: '#0f172a' }}>E-mail:</strong> {empresa?.email || 'contato@arkhen.com.br'}</span>
                        </div>

                        <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 500, lineHeight: 1.35 }}>
                          {empresa?.endereco ? `${empresa.endereco}, ${empresa.numero || ''}` : 'Avenida Paulista, 1000'} — {empresa?.cidade || 'São Paulo'} / {empresa?.estado || 'SP'} {empresa?.cep ? `— CEP: ${empresa.cep}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Título do Relatório */}
                  <div style={{ textAlign: 'center', margin: '8px 0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      RELATÓRIO TÉCNICO DE SIMULAÇÃO
                    </h3>
                    <p style={{ fontSize: '0.7rem', color: '#c59235', fontWeight: 700, margin: '4px 0 0 0', letterSpacing: '0.02em' }}>
                      {title.toUpperCase()}
                    </p>
                  </div>

                  {/* Conteúdo Dinâmico do Relatório conforme a Calculadora Ativa */}
                  <div>
                    {renderPdfContent()}
                  </div>

                  {/* Rodapé de autenticação */}
                  <div style={{
                    borderTop: '1px solid #cbd5e1',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.6rem',
                    color: '#94a3b8'
                  }}>
                    <span>Gerado eletronicamente por {SYSTEM_NAME} em {formatGeneratedDateTime(pdfGeneratedAt)}</span>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Página 1 de 1</span>
                  </div>
                </div>
              </div>
              </div>

              {/* Painel Direito: Ações (Baixar, Excluir, Compartilhar) */}
              <div className="simulation-export-actions" style={{
                backgroundColor: '#0f172a',
                overflowY: 'auto'
              }}>
                
                {/* Cabeçalho de Ações */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
                      <FileText size={16} style={{ color: '#c59235' }} />
                      Ações do PDF
                    </h3>
                    <button
                      onClick={() => setIsPdfModalOpen(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.4', marginBottom: '24px' }}>
                    Escolha uma das ações abaixo para gerenciar o relatório gerado. Você pode baixar em PDF, excluir do histórico temporário, ou criar um link de visualização para o cliente.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Botão de Download */}
                    <button
                      onClick={handleDownloadPdf}
                      disabled={downloadState === 'generating'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        width: '100%'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#334155';
                        e.currentTarget.style.borderColor = '#475569';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e293b';
                        e.currentTarget.style.borderColor = '#334155';
                      }}
                    >
                      <Download size={16} style={{ color: '#c59235' }} />
                      {downloadState === 'generating' ? 'Gerando Arquivo...' : downloadState === 'done' ? '✓ Baixado!' : 'Baixar PDF'}
                    </button>

                    {/* Botão de Excluir */}
                    <button
                      onClick={handleDiscardPdf}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        width: '100%'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = '#ef4444';
                        e.currentTarget.style.color = '#fca5a5';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e293b';
                        e.currentTarget.style.borderColor = '#334155';
                        e.currentTarget.style.color = '#f8fafc';
                      }}
                    >
                      <Trash2 size={16} />
                      Excluir Simulação
                    </button>

                    {/* Botão de Compartilhar */}
                    <button
                      onClick={() => {
                        setIsSharing(!isSharing);
                        setGeneratedLink('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        backgroundColor: isSharing ? '#c59235' : '#1e293b',
                        color: '#f8fafc',
                        border: '1px solid',
                        borderColor: isSharing ? '#c59235' : '#334155',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        width: '100%'
                      }}
                      onMouseOver={(e) => {
                        if (!isSharing) {
                          e.currentTarget.style.backgroundColor = '#334155';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isSharing) {
                          e.currentTarget.style.backgroundColor = '#1e293b';
                        }
                      }}
                    >
                      <Share2 size={16} style={{ color: isSharing ? '#ffffff' : '#c59235' }} />
                      Compartilhar Link
                    </button>
                  </div>

                  {/* Seção de Compartilhar Segura */}
                  {isSharing && (
                    <div style={{
                      marginTop: '20px',
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '1px solid #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      animation: 'slideDown 0.25s ease-out'
                    }}>
                      <h4 style={{ fontSize: '0.78rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                        Configurações do Link
                      </h4>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                          Tempo de Expiração
                        </label>
                        <select
                          value={shareExpires}
                          onChange={(e) => {
                            setShareExpires(e.target.value);
                            setGeneratedLink('');
                          }}
                          style={{
                            width: '100%',
                            backgroundColor: '#ffffff',
                            color: '#111827',
                            border: '1px solid #475569',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            fontSize: '0.75rem',
                            outline: 'none',
                            fontWeight: 500
                          }}
                        >
                          <option value="15m">15 minutos</option>
                          <option value="1h">1 hora</option>
                          <option value="24h">24 horas</option>
                          <option value="7d">7 dias</option>
                          <option value="never">Sem expiração</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          id="sharePasswordRequired"
                          checked={sharePasswordRequired}
                          onChange={(e) => {
                            setSharePasswordRequired(e.target.checked);
                            setGeneratedLink('');
                            if (!e.target.checked) setSharePassword('');
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="sharePasswordRequired" style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                          Pedir senha para acessar?
                        </label>
                      </div>

                      {sharePasswordRequired && (
                        <div style={{ animation: 'slideDown 0.2s ease-out' }}>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                            Definir Senha de Acesso
                          </label>
                          <input
                            type="text"
                            value={sharePassword}
                            onChange={(e) => {
                              setSharePassword(e.target.value);
                              setGeneratedLink('');
                            }}
                            placeholder="Ex: Arkhen@2026"
                            style={{
                              width: '100%',
                              backgroundColor: '#ffffff',
                              color: '#111827',
                              border: '1px solid #475569',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '0.75rem',
                              outline: 'none',
                              fontWeight: 500
                            }}
                          />
                        </div>
                      )}

                      <button
                        onClick={handleGenerateShareLink}
                        style={{
                          backgroundColor: '#c59235',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#a67a2b')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#c59235')}
                      >
                        <Share2 size={13} />
                        Gerar Link
                      </button>

                      {generatedLink && (
                        <div style={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          padding: '10px',
                          border: '1px solid #334155',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          animation: 'fadeIn 0.2s ease'
                        }}>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#c59235' }}>LINK GERADO COM SUCESSO:</span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="text"
                              readOnly
                              value={generatedLink}
                              style={{
                                backgroundColor: '#ffffff',
                                color: '#111827',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                flex: 1,
                                fontSize: '0.68rem',
                                outline: 'none',
                                fontWeight: 500
                              }}
                            />
                            <button
                              onClick={handleCopyLink}
                              style={{
                                backgroundColor: '#334155',
                                border: 'none',
                                color: '#ffffff',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {copiedLink ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                            </button>
                          </div>
                          <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} />
                            {shareExpires === 'never' ? 'Acesso permanente.' : `Expira em ${formatShareExpiryLabel(shareExpires)}.`}
                          </p>
                          {shareNotice && (
                            <p style={{ fontSize: '0.6rem', color: sharePasswordRequired ? '#fbbf24' : '#94a3b8', margin: 0, lineHeight: 1.35 }}>
                              {shareNotice}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        )}
        <SystemQuickModal
          isOpen={showDiscardConfirm}
          title="Excluir Simulação"
          message="Tem certeza que deseja descartar este relatório de simulação?"
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          danger
          onConfirm={confirmDiscardPdf}
          onClose={() => setShowDiscardConfirm(false)}
        />
      </div>
    </div>
  );
};

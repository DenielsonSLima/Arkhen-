import { useEffect, useRef, useState } from 'react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { relatoriosService } from '../services/relatoriosService';
import type { FaturamentoReportData, ConformidadeReportData, PessoalReportData, ComparativoRegimeData } from '../services/relatoriosService';

export const useRelatorios = () => {
  const [activeReport, setActiveReport] = useState<'faturamento' | 'conformidade' | 'pessoal' | 'tributario'>('faturamento');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('Todos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Simulação Tributária
  const [faturamentoAnual, setFaturamentoAnual] = useState<string>('1200000');
  const [custoFolhaAnual, setCustoFolhaAnual] = useState<string>('240000');

  // Geração
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const generation = useRef(0);

  // Dados dos Relatórios
  const [faturamentoData, setFaturamentoData] = useState<FaturamentoReportData | null>(null);
  const [conformidadeData, setConformidadeData] = useState<ConformidadeReportData | null>(null);
  const [pessoalData, setPessoalData] = useState<PessoalReportData | null>(null);
  const [tributarioData, setTributarioData] = useState<ComparativoRegimeData[] | null>(null);

  // Carrega empresas ao iniciar
  useEffect(() => {
    let mounted = true;
    const loadCompanies = async () => {
      try {
        const list = await gestaoEmpresarialService.getCompanies();
        if (mounted) setCompanies(list);
      } catch (err) {
        console.error('Erro ao carregar empresas para relatórios:', err);
        if (mounted) setError(err instanceof Error ? err : new Error('Não foi possível carregar as empresas.'));
      }
    };
    loadCompanies();
    return () => { mounted = false; };
  }, []);

  // Reseta estado gerado ao trocar de relatório
  useEffect(() => {
    generation.current += 1;
    setIsLoading(false);
    setError(null);
    setIsGenerated(false);
    setFaturamentoData(null);
    setConformidadeData(null);
    setPessoalData(null);
    setTributarioData(null);
    return () => { generation.current += 1; };
  }, [activeReport, selectedCompany, startDate, endDate, faturamentoAnual, custoFolhaAnual]);

  const handleGenerateReport = async () => {
    const requestGeneration = ++generation.current;
    const isCurrent = () => requestGeneration === generation.current;
    setIsLoading(true);
    setIsGenerated(false);
    setError(null);
    try {
      if (activeReport === 'faturamento') {
        const data = await relatoriosService.getFaturamentoReport(selectedCompany, startDate, endDate);
        if (!isCurrent()) return;
        setFaturamentoData(data);
      } else if (activeReport === 'conformidade') {
        const data = await relatoriosService.getConformidadeReport(selectedCompany);
        if (!isCurrent()) return;
        setConformidadeData(data);
      } else if (activeReport === 'pessoal') {
        const data = await relatoriosService.getPessoalReport(selectedCompany);
        if (!isCurrent()) return;
        setPessoalData(data);
      } else if (activeReport === 'tributario') {
        const fat = parseFloat(faturamentoAnual) || 0;
        const fol = parseFloat(custoFolhaAnual) || 0;
        const data = await relatoriosService.calcularComparativoRegimes(fat, fol);
        if (!isCurrent()) return;
        setTributarioData(data);
      }
      if (isCurrent()) setIsGenerated(true);
    } catch (err) {
      console.error('Erro ao processar relatório:', err);
      if (isCurrent()) setError(err instanceof Error ? err : new Error('Não foi possível gerar o relatório.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (isGenerated && !isLoading) window.print();
  };

  return {
    activeReport,
    setActiveReport,
    companies,
    selectedCompany,
    setSelectedCompany,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    faturamentoAnual,
    setFaturamentoAnual,
    custoFolhaAnual,
    setCustoFolhaAnual,
    isLoading,
    error,
    isGenerated,
    faturamentoData,
    conformidadeData,
    pessoalData,
    tributarioData,
    handleGenerateReport,
    handlePrint
  };
};

import { useEffect, useState } from 'react';
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

  // Dados dos Relatórios
  const [faturamentoData, setFaturamentoData] = useState<FaturamentoReportData | null>(null);
  const [conformidadeData, setConformidadeData] = useState<ConformidadeReportData | null>(null);
  const [pessoalData, setPessoalData] = useState<PessoalReportData | null>(null);
  const [tributarioData, setTributarioData] = useState<ComparativoRegimeData[] | null>(null);

  // Carrega empresas ao iniciar
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const list = await gestaoEmpresarialService.getCompanies();
        setCompanies(list);
      } catch (err) {
        console.error('Erro ao carregar empresas para relatórios:', err);
      }
    };
    loadCompanies();
  }, []);

  // Reseta estado gerado ao trocar de relatório
  useEffect(() => {
    setIsGenerated(false);
    setFaturamentoData(null);
    setConformidadeData(null);
    setPessoalData(null);
    setTributarioData(null);
  }, [activeReport, selectedCompany, startDate, endDate]);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setIsGenerated(false);
    try {
      if (activeReport === 'faturamento') {
        const data = await relatoriosService.getFaturamentoReport(selectedCompany, startDate, endDate);
        setFaturamentoData(data);
      } else if (activeReport === 'conformidade') {
        const data = await relatoriosService.getConformidadeReport(selectedCompany);
        setConformidadeData(data);
      } else if (activeReport === 'pessoal') {
        const data = await relatoriosService.getPessoalReport(selectedCompany);
        setPessoalData(data);
      } else if (activeReport === 'tributario') {
        const fat = parseFloat(faturamentoAnual) || 0;
        const fol = parseFloat(custoFolhaAnual) || 0;
        const data = await relatoriosService.calcularComparativoRegimes(fat, fol);
        setTributarioData(data);
      }
      setIsGenerated(true);
    } catch (err) {
      console.error('Erro ao processar relatório:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
    isGenerated,
    faturamentoData,
    conformidadeData,
    pessoalData,
    tributarioData,
    handleGenerateReport,
    handlePrint
  };
};

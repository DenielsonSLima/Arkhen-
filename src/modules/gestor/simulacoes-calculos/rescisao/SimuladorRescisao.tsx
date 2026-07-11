import React, { useEffect, useMemo, useState } from 'react';
import { FileX2, Calculator } from 'lucide-react';
import { type ResultadoRescisao, formatCurrency } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';
import { formatCurrencyInputValue } from '../../shared/currencyInputUtils';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { Company, Employee } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { TipoRescisaoParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';
import type { AvisoPrevioModo } from '../hooks/useSimulacoesCalculos';

interface Params {
  tipo: string;
  avisoPrevioModo: AvisoPrevioModo;
  salario: string;
  dataAdmissao: string;
  dataDemissao: string;
  saldoFGTS: string;
}

interface Props {
  params: Params;
  setParams: (p: Params) => void;
  resultado: ResultadoRescisao;
  tiposRescisao: TipoRescisaoParametro[];
}

const AVISO_PREVIO_OPCOES: { id: AvisoPrevioModo; label: string; desc: string }[] = [
  { id: 'cumprido', label: 'Cumpriu 30 dias', desc: 'Não soma nem desconta aviso prévio.' },
  { id: 'descontado', label: 'Não cumpriu', desc: 'Desconta 30 dias de aviso do valor líquido.' },
  { id: 'indenizado', label: 'Indenizado', desc: 'Soma aviso prévio indenizado nas verbas.' },
];

export const SimuladorRescisao: React.FC<Props> = ({ params, setParams, resultado, tiposRescisao }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    let active = true;

    gestaoEmpresarialService.getCompanies().then((data) => {
      if (active) setCompanies(data);
    });

    return () => {
      active = false;
    };
  }, []);

  const selectedCompany = useMemo(() => {
    return companies.find((company) => company.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  const selectedEmployee = useMemo(() => {
    return selectedCompany?.funcionarios.find((employee) => employee.id === selectedEmployeeId) || null;
  }, [selectedCompany, selectedEmployeeId]);

  const set = (key: keyof Params) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams({ ...params, [key]: e.target.value });

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedEmployeeId('');
  };

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const employee = selectedCompany?.funcionarios.find((item) => item.id === employeeId);
    if (!employee) return;

    setParams({
      ...params,
      salario: formatCurrencyInputValue(employee.salario),
      dataAdmissao: employee.dataAdmissao,
    });
  };

  const employeeLabel = (employee: Employee) => {
    return `${employee.nome} - ${employee.cargo}`;
  };

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><FileX2 size={18} color="#c59235" />Dados da Rescisão</h3>
        <div className="rescisao-select-grid">
          <div className="calc-field">
            <label>Empresa</label>
            <select
              value={selectedCompanyId}
              onChange={(event) => handleSelectCompany(event.target.value)}
            >
              <option value="">Preenchimento manual</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="calc-field">
            <label>Funcionário</label>
            <select
              value={selectedEmployeeId}
              onChange={(event) => handleSelectEmployee(event.target.value)}
              disabled={!selectedCompany}
            >
              <option value="">
                {selectedCompany ? 'Selecionar funcionário' : 'Selecione uma empresa'}
              </option>
              {selectedCompany?.funcionarios.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeLabel(employee)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedEmployee && (
          <div className="rescisao-employee-summary">
            <strong>{selectedEmployee.nome}</strong>
            <span>{selectedCompany?.nome}</span>
            <span>{selectedEmployee.status}</span>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>
            Tipo de Rescisão
          </label>
          <div className="tipo-rescisao-grid">
            {tiposRescisao.map((tipo) => (
              <button
                key={tipo.id}
                className={`tipo-rescisao-btn${params.tipo === tipo.id ? ' active' : ''}`}
                onClick={() => setParams({ ...params, tipo: tipo.id })}
                title={tipo.descricao}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>
            Aviso Prévio
          </label>
          <div className="aviso-previo-grid">
            {AVISO_PREVIO_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                className={`aviso-previo-btn${params.avisoPrevioModo === opcao.id ? ' active' : ''}`}
                onClick={() => setParams({ ...params, avisoPrevioModo: opcao.id })}
                title={opcao.desc}
              >
                <span>{opcao.label}</span>
                <small>{opcao.desc}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="calc-field">
          <label>Último Salário (R$)</label>
          <CurrencyInput
            value={params.salario}
            onValueChange={(value) => setParams({ ...params, salario: value })}
          />
        </div>
        <div className="calc-field">
          <label>Data de Admissão</label>
          <input type="date" value={params.dataAdmissao} onChange={set('dataAdmissao')} />
        </div>
        <div className="calc-field">
          <label>Data de Demissão</label>
          <input type="date" value={params.dataDemissao} onChange={set('dataDemissao')} />
        </div>
        <div className="calc-field">
          <label>Saldo do FGTS (R$)</label>
          <CurrencyInput
            value={params.saldoFGTS}
            onValueChange={(value) => setParams({ ...params, saldoFGTS: value })}
          />
        </div>
      </div>

      <div className="resultado-card">
        <h3><Calculator size={18} color="#c59235" />Verbas Rescisórias</h3>
        <div className="resultado-row">
          <span className="r-label">Saldo de Salário</span>
          <span className="r-valor">{formatCurrency(resultado.saldoSalario)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">13º Proporcional</span>
          <span className="r-valor">{formatCurrency(resultado.decimoTerceiroProporcional)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Férias Proporcionais</span>
          <span className="r-valor">{formatCurrency(resultado.feriasProporcionais)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Adicional de 1/3 de Férias</span>
          <span className="r-valor">{formatCurrency(resultado.adicionalFerias)}</span>
        </div>
        {resultado.avisoPrevio > 0 && (
          <div className="resultado-row">
            <span className="r-label">Aviso Prévio Indenizado</span>
            <span className="r-valor">{formatCurrency(resultado.avisoPrevio)}</span>
          </div>
        )}
        {resultado.multaFGTS > 0 && (
          <div className="resultado-row azul">
            <span className="r-label">Multa FGTS (40%)</span>
            <span className="r-valor">{formatCurrency(resultado.multaFGTS)}</span>
          </div>
        )}
        <div className="resultado-row">
          <span className="r-label">Total Bruto</span>
          <span className="r-valor">{formatCurrency(resultado.totalBruto)}</span>
        </div>
        {resultado.avisoPrevioDesconto > 0 && (
          <div className="resultado-row perigo">
            <span className="r-label">(-) Aviso Prévio Não Cumprido</span>
            <span className="r-valor">- {formatCurrency(resultado.avisoPrevioDesconto)}</span>
          </div>
        )}
        <div className="resultado-row perigo">
          <span className="r-label">(-) INSS</span>
          <span className="r-valor">- {formatCurrency(resultado.inssRescisao)}</span>
        </div>
        <div className="resultado-row perigo">
          <span className="r-label">(-) IRRF</span>
          <span className="r-valor">- {formatCurrency(resultado.irrfRescisao)}</span>
        </div>
        <div className="resultado-row destaque verde">
          <span className="r-label">Total Líquido a Receber</span>
          <span className="r-valor">{formatCurrency(resultado.totalLiquido)}</span>
        </div>
      </div>
    </div>
  );
};

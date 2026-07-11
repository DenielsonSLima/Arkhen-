import type { Company } from './gestaoEmpresarialService';

export const MOCK_COMPANIES: Company[] = [
  {
    id: 'emp-1',
    nome: 'Tech Solutions Ltda',
    razaoSocial: 'Tech Solutions Consultoria e Desenvolvimento de Sistemas Ltda',
    cnpj: '12.345.678/0001-90',
    tipo: 'Lucro Real',
    tipoEstabelecimento: 'Matriz',
    funcionariosCount: 8,
    status: 'Ativa',
    email: 'contato@techsolutions.com.br',
    telefone: '(11) 98765-4321',
    endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    pastasDocumentos: ['Contratos e Atos', 'Trabalhista / Folha', 'Certidões (CND)', 'Outros Arquivos', 'Financeiro'],
    categoriasDocumentos: ['Contrato Social', 'GFIP', 'Folha de Pagamento', 'CND', 'Outros'],
    capitalSocial: 250000,
    socios: [
      { id: 's-1', nome: 'João Silva', participacao: 60, capital: 150000, cargo: 'Sócio-Administrador' },
      { id: 's-2', nome: 'Maria Oliveira', participacao: 40, capital: 100000, cargo: 'Sócio Quotista' }
    ],
    historicoCorporativo: [
      { id: 'e-1', data: '2022-03-15', titulo: 'Abertura da Empresa', descricao: 'Constituição inicial da sociedade limitada com Capital Social de R$ 100.000,00 integralizado pelos sócios João Silva (60%) e Pedro Santos (40%).' },
      { id: 'e-2', data: '2024-05-10', titulo: 'Alteração Contratual - Aumento de Capital', descricao: 'Aumento do Capital Social de R$ 100.000,00 para R$ 250.000,00, totalmente integralizado pelos sócios em moeda corrente nacional.' },
      { id: 'e-3', data: '2026-01-12', titulo: 'Alteração Contratual - Retirada e Entrada de Sócio', descricao: 'Retirada do sócio Pedro Santos com cessão e transferência de suas quotas para a nova sócia admitida Maria Oliveira, passando a deter 40% do capital social.' }
    ],
    funcionarios: [
      {
        id: 'f-101',
        nome: 'Ana Souza',
        cargo: 'Engenheira de Software Senior',
        dataAdmissao: '2022-03-15',
        salario: 9500,
        status: 'Ativo',
        cpf: '123.456.789-00',
        rg: '12.345.678-9',
        email: 'ana.souza@techsolutions.com.br',
        telefone: '(11) 99999-1111',
        dataNascimento: '1992-07-15',
        filhosCount: 2,
        historicoSalario: [
          { data: '2022-03-15', motivo: 'Admissão', valor: 8000 },
          { data: '2023-04-01', motivo: 'Promoção', valor: 8800 },
          { data: '2024-05-01', motivo: 'Aumento Anual', valor: 9500 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Certidão de Nascimento de Dependentes', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-102',
        nome: 'Carlos Eduardo',
        cargo: 'Desenvolvedor Full Stack',
        dataAdmissao: '2023-01-10',
        salario: 6500,
        status: 'Ativo',
        cpf: '234.567.890-11',
        rg: '23.456.789-0',
        email: 'carlos.eduardo@techsolutions.com.br',
        telefone: '(11) 98888-2222',
        dataNascimento: '1996-03-22',
        filhosCount: 0,
        historicoSalario: [
          { data: '2023-01-10', motivo: 'Admissão', valor: 6000 },
          { data: '2024-02-01', motivo: 'Reajuste Convenção', valor: 6500 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-103',
        nome: 'Mariana Costa',
        cargo: 'Product Owner',
        dataAdmissao: '2021-08-01',
        salario: 8500,
        status: 'Ativo',
        cpf: '345.678.901-22',
        rg: '34.567.890-1',
        email: 'mariana.costa@techsolutions.com.br',
        telefone: '(11) 97777-3333',
        dataNascimento: '1989-11-05',
        filhosCount: 1,
        historicoSalario: [
          { data: '2021-08-01', motivo: 'Admissão', valor: 7500 },
          { data: '2023-01-01', motivo: 'Aumento por Mérito', valor: 8500 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Certidão de Nascimento de Dependentes', status: 'Pendente' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-104',
        nome: 'Roberto Silva',
        cargo: 'UX/UI Designer',
        dataAdmissao: '2023-05-20',
        salario: 5500,
        status: 'Ativo',
        cpf: '456.789.012-33',
        rg: '45.678.901-2',
        email: 'roberto.silva@techsolutions.com.br',
        telefone: '(11) 96666-4444',
        dataNascimento: '1995-12-10',
        filhosCount: 0,
        historicoSalario: [
          { data: '2023-05-20', motivo: 'Admissão', valor: 5500 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Pendente' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-105',
        nome: 'Beatriz Santos',
        cargo: 'Desenvolvedora Frontend',
        dataAdmissao: '2024-02-15',
        salario: 4500,
        status: 'Ativo',
        cpf: '567.890.123-44',
        rg: '56.789.012-3',
        email: 'beatriz. santos@techsolutions.com.br',
        telefone: '(11) 95555-5555',
        dataNascimento: '1999-02-15',
        filhosCount: 0,
        historicoSalario: [
          { data: '2024-02-15', motivo: 'Admissão', valor: 4500 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Pendente' }
        ]
      },
      {
        id: 'f-106',
        nome: 'Lucas Oliveira',
        cargo: 'QA Engineer',
        dataAdmissao: '2023-09-01',
        salario: 4800,
        status: 'Afastado',
        cpf: '678.901.234-55',
        rg: '67.890.123-4',
        email: 'lucas.oliveira@techsolutions.com.br',
        telefone: '(11) 94444-6666',
        dataNascimento: '1997-08-30',
        filhosCount: 0,
        historicoSalario: [
          { data: '2023-09-01', motivo: 'Admissão', valor: 4800 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-107',
        nome: 'Felipe Almeida',
        cargo: 'Analista de Sistemas',
        dataAdmissao: '2020-04-12',
        salario: 7000,
        status: 'Ativo',
        cpf: '789.012.345-66',
        rg: '78.901.234-5',
        email: 'felipe.almeida@techsolutions.com.br',
        telefone: '(11) 93333-7777',
        dataNascimento: '1987-05-18',
        filhosCount: 3,
        historicoSalario: [
          { data: '2020-04-12', motivo: 'Admissão', valor: 6000 },
          { data: '2022-05-01', motivo: 'Dissídio Anual', valor: 6500 },
          { data: '2024-06-01', motivo: 'Reajuste Dissídio', valor: 7000 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Certidão de Nascimento de Dependentes', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-108',
        nome: 'Juliana Lima',
        cargo: 'Estagiária de Dev',
        dataAdmissao: '2025-01-15',
        salario: 2000,
        status: 'Ativo',
        cpf: '890.123.456-77',
        rg: '89.012.345-6',
        email: 'juliana.lima@techsolutions.com.br',
        telefone: '(11) 92222-8888',
        dataNascimento: '2003-09-05',
        filhosCount: 0,
        historicoSalario: [
          { data: '2025-01-15', motivo: 'Admissão', valor: 2000 }
        ],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
    ],
    ferias: [
      { id: 'v-101', funcionarioNome: 'Carlos Eduardo', cargo: 'Desenvolvedor Full Stack', dataInicio: '2026-07-10', dataFim: '2026-07-30', status: 'Agendada', dias: 20 },
      { id: 'v-102', funcionarioNome: 'Mariana Costa', cargo: 'Product Owner', dataInicio: '2026-06-15', dataFim: '2026-07-15', status: 'Gozando', dias: 30 },
      { id: 'v-103', funcionarioNome: 'Felipe Almeida', cargo: 'Analista de Sistemas', dataInicio: '2025-12-01', dataFim: '2025-12-15', status: 'Gozada', dias: 15 },
    ],
    documentos: [
      { id: 'd-101', nome: 'Contrato_Social_Consolidado.pdf', tipo: 'Contrato Social', dataUpload: '2022-03-20', tamanho: '2.4 MB', url: '#', pasta: 'Contratos e Atos' },
      { id: 'd-102', nome: 'GFIP_Competencia_05_2026.pdf', tipo: 'GFIP', dataUpload: '2026-06-05', tamanho: '512 KB', url: '#', pasta: 'Trabalhista / Folha' },
      { id: 'd-103', nome: 'Folha_Pagamento_Maio_2026.pdf', tipo: 'Folha de Pagamento', dataUpload: '2026-06-02', tamanho: '1.1 MB', url: '#', pasta: 'Trabalhista / Folha' },
      { id: 'd-104', nome: 'CND_Tributos_Federais_Valida.pdf', tipo: 'CND', dataUpload: '2026-05-15', tamanho: '340 KB', url: '#', pasta: 'Certidões (CND)' },
      { id: 'd-105', nome: 'Balancete_Consolidado_Maio_2026.xlsx', tipo: 'Outros', dataUpload: '2026-06-08', tamanho: '1.8 MB', url: '#', pasta: 'Financeiro' },
      { id: 'd-106', nome: 'Apresentacao_Resultados_Q1.pptx', tipo: 'Outros', dataUpload: '2026-04-12', tamanho: '4.2 MB', url: '#', pasta: 'Outros Arquivos' },
      { id: 'd-107', nome: 'Contrato_Prestacao_Servicos_Tech.docx', tipo: 'Contrato Social', dataUpload: '2023-08-15', tamanho: '1.4 MB', url: '#', pasta: 'Contratos e Atos' },
      { id: 'd-108', nome: 'Extrato_Conciliacao_Bradesco.ofx', tipo: 'Outros', dataUpload: '2026-06-10', tamanho: '45 KB', url: '#', pasta: 'Financeiro' },
      { id: 'd-109', nome: 'Comprovante_Pagamento_Energia.png', tipo: 'Outros', dataUpload: '2026-06-05', tamanho: '2.1 MB', url: '#', pasta: 'Outros Arquivos' }
    ]
  },
  {
    id: 'emp-1-filial',
    nome: 'Tech Solutions - Filial Campinas',
    razaoSocial: 'Tech Solutions Consultoria e Desenvolvimento de Sistemas Ltda',
    cnpj: '12.345.678/0002-77',
    tipo: 'Lucro Real',
    tipoEstabelecimento: 'Filial',
    funcionariosCount: 2,
    status: 'Ativa',
    email: 'campinas@techsolutions.com.br',
    telefone: '(19) 3213-4567',
    endereco: 'Av. Francisco Glicério, 1500 - Centro, Campinas - SP',
    pastasDocumentos: ['Contratos e Atos', 'Trabalhista / Folha', 'Certidões (CND)', 'Outros Arquivos'],
    categoriasDocumentos: ['Contrato Social', 'GFIP', 'Folha de Pagamento', 'CND', 'Outros'],
    capitalSocial: 50000,
    socios: [
      { id: 's-1', nome: 'João Silva', participacao: 100, capital: 50000, cargo: 'Sócio-Administrador' }
    ],
    historicoCorporativo: [
      { id: 'e-4', data: '2024-06-01', titulo: 'Abertura de Filial', descricao: 'Abertura da filial em Campinas para expansão de atividades de suporte técnico, com destaque de R$ 50.000,00 do capital social da matriz.' }
    ],
    funcionarios: [
      {
        id: 'f-151',
        nome: 'Guilherme Rosa',
        cargo: 'Analista de Suporte',
        dataAdmissao: '2024-10-01',
        salario: 3200,
        status: 'Ativo',
        cpf: '321.654.987-12',
        rg: '32.165.498-7',
        email: 'guilherme.rosa@techsolutions.com.br',
        telefone: '(19) 98765-1111',
        dataNascimento: '1998-04-12',
        filhosCount: 0,
        historicoSalario: [{ data: '2024-10-01', motivo: 'Admissão', valor: 3200 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-152',
        nome: 'Priscila Ramos',
        cargo: 'Assistente Administrativo',
        dataAdmissao: '2025-02-10',
        salario: 2400,
        status: 'Ativo',
        cpf: '987.654.321-09',
        rg: '98.765.432-1',
        email: 'priscila.ramos@techsolutions.com.br',
        telefone: '(19) 98765-2222',
        dataNascimento: '2001-08-30',
        filhosCount: 1,
        historicoSalario: [{ data: '2025-02-10', motivo: 'Admissão', valor: 2400 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Pendente' },
          { nome: 'Certidão de Nascimento de Dependentes', status: 'Entregue' },
          { nome: 'Atestado de Saúde Ocupacional (ASO)', status: 'Entregue' }
        ]
      }
    ],
    ferias: [],
    documentos: [
      { id: 'd-151', nome: 'Alvara_Funcionamento_Campinas_2026.pdf', tipo: 'Outros', dataUpload: '2026-01-15', tamanho: '420 KB', url: '#', pasta: 'Outros Arquivos' }
    ]
  },
  {
    id: 'emp-2',
    nome: 'Padaria Pão de Ouro',
    razaoSocial: 'Panificadora e Confeitaria Pão de Ouro Ltda',
    cnpj: '98.765.432/0001-10',
    tipo: 'Simples Nacional',
    tipoEstabelecimento: 'Matriz',
    funcionariosCount: 4,
    status: 'Ativa',
    email: 'financeiro@paodeouro.com.br',
    telefone: '(11) 96543-2109',
    endereco: 'Rua das Flores, 450 - Pinheiros, São Paulo - SP',
    pastasDocumentos: ['Contratos e Atos', 'Trabalhista / Folha', 'Certidões (CND)', 'Outros Arquivos'],
    categoriasDocumentos: ['Contrato Social', 'GFIP', 'Folha de Pagamento', 'CND', 'Outros'],
    capitalSocial: 120000,
    socios: [
      { id: 's-3', nome: 'Antonio Lima', participacao: 50, capital: 60000, cargo: 'Sócio-Administrador' },
      { id: 's-4', nome: 'Francisco Lima', participacao: 50, capital: 60000, cargo: 'Sócio-Administrador' }
    ],
    historicoCorporativo: [
      { id: 'e-5', data: '2019-10-01', titulo: 'Abertura da Sociedade', descricao: 'Início das atividades da Panificadora Pão de Ouro com capital social de R$ 120.000,00 dividido igualmente entre os irmãos Antonio e Francisco.' }
    ],
    funcionarios: [
      {
        id: 'f-201',
        nome: 'José da Silva',
        cargo: 'Padeiro Líder',
        dataAdmissao: '2019-10-01',
        salario: 3500,
        status: 'Ativo',
        cpf: '111.222.333-44',
        rg: '11.222.333-4',
        email: 'jose.silva@paodeouro.com.br',
        telefone: '(11) 94444-1111',
        dataNascimento: '1985-05-24',
        filhosCount: 2,
        historicoSalario: [{ data: '2019-10-01', motivo: 'Admissão', valor: 3500 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' }
        ]
      },
      {
        id: 'f-202',
        nome: 'Maria Oliveira',
        cargo: 'Atendente de Caixa',
        dataAdmissao: '2021-11-15',
        salario: 1800,
        status: 'Ativo',
        cpf: '222.333.444-55',
        rg: '22.333.444-5',
        email: 'maria.oliveira@paodeouro.com.br',
        telefone: '(11) 94444-2222',
        dataNascimento: '2000-12-15',
        filhosCount: 0,
        historicoSalario: [{ data: '2021-11-15', motivo: 'Admissão', valor: 1800 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' }
        ]
      },
      {
        id: 'f-203',
        nome: 'Antônio Santos',
        cargo: 'Auxiliar de Cozinha',
        dataAdmissao: '2023-02-01',
        salario: 1600,
        status: 'Ativo',
        cpf: '333.444.555-66',
        rg: '33.444.555-6',
        email: 'antonio.santos@paodeouro.com.br',
        telefone: '(11) 94444-3333',
        dataNascimento: '2002-04-18',
        filhosCount: 0,
        historicoSalario: [{ data: '2023-02-01', motivo: 'Admissão', valor: 1600 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Pendente' }
        ]
      },
      {
        id: 'f-204',
        nome: 'Patricia Mendes',
        cargo: 'Gerente Operacional',
        dataAdmissao: '2020-07-20',
        salario: 4200,
        status: 'Ativo',
        cpf: '444.555.666-77',
        rg: '44.455.566-6',
        email: 'patricia.mendes@paodeouro.com.br',
        telefone: '(11) 94444-4444',
        dataNascimento: '1990-09-08',
        filhosCount: 1,
        historicoSalario: [{ data: '2020-07-20', motivo: 'Admissão', valor: 4200 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' },
          { nome: 'Comprovante de Residência', status: 'Entregue' }
        ]
      },
    ],
    ferias: [
      { id: 'v-201', funcionarioNome: 'José da Silva', cargo: 'Padeiro Líder', dataInicio: '2026-08-01', dataFim: '2026-08-30', status: 'Agendada', dias: 30 },
      { id: 'v-202', funcionarioNome: 'Antônio Santos', cargo: 'Auxiliar de Cozinha', dataInicio: '2026-05-01', dataFim: '2026-05-15', status: 'Gozada', dias: 15 },
    ],
    documentos: [
      { id: 'd-201', nome: 'Alteracao_Contratual_QSA.pdf', tipo: 'Contrato Social', dataUpload: '2021-05-10', tamanho: '1.8 MB', url: '#', pasta: 'Contratos e Atos' },
      { id: 'd-202', nome: 'Folha_Pagamento_Maio_2026_Assinada.pdf', tipo: 'Folha de Pagamento', dataUpload: '2026-06-03', tamanho: '950 KB', url: '#', pasta: 'Trabalhista / Folha' },
      { id: 'd-203', nome: 'CND_Municipal_Sao_Paulo.pdf', tipo: 'CND', dataUpload: '2026-04-10', tamanho: '180 KB', url: '#', pasta: 'Certidões (CND)' },
    ]
  },
  {
    id: 'emp-3',
    nome: 'Consultório Dr. Marcos',
    razaoSocial: 'Marcos Almeida Servicos Medicos S/S',
    cnpj: '45.678.901/0001-22',
    tipo: 'Lucro Presumido',
    tipoEstabelecimento: 'Matriz',
    funcionariosCount: 2,
    status: 'Ativa',
    email: 'marcos.almeida@medicos.com.br',
    telefone: '(11) 94567-8901',
    endereco: 'Rua Vergueiro, 2500, Conj 42 - Vila Mariana, São Paulo - SP',
    pastasDocumentos: ['Contratos e Atos', 'Trabalhista / Folha', 'Certidões (CND)', 'Outros Arquivos'],
    categoriasDocumentos: ['Contrato Social', 'GFIP', 'Folha de Pagamento', 'CND', 'Outros'],
    capitalSocial: 10000,
    socios: [
      { id: 's-5', nome: 'Marcos Almeida', participacao: 100, capital: 10000, cargo: 'Sócio-Administrador' }
    ],
    historicoCorporativo: [
      { id: 'e-6', data: '2015-08-10', titulo: 'Constituição de Consultório', descricao: 'Abertura da sociedade simples unipessoal para prestação de serviços médicos especializados, com capital inicial de R$ 10.000,00.' }
    ],
    funcionarios: [
      {
        id: 'f-301',
        nome: 'Camila Ribeiro',
        cargo: 'Secretária Executiva',
        dataAdmissao: '2020-01-15',
        salario: 2800,
        status: 'Ativo',
        cpf: '555.666.777-88',
        rg: '55.666.777-8',
        email: 'camila.ribeiro@medicos.com.br',
        telefone: '(11) 95555-1111',
        dataNascimento: '1994-06-18',
        filhosCount: 0,
        historicoSalario: [{ data: '2020-01-15', motivo: 'Admissão', valor: 2800 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' }
        ]
      },
      {
        id: 'f-302',
        nome: 'Marcos Almeida',
        cargo: 'Médico Titular',
        dataAdmissao: '2015-08-10',
        salario: 15000,
        status: 'Ativo',
        cpf: '666.777.888-99',
        rg: '66.777.888-9',
        email: 'marcos.almeida@medicos.com.br',
        telefone: '(11) 96666-2222',
        dataNascimento: '1975-08-10',
        filhosCount: 1,
        historicoSalario: [{ data: '2015-08-10', motivo: 'Admissão', valor: 15000 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' }
        ]
      },
    ],
    ferias: [
      { id: 'v-301', funcionarioNome: 'Camila Ribeiro', cargo: 'Secretária Executiva', dataInicio: '2026-09-10', dataFim: '2026-09-25', status: 'Agendada', dias: 15 },
    ],
    documentos: [
      { id: 'd-301', nome: 'Contrato_Social_Constituicao.pdf', tipo: 'Contrato Social', dataUpload: '2015-08-15', tamanho: '1.2 MB', url: '#', pasta: 'Contratos e Atos' },
      { id: 'd-302', nome: 'Folha_Pagamento_Maio_2026.pdf', tipo: 'Folha de Pagamento', dataUpload: '2026-06-01', tamanho: '400 KB', url: '#', pasta: 'Trabalhista / Folha' },
    ]
  },
  {
    id: 'emp-4',
    nome: 'Ana Make Up Artist',
    razaoSocial: 'Ana Beatriz Pereira da Silva MEI',
    cnpj: '33.444.555/0001-66',
    tipo: 'MEI',
    tipoEstabelecimento: 'Matriz',
    funcionariosCount: 1,
    status: 'Ativa',
    email: 'ana.makeup@outlook.com',
    telefone: '(11) 93333-4444',
    endereco: 'Rua Augusta, 1800 - Consolação, São Paulo - SP',
    pastasDocumentos: ['Contratos e Atos', 'Trabalhista / Folha', 'Certidões (CND)', 'Outros Arquivos'],
    categoriasDocumentos: ['Contrato Social', 'GFIP', 'Folha de Pagamento', 'CND', 'Outros'],
    capitalSocial: 5000,
    socios: [
      { id: 's-6', nome: 'Ana Beatriz Pereira', participacao: 100, capital: 5000, cargo: 'Sócio-Administrador' }
    ],
    historicoCorporativo: [
      { id: 'e-7', data: '2023-01-10', titulo: 'Registro de MEI', descricao: 'Inscrição no regime Microempreendedor Individual para início formal das prestações de serviços de estética e maquiagem.' }
    ],
    funcionarios: [
      {
        id: 'f-401',
        nome: 'Fernanda Lima',
        cargo: 'Auxiliar de Estética',
        dataAdmissao: '2024-06-01',
        salario: 1512,
        status: 'Ativo',
        cpf: '777.888.999-00',
        rg: '77.888.999-0',
        email: 'fernanda.lima@outlook.com',
        telefone: '(11) 97777-1111',
        dataNascimento: '1998-09-02',
        filhosCount: 0,
        historicoSalario: [{ data: '2024-06-01', motivo: 'Admissão', valor: 1512 }],
        documentosAdmissao: [
          { nome: 'Documento de Identidade (RG/CPF)', status: 'Entregue' },
          { nome: 'Carteira de Trabalho (CTPS)', status: 'Entregue' }
        ]
      }
    ],
    ferias: [],
    documentos: [
      { id: 'd-401', nome: 'CCMEI_Certificado_MEI.pdf', tipo: 'Contrato Social', dataUpload: '2023-01-10', tamanho: '750 KB', url: '#', pasta: 'Contratos e Atos' },
      { id: 'd-402', nome: 'DAS_MEI_Guia_Mensal_05_2026.pdf', tipo: 'Outros', dataUpload: '2026-06-10', tamanho: '120 KB', url: '#', pasta: 'Outros Arquivos' }
    ]
  },
  {
    id: 'emp-5',
    nome: 'Logística Rapidez SA',
    razaoSocial: 'Rapidez Transportes e Logistica SA',
    cnpj: '55.666.777/0001-88',
    tipo: 'Lucro Real',
    tipoEstabelecimento: 'Matriz',
    funcionariosCount: 0,
    status: 'Inativa',
    email: 'diretoria@rapidezlogistica.com.br',
    telefone: '(11) 95555-6666',
    endereco: 'Rodovia Anhanguera, KM 18 - Jaraguá, São Paulo - SP',
    pastasDocumentos: ['Contratos e Atos', 'Trabalhista / Folha', 'Certidões (CND)', 'Outros Arquivos'],
    categoriasDocumentos: ['Contrato Social', 'GFIP', 'Folha de Pagamento', 'CND', 'Outros'],
    capitalSocial: 1500000,
    socios: [
      { id: 's-7', nome: 'Holding Rapidez Participações S.A.', participacao: 80, capital: 1200000, cargo: 'Sócio Quotista' },
      { id: 's-8', nome: 'Carlos Augusto Silveira', participacao: 20, capital: 300000, cargo: 'Sócio-Administrador' }
    ],
    historicoCorporativo: [
      { id: 'e-8', data: '2020-11-12', titulo: 'Transformação em S.A. e Abertura', descricao: 'Constituição da transportadora sob formato de Sociedade Anônima Fechada com capital integralizado de R$ 1.500.000,00.' }
    ],
    funcionarios: [],
    ferias: [],
    documentos: [
      { id: 'd-501', nome: 'Estatuto_Social_Ultima_Assembleia.pdf', tipo: 'Contrato Social', dataUpload: '2020-11-12', tamanho: '4.5 MB', url: '#', pasta: 'Contratos e Atos' },
      { id: 'd-502', nome: 'CND_Tributos_Estaduais.pdf', tipo: 'CND', dataUpload: '2026-02-05', tamanho: '310 KB', url: '#', pasta: 'Certidões (CND)' }
    ]
  }
];

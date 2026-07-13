-- Massa de teste para conferir Empresas, Usuarios, Atividades e Documentos.
-- Escopo: tenant b9b06f80-10ff-4bb1-bf53-63f3df0deca1.

CREATE OR REPLACE FUNCTION public.perfis_acesso_padrao()
RETURNS TABLE (
  id uuid,
  codigo varchar,
  nome varchar,
  descricao text,
  sistema boolean,
  permissoes text[],
  ordem integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $seed$
  VALUES
    (
      '00000000-0000-0000-0000-000000000101'::uuid,
      'administrador'::varchar,
      'Administrador'::varchar,
      'Acesso completo ao sistema, configuracoes, equipe, clientes, documentos, atividades e financeiro do escritorio.'::text,
      true,
      ARRAY[
        'inicio:view','clientes:view','clientes:create','clientes:update','clientes:delete',
        'parametrizacao:view','parametrizacao:manage','agenda:view','agenda:manage',
        'atividades:view','atividades:manage','protocolos:view','protocolos:manage',
        'conformidade:view','simulacoes:view','faturamento:view','faturamento:manage',
        'financeiro:view','financeiro:manage','documentos:view','documentos:manage',
        'configuracoes:view','configuracoes:manage','usuarios:manage','perfis:manage'
      ]::text[],
      10,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000102'::uuid,
      'financeiro'::varchar,
      'Financeiro'::varchar,
      'Controla faturamento, cobrancas, contas bancarias e relatorios financeiros, sem administrar usuarios ou perfis.'::text,
      true,
      ARRAY[
        'inicio:view','clientes:view','faturamento:view','faturamento:manage',
        'financeiro:view','financeiro:manage','documentos:view',
        'configuracoes:view','contas-bancarias:manage','integracao-bancaria:manage'
      ]::text[],
      20,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000103'::uuid,
      'funcionario'::varchar,
      'Funcionário'::varchar,
      'Acessa sua rotina de trabalho, atividades atribuídas, agenda, protocolos e documentos operacionais.'::text,
      true,
      ARRAY[
        'inicio:view','agenda:view','atividades:view','atividades:update-own',
        'protocolos:view','protocolos:create','documentos:view','documentos:create',
        'meu-perfil:manage'
      ]::text[],
      30,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000104'::uuid,
      'fiscal'::varchar,
      'Analista Fiscal'::varchar,
      'Atua em obrigacoes fiscais, conformidade, cadastros de clientes e integracao fiscal, sem acesso ao financeiro do escritorio.'::text,
      true,
      ARRAY[
        'inicio:view','clientes:view','clientes:update','parametrizacao:view',
        'agenda:view','atividades:view','atividades:manage','protocolos:view',
        'protocolos:manage','conformidade:view','simulacoes:view',
        'documentos:view','documentos:manage','integracao-fiscal:manage'
      ]::text[],
      40,
      '2026-01-01 00:00:00+00'::timestamptz
    ),
    (
      '00000000-0000-0000-0000-000000000105'::uuid,
      'cliente'::varchar,
      'Cliente Externo'::varchar,
      'Visualiza apenas documentos, protocolos, obrigacoes e solicitacoes vinculadas a propria empresa cliente.'::text,
      true,
      ARRAY[
        'cliente-portal:view','documentos:view-own','documentos:create-own',
        'protocolos:view-own','atividades:view-own','faturamento:view-own',
        'meu-perfil:manage'
      ]::text[],
      50,
      '2026-01-01 00:00:00+00'::timestamptz
    )
$seed$;

DO $$
DECLARE
  v_empresa_id uuid := 'b9b06f80-10ff-4bb1-bf53-63f3df0deca1';
  v_owner_user_id uuid;
  v_cliente_mercado uuid := 'b0a35346-264e-485e-b369-6ba8295d6ecd';
  v_cliente_clinica uuid := '0b3e87cd-1289-4297-83be-ab974a3ee3cb';
  v_cliente_agro uuid;
  v_modelos text[];
  v_rotina_fiscal uuid;
  v_rotina_folha uuid;
  v_rotina_documentos uuid;
  v_rotina_contabil uuid;
  v_pasta text;
BEGIN
  SELECT p.user_id
    INTO v_owner_user_id
  FROM public.perfis p
  WHERE p.empresa_id = v_empresa_id
    AND p.ativo = true
  ORDER BY p.created_at
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuario auth encontrado para a empresa de demonstracao.';
  END IF;

  SELECT COALESCE(
    (SELECT c.modelos_ativos FROM public.clientes c WHERE c.empresa_id = v_empresa_id AND array_length(c.modelos_ativos, 1) > 0 LIMIT 1),
    ARRAY(
      SELECT am.id::text
      FROM public.atividades_modelos am
      WHERE am.empresa_id = v_empresa_id
        AND am.ativo = true
      ORDER BY am.nome
      LIMIT 6
    )
  )
  INTO v_modelos;

  UPDATE public.empresas
  SET nome = 'ARKHEN Contabilidade e Consultoria',
      razao_social = 'ARKHEN Contabilidade e Consultoria Ltda',
      cnpj = '48.936.210/0001-40',
      status = 'ativo',
      updated_at = now()
  WHERE id = v_empresa_id;

  INSERT INTO public.configuracoes_empresa (
    empresa_id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
    email, telefone, cep, endereco, numero, cidade, estado, logo_tamanho
  )
  VALUES (
    v_empresa_id,
    'ARKHEN Contabilidade e Consultoria Ltda',
    'ARKHEN Contabilidade',
    '48.936.210/0001-40',
    'Isento',
    'atendimento@arkhencontabil.com.br',
    '(79) 3025-1844',
    '49020-000',
    'Avenida Hermes Fontes',
    '1210',
    'Aracaju',
    'SE',
    80
  )
  ON CONFLICT (empresa_id) DO UPDATE
  SET razao_social = EXCLUDED.razao_social,
      nome_fantasia = EXCLUDED.nome_fantasia,
      cnpj = EXCLUDED.cnpj,
      inscricao_estadual = EXCLUDED.inscricao_estadual,
      email = EXCLUDED.email,
      telefone = EXCLUDED.telefone,
      cep = EXCLUDED.cep,
      endereco = EXCLUDED.endereco,
      numero = EXCLUDED.numero,
      cidade = EXCLUDED.cidade,
      estado = EXCLUDED.estado,
      logo_tamanho = EXCLUDED.logo_tamanho,
      updated_at = now();

  UPDATE public.configuracoes_perfis_acesso
  SET nome = 'Administrador',
      codigo = 'administrador',
      descricao = 'Acesso completo ao sistema e as configuracoes do escritorio.',
      ordem = 10,
      updated_at = now()
  WHERE empresa_id = v_empresa_id
    AND codigo = 'gestor';

  UPDATE public.configuracoes_usuarios
  SET perfil = 'Administrador'
  WHERE empresa_id = v_empresa_id
    AND lower(perfil) = 'gestor';

  DELETE FROM public.configuracoes_perfis_acesso
  WHERE empresa_id = v_empresa_id
    AND codigo = 'gestor';

  INSERT INTO public.configuracoes_usuarios (
    empresa_id, auth_user_id, nome, email, cpf, telefone, perfil, status, access_config, ultimo_acesso_em
  )
  VALUES
    (
      v_empresa_id,
      v_owner_user_id,
      'João Silva Administrador',
      'admin@arkhencontabil.com.br',
      '123.456.789-09',
      '(79) 99910-2001',
      'Administrador',
      'Ativo',
      '{"enabled":false,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"18:00"}],"message":"Seu acesso nao esta permitido neste dia ou horario. Entre em contato com o administrador."}'::jsonb,
      now() - interval '1 hour'
    ),
    (
      v_empresa_id,
      NULL,
      'Marina Costa Funcionária',
      'marina.funcionario@arkhencontabil.com.br',
      '321.654.987-00',
      '(79) 99910-2002',
      'Funcionário',
      'Ativo',
      '{"enabled":true,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"17:30"}],"message":"Acesso permitido apenas no horario comercial."}'::jsonb,
      now() - interval '2 days'
    ),
    (
      v_empresa_id,
      NULL,
      'Rafael Lima Fiscal',
      'rafael.fiscal@arkhencontabil.com.br',
      '222.333.444-55',
      '(79) 99910-2003',
      'Analista Fiscal',
      'Ativo',
      '{"enabled":false,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"18:00"}],"message":"Acesso liberado."}'::jsonb,
      now() - interval '4 hours'
    ),
    (
      v_empresa_id,
      NULL,
      'Bianca Rocha Financeiro',
      'bianca.financeiro@arkhencontabil.com.br',
      '555.666.777-88',
      '(79) 99910-2004',
      'Financeiro',
      'Pendente',
      '{"enabled":false,"days":[1,2,3,4,5],"intervals":[{"start":"08:00","end":"18:00"}],"message":"Convite pendente de ativacao."}'::jsonb,
      NULL
    )
  ON CONFLICT (empresa_id, email) DO UPDATE
  SET auth_user_id = COALESCE(EXCLUDED.auth_user_id, public.configuracoes_usuarios.auth_user_id),
      nome = EXCLUDED.nome,
      cpf = EXCLUDED.cpf,
      telefone = EXCLUDED.telefone,
      perfil = EXCLUDED.perfil,
      status = EXCLUDED.status,
      access_config = EXCLUDED.access_config,
      ultimo_acesso_em = EXCLUDED.ultimo_acesso_em,
      updated_at = now();

  UPDATE public.clientes
  SET nome = 'Mercado Sol Nascente',
      razao_social = 'Mercado Sol Nascente Ltda',
      cnpj = '11.284.390/0001-72',
      tipo = 'Simples Nacional',
      categoria_cliente = 'Comércio',
      tipo_estabelecimento = 'Matriz',
      funcionarios_count = 12,
      status = 'Ativa',
      email = 'financeiro@solnascente.com.br',
      telefone = '(79) 3345-1180',
      endereco = 'Rua Frei Paulo, 482',
      cidade = 'Aracaju',
      uf = 'SE',
      cep = '49015-260',
      bairro = 'Siqueira Campos',
      contato = 'Patrícia Menezes',
      inscricao_estadual = '27.123.456-7',
      funcionarios = jsonb_build_array(
        jsonb_build_object('id','func-mercado-1','nome','Carlos Eduardo Santos','cargo','Gerente de Loja','dataAdmissao','2021-03-10','salario',4200,'status','Ativo','cpf','101.202.303-44','rg','3214567 SSP/SE','email','carlos@solnascente.com.br','telefone','(79) 98811-2200','dataNascimento','1988-05-14','filhosCount',2,'historicoSalario',jsonb_build_array(jsonb_build_object('data','2026-01-01','motivo','Reajuste anual','valor',4200)),'documentosAdmissao',jsonb_build_array(jsonb_build_object('nome','RG e CPF','status','Entregue'), jsonb_build_object('nome','Comprovante de residência','status','Pendente'))),
        jsonb_build_object('id','func-mercado-2','nome','Aline Souza Lima','cargo','Operadora de Caixa','dataAdmissao','2023-09-01','salario',1850,'status','Ativo','cpf','202.303.404-55','rg','4567890 SSP/SE','email','aline@solnascente.com.br','telefone','(79) 98811-2201','dataNascimento','1996-11-02','filhosCount',0,'historicoSalario',jsonb_build_array(jsonb_build_object('data','2026-02-01','motivo','Piso da categoria','valor',1850)),'documentosAdmissao',jsonb_build_array(jsonb_build_object('nome','Contrato de experiência','status','Entregue'), jsonb_build_object('nome','ASO admissional','status','Entregue')))
      ),
      ferias = jsonb_build_array(jsonb_build_object('id','ferias-mercado-1','funcionarioNome','Carlos Eduardo Santos','cargo','Gerente de Loja','dataInicio','2026-08-05','dataFim','2026-08-24','status','Agendada','dias',20)),
      documentos = '[]'::jsonb,
      pastas_documentos = ARRAY['01 - Cadastro','02 - Fiscal','03 - Trabalhista','04 - Financeiro','05 - Entregas','06 - Concluídos'],
      categorias_documentos = ARRAY['Contrato Social','Notas Fiscais','Folha de Pagamento','Guias Pagas','Relatórios'],
      capital_social = 180000,
      socios = jsonb_build_array(jsonb_build_object('id','socio-mercado-1','nome','Patrícia Menezes','participacao',70,'capital',126000,'cargo','Sócio-Administrador'), jsonb_build_object('id','socio-mercado-2','nome','Roberto Menezes','participacao',30,'capital',54000,'cargo','Sócio Quotista')),
      historico_corporativo = jsonb_build_array(jsonb_build_object('id','etapa-1','data','2026-07-01','titulo','Etapa 1 - Cadastro revisado','descricao','Dados cadastrais atualizados para teste.'), jsonb_build_object('id','etapa-2','data','2026-07-05','titulo','Etapa 2 - Documentos fiscais','descricao','Pastas fiscais e trabalhistas criadas.'), jsonb_build_object('id','etapa-3','data','2026-07-10','titulo','Etapa 3 - Rotinas em execução','descricao','Tarefas mensais vinculadas ao cliente.')),
      certificados = jsonb_build_array(jsonb_build_object('id','cert-mercado-1','tipo','e-CNPJ Empresa','descricao','Certificado A1 para emissao e transmissao','titular','Mercado Sol Nascente Ltda','dataEnvio','2026-07-10','dataValidade','2027-07-10','senha','demo123','arquivoNome','certificado-sol-nascente.pfx')),
      polos = '[]'::jsonb,
      modelos_ativos = v_modelos,
      cnae = '4712-1/00',
      cnae_descricao = 'Comércio varejista de mercadorias em geral',
      updated_at = now()
  WHERE id = v_cliente_mercado
    AND empresa_id = v_empresa_id;

  UPDATE public.clientes
  SET nome = 'Clínica Vida Plena',
      razao_social = 'Vida Plena Serviços Médicos Ltda',
      cnpj = '22.517.640/0001-18',
      tipo = 'Lucro Presumido',
      categoria_cliente = 'Saúde',
      tipo_estabelecimento = 'Matriz',
      funcionarios_count = 7,
      status = 'Ativa',
      email = 'administrativo@vidaplena.med.br',
      telefone = '(79) 3222-9040',
      endereco = 'Avenida Barão de Maruim, 910',
      cidade = 'Aracaju',
      uf = 'SE',
      cep = '49010-340',
      bairro = 'São José',
      contato = 'Dra. Helena Prado',
      inscricao_estadual = 'Isento',
      funcionarios = jsonb_build_array(
        jsonb_build_object('id','func-clinica-1','nome','Helena Prado','cargo','Diretora Técnica','dataAdmissao','2020-01-15','salario',9800,'status','Ativo','cpf','303.404.505-66','rg','7891234 SSP/SE','email','helena@vidaplena.med.br','telefone','(79) 98822-3300','dataNascimento','1982-08-19','filhosCount',1,'historicoSalario',jsonb_build_array(jsonb_build_object('data','2026-03-01','motivo','Ajuste contratual','valor',9800)),'documentosAdmissao',jsonb_build_array(jsonb_build_object('nome','CRM','status','Entregue'), jsonb_build_object('nome','Comprovante de endereço','status','Entregue'))),
        jsonb_build_object('id','func-clinica-2','nome','Marcos Vinícius Rocha','cargo','Recepcionista','dataAdmissao','2024-02-12','salario',2100,'status','Ativo','cpf','404.505.606-77','rg','1472583 SSP/SE','email','marcos@vidaplena.med.br','telefone','(79) 98822-3301','dataNascimento','1993-04-22','filhosCount',0,'historicoSalario',jsonb_build_array(jsonb_build_object('data','2026-04-01','motivo','Reajuste funcional','valor',2100)),'documentosAdmissao',jsonb_build_array(jsonb_build_object('nome','Contrato de trabalho','status','Entregue'), jsonb_build_object('nome','ASO admissional','status','Pendente')))
      ),
      ferias = jsonb_build_array(jsonb_build_object('id','ferias-clinica-1','funcionarioNome','Marcos Vinícius Rocha','cargo','Recepcionista','dataInicio','2026-09-01','dataFim','2026-09-15','status','Agendada','dias',15)),
      documentos = '[]'::jsonb,
      pastas_documentos = ARRAY['01 - Cadastro','02 - Fiscal','03 - Trabalhista','04 - Financeiro','05 - Entregas','06 - Concluídos'],
      categorias_documentos = ARRAY['Alvarás','Contratos Médicos','Notas Fiscais','Folha','Guias'],
      capital_social = 250000,
      socios = jsonb_build_array(jsonb_build_object('id','socio-clinica-1','nome','Helena Prado','participacao',60,'capital',150000,'cargo','Sócio-Administrador'), jsonb_build_object('id','socio-clinica-2','nome','Ricardo Prado','participacao',40,'capital',100000,'cargo','Sócio Quotista')),
      historico_corporativo = jsonb_build_array(jsonb_build_object('id','etapa-1','data','2026-07-02','titulo','Etapa 1 - Dados societários','descricao','Contrato social revisado.'), jsonb_build_object('id','etapa-2','data','2026-07-08','titulo','Etapa 2 - Licenças e alvarás','descricao','Controle documental de saúde separado por etapa.'), jsonb_build_object('id','etapa-3','data','2026-07-12','titulo','Etapa 3 - Folha conferida','descricao','Tarefa de folha parcialmente concluída.')),
      certificados = jsonb_build_array(jsonb_build_object('id','cert-clinica-1','tipo','e-CNPJ Empresa','descricao','Certificado A1 para transmissao fiscal','titular','Vida Plena Serviços Médicos Ltda','dataEnvio','2026-06-20','dataValidade','2027-06-20','senha','demo456','arquivoNome','certificado-vida-plena.pfx')),
      polos = jsonb_build_array(jsonb_build_object('id','filial-clinica-1','companyId',v_cliente_clinica::text,'nome','Unidade Atalaia','cnpj','22.517.640/0002-07','email','atalaia@vidaplena.med.br','telefone','(79) 3222-9041','cidade','Aracaju','uf','SE','bairro','Atalaia','contato','Paula Prado','ativo',true,'endereco','Avenida Santos Dumont, 1400','cep','49035-730')),
      modelos_ativos = v_modelos,
      cnae = '8630-5/03',
      cnae_descricao = 'Atividade médica ambulatorial restrita a consultas',
      updated_at = now()
  WHERE id = v_cliente_clinica
    AND empresa_id = v_empresa_id;

  SELECT id INTO v_cliente_agro
  FROM public.clientes
  WHERE empresa_id = v_empresa_id
    AND cnpj = '33.746.980/0001-05'
  LIMIT 1;

  IF v_cliente_agro IS NULL THEN
    INSERT INTO public.clientes (
      empresa_id, nome, razao_social, cnpj, tipo, categoria_cliente, tipo_estabelecimento,
      funcionarios_count, status, email, telefone, endereco, cidade, uf, cep, bairro, contato,
      inscricao_estadual, funcionarios, ferias, documentos, pastas_documentos, categorias_documentos,
      capital_social, socios, historico_corporativo, certificados, polos, modelos_ativos, cnae, cnae_descricao
    )
    VALUES (
      v_empresa_id,
      'AgroVale Insumos',
      'AgroVale Insumos Agrícolas Ltda',
      '33.746.980/0001-05',
      'Lucro Real',
      'Agronegócio',
      'Matriz',
      24,
      'Ativa',
      'controladoria@agrovale.com.br',
      '(79) 3261-7788',
      'Rodovia SE-270, Km 14',
      'Lagarto',
      'SE',
      '49400-000',
      'Zona Rural',
      'Sérgio Andrade',
      '27.765.432-1',
      jsonb_build_array(jsonb_build_object('id','func-agro-1','nome','Sérgio Andrade','cargo','Gerente Operacional','dataAdmissao','2019-05-20','salario',7200,'status','Ativo','cpf','505.606.707-88','rg','9638527 SSP/SE','email','sergio@agrovale.com.br','telefone','(79) 98777-4100','dataNascimento','1984-12-05','filhosCount',2,'historicoSalario',jsonb_build_array(jsonb_build_object('data','2026-01-01','motivo','Reajuste anual','valor',7200)),'documentosAdmissao',jsonb_build_array(jsonb_build_object('nome','CNH','status','Entregue'), jsonb_build_object('nome','ASO','status','Entregue')))),
      jsonb_build_array(),
      '[]'::jsonb,
      ARRAY['01 - Cadastro','02 - Fiscal','03 - Trabalhista','04 - Financeiro','05 - Entregas','06 - Concluídos'],
      ARRAY['Contratos Rurais','Notas de Insumos','Estoque','Folha Rural','Guias'],
      900000,
      jsonb_build_array(jsonb_build_object('id','socio-agro-1','nome','Sérgio Andrade','participacao',80,'capital',720000,'cargo','Sócio-Administrador'), jsonb_build_object('id','socio-agro-2','nome','Márcia Andrade','participacao',20,'capital',180000,'cargo','Sócio Quotista')),
      jsonb_build_array(jsonb_build_object('id','etapa-1','data','2026-07-03','titulo','Etapa 1 - Implantação','descricao','Cliente adicionado para testar fluxo completo.'), jsonb_build_object('id','etapa-2','data','2026-07-09','titulo','Etapa 2 - Fiscal agro','descricao','Documentos de insumos e notas separados.'), jsonb_build_object('id','etapa-3','data','2026-07-13','titulo','Etapa 3 - Atividades abertas','descricao','Pendências fiscais e contábeis em andamento.')),
      jsonb_build_array(),
      jsonb_build_array(),
      v_modelos,
      '4623-1/09',
      'Comércio atacadista de alimentos para animais'
    )
    RETURNING id INTO v_cliente_agro;
  ELSE
    UPDATE public.clientes
    SET nome = 'AgroVale Insumos',
        razao_social = 'AgroVale Insumos Agrícolas Ltda',
        cnpj = '33.746.980/0001-05',
        tipo = 'Lucro Real',
        categoria_cliente = 'Agronegócio',
        tipo_estabelecimento = 'Matriz',
        funcionarios_count = 24,
        status = 'Ativa',
        email = 'controladoria@agrovale.com.br',
        telefone = '(79) 3261-7788',
        endereco = 'Rodovia SE-270, Km 14',
        cidade = 'Lagarto',
        uf = 'SE',
        cep = '49400-000',
        bairro = 'Zona Rural',
        contato = 'Sérgio Andrade',
        pastas_documentos = ARRAY['01 - Cadastro','02 - Fiscal','03 - Trabalhista','04 - Financeiro','05 - Entregas','06 - Concluídos'],
        categorias_documentos = ARRAY['Contratos Rurais','Notas de Insumos','Estoque','Folha Rural','Guias'],
        modelos_ativos = v_modelos,
        updated_at = now()
    WHERE id = v_cliente_agro;
  END IF;

  DELETE FROM public.documentos
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.documentos_categorias
  WHERE empresa_id = v_empresa_id;

  UPDATE public.parametrizacao_pastas_documentos
  SET ativo = false,
      updated_at = now()
  WHERE empresa_id = v_empresa_id;

  FOR v_pasta IN
    SELECT unnest(ARRAY[
      '01 - Cadastro',
      '02 - Fiscal',
      '03 - Trabalhista',
      '04 - Financeiro',
      '05 - Entregas',
      '06 - Concluídos',
      'Biblioteca/Modelos',
      'Biblioteca/Checklists',
      'Biblioteca/Procedimentos'
    ])
  LOOP
    INSERT INTO public.parametrizacao_pastas_documentos (empresa_id, codigo, caminho, descricao, sistema, ativo, ordem)
    VALUES (
      v_empresa_id,
      lower(regexp_replace(v_pasta, '[^a-zA-Z0-9]+', '-', 'g')),
      v_pasta,
      'Pasta demo criada para conferencia do modulo documentos.',
      false,
      true,
      200
    )
    ON CONFLICT (empresa_id, caminho) DO UPDATE
    SET codigo = EXCLUDED.codigo,
        descricao = EXCLUDED.descricao,
        ativo = true,
        updated_at = now();
  END LOOP;

  INSERT INTO public.documentos_categorias (empresa_id, cliente_id, nome, ativo, sistema, ordem)
  VALUES
    (v_empresa_id, NULL, 'Modelos Internos', true, false, 10),
    (v_empresa_id, NULL, 'Checklists', true, false, 20),
    (v_empresa_id, NULL, 'Procedimentos', true, false, 30),
    (v_empresa_id, v_cliente_mercado, 'Contrato Social', true, false, 10),
    (v_empresa_id, v_cliente_mercado, 'Notas Fiscais', true, false, 20),
    (v_empresa_id, v_cliente_clinica, 'Alvarás', true, false, 10),
    (v_empresa_id, v_cliente_clinica, 'Folha', true, false, 20),
    (v_empresa_id, v_cliente_agro, 'Contratos Rurais', true, false, 10),
    (v_empresa_id, v_cliente_agro, 'Notas de Insumos', true, false, 20);

  INSERT INTO public.documentos (
    empresa_id, owner_user_id, scope, cliente_id, storage_bucket, storage_path,
    nome, tipo, descricao, pasta, data_validade, mime_type, tamanho_bytes
  )
  VALUES
    (v_empresa_id, v_owner_user_id, 'pessoal', NULL, 'amostras_xml', '/documentos/biblioteca-demo/guia-biblioteca-documentos.txt', 'Guia da Biblioteca de Documentos.txt', 'Procedimentos', 'Arquivo novo da biblioteca para orientar organizacao por etapas.', 'Biblioteca/Procedimentos', NULL, 'text/plain', 620),
    (v_empresa_id, v_owner_user_id, 'pessoal', NULL, 'amostras_xml', '/documentos/biblioteca-demo/checklist-fiscal-mensal.txt', 'Checklist Fiscal Mensal.txt', 'Checklists', 'Modelo de checklist fiscal para conferencia mensal.', 'Biblioteca/Checklists', NULL, 'text/plain', 420),
    (v_empresa_id, v_owner_user_id, 'pessoal', NULL, 'amostras_xml', '/documentos/biblioteca-demo/roteiro-admissao-funcionario.txt', 'Roteiro de Admissão de Funcionário.txt', 'Modelos Internos', 'Roteiro para testar arquivos trabalhistas na biblioteca.', 'Biblioteca/Modelos', NULL, 'text/plain', 420),
    (v_empresa_id, v_owner_user_id, 'pessoal', NULL, 'amostras_xml', '/documentos/biblioteca-demo/modelo-controle-pendencias.txt', 'Modelo de Controle de Pendências.txt', 'Modelos Internos', 'Modelo para acompanhamento de pendencias por cliente.', 'Biblioteca/Modelos', NULL, 'text/plain', 360),
    (v_empresa_id, v_owner_user_id, 'empresa', v_cliente_mercado::text, 'amostras_xml', '/documentos/biblioteca-demo/checklist-fiscal-mensal.txt?empresa=mercado-fiscal', 'Mercado Sol Nascente - Checklist Fiscal.txt', 'Notas Fiscais', 'Documento de teste vinculado a etapa fiscal.', '02 - Fiscal', CURRENT_DATE + 45, 'text/plain', 420),
    (v_empresa_id, v_owner_user_id, 'empresa', v_cliente_mercado::text, 'amostras_xml', '/documentos/biblioteca-demo/modelo-controle-pendencias.txt?empresa=mercado-entregas', 'Mercado Sol Nascente - Pendências.txt', 'Relatórios', 'Controle de pendencias do cliente.', '05 - Entregas', CURRENT_DATE + 15, 'text/plain', 360),
    (v_empresa_id, v_owner_user_id, 'empresa', v_cliente_clinica::text, 'amostras_xml', '/documentos/biblioteca-demo/roteiro-admissao-funcionario.txt?empresa=clinica-trabalhista', 'Clínica Vida Plena - Admissão.txt', 'Folha', 'Documento trabalhista para testar pasta por empresa.', '03 - Trabalhista', CURRENT_DATE + 30, 'text/plain', 420),
    (v_empresa_id, v_owner_user_id, 'empresa', v_cliente_agro::text, 'amostras_xml', '/documentos/biblioteca-demo/guia-biblioteca-documentos.txt?empresa=agro-cadastro', 'AgroVale Insumos - Guia Documental.txt', 'Contratos Rurais', 'Documento de cadastro e organizacao por etapas.', '01 - Cadastro', CURRENT_DATE + 60, 'text/plain', 620);

  DELETE FROM public.atividades_tarefas
  WHERE empresa_id = v_empresa_id;

  DELETE FROM public.atividades_rotinas
  WHERE empresa_id = v_empresa_id
    AND sistema = false;

  INSERT INTO public.atividades_rotinas (
    empresa_id, codigo, nome, categoria, frequencia, intervalo_dias, responsavel_nome,
    cliente_nome, proxima_execucao, prioridade, checklist, observacoes, incluir_finais_de_semana, sistema, ativa
  )
  VALUES
    (v_empresa_id, 'demo-fiscal-mensal', 'Conferência fiscal mensal', 'Fiscal', 'Mensal', 30, 'Rafael Lima Fiscal', 'Mercado Sol Nascente', CURRENT_DATE + 2, 'Alta', '["Receber XMLs","Conferir notas","Apurar impostos","Registrar protocolo"]'::jsonb, 'Rotina criada para testar fluxo fiscal.', false, false, true),
    (v_empresa_id, 'demo-folha-mensal', 'Fechamento de folha', 'Folha', 'Mensal', 30, 'Marina Costa Funcionária', 'Clínica Vida Plena', CURRENT_DATE + 4, 'Média', '["Conferir ponto","Validar admissões","Gerar encargos","Enviar guias"]'::jsonb, 'Rotina criada para testar fluxo trabalhista.', false, false, true),
    (v_empresa_id, 'demo-documentos-semanal', 'Cobrança de documentos pendentes', 'Cliente', 'Semanal', 7, 'João Silva Administrador', 'AgroVale Insumos', CURRENT_DATE + 1, 'Alta', '["Listar pendências","Enviar solicitação","Registrar retorno"]'::jsonb, 'Rotina semanal para conferir comunicação com cliente.', false, false, true),
    (v_empresa_id, 'demo-contabil-mensal', 'Conciliação contábil', 'Contábil', 'Mensal', 30, 'Bianca Rocha Financeiro', 'Escritório', CURRENT_DATE + 7, 'Média', '["Importar extratos","Conciliar lançamentos","Revisar saldos"]'::jsonb, 'Rotina interna de conciliação.', false, false, true)
  ON CONFLICT (empresa_id, codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      categoria = EXCLUDED.categoria,
      frequencia = EXCLUDED.frequencia,
      intervalo_dias = EXCLUDED.intervalo_dias,
      responsavel_nome = EXCLUDED.responsavel_nome,
      cliente_nome = EXCLUDED.cliente_nome,
      proxima_execucao = EXCLUDED.proxima_execucao,
      prioridade = EXCLUDED.prioridade,
      checklist = EXCLUDED.checklist,
      observacoes = EXCLUDED.observacoes,
      ativa = true,
      atualizado_em = now();

  SELECT id INTO v_rotina_fiscal FROM public.atividades_rotinas WHERE empresa_id = v_empresa_id AND codigo = 'demo-fiscal-mensal';
  SELECT id INTO v_rotina_folha FROM public.atividades_rotinas WHERE empresa_id = v_empresa_id AND codigo = 'demo-folha-mensal';
  SELECT id INTO v_rotina_documentos FROM public.atividades_rotinas WHERE empresa_id = v_empresa_id AND codigo = 'demo-documentos-semanal';
  SELECT id INTO v_rotina_contabil FROM public.atividades_rotinas WHERE empresa_id = v_empresa_id AND codigo = 'demo-contabil-mensal';

  INSERT INTO public.atividades_tarefas (
    empresa_id, rotina_id, cliente_id, titulo, categoria, frequencia, responsavel_nome,
    cliente_nome, competencia, vencimento, prioridade, status, origem, checklist, notas,
    data_hora_conclusao, observacao_falta, ativo
  )
  VALUES
    (v_empresa_id, v_rotina_fiscal, v_cliente_mercado, 'Apurar DAS e conferir notas de julho', 'Fiscal', 'Mensal', 'Rafael Lima Fiscal', 'Mercado Sol Nascente', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE, 'Alta', 'Em andamento', 'Rotina', '[{"titulo":"Receber XMLs","concluida":true},{"titulo":"Conferir notas","concluida":true},{"titulo":"Apurar guia","concluida":false}]'::jsonb, 'Faltam duas notas de serviço.', NULL, NULL, true),
    (v_empresa_id, v_rotina_folha, v_cliente_clinica, 'Fechar folha e enviar encargos', 'Folha', 'Mensal', 'Marina Costa Funcionária', 'Clínica Vida Plena', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE + 1, 'Média', 'Pendente', 'Rotina', '[{"titulo":"Conferir ponto","concluida":false},{"titulo":"Validar admissões","concluida":false},{"titulo":"Gerar guias","concluida":false}]'::jsonb, 'Aguardando ASO de um funcionário.', NULL, 'ASO admissional pendente.', true),
    (v_empresa_id, v_rotina_documentos, v_cliente_agro, 'Cobrar contratos rurais e notas de insumos', 'Cliente', 'Semanal', 'João Silva Administrador', 'AgroVale Insumos', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE - 1, 'Alta', 'Pendente', 'Manual', '[{"titulo":"Enviar solicitação","concluida":true},{"titulo":"Cliente retornou","concluida":false}]'::jsonb, 'Atrasada para testar alerta de prazo.', NULL, 'Cliente ainda nao enviou documentos.', true),
    (v_empresa_id, v_rotina_contabil, NULL, 'Conciliar extratos do escritório', 'Contábil', 'Mensal', 'Bianca Rocha Financeiro', 'Escritório', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE - 2, 'Média', 'Concluída', 'Manual', '[{"titulo":"Importar extratos","concluida":true},{"titulo":"Conciliar saldos","concluida":true},{"titulo":"Registrar divergências","concluida":true}]'::jsonb, 'Tarefa marcada como realizada para teste.', now() - interval '3 hours', NULL, true),
    (v_empresa_id, NULL, v_cliente_mercado, 'Atualizar dados cadastrais do Mercado Sol Nascente', 'Controle', 'Única', 'João Silva Administrador', 'Mercado Sol Nascente', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE + 3, 'Baixa', 'Concluída', 'Manual', '[{"titulo":"Conferir CNPJ","concluida":true},{"titulo":"Conferir endereço","concluida":true}]'::jsonb, 'Concluída para testar histórico.', now() - interval '1 day', NULL, true),
    (v_empresa_id, NULL, v_cliente_clinica, 'Revisar alvarás da Clínica Vida Plena', 'Cliente', 'Única', 'Rafael Lima Fiscal', 'Clínica Vida Plena', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE + 5, 'Alta', 'Em andamento', 'Manual', '[{"titulo":"Conferir alvará sanitário","concluida":true},{"titulo":"Validar vencimento","concluida":false}]'::jsonb, 'Alvará sanitário em conferência.', NULL, NULL, true),
    (v_empresa_id, NULL, v_cliente_agro, 'Separar documentos da etapa fiscal AgroVale', 'Fiscal', 'Única', 'Marina Costa Funcionária', 'AgroVale Insumos', to_char(CURRENT_DATE, 'YYYY-MM'), CURRENT_DATE + 6, 'Média', 'Pendente', 'Usuario', '[{"titulo":"Organizar pasta 02 - Fiscal","concluida":false},{"titulo":"Anexar notas de insumos","concluida":false}]'::jsonb, 'Criada para testar etapa por empresa.', NULL, NULL, true);
END;
$$;

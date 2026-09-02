-- Separa porte/enquadramento, natureza jurídica e categoria de atividade.
-- Os catálogos são multiempresa. Aliases oficiais antigos são arquivados
-- somente depois de seus vínculos serem movidos ao UUID canônico do tenant.

BEGIN;

SET LOCAL lock_timeout = '15s';

-- Empresas vem primeiro para que nenhum tenant seja criado entre o seed
-- canônico e a instalação do gatilho de provisionamento. Depois a ordem é
-- catálogo -> clientes, impedindo referência legada durante a consolidação.
LOCK TABLE public.empresas IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.parametrizacao_catalogos IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;

-- Porte / enquadramento. Pessoa Física permanece disponível exclusivamente
-- para cadastros por CPF e não é tratada como porte de pessoa jurídica.
WITH padroes(codigo, nome, descricao, ordem) AS (
  VALUES
    ('pessoa_fisica', 'Pessoa Física',
      'Parceiro PF/autônomo sem CNPJ, usado para atendimentos e rotinas pessoais.', 10),
    ('mei', 'MEI',
      'Microempreendedor individual com rotinas simplificadas.', 20),
    ('microempresa', 'ME',
      'Microempresa, conforme o porte oficial cadastrado no CNPJ.', 30),
    ('epp', 'EPP',
      'Empresa de pequeno porte, conforme o cadastro oficial.', 40),
    ('demais', 'Demais',
      'Demais portes e empresas sem enquadramento como MEI, ME ou EPP.', 50)
)
INSERT INTO public.parametrizacao_catalogos (
  empresa_id, tipo, codigo, nome, descricao, sistema, ativo, ordem
)
SELECT
  empresa.id,
  'tipos_empresa',
  padrao.codigo,
  padrao.nome,
  padrao.descricao,
  true,
  true,
  padrao.ordem
FROM public.empresas empresa
CROSS JOIN padroes padrao
ON CONFLICT (empresa_id, tipo, codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    sistema = true,
    ativo = true,
    ordem = EXCLUDED.ordem
WHERE (
  parametrizacao_catalogos.nome,
  parametrizacao_catalogos.descricao,
  parametrizacao_catalogos.sistema,
  parametrizacao_catalogos.ativo,
  parametrizacao_catalogos.ordem
) IS DISTINCT FROM (
  EXCLUDED.nome,
  EXCLUDED.descricao,
  true,
  true,
  EXCLUDED.ordem
);

-- Estes dois conceitos eram oferecidos como "tipo de empresa", mas não são
-- portes. Os códigos canônicos continuam existindo, inativos, para receber as
-- referências históricas exatas de te-5/te-6 sem inventar outro enquadramento.
WITH legados(codigo, nome, descricao, ordem) AS (
  VALUES
    ('isenta_imune', 'Isenta / Imune',
      'Entidade ou operação com tratamento tributário diferenciado.', 90),
    ('holding_patrimonial', 'Holding / Patrimonial',
      'Empresa com acompanhamento societário e documental específico.', 100)
)
INSERT INTO public.parametrizacao_catalogos (
  empresa_id, tipo, codigo, nome, descricao, sistema, ativo, ordem
)
SELECT
  empresa.id,
  'tipos_empresa',
  legado.codigo,
  legado.nome,
  legado.descricao,
  true,
  false,
  legado.ordem
FROM public.empresas empresa
CROSS JOIN legados legado
ON CONFLICT (empresa_id, tipo, codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    sistema = true,
    ativo = false,
    ordem = EXCLUDED.ordem
WHERE (
  parametrizacao_catalogos.nome,
  parametrizacao_catalogos.descricao,
  parametrizacao_catalogos.sistema,
  parametrizacao_catalogos.ativo,
  parametrizacao_catalogos.ordem
) IS DISTINCT FROM (
  EXCLUDED.nome,
  EXCLUDED.descricao,
  true,
  false,
  EXCLUDED.ordem
);

-- Naturezas jurídicas. O nome completo e a sigla permanecem juntos para
-- facilitar a conciliação com a consulta oficial de CNPJ.
WITH padroes(codigo, nome, descricao, ordem) AS (
  VALUES
    ('empresario_individual', 'Empresário Individual (EI)',
      'Pessoa física titular de atividade empresarial.', 10),
    ('sociedade_limitada', 'Sociedade Limitada (LTDA)',
      'Empresa formada por sócios com quotas de participação.', 20),
    ('sociedade_limitada_unipessoal', 'Sociedade Limitada Unipessoal (SLU)',
      'Modelo societário com um único titular.', 30),
    ('associacao_privada', 'Associação',
      'Entidade sem fins lucrativos com obrigações próprias.', 40),
    ('sociedade_anonima', 'Sociedade Anônima (S.A.)',
      'Sociedade empresária com capital dividido em ações.', 50),
    ('cooperativa', 'Cooperativa',
      'Sociedade de pessoas organizada para atividade cooperativa.', 60),
    ('fundacao_privada', 'Fundação',
      'Entidade privada constituída a partir de um patrimônio destinado a uma finalidade.', 70),
    ('sociedade_simples', 'Sociedade Simples',
      'Sociedade voltada a atividades intelectuais, científicas, literárias ou artísticas.', 80),
    ('organizacao_religiosa', 'Organização Religiosa',
      'Pessoa jurídica privada constituída para finalidade religiosa.', 90)
)
INSERT INTO public.parametrizacao_catalogos (
  empresa_id, tipo, codigo, nome, descricao, sistema, ativo, ordem
)
SELECT
  empresa.id,
  'naturezas_juridicas',
  padrao.codigo,
  padrao.nome,
  padrao.descricao,
  true,
  true,
  padrao.ordem
FROM public.empresas empresa
CROSS JOIN padroes padrao
ON CONFLICT (empresa_id, tipo, codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    sistema = true,
    ativo = true,
    ordem = EXCLUDED.ordem
WHERE (
  parametrizacao_catalogos.nome,
  parametrizacao_catalogos.descricao,
  parametrizacao_catalogos.sistema,
  parametrizacao_catalogos.ativo,
  parametrizacao_catalogos.ordem
) IS DISTINCT FROM (
  EXCLUDED.nome,
  EXCLUDED.descricao,
  true,
  true,
  EXCLUDED.ordem
);

-- Mapa fechado dos aliases publicados originalmente pelo sistema. A
-- consolidação é por empresa + catálogo + código; nomes parecidos criados
-- pelo usuário nunca são usados para inferir equivalência.
CREATE TEMPORARY TABLE catalogos_aliases_exatos_para_consolidar
ON COMMIT DROP
AS
SELECT mapa.tipo, mapa.codigo_alias, mapa.codigo_canonico,
  mapa.nome_canonico, mapa.ativo_canonico
FROM (VALUES
  ('tipos_empresa', 'te-1', 'pessoa_fisica', 'Pessoa Física', true),
  ('tipos_empresa', 'te-2', 'mei', 'MEI', true),
  ('tipos_empresa', 'te-3', 'microempresa', 'ME', true),
  ('tipos_empresa', 'te-4', 'epp', 'EPP', true),
  ('tipos_empresa', 'te-5', 'isenta_imune', 'Isenta / Imune', false),
  ('tipos_empresa', 'te-6', 'holding_patrimonial', 'Holding / Patrimonial', false),
  ('naturezas_juridicas', 'nj-1', 'empresario_individual',
    'Empresário Individual (EI)', true),
  ('naturezas_juridicas', 'nj-2', 'sociedade_limitada',
    'Sociedade Limitada (LTDA)', true),
  ('naturezas_juridicas', 'nj-3', 'sociedade_limitada_unipessoal',
    'Sociedade Limitada Unipessoal (SLU)', true),
  ('naturezas_juridicas', 'nj-4', 'associacao_privada', 'Associação', true)
) AS mapa(
  tipo, codigo_alias, codigo_canonico, nome_canonico, ativo_canonico
);

-- A migration para atomicamente se um alias conhecido não tiver seu destino
-- canônico no mesmo tenant. Assim nenhuma referência pode cruzar empresas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos alias
    JOIN catalogos_aliases_exatos_para_consolidar mapa
      ON mapa.tipo = alias.tipo
     AND mapa.codigo_alias = alias.codigo
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos canonico
      WHERE canonico.empresa_id = alias.empresa_id
        AND canonico.tipo = mapa.tipo
        AND canonico.codigo = mapa.codigo_canonico
    )
  ) THEN
    RAISE EXCEPTION
      'Alias legado sem classificação canônica no mesmo tenant.';
  END IF;
END;
$$;

-- O alias te-2 e o código canônico mei só podem normalizar cadastros que já
-- estejam marcados como MEI ou Simples Nacional. Lucro Real, Presumido e
-- Isenta são contradições fiscais e exigem decisão humana; a migration aborta
-- atomicamente em vez de alterar o discriminador usado pelas obrigações.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
     AND catalogo.empresa_id = cliente.empresa_id
     AND catalogo.tipo = 'tipos_empresa'
     AND catalogo.codigo IN ('te-2', 'mei')
    WHERE cliente.tipo NOT IN ('MEI', 'Simples Nacional')
  ) THEN
    RAISE EXCEPTION
      'Há cliente de regime incompatível associado ao enquadramento MEI.';
  END IF;
END;
$$;

-- Primeiro preserva os vínculos, trocando somente aliases de significado
-- comprovadamente idêntico. Os UUIDs canônicos sempre pertencem ao tenant do
-- cliente por construção e pelas FKs compostas existentes.
UPDATE public.clientes cliente
SET tipo_empresa_id = canonico.id,
    tipo_empresa_catalogo_tipo = 'tipos_empresa'
FROM catalogos_aliases_exatos_para_consolidar mapa
JOIN public.parametrizacao_catalogos alias
  ON alias.tipo = mapa.tipo
 AND alias.codigo = mapa.codigo_alias
JOIN public.parametrizacao_catalogos canonico
  ON canonico.empresa_id = alias.empresa_id
 AND canonico.tipo = mapa.tipo
 AND canonico.codigo = mapa.codigo_canonico
WHERE mapa.tipo = 'tipos_empresa'
  AND cliente.empresa_id = alias.empresa_id
  AND cliente.tipo_empresa_id = alias.id
  AND cliente.tipo_empresa_id IS DISTINCT FROM canonico.id;

UPDATE public.clientes cliente
SET natureza_juridica_id = canonico.id,
    natureza_juridica_catalogo_tipo = 'naturezas_juridicas'
FROM catalogos_aliases_exatos_para_consolidar mapa
JOIN public.parametrizacao_catalogos alias
  ON alias.tipo = mapa.tipo
 AND alias.codigo = mapa.codigo_alias
JOIN public.parametrizacao_catalogos canonico
  ON canonico.empresa_id = alias.empresa_id
 AND canonico.tipo = mapa.tipo
 AND canonico.codigo = mapa.codigo_canonico
WHERE mapa.tipo = 'naturezas_juridicas'
  AND cliente.empresa_id = alias.empresa_id
  AND cliente.natureza_juridica_id = alias.id
  AND cliente.natureza_juridica_id IS DISTINCT FROM canonico.id;

-- PF e MEI também possuem discriminadores operacionais em clientes.tipo.
-- O valor operacional inequívoco prevalece; nenhum regime de CNPJ é usado
-- para inferir ME, EPP ou Demais.
WITH enquadramento_explicito AS (
  SELECT empresa_id, codigo, id
  FROM public.parametrizacao_catalogos
  WHERE tipo = 'tipos_empresa'
    AND codigo IN ('pessoa_fisica', 'mei')
)
UPDATE public.clientes cliente
SET tipo_empresa_id = catalogo.id,
    tipo_empresa_catalogo_tipo = 'tipos_empresa'
FROM enquadramento_explicito catalogo
WHERE cliente.empresa_id = catalogo.empresa_id
  AND (
    (cliente.tipo = 'PF' AND catalogo.codigo = 'pessoa_fisica')
    OR (cliente.tipo = 'MEI' AND catalogo.codigo = 'mei')
  )
  AND cliente.tipo_empresa_id IS DISTINCT FROM catalogo.id;

-- MEI é exibido como porte e Simples Nacional como regime, mas o discriminador
-- `tipo=MEI` permanece internamente para as obrigações operacionais existentes.
UPDATE public.clientes cliente
SET tipo = 'MEI'
FROM public.parametrizacao_catalogos catalogo
WHERE catalogo.id = cliente.tipo_empresa_id
  AND catalogo.empresa_id = cliente.empresa_id
  AND catalogo.tipo = 'tipos_empresa'
  AND catalogo.codigo = 'mei'
  AND cliente.tipo IS DISTINCT FROM 'MEI';

-- Uma associação histórica contraditória entre CNPJ e te-1 não é corrigida
-- silenciosamente como PF: ela exige decisão humana e aborta toda a migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes cliente
    JOIN public.parametrizacao_catalogos catalogo
      ON catalogo.id = cliente.tipo_empresa_id
     AND catalogo.empresa_id = cliente.empresa_id
     AND catalogo.tipo = 'tipos_empresa'
     AND catalogo.codigo = 'pessoa_fisica'
    WHERE cliente.tipo IS DISTINCT FROM 'PF'
  ) THEN
    RAISE EXCEPTION
      'Há cliente CNPJ associado ao enquadramento Pessoa Física.';
  END IF;
END;
$$;

-- Os registros de alias ficam auditáveis, porém inativos e com nome distinto.
-- Isso evita colisão no índice normalizado sem apagar o histórico do catálogo.
UPDATE public.parametrizacao_catalogos alias
SET nome = mapa.nome_canonico || ' [legado ' || mapa.codigo_alias || ']',
    sistema = true,
    ativo = false
FROM catalogos_aliases_exatos_para_consolidar mapa
WHERE alias.tipo = mapa.tipo
  AND alias.codigo = mapa.codigo_alias
  AND (
    alias.nome,
    alias.sistema,
    alias.ativo
  ) IS DISTINCT FROM (
    mapa.nome_canonico || ' [legado ' || mapa.codigo_alias || ']',
    true,
    false
  );

-- Os botões de criação rápida não podem introduzir uma segunda opção com o
-- mesmo nome. Se já houver duplicidade, o deploy para sem mesclar UUIDs ou
-- reclassificar clientes; a correção pode então ser decidida explicitamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.tipo IN ('tipos_empresa', 'naturezas_juridicas')
    GROUP BY
      catalogo.empresa_id,
      catalogo.tipo,
      lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Há nomes duplicados em enquadramentos ou naturezas jurídicas.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  parametrizacao_catalogos_classificacoes_nome_norm_unq
ON public.parametrizacao_catalogos (
  empresa_id,
  tipo,
  lower(regexp_replace(btrim(nome), '[[:space:]]+', ' ', 'g'))
)
WHERE tipo IN ('tipos_empresa', 'naturezas_juridicas');

COMMENT ON INDEX public.parametrizacao_catalogos_classificacoes_nome_norm_unq IS
  'Impede nomes repetidos em enquadramentos e naturezas da mesma empresa.';


-- Empresas criadas depois desta migration recebem as mesmas opções sem
-- depender da permissão de parametrização do primeiro usuário do tenant.
CREATE OR REPLACE FUNCTION app_private.provisionar_classificacoes_parceiro_empresa_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.parametrizacao_catalogos (
    empresa_id, tipo, codigo, nome, descricao, sistema, ativo, ordem
  )
  SELECT NEW.id, padrao.tipo, padrao.codigo, padrao.nome,
    padrao.descricao, true, true, padrao.ordem
  FROM (VALUES
    ('tipos_empresa', 'pessoa_fisica', 'Pessoa Física',
      'Parceiro PF/autônomo sem CNPJ, usado para atendimentos e rotinas pessoais.', 10),
    ('tipos_empresa', 'mei', 'MEI',
      'Microempreendedor individual com rotinas simplificadas.', 20),
    ('tipos_empresa', 'microempresa', 'ME',
      'Microempresa, conforme o porte oficial cadastrado no CNPJ.', 30),
    ('tipos_empresa', 'epp', 'EPP',
      'Empresa de pequeno porte, conforme o cadastro oficial.', 40),
    ('tipos_empresa', 'demais', 'Demais',
      'Demais portes e empresas sem enquadramento como MEI, ME ou EPP.', 50),
    ('naturezas_juridicas', 'empresario_individual', 'Empresário Individual (EI)',
      'Pessoa física titular de atividade empresarial.', 10),
    ('naturezas_juridicas', 'sociedade_limitada', 'Sociedade Limitada (LTDA)',
      'Empresa formada por sócios com quotas de participação.', 20),
    ('naturezas_juridicas', 'sociedade_limitada_unipessoal',
      'Sociedade Limitada Unipessoal (SLU)', 'Modelo societário com um único titular.', 30),
    ('naturezas_juridicas', 'associacao_privada', 'Associação',
      'Entidade sem fins lucrativos com obrigações próprias.', 40),
    ('naturezas_juridicas', 'sociedade_anonima', 'Sociedade Anônima (S.A.)',
      'Sociedade empresária com capital dividido em ações.', 50),
    ('naturezas_juridicas', 'cooperativa', 'Cooperativa',
      'Sociedade de pessoas organizada para atividade cooperativa.', 60),
    ('naturezas_juridicas', 'fundacao_privada', 'Fundação',
      'Entidade privada constituída a partir de um patrimônio destinado a uma finalidade.', 70),
    ('naturezas_juridicas', 'sociedade_simples', 'Sociedade Simples',
      'Sociedade voltada a atividades intelectuais, científicas, literárias ou artísticas.', 80),
    ('naturezas_juridicas', 'organizacao_religiosa', 'Organização Religiosa',
      'Pessoa jurídica privada constituída para finalidade religiosa.', 90),
    ('tipos_parceiros', 'cliente_contabil', 'Cliente Contábil',
      'Empresa atendida diretamente pelo escritório.', 10),
    ('tipos_parceiros', 'parceiro_comercial', 'Parceiro Comercial',
      'Origem de indicações e oportunidades comerciais.', 20),
    ('tipos_parceiros', 'fornecedor', 'Fornecedor',
      'Prestador ou fornecedor vinculado às rotinas internas.', 30),
    ('tipos_parceiros', 'correspondente', 'Correspondente',
      'Parceiro operacional para demandas locais.', 40),
    ('categorias_clientes', 'clinica', 'Clínica',
      'Clínicas e estabelecimentos de serviços de saúde.', 10),
    ('categorias_clientes', 'comercio', 'Comércio',
      'Empresas de comércio varejista ou atacadista.', 20),
    ('categorias_clientes', 'restaurante', 'Restaurante',
      'Restaurantes, bares, lanchonetes e atividades de alimentação.', 30),
    ('categorias_clientes', 'transportadora', 'Transportadora',
      'Transportadoras e empresas de logística.', 40),
    ('categorias_clientes', 'escola', 'Escola',
      'Escolas, cursos e demais instituições de ensino.', 50),
    ('categorias_clientes', 'prestador_servicos', 'Prestador de Serviços',
      'Empresas e profissionais prestadores de serviços.', 60),
    ('categorias_clientes', 'industria', 'Indústria',
      'Empresas de produção e transformação industrial.', 70),
    ('categorias_clientes', 'agronegocio', 'Agronegócio',
      'Empresas rurais e da cadeia do agronegócio.', 80),
    ('categorias_clientes', 'outro', 'Outro',
      'Demais segmentos de atividade.', 90)
  ) AS padrao(tipo, codigo, nome, descricao, ordem)
  ON CONFLICT (empresa_id, tipo, codigo) DO NOTHING;

  INSERT INTO public.parametrizacao_catalogos (
    empresa_id, tipo, codigo, nome, descricao, sistema, ativo, ordem
  )
  SELECT NEW.id, 'tipos_empresa', legado.codigo, legado.nome,
    legado.descricao, true, false, legado.ordem
  FROM (VALUES
    ('isenta_imune', 'Isenta / Imune',
      'Entidade ou operação com tratamento tributário diferenciado.', 90),
    ('holding_patrimonial', 'Holding / Patrimonial',
      'Empresa com acompanhamento societário e documental específico.', 100)
  ) AS legado(codigo, nome, descricao, ordem)
  ON CONFLICT (empresa_id, tipo, codigo) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app_private.provisionar_classificacoes_parceiro_empresa_trigger()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS provisionar_classificacoes_parceiro_empresa
  ON public.empresas;
CREATE TRIGGER provisionar_classificacoes_parceiro_empresa
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.provisionar_classificacoes_parceiro_empresa_trigger();


COMMENT ON COLUMN public.clientes.tipo_empresa_id IS
  'Porte/enquadramento no catálogo multiempresa tipos_empresa.';

COMMENT ON COLUMN public.clientes.natureza_juridica_id IS
  'Natureza jurídica no catálogo multiempresa naturezas_juridicas.';

COMMIT;

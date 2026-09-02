-- Consolida categorias setoriais e instala a validação permanente dos vínculos.
-- O provisionamento de novas empresas já foi instalado na migration anterior.

BEGIN;

SET LOCAL lock_timeout = '15s';

-- A ordem de lock segue catálogo -> clientes, igual à etapa canônica.
LOCK TABLE public.parametrizacao_catalogos IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;

-- Repete, de forma idempotente, somente a consolidação necessária para fechar
-- a janela entre migrations. Se um cliente foi gravado com cache legado após
-- a etapa anterior, seu vínculo exato é movido antes de o gatilho ser ativado.
CREATE TEMPORARY TABLE catalogos_aliases_exatos_da_janela
ON COMMIT DROP
AS
SELECT mapa.tipo, mapa.codigo_alias, mapa.codigo_canonico,
  mapa.nome_canonico
FROM (VALUES
  ('tipos_empresa', 'te-1', 'pessoa_fisica', 'Pessoa Física'),
  ('tipos_empresa', 'te-2', 'mei', 'MEI'),
  ('tipos_empresa', 'te-3', 'microempresa', 'ME'),
  ('tipos_empresa', 'te-4', 'epp', 'EPP'),
  ('tipos_empresa', 'te-5', 'isenta_imune', 'Isenta / Imune'),
  ('tipos_empresa', 'te-6', 'holding_patrimonial', 'Holding / Patrimonial'),
  ('naturezas_juridicas', 'nj-1', 'empresario_individual',
    'Empresário Individual (EI)'),
  ('naturezas_juridicas', 'nj-2', 'sociedade_limitada',
    'Sociedade Limitada (LTDA)'),
  ('naturezas_juridicas', 'nj-3', 'sociedade_limitada_unipessoal',
    'Sociedade Limitada Unipessoal (SLU)'),
  ('naturezas_juridicas', 'nj-4', 'associacao_privada', 'Associação')
) AS mapa(tipo, codigo_alias, codigo_canonico, nome_canonico);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos alias
    JOIN catalogos_aliases_exatos_da_janela mapa
      ON mapa.tipo = alias.tipo AND mapa.codigo_alias = alias.codigo
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.parametrizacao_catalogos canonico
      WHERE canonico.empresa_id = alias.empresa_id
        AND canonico.tipo = mapa.tipo
        AND canonico.codigo = mapa.codigo_canonico
    )
  ) THEN
    RAISE EXCEPTION 'Alias legado sem destino canônico no mesmo tenant.';
  END IF;

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

UPDATE public.clientes cliente
SET tipo_empresa_id = canonico.id,
    tipo_empresa_catalogo_tipo = 'tipos_empresa'
FROM catalogos_aliases_exatos_da_janela mapa
JOIN public.parametrizacao_catalogos alias
  ON alias.tipo = mapa.tipo AND alias.codigo = mapa.codigo_alias
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
FROM catalogos_aliases_exatos_da_janela mapa
JOIN public.parametrizacao_catalogos alias
  ON alias.tipo = mapa.tipo AND alias.codigo = mapa.codigo_alias
JOIN public.parametrizacao_catalogos canonico
  ON canonico.empresa_id = alias.empresa_id
 AND canonico.tipo = mapa.tipo
 AND canonico.codigo = mapa.codigo_canonico
WHERE mapa.tipo = 'naturezas_juridicas'
  AND cliente.empresa_id = alias.empresa_id
  AND cliente.natureza_juridica_id = alias.id
  AND cliente.natureza_juridica_id IS DISTINCT FROM canonico.id;

WITH enquadramento_explicito AS (
  SELECT empresa_id, codigo, id
  FROM public.parametrizacao_catalogos
  WHERE tipo = 'tipos_empresa' AND codigo IN ('pessoa_fisica', 'mei')
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

UPDATE public.clientes cliente
SET tipo = 'MEI'
FROM public.parametrizacao_catalogos catalogo
WHERE catalogo.id = cliente.tipo_empresa_id
  AND catalogo.empresa_id = cliente.empresa_id
  AND catalogo.tipo = 'tipos_empresa'
  AND catalogo.codigo = 'mei'
  AND cliente.tipo IS DISTINCT FROM 'MEI';

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
    RAISE EXCEPTION 'Há cliente CNPJ associado ao enquadramento Pessoa Física.';
  END IF;
END;
$$;

UPDATE public.parametrizacao_catalogos alias
SET nome = mapa.nome_canonico || ' [legado ' || mapa.codigo_alias || ']',
    sistema = true,
    ativo = false
FROM catalogos_aliases_exatos_da_janela mapa
WHERE alias.tipo = mapa.tipo
  AND alias.codigo = mapa.codigo_alias
  AND (alias.nome, alias.sistema, alias.ativo) IS DISTINCT FROM (
    mapa.nome_canonico || ' [legado ' || mapa.codigo_alias || ']', true, false
  );

-- Categorias representam o segmento de atividade. A verificação por nome
-- normalizado evita conflito com uma categoria equivalente criada antes com
-- outro código e preserva esse registro do usuário.
WITH padroes(codigo, nome, descricao, ordem) AS (
  VALUES
    ('clinica', 'Clínica',
      'Clínicas e estabelecimentos de serviços de saúde.', 10),
    ('comercio', 'Comércio',
      'Empresas de comércio varejista ou atacadista.', 20),
    ('restaurante', 'Restaurante',
      'Restaurantes, bares, lanchonetes e atividades de alimentação.', 30),
    ('transportadora', 'Transportadora',
      'Transportadoras e empresas de logística.', 40),
    ('escola', 'Escola',
      'Escolas, cursos e demais instituições de ensino.', 50),
    ('prestador_servicos', 'Prestador de Serviços',
      'Empresas e profissionais prestadores de serviços.', 60),
    ('industria', 'Indústria',
      'Empresas de produção e transformação industrial.', 70),
    ('agronegocio', 'Agronegócio',
      'Empresas rurais e da cadeia do agronegócio.', 80),
    ('outro', 'Outro',
      'Demais segmentos de atividade.', 90)
)
INSERT INTO public.parametrizacao_catalogos (
  empresa_id, tipo, codigo, nome, descricao, sistema, ativo, ordem
)
SELECT
  empresa.id,
  'categorias_clientes',
  padrao.codigo,
  padrao.nome,
  padrao.descricao,
  true,
  true,
  padrao.ordem
FROM public.empresas empresa
CROSS JOIN padroes padrao
WHERE NOT EXISTS (
  SELECT 1
  FROM public.parametrizacao_catalogos existente
  WHERE existente.empresa_id = empresa.id
    AND existente.tipo = 'categorias_clientes'
    AND lower(regexp_replace(btrim(existente.nome), '[[:space:]]+', ' ', 'g'))
      = lower(regexp_replace(btrim(padrao.nome), '[[:space:]]+', ' ', 'g'))
)
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

-- Se o mesmo nome já existia com outro código, ele é o registro preservado e
-- deve permanecer disponível. Descrição, autoria e código não são alterados.
WITH nomes(nome) AS (
  VALUES
    ('Clínica'), ('Comércio'), ('Restaurante'), ('Transportadora'), ('Escola'),
    ('Prestador de Serviços'), ('Indústria'), ('Agronegócio'), ('Outro')
)
UPDATE public.parametrizacao_catalogos catalogo
SET ativo = true
FROM nomes
WHERE catalogo.tipo = 'categorias_clientes'
  AND lower(regexp_replace(btrim(catalogo.nome), '[[:space:]]+', ' ', 'g'))
    = lower(regexp_replace(btrim(nomes.nome), '[[:space:]]+', ' ', 'g'))
  AND catalogo.ativo = false;

-- As categorias antigas misturavam vínculo operacional, condição fiscal e
-- segmento. Os textos já gravados em clientes são preservados para revisão,
-- mas essas opções deixam de aparecer em novos cadastros.
UPDATE public.parametrizacao_catalogos
SET ativo = false
WHERE tipo = 'categorias_clientes'
  AND codigo IN (
    'cliente_contabil',
    'cliente-contabil',
    'pessoa_fisica',
    'pessoa-fisica',
    'entidade_isenta',
    'entidade-isenta',
    'holding_patrimonial',
    'holding-patrimonial'
  )
  AND ativo = true;

-- Isenta/Imune e Holding/Patrimonial não são portes. As opções deixam de ser
-- oferecidas em novos cadastros, mas referências históricas são preservadas.
UPDATE public.parametrizacao_catalogos
SET ativo = false
WHERE tipo = 'tipos_empresa'
  AND codigo IN ('isenta_imune', 'holding_patrimonial', 'te-5', 'te-6')
  AND ativo = true;

-- Proteção permanente contra formulários antigos, cache ou gravação direta
-- que tente reutilizar as opções legadas após esta migration.
CREATE OR REPLACE FUNCTION app_private.validar_enquadramento_cliente_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tipo_empresa_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.id = NEW.tipo_empresa_id
      AND catalogo.empresa_id = NEW.empresa_id
      AND catalogo.tipo = 'tipos_empresa'
      AND (
        catalogo.ativo = false
        OR catalogo.codigo IN (
          'isenta_imune', 'holding_patrimonial',
          'te-1', 'te-2', 'te-3', 'te-4', 'te-5', 'te-6'
        )
      )
  ) THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.tipo_empresa_id IS DISTINCT FROM OLD.tipo_empresa_id) THEN
      RAISE EXCEPTION
        'Selecione um porte/enquadramento válido.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.natureza_juridica_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.id = NEW.natureza_juridica_id
      AND catalogo.empresa_id = NEW.empresa_id
      AND catalogo.tipo = 'naturezas_juridicas'
      AND (
        catalogo.ativo = false
        OR catalogo.codigo IN ('nj-1', 'nj-2', 'nj-3', 'nj-4')
      )
  ) THEN
    IF TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE'
         AND NEW.natureza_juridica_id IS DISTINCT FROM OLD.natureza_juridica_id) THEN
      RAISE EXCEPTION
        'Selecione uma natureza jurídica válida.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.tipo IS DISTINCT FROM 'PF' AND EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.id = NEW.tipo_empresa_id
      AND catalogo.empresa_id = NEW.empresa_id
      AND catalogo.tipo = 'tipos_empresa'
      AND catalogo.codigo IN ('pessoa_fisica', 'te-1')
  ) THEN
    RAISE EXCEPTION
      'Pessoa Física não é um porte válido para CNPJ.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tipo = 'PF' AND NOT EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.id = NEW.tipo_empresa_id
      AND catalogo.empresa_id = NEW.empresa_id
      AND catalogo.tipo = 'tipos_empresa'
      AND catalogo.codigo IN ('pessoa_fisica', 'te-1')
  ) THEN
    RAISE EXCEPTION
      'Pessoa Física deve usar o enquadramento Pessoa Física.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tipo = 'MEI' AND NOT EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.id = NEW.tipo_empresa_id
      AND catalogo.empresa_id = NEW.empresa_id
      AND catalogo.tipo = 'tipos_empresa'
      AND catalogo.codigo IN ('mei', 'te-2')
  ) THEN
    RAISE EXCEPTION
      'MEI deve usar o enquadramento MEI.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.tipo IS DISTINCT FROM 'MEI' AND EXISTS (
    SELECT 1
    FROM public.parametrizacao_catalogos catalogo
    WHERE catalogo.id = NEW.tipo_empresa_id
      AND catalogo.empresa_id = NEW.empresa_id
      AND catalogo.tipo = 'tipos_empresa'
      AND catalogo.codigo IN ('mei', 'te-2')
  ) THEN
    RAISE EXCEPTION
      'O enquadramento MEI deve preservar o regime operacional MEI.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_enquadramento_cliente ON public.clientes;
CREATE TRIGGER validar_enquadramento_cliente
  BEFORE INSERT OR UPDATE OF tipo, tipo_empresa_id, empresa_id,
    tipo_empresa_catalogo_tipo, natureza_juridica_id,
    natureza_juridica_catalogo_tipo ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION app_private.validar_enquadramento_cliente_trigger();

REVOKE ALL ON FUNCTION app_private.validar_enquadramento_cliente_trigger()
  FROM PUBLIC, anon, authenticated;

COMMIT;

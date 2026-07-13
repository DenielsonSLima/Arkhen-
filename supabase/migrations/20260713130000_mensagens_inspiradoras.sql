-- Mensagens inspiradoras diarias para o painel inicial.

CREATE TABLE IF NOT EXISTS public.mensagens_inspiradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo varchar(90) NOT NULL,
  texto text NOT NULL CHECK (char_length(trim(texto)) >= 20),
  autor varchar(140) NOT NULL DEFAULT 'Equipe Contábil',
  categoria varchar(40) NOT NULL DEFAULT 'motivacao'
    CHECK (categoria IN ('forca', 'recomeco', 'esperanca', 'coragem', 'paz', 'fe', 'reflexao', 'animo', 'perseveranca', 'gratidao', 'sabedoria', 'confianca', 'cura', 'proposito', 'disciplina', 'renovacao', 'resiliencia', 'luz', 'autocuidado', 'vitoria', 'motivacao')),
  ordem integer NOT NULL CHECK (ordem > 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_inspiradoras_global_codigo_uidx
  ON public.mensagens_inspiradoras (codigo)
  WHERE empresa_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_inspiradoras_empresa_codigo_uidx
  ON public.mensagens_inspiradoras (empresa_id, codigo)
  WHERE empresa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mensagens_inspiradoras_global_ordem_uidx
  ON public.mensagens_inspiradoras (ordem)
  WHERE empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_mensagens_inspiradoras_empresa_ativo_ordem
  ON public.mensagens_inspiradoras (empresa_id, ativo, ordem);

DROP TRIGGER IF EXISTS set_mensagens_inspiradoras_updated_at ON public.mensagens_inspiradoras;
CREATE TRIGGER set_mensagens_inspiradoras_updated_at
  BEFORE UPDATE ON public.mensagens_inspiradoras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mensagens_inspiradoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_inspiradoras_select_policy ON public.mensagens_inspiradoras;
CREATE POLICY mensagens_inspiradoras_select_policy ON public.mensagens_inspiradoras
  FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS mensagens_inspiradoras_write_policy ON public.mensagens_inspiradoras;
CREATE POLICY mensagens_inspiradoras_write_policy ON public.mensagens_inspiradoras
  FOR ALL TO authenticated
  USING (empresa_id IS NOT NULL AND public.is_empresa_member(empresa_id))
  WITH CHECK (empresa_id IS NOT NULL AND public.is_empresa_member(empresa_id));

WITH inicios(ordem_inicio, categoria, texto) AS (
  VALUES
    (1, 'forca', 'Quando o coração estiver cansado, respire com calma: você não precisa vencer a vida inteira hoje, apenas dar o próximo passo possível.'),
    (2, 'recomeco', 'Há dias em que levantar já é coragem; respeite o seu ritmo e siga, porque recomeços pequenos também movem destinos grandes.'),
    (3, 'esperanca', 'Mesmo quando a resposta demora, a esperança trabalha em silêncio dentro de você, preparando firmeza para a hora certa.'),
    (4, 'coragem', 'A coragem não é ausência de medo; é a decisão humilde de continuar caminhando mesmo com as mãos tremendo.'),
    (5, 'paz', 'Antes de cobrar perfeição de si mesmo, acolha a sua humanidade: quem está ferido também pode florescer de novo.'),
    (6, 'fe', 'Quando a mente pesar, entregue a Deus o que você não consegue carregar sozinho e faça com amor o que cabe nas suas mãos.'),
    (7, 'reflexao', 'Nem todo atraso é perda; às vezes é cuidado, maturação e livramento formando um caminho mais firme do que o planejado.'),
    (8, 'animo', 'O dia pode ter começado difícil, mas ainda existe espaço para uma escolha boa, uma conversa sincera e uma pequena vitória.'),
    (9, 'perseveranca', 'Continue sem se desprezar pelo cansaço: constância também é saber pausar, respirar e voltar com dignidade.'),
    (10, 'gratidao', 'Olhe para o que ainda permanece de pé em você; talvez ali esteja a prova de que a força não foi embora.'),
    (11, 'sabedoria', 'Não transforme um momento ruim em sentença definitiva; a vida tem capítulos que só fazem sentido depois da virada.'),
    (12, 'confianca', 'Você não precisa ter todas as respostas para seguir; às vezes a luz chega somente depois do primeiro passo.'),
    (13, 'cura', 'Se hoje doer, trate-se com ternura: ninguém se reconstrói melhor sendo cruel consigo mesmo.'),
    (14, 'proposito', 'O seu trabalho, sua presença e sua história importam mais do que a fase difícil tenta fazer você acreditar.'),
    (15, 'disciplina', 'Faça o necessário com serenidade; pequenas ações honestas, repetidas em dias difíceis, constroem força verdadeira.'),
    (16, 'renovacao', 'Há força nova esperando no silêncio de uma oração, numa pausa sincera e na decisão de não desistir de si.'),
    (17, 'resiliencia', 'Você já atravessou dias que pareciam impossíveis; lembre-se disso quando a ansiedade tentar diminuir a sua fé.'),
    (18, 'luz', 'A noite emocional não cancela o amanhecer; apenas pede paciência até que a luz volte a tocar o caminho.'),
    (19, 'autocuidado', 'Cuide do corpo, da mente e da alma como quem protege uma semente preciosa em tempo de vento forte.'),
    (20, 'vitoria', 'A vitória de hoje pode ser simples: responder com calma, manter a fé e não abandonar o bem que existe em você.')
),
finais(ordem_final, autor, texto) AS (
  VALUES
    (1, 'Salmo 23:4 (paráfrase)', 'Mesmo no vale escuro, Deus continua perto, sustentando seus passos e renovando sua segurança.'),
    (2, 'Salmo 27:1 (paráfrase)', 'Se o Senhor é sua luz e proteção, o medo perde o direito de comandar o seu coração.'),
    (3, 'Salmo 30:5 (paráfrase)', 'A tristeza pode visitar a noite, mas a alegria ainda tem lugar reservado para a manhã.'),
    (4, 'Salmo 34:18 (paráfrase)', 'Deus se aproxima de quem está quebrantado e recolhe com cuidado aquilo que parecia perdido.'),
    (5, 'Salmo 46:1 (paráfrase)', 'Na aflição, há refúgio disponível: você não está sem abrigo, nem sem socorro.'),
    (6, 'Salmo 55:22 (paráfrase)', 'Lance sobre Deus o peso que sufoca; Ele sabe sustentar o que seus braços já não conseguem.'),
    (7, 'Salmo 91:2 (paráfrase)', 'Faça da confiança seu lugar de descanso, porque Deus permanece firme quando tudo parece instável.'),
    (8, 'Salmo 121:2 (paráfrase)', 'O auxílio que você precisa não nasce apenas do esforço; vem também do alto, no tempo certo.'),
    (9, 'Isaías 40:31 (paráfrase)', 'Quem espera em Deus encontra fôlego novo para continuar, mesmo depois de uma longa temporada de desgaste.'),
    (10, 'Isaías 41:10 (paráfrase)', 'Não caminhe como quem foi abandonado; há uma mão fiel fortalecendo você por dentro.'),
    (11, 'Mateus 11:28 (paráfrase)', 'Quando o cansaço pesar demais, Cristo chama você para descanso, não para cobrança sem fim.'),
    (12, 'Filipenses 4:6-7 (paráfrase)', 'Transforme a ansiedade em oração, e permita que a paz organize por dentro o que fora ainda parece confuso.'),
    (13, 'Romanos 8:28 (paráfrase)', 'Deus também trabalha nas partes difíceis da história, juntando sentido onde hoje só parece haver fragmento.'),
    (14, '2 Coríntios 12:9 (paráfrase)', 'A graça se revela justamente onde a força humana acaba; fraqueza não impede cuidado, abre espaço para ele.'),
    (15, 'Josué 1:9 (paráfrase)', 'Seja forte e corajoso, não por negar a luta, mas por lembrar que Deus vai com você.'),
    (16, 'Equipe Contábil', 'Respire, reorganize o essencial e siga com gentileza: um dia pesado não define uma vida inteira.'),
    (17, 'Equipe Contábil', 'A disciplina mais bonita é aquela que não humilha o cansaço, mas ajuda você a voltar ao caminho.'),
    (18, 'Equipe Contábil', 'Nem toda conquista faz barulho; algumas acontecem quando você escolhe permanecer íntegro em silêncio.'),
    (19, 'Equipe Contábil', 'Pequenas melhoras ainda são melhoras; honre o avanço possível, porque ele também conta.'),
    (20, 'Equipe Contábil', 'Você pode começar de novo quantas vezes forem necessárias; recomeçar também é uma forma de coragem.'),
    (21, 'Equipe Contábil', 'Hoje, escolha uma coisa boa para fazer com presença; a vida se fortalece em gestos possíveis.')
),
mensagens AS (
  SELECT
    row_number() OVER (ORDER BY i.ordem_inicio, f.ordem_final)::integer AS ordem,
    i.categoria,
    f.autor,
    trim(i.texto || ' ' || f.texto) AS texto
  FROM inicios i
  CROSS JOIN finais f
)
INSERT INTO public.mensagens_inspiradoras (empresa_id, codigo, texto, autor, categoria, ordem, ativo)
SELECT
  NULL,
  'global-' || lpad(m.ordem::text, 3, '0'),
  m.texto,
  m.autor,
  m.categoria,
  m.ordem,
  true
FROM mensagens m
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_mensagem_inspiradora_do_dia(p_data date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id uuid,
  texto text,
  autor varchar,
  categoria varchar,
  ordem integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_total integer;
  v_ordem integer;
  v_data date := COALESCE(p_data, CURRENT_DATE);
BEGIN
  SELECT count(*)
    INTO v_total
  FROM public.mensagens_inspiradoras mi
  WHERE mi.ativo = true
    AND (mi.empresa_id IS NULL OR mi.empresa_id = v_empresa_id);

  IF v_total = 0 THEN
    RETURN;
  END IF;

  v_ordem := (((v_data - DATE '2026-01-01') % v_total + v_total) % v_total) + 1;

  RETURN QUERY
  WITH disponiveis AS (
    SELECT
      mi.id,
      mi.texto,
      mi.autor,
      mi.categoria,
      mi.ordem,
      row_number() OVER (
        ORDER BY
          CASE WHEN mi.empresa_id = v_empresa_id THEN 0 ELSE 1 END,
          mi.ordem,
          mi.codigo
      )::integer AS posicao
    FROM public.mensagens_inspiradoras mi
    WHERE mi.ativo = true
      AND (mi.empresa_id IS NULL OR mi.empresa_id = v_empresa_id)
  )
  SELECT d.id, d.texto, d.autor, d.categoria, d.ordem
  FROM disponiveis d
  WHERE d.posicao = v_ordem
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mensagem_inspiradora_do_dia(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mensagem_inspiradora_do_dia(date) TO authenticated;

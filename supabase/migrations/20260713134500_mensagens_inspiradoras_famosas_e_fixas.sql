-- Reequilibra o acervo para frases motivacionais famosas e fixa a escolha por empresa/dia.

CREATE TABLE IF NOT EXISTS public.mensagens_inspiradoras_empresas_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  mensagem_id uuid NOT NULL REFERENCES public.mensagens_inspiradoras(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, data_ref)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_inspiradoras_empresas_dia_lookup
  ON public.mensagens_inspiradoras_empresas_dia (empresa_id, data_ref);

ALTER TABLE public.mensagens_inspiradoras_empresas_dia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_inspiradoras_empresas_dia_select_policy ON public.mensagens_inspiradoras_empresas_dia;
CREATE POLICY mensagens_inspiradoras_empresas_dia_select_policy ON public.mensagens_inspiradoras_empresas_dia
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS mensagens_inspiradoras_empresas_dia_write_policy ON public.mensagens_inspiradoras_empresas_dia;

TRUNCATE public.mensagens_inspiradoras_empresas_dia;
DELETE FROM public.mensagens_inspiradoras;

WITH fontes(ordem_fonte, autor, categoria, texto) AS (
  VALUES
    (1, 'Inspirado em Sêneca', 'sabedoria', 'A dificuldade não veio para provar que você é fraco, mas para revelar a força que ainda não tinha sido chamada.'),
    (2, 'Inspirado em Marco Aurélio', 'disciplina', 'Você tem poder sobre a forma como responde ao dia; comece por aí e o restante fica mais leve.'),
    (3, 'Inspirado em Aristóteles', 'disciplina', 'Excelência não nasce de um momento de empolgação, mas de pequenos hábitos bem escolhidos e repetidos com firmeza.'),
    (4, 'Inspirado em Sócrates', 'reflexao', 'Conhecer a si mesmo também é perceber quando precisa recomeçar com mais calma, mais verdade e menos cobrança.'),
    (5, 'Inspirado em Confúcio', 'perseveranca', 'Não importa ir devagar; importa não abandonar a direção que pode transformar sua vida.'),
    (6, 'Inspirado em Lao Tsé', 'paz', 'O caminho grande começa simples, com um passo honesto dado apesar do cansaço.'),
    (7, 'Inspirado em Nelson Mandela', 'coragem', 'O impossível costuma parecer definitivo até alguém cansado, mas decidido, atravessar a primeira porta.'),
    (8, 'Inspirado em Maya Angelou', 'forca', 'Você pode não controlar tudo que acontece, mas pode preservar a dignidade com que se levanta.'),
    (9, 'Inspirado em Martin Luther King Jr.', 'esperanca', 'Dê o primeiro passo mesmo sem enxergar a escada inteira; a coragem também aprende andando.'),
    (10, 'Inspirado em Winston Churchill', 'perseveranca', 'Sucesso é continuar depois de dias difíceis, sem deixar que uma queda escreva o final da história.'),
    (11, 'Inspirado em Theodore Roosevelt', 'confianca', 'Acredite que você pode avançar; metade da caminhada começa quando a mente para de desistir antes do corpo.'),
    (12, 'Inspirado em Henry Ford', 'confianca', 'Se você acredita que consegue melhorar, já abriu espaço para a ação provar que era possível.'),
    (13, 'Inspirado em Thomas Edison', 'resiliencia', 'Cada tentativa que não funcionou ensinou algo; não desperdice a lição chamando-a apenas de fracasso.'),
    (14, 'Inspirado em Albert Einstein', 'reflexao', 'No meio da dificuldade também existe uma oportunidade escondida, esperando sua mente respirar para enxergá-la.'),
    (15, 'Inspirado em Viktor Frankl', 'proposito', 'Quando você reencontra um sentido, até o sofrimento perde parte do poder de paralisar seus passos.'),
    (16, 'Inspirado em C.S. Lewis', 'recomeco', 'Você nunca é velho demais, nem está atrasado demais, para escolher um novo começo com esperança.'),
    (17, 'Inspirado em Napoleon Hill', 'disciplina', 'A meta fica mais próxima quando desejo, plano e ação começam a caminhar na mesma direção.'),
    (18, 'Inspirado em Jim Rohn', 'disciplina', 'Disciplina é a ponte discreta entre o que você sonha e o que decide construir hoje.'),
    (19, 'Inspirado em Zig Ziglar', 'animo', 'A motivação precisa ser renovada, e tudo bem: algumas forças bonitas também são cultivadas diariamente.'),
    (20, 'Inspirado em Dale Carnegie', 'paz', 'Viva este dia com presença; carregar todos os problemas de uma vez só torna qualquer coração pesado demais.'),
    (21, 'Inspirado em Peter Drucker', 'proposito', 'O melhor jeito de preparar o futuro é fazer com clareza aquilo que está sob sua responsabilidade agora.'),
    (22, 'Inspirado em Stephen Covey', 'sabedoria', 'Comece pelo que é essencial; quando os valores lideram, as tarefas deixam de mandar na sua paz.'),
    (23, 'Inspirado em Warren Buffett', 'sabedoria', 'Invista em você com paciência; conhecimento, caráter e constância rendem frutos que crise nenhuma toma facilmente.'),
    (24, 'Inspirado em Steve Jobs', 'proposito', 'Faça um trabalho que tenha significado para você; a energia muda quando existe propósito por trás do esforço.'),
    (25, 'Inspirado em Oprah Winfrey', 'gratidao', 'Reconheça o que já existe de bom; gratidão não nega a luta, apenas devolve equilíbrio ao olhar.'),
    (26, 'Inspirado em Brené Brown', 'coragem', 'Coragem também é aparecer de coração aberto, mesmo quando a insegurança tenta mandar você se esconder.'),
    (27, 'Inspirado em Tony Robbins', 'animo', 'Uma decisão verdadeira pode mudar o ritmo do dia; escolha agir antes que o medo escolha por você.'),
    (28, 'Inspirado em Les Brown', 'esperanca', 'Mire alto sem desprezar o começo; sonhos grandes também precisam de passos pequenos e consistentes.'),
    (29, 'Inspirado em John Maxwell', 'lideranca', 'Liderar a própria vida começa quando você assume responsabilidade pelo próximo passo, não pelo mundo inteiro.'),
    (30, 'Inspirado em Ayrton Senna', 'vitoria', 'Quando existe dedicação verdadeira, o limite de ontem vira apenas uma marca a ser superada com respeito.'),
    (31, 'Inspirado em Pelé', 'disciplina', 'Talento ajuda, mas treino, humildade e repetição transformam potencial em resultado que permanece.'),
    (32, 'Inspirado em Muhammad Ali', 'confianca', 'A vitória começa na mente antes de aparecer do lado de fora; fale consigo como quem acredita.'),
    (33, 'Inspirado em Michael Jordan', 'resiliencia', 'Você pode errar muitas vezes e ainda assim vencer, desde que não transforme erro em desistência.'),
    (34, 'Inspirado em Kobe Bryant', 'disciplina', 'Compromisso é fazer o necessário mesmo quando ninguém vê, ninguém aplaude e o ânimo está baixo.'),
    (35, 'Inspirado em Serena Williams', 'forca', 'Força também é entrar no dia com foco, apesar das dúvidas que tentam diminuir sua presença.'),
    (36, 'Inspirado em Madre Teresa de Calcutá', 'proposito', 'Nem sempre dá para fazer algo grande, mas sempre é possível fazer algo pequeno com amor.'),
    (37, 'Inspirado em Papa Francisco', 'esperanca', 'A esperança abre janelas onde o medo só consegue enxergar paredes.'),
    (38, 'Inspirado em Clarice Lispector', 'recomeco', 'Permita-se nascer de novo dentro do mesmo dia; às vezes a alma só precisa de uma chance sincera.'),
    (39, 'Inspirado em Machado de Assis', 'reflexao', 'Olhe a vida com lucidez, mas não deixe que a lucidez roube sua capacidade de acreditar.'),
    (40, 'Inspirado em Carlos Drummond de Andrade', 'perseveranca', 'Havia uma pedra no caminho, mas também havia caminho depois da pedra.'),
    (41, 'Inspirado em Cecília Meireles', 'paz', 'Aprenda a guardar beleza mesmo nos dias incertos; ela ajuda a alma a não endurecer.'),
    (42, 'Inspirado em Fernando Pessoa', 'coragem', 'Tudo vale a pena quando a alma encontra sentido para continuar atravessando o mar.'),
    (43, 'Inspirado em Paulo Freire', 'esperanca', 'Esperança não é espera parada; é força que se levanta para transformar a realidade.'),
    (44, 'Inspirado em Rubem Alves', 'leveza', 'Há sabedoria em cuidar da alegria; ela também ensina a caminhar em dias pesados.'),
    (45, 'Inspirado em Augusto Cury', 'autocuidado', 'Gerencie seus pensamentos com carinho; nem toda voz dentro da mente merece virar verdade.'),
    (46, 'Inspirado em Mario Sergio Cortella', 'proposito', 'Faça o melhor possível nas condições que você tem, enquanto trabalha para melhorar essas condições.'),
    (47, 'Inspirado em Leandro Karnal', 'reflexao', 'Maturidade é perceber que nem todo desconforto é inimigo; alguns desconfortos educam a alma.'),
    (48, 'Inspirado em Abraham Lincoln', 'integridade', 'A melhor forma de prever quem você será é construir, hoje, uma atitude da qual possa se orgulhar.'),
    (49, 'Inspirado em Benjamin Franklin', 'disciplina', 'Pequenas economias de tempo, atenção e energia constroem grandes reservas de futuro.'),
    (50, 'Inspirado em Helen Keller', 'esperanca', 'Mesmo quando a visão falha, a esperança consegue apontar uma direção para o coração.'),
    (51, 'Inspirado em Anne Frank', 'luz', 'Ainda existe bondade para procurar, cultivar e proteger, mesmo quando o mundo parece difícil demais.'),
    (52, 'Inspirado em Mahatma Gandhi', 'paz', 'Seja no cotidiano a mudança que você espera encontrar no caminho.'),
    (53, 'Inspirado em Desmond Tutu', 'esperanca', 'A esperança é teimosa: ela insiste em procurar luz mesmo quando a sala parece escura.'),
    (54, 'Inspirado em Dalai Lama', 'paz', 'Uma mente mais calma não resolve tudo, mas enxerga melhor o próximo passo.'),
    (55, 'Inspirado em Provérbio Japonês', 'resiliencia', 'Caia sete vezes, levante oito; a dignidade está em voltar mais uma vez.'),
    (56, 'Inspirado em Provérbio Africano', 'forca', 'Se quiser ir longe, valorize quem caminha com você e fortaleça bons vínculos.'),
    (57, 'Inspirado em Provérbio Chinês', 'perseveranca', 'Quem move uma montanha começa carregando pequenas pedras; não despreze o começo.'),
    (58, 'Salmo 23:4 (paráfrase)', 'fe', 'Mesmo em vale difícil, você não caminha sem amparo; há presença, consolo e direção.'),
    (59, 'Salmo 46:1 (paráfrase)', 'fe', 'Na aflição, existe refúgio; você pode respirar antes de tentar carregar tudo sozinho.'),
    (60, 'Isaías 41:10 (paráfrase)', 'fe', 'Não tema: há força sendo renovada em você quando a sua parece pequena demais.')
),
reforcos(ordem_reforco, texto) AS (
  VALUES
    (1, 'Respire fundo, organize uma prioridade e dê a si mesmo a chance de vencer o dia em partes.'),
    (2, 'Hoje não precisa ser perfeito; precisa apenas ter um gesto honesto de continuidade.'),
    (3, 'A fase difícil pode até diminuir seu ritmo, mas não precisa apagar sua direção.'),
    (4, 'Você já superou dias que pareciam maiores do que suas forças; lembre-se disso agora.'),
    (5, 'Escolha uma atitude pequena, concreta e boa; muitas viradas começam sem barulho.'),
    (6, 'Trate-se com respeito enquanto luta, porque coragem também precisa de cuidado.'),
    (7, 'O próximo passo vale mais do que a culpa por tudo que ainda não foi feito.')
),
mensagens AS (
  SELECT
    row_number() OVER (ORDER BY f.ordem_fonte, r.ordem_reforco)::integer AS ordem,
    f.autor,
    f.categoria,
    trim(f.texto || ' ' || r.texto) AS texto
  FROM fontes f
  CROSS JOIN reforcos r
)
INSERT INTO public.mensagens_inspiradoras (empresa_id, codigo, texto, autor, categoria, ordem, ativo)
SELECT
  NULL,
  'global-' || lpad(m.ordem::text, 3, '0'),
  m.texto,
  m.autor,
  CASE
    WHEN m.categoria IN ('forca', 'recomeco', 'esperanca', 'coragem', 'paz', 'fe', 'reflexao', 'animo', 'perseveranca', 'gratidao', 'sabedoria', 'confianca', 'cura', 'proposito', 'disciplina', 'renovacao', 'resiliencia', 'luz', 'autocuidado', 'vitoria', 'motivacao')
      THEN m.categoria
    ELSE 'motivacao'
  END,
  m.ordem,
  true
FROM mensagens m;

DROP FUNCTION IF EXISTS public.get_mensagem_inspiradora_do_dia(date);

CREATE OR REPLACE FUNCTION public.get_mensagem_inspiradora_do_dia(p_data date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id uuid,
  texto text,
  autor varchar,
  categoria varchar,
  ordem integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_data date := COALESCE(p_data, CURRENT_DATE);
BEGIN
  IF v_empresa_id IS NULL OR NOT public.is_empresa_member(v_empresa_id) THEN
    RAISE EXCEPTION 'Empresa atual nao encontrada.';
  END IF;

  INSERT INTO public.mensagens_inspiradoras_empresas_dia (empresa_id, data_ref, mensagem_id)
  SELECT v_empresa_id, v_data, escolha.id
  FROM (
    SELECT mi.id
    FROM public.mensagens_inspiradoras mi
    WHERE mi.ativo = true
      AND mi.empresa_id IS NULL
    ORDER BY md5(v_empresa_id::text || ':' || v_data::text || ':' || mi.codigo), mi.codigo
    LIMIT 1
  ) escolha
  ON CONFLICT (empresa_id, data_ref) DO NOTHING;

  RETURN QUERY
  SELECT mi.id, mi.texto, mi.autor, mi.categoria, mi.ordem
  FROM public.mensagens_inspiradoras_empresas_dia md
  JOIN public.mensagens_inspiradoras mi ON mi.id = md.mensagem_id
  WHERE md.empresa_id = v_empresa_id
    AND md.data_ref = v_data
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mensagem_inspiradora_do_dia(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mensagem_inspiradora_do_dia(date) TO authenticated;

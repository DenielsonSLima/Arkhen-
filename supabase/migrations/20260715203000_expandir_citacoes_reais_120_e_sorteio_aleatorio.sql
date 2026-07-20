-- Amplia o acervo para 120 citações reais, registra a fonte e sorteia uma por empresa/dia.

ALTER TABLE public.mensagens_inspiradoras
  ADD COLUMN IF NOT EXISTS fonte text;

TRUNCATE TABLE public.mensagens_inspiradoras_empresas_dia;
DELETE FROM public.mensagens_inspiradoras;

INSERT INTO public.mensagens_inspiradoras (
  empresa_id,
  codigo,
  texto,
  autor,
  categoria,
  ordem,
  ativo,
  fonte
)
VALUES
  (NULL, 'citacao-real-001', 'Se você quer ser bem-sucedido, precisa ter dedicação total, buscar seu último limite e dar o melhor de si.', 'Ayrton Senna', 'disciplina', 1, true, 'Site oficial Ayrton Senna — acervo de frases'),
  (NULL, 'citacao-real-002', 'No que diz respeito ao empenho, ao compromisso, ao esforço, à dedicação, não existe meio-termo. Ou você faz uma coisa bem-feita ou não faz.', 'Ayrton Senna', 'disciplina', 2, true, 'Site oficial Ayrton Senna — acervo de frases'),
  (NULL, 'citacao-real-003', 'Nas adversidades uns desistem, enquanto outros batem recordes.', 'Ayrton Senna', 'resiliencia', 3, true, 'Site oficial Ayrton Senna — acervo de frases'),
  (NULL, 'citacao-real-004', 'Vencer sem correr riscos é triunfar sem glórias!', 'Ayrton Senna', 'coragem', 4, true, 'Site oficial Ayrton Senna — acervo de frases'),
  (NULL, 'citacao-real-005', 'Vencer é o que importa. O resto é a consequência.', 'Ayrton Senna', 'proposito', 5, true, 'Site oficial Ayrton Senna — acervo de frases'),
  (NULL, 'citacao-real-006', 'A única maneira de fazer um excelente trabalho é amar o que você faz.', 'Steve Jobs', 'proposito', 6, true, 'Discurso de formatura da Universidade Stanford, 2005'),
  (NULL, 'citacao-real-007', 'Às vezes, a vida acerta você na cabeça com um tijolo. Não perca a fé.', 'Steve Jobs', 'esperanca', 7, true, 'Discurso de formatura da Universidade Stanford, 2005'),
  (NULL, 'citacao-real-008', 'Seu tempo é limitado, então não o desperdice vivendo a vida de outra pessoa.', 'Steve Jobs', 'proposito', 8, true, 'Discurso de formatura da Universidade Stanford, 2005'),
  (NULL, 'citacao-real-009', 'Se você ainda não encontrou o que ama, continue procurando. Não se acomode.', 'Steve Jobs', 'perseveranca', 9, true, 'Discurso de formatura da Universidade Stanford, 2005'),
  (NULL, 'citacao-real-010', 'Aprendi que a coragem não era a ausência do medo, mas o triunfo sobre ele.', 'Nelson Mandela', 'coragem', 10, true, 'Long Walk to Freedom'),
  (NULL, 'citacao-real-011', 'A educação é a arma mais poderosa que você pode usar para mudar o mundo.', 'Nelson Mandela', 'sabedoria', 11, true, 'Discurso no Madison Park High School, Boston, 1990'),
  (NULL, 'citacao-real-012', 'Depois de escalar uma grande montanha, descobre-se que há muitas outras montanhas para escalar.', 'Nelson Mandela', 'perseveranca', 12, true, 'Long Walk to Freedom'),
  (NULL, 'citacao-real-013', 'Uma criança, um professor, um livro e uma caneta podem mudar o mundo.', 'Malala Yousafzai', 'esperanca', 13, true, 'Discurso no Youth Takeover das Nações Unidas, 2013'),
  (NULL, 'citacao-real-014', 'Percebemos a importância de nossa voz quando somos silenciados.', 'Malala Yousafzai', 'coragem', 14, true, 'Discurso no Youth Takeover das Nações Unidas, 2013'),
  (NULL, 'citacao-real-015', 'A única coisa que devemos temer é o próprio medo.', 'Franklin D. Roosevelt', 'coragem', 15, true, 'Primeiro discurso de posse, 1933'),
  (NULL, 'citacao-real-016', 'Tudo vale a pena se a alma não é pequena.', 'Fernando Pessoa', 'coragem', 16, true, 'Mensagem — Mar Português'),
  (NULL, 'citacao-real-017', 'Tenho em mim todos os sonhos do mundo.', 'Fernando Pessoa', 'esperanca', 17, true, 'Álvaro de Campos — Tabacaria'),
  (NULL, 'citacao-real-018', 'É preciso ter esperança, mas ter esperança do verbo esperançar; porque tem gente que tem esperança do verbo esperar.', 'Paulo Freire', 'esperanca', 18, true, 'Pedagogia da Esperança'),
  (NULL, 'citacao-real-019', 'Ninguém caminha sem aprender a caminhar, sem aprender a fazer o caminho caminhando.', 'Paulo Freire', 'sabedoria', 19, true, 'Pedagogia da Esperança'),
  (NULL, 'citacao-real-020', 'O que a vida quer da gente é coragem.', 'João Guimarães Rosa', 'coragem', 20, true, 'Grande Sertão: Veredas'),
  (NULL, 'citacao-real-021', 'Você tem poder sobre sua mente, não sobre os acontecimentos externos. Perceba isso e encontrará força.', 'Marco Aurélio', 'autocuidado', 21, true, 'Meditações'),
  (NULL, 'citacao-real-022', 'A felicidade da sua vida depende da qualidade dos seus pensamentos.', 'Marco Aurélio', 'sabedoria', 22, true, 'Meditações'),
  (NULL, 'citacao-real-023', 'Não perca mais tempo discutindo como deve ser uma pessoa boa. Seja uma.', 'Marco Aurélio', 'disciplina', 23, true, 'Meditações'),
  (NULL, 'citacao-real-024', 'O impedimento à ação faz a ação avançar. O que está no caminho torna-se o caminho.', 'Marco Aurélio', 'resiliencia', 24, true, 'Meditações'),
  (NULL, 'citacao-real-025', 'Se não é certo, não faça; se não é verdade, não diga.', 'Marco Aurélio', 'sabedoria', 25, true, 'Meditações'),
  (NULL, 'citacao-real-026', 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.', 'Sêneca', 'coragem', 26, true, 'Cartas a Lucílio, carta 104'),
  (NULL, 'citacao-real-027', 'Sofremos mais vezes na imaginação do que na realidade.', 'Sêneca', 'reflexao', 27, true, 'Cartas a Lucílio, carta 13'),
  (NULL, 'citacao-real-028', 'Não é que tenhamos pouco tempo, mas desperdiçamos muito.', 'Sêneca', 'sabedoria', 28, true, 'Sobre a Brevidade da Vida'),
  (NULL, 'citacao-real-029', 'Enquanto adiamos, a vida passa.', 'Sêneca', 'proposito', 29, true, 'Cartas a Lucílio, carta 1'),
  (NULL, 'citacao-real-030', 'Nenhum vento é favorável para quem não sabe a que porto se dirige.', 'Sêneca', 'proposito', 30, true, 'Cartas a Lucílio, carta 71'),
  (NULL, 'citacao-real-031', 'Não são as coisas que perturbam as pessoas, mas os juízos que elas fazem sobre as coisas.', 'Epicteto', 'reflexao', 31, true, 'Manual de Epicteto'),
  (NULL, 'citacao-real-032', 'Primeiro diga a si mesmo o que você quer ser; depois faça o que precisa ser feito.', 'Epicteto', 'disciplina', 32, true, 'Discursos'),
  (NULL, 'citacao-real-033', 'Nenhuma pessoa é livre se não é senhora de si mesma.', 'Epicteto', 'autocuidado', 33, true, 'Discursos'),
  (NULL, 'citacao-real-034', 'Faça o melhor uso do que está em seu poder e aceite o restante como acontecer.', 'Epicteto', 'sabedoria', 34, true, 'Discursos'),
  (NULL, 'citacao-real-035', 'Se quiser melhorar, aceite parecer ignorante nas coisas externas.', 'Epicteto', 'autocuidado', 35, true, 'Manual de Epicteto'),
  (NULL, 'citacao-real-036', 'Uma jornada de mil quilômetros começa com um único passo.', 'Lao Tsé', 'perseveranca', 36, true, 'Tao Te Ching, capítulo 64'),
  (NULL, 'citacao-real-037', 'Quem conhece os outros é sábio; quem conhece a si mesmo é iluminado.', 'Lao Tsé', 'sabedoria', 37, true, 'Tao Te Ching, capítulo 33'),
  (NULL, 'citacao-real-038', 'Quem vence os outros é forte; quem vence a si mesmo é poderoso.', 'Lao Tsé', 'forca', 38, true, 'Tao Te Ching, capítulo 33'),
  (NULL, 'citacao-real-039', 'Grandes realizações são compostas de pequenas ações.', 'Lao Tsé', 'disciplina', 39, true, 'Tao Te Ching, capítulo 63'),
  (NULL, 'citacao-real-040', 'Quem sabe que o suficiente é suficiente sempre terá o suficiente.', 'Lao Tsé', 'gratidao', 40, true, 'Tao Te Ching, capítulo 46'),
  (NULL, 'citacao-real-041', 'Aprender e não pensar é desperdício; pensar e não aprender é perigoso.', 'Confúcio', 'sabedoria', 41, true, 'Analectos, livro II'),
  (NULL, 'citacao-real-042', 'Saber o que você sabe e saber o que você não sabe: isso é conhecimento.', 'Confúcio', 'sabedoria', 42, true, 'Analectos, livro II'),
  (NULL, 'citacao-real-043', 'Ao ver uma pessoa digna, pense em igualá-la; ao ver o contrário, examine a si mesmo.', 'Confúcio', 'reflexao', 43, true, 'Analectos, livro IV'),
  (NULL, 'citacao-real-044', 'A pessoa superior é modesta em suas palavras, mas excede em suas ações.', 'Confúcio', 'sabedoria', 44, true, 'Analectos, livro XIV'),
  (NULL, 'citacao-real-045', 'Não se preocupe por não ser reconhecido; procure ser digno de reconhecimento.', 'Confúcio', 'proposito', 45, true, 'Analectos, livro I'),
  (NULL, 'citacao-real-046', 'Bem feito é melhor do que bem dito.', 'Benjamin Franklin', 'disciplina', 46, true, 'Poor Richard’s Almanack'),
  (NULL, 'citacao-real-047', 'Tempo perdido nunca é encontrado novamente.', 'Benjamin Franklin', 'sabedoria', 47, true, 'Poor Richard’s Almanack'),
  (NULL, 'citacao-real-048', 'Um investimento em conhecimento sempre paga os melhores juros.', 'Benjamin Franklin', 'sabedoria', 48, true, 'The Way to Wealth'),
  (NULL, 'citacao-real-049', 'Energia e persistência conquistam todas as coisas.', 'Benjamin Franklin', 'perseveranca', 49, true, 'The Autobiography of Benjamin Franklin'),
  (NULL, 'citacao-real-050', 'Aquele que tem paciência pode ter o que quiser.', 'Benjamin Franklin', 'perseveranca', 50, true, 'Poor Richard’s Almanack'),
  (NULL, 'citacao-real-051', 'É difícil falhar, mas é pior nunca ter tentado ter sucesso.', 'Theodore Roosevelt', 'coragem', 51, true, 'The Strenuous Life'),
  (NULL, 'citacao-real-052', 'O crédito pertence à pessoa que está realmente na arena.', 'Theodore Roosevelt', 'coragem', 52, true, 'Discurso Citizenship in a Republic, 1910'),
  (NULL, 'citacao-real-053', 'Mantenha os olhos nas estrelas e os pés no chão.', 'Theodore Roosevelt', 'proposito', 53, true, 'Discurso em Nova York, 1904'),
  (NULL, 'citacao-real-054', 'A melhor recompensa que a vida oferece é a chance de trabalhar duro em um trabalho que vale a pena.', 'Theodore Roosevelt', 'proposito', 54, true, 'Discurso no New York State Agricultural Association, 1903'),
  (NULL, 'citacao-real-055', 'Desejo pregar não a doutrina da facilidade, mas a doutrina da vida árdua.', 'Theodore Roosevelt', 'disciplina', 55, true, 'Discurso The Strenuous Life, 1899'),
  (NULL, 'citacao-real-056', 'A vida é uma aventura ousada ou não é nada.', 'Helen Keller', 'coragem', 56, true, 'The Open Door'),
  (NULL, 'citacao-real-057', 'O otimismo é a fé que conduz à realização. Nada pode ser feito sem esperança e confiança.', 'Helen Keller', 'esperanca', 57, true, 'Optimism'),
  (NULL, 'citacao-real-058', 'Sozinhos podemos fazer tão pouco; juntos podemos fazer tanto.', 'Helen Keller', 'forca', 58, true, 'Discurso no Sorbonne, 1931'),
  (NULL, 'citacao-real-059', 'O caráter não pode ser desenvolvido na facilidade e na tranquilidade.', 'Helen Keller', 'resiliencia', 59, true, 'My Life and Story'),
  (NULL, 'citacao-real-060', 'Embora o mundo esteja cheio de sofrimento, está também cheio de superação.', 'Helen Keller', 'esperanca', 60, true, 'Optimism'),
  (NULL, 'citacao-real-061', 'Você pode encontrar muitas derrotas, mas não deve ser derrotado.', 'Maya Angelou', 'resiliencia', 61, true, 'Letter to My Daughter'),
  (NULL, 'citacao-real-062', 'Faça o melhor que puder até saber mais. Quando souber mais, faça melhor.', 'Maya Angelou', 'sabedoria', 62, true, 'Entrevista à Oprah Winfrey'),
  (NULL, 'citacao-real-063', 'Nada funcionará a menos que você trabalhe.', 'Maya Angelou', 'disciplina', 63, true, 'Wouldn’t Take Nothing for My Journey Now'),
  (NULL, 'citacao-real-064', 'Se você não gosta de algo, mude-o. Se não puder mudar, mude sua atitude.', 'Maya Angelou', 'autocuidado', 64, true, 'Wouldn’t Take Nothing for My Journey Now'),
  (NULL, 'citacao-real-065', 'Coragem é a mais importante de todas as virtudes, porque sem coragem você não pratica nenhuma outra consistentemente.', 'Maya Angelou', 'coragem', 65, true, 'Entrevista à USA Today, 1988'),
  (NULL, 'citacao-real-066', 'Na vida, nada deve ser temido, apenas compreendido.', 'Marie Curie', 'coragem', 66, true, 'Entrevista a Marie Mattingly Meloney, 1921'),
  (NULL, 'citacao-real-067', 'Devemos acreditar que somos talentosos para alguma coisa e que essa coisa deve ser alcançada.', 'Marie Curie', 'proposito', 67, true, 'Madame Curie: A Biography, de Ève Curie'),
  (NULL, 'citacao-real-068', 'Não podemos esperar construir um mundo melhor sem melhorar os indivíduos.', 'Marie Curie', 'sabedoria', 68, true, 'Pierre Curie, 1923'),
  (NULL, 'citacao-real-069', 'Seja menos curioso sobre pessoas e mais curioso sobre ideias.', 'Marie Curie', 'sabedoria', 69, true, 'Madame Curie: A Biography, de Ève Curie'),
  (NULL, 'citacao-real-070', 'Eu estava convencida de que nosso caminho levava a uma nova ciência que tínhamos de criar.', 'Marie Curie', 'proposito', 70, true, 'Pierre Curie, 1923'),
  (NULL, 'citacao-real-071', 'Minha vida é minha mensagem.', 'Mahatma Gandhi', 'sabedoria', 71, true, 'Resposta a jornalistas, 1948'),
  (NULL, 'citacao-real-072', 'Se pudéssemos mudar a nós mesmos, as tendências do mundo também mudariam.', 'Mahatma Gandhi', 'renovacao', 72, true, 'Indian Opinion, 1913'),
  (NULL, 'citacao-real-073', 'A força não vem da capacidade física. Vem de uma vontade indomável.', 'Mahatma Gandhi', 'forca', 73, true, 'Young India, 1920'),
  (NULL, 'citacao-real-074', 'De maneira gentil, você pode sacudir o mundo.', 'Mahatma Gandhi', 'coragem', 74, true, 'Young India, 1921'),
  (NULL, 'citacao-real-075', 'Um grama de prática vale mais que toneladas de pregação.', 'Mahatma Gandhi', 'disciplina', 75, true, 'Young India, 1927'),
  (NULL, 'citacao-real-076', 'A escuridão não pode expulsar a escuridão; somente a luz pode fazer isso.', 'Martin Luther King Jr.', 'esperanca', 76, true, 'Strength to Love'),
  (NULL, 'citacao-real-077', 'O ódio não pode expulsar o ódio; somente o amor pode fazer isso.', 'Martin Luther King Jr.', 'paz', 77, true, 'Strength to Love'),
  (NULL, 'citacao-real-078', 'Devemos aceitar a decepção finita, mas nunca perder a esperança infinita.', 'Martin Luther King Jr.', 'esperanca', 78, true, 'Discurso em Washington, 1968'),
  (NULL, 'citacao-real-079', 'A hora é sempre certa para fazer o que é certo.', 'Martin Luther King Jr.', 'sabedoria', 79, true, 'Discurso no Oberlin College, 1964'),
  (NULL, 'citacao-real-080', 'Se não puder voar, corra; se não puder correr, caminhe; se não puder caminhar, rasteje, mas continue avançando.', 'Martin Luther King Jr.', 'perseveranca', 80, true, 'Discurso no Spelman College, 1967'),
  (NULL, 'citacao-real-081', 'Faço o melhor que sei, o melhor que posso, e pretendo continuar fazendo isso até o fim.', 'Abraham Lincoln', 'disciplina', 81, true, 'Relato de Francis B. Carpenter, 1866'),
  (NULL, 'citacao-real-082', 'Tenha sempre em mente que sua própria resolução de alcançar o sucesso é mais importante do que qualquer outra coisa.', 'Abraham Lincoln', 'proposito', 82, true, 'Carta a Isham Reavis, 1855'),
  (NULL, 'citacao-real-083', 'Não sou obrigado a vencer, mas sou obrigado a ser verdadeiro.', 'Abraham Lincoln', 'sabedoria', 83, true, 'The Life and Public Service of Abraham Lincoln, 1865'),
  (NULL, 'citacao-real-084', 'Uma casa dividida contra si mesma não pode permanecer.', 'Abraham Lincoln', 'sabedoria', 84, true, 'Discurso House Divided, 1858'),
  (NULL, 'citacao-real-085', 'Não deixe nenhum sentimento de desânimo dominá-lo; no fim, você certamente terá sucesso.', 'Abraham Lincoln', 'perseveranca', 85, true, 'Carta a Quintin Campbell, 1862'),
  (NULL, 'citacao-real-086', 'Gênio é um por cento inspiração e noventa e nove por cento transpiração.', 'Thomas Edison', 'disciplina', 86, true, 'Entrevista à Harper’s Monthly, 1932'),
  (NULL, 'citacao-real-087', 'Nossa maior fraqueza está em desistir. O caminho mais certo para vencer é tentar mais uma vez.', 'Thomas Edison', 'perseveranca', 87, true, 'Declaração registrada por B. C. Forbes, 1921'),
  (NULL, 'citacao-real-088', 'Resultados negativos são exatamente o que quero. Eles são tão valiosos para mim quanto os resultados positivos.', 'Thomas Edison', 'resiliencia', 88, true, 'The Diary and Sundry Observations of Thomas Alva Edison'),
  (NULL, 'citacao-real-089', 'Oportunidade é perdida pela maioria porque vem vestida de macacão e parece trabalho.', 'Thomas Edison', 'disciplina', 89, true, 'Entrevista de 1921'),
  (NULL, 'citacao-real-090', 'Se fizéssemos tudo de que somos capazes, surpreenderíamos a nós mesmos.', 'Thomas Edison', 'proposito', 90, true, 'The Diary and Sundry Observations of Thomas Alva Edison'),
  (NULL, 'citacao-real-091', 'Se você pensa que pode ou pensa que não pode, de qualquer forma está certo.', 'Henry Ford', 'confianca', 91, true, 'Ford News, 1923'),
  (NULL, 'citacao-real-092', 'Um negócio que não produz nada além de dinheiro é um negócio pobre.', 'Henry Ford', 'sabedoria', 92, true, 'My Life and Work'),
  (NULL, 'citacao-real-093', 'Fracasso é simplesmente a oportunidade de começar de novo, desta vez de forma mais inteligente.', 'Henry Ford', 'recomeco', 93, true, 'My Life and Work'),
  (NULL, 'citacao-real-094', 'Nada é particularmente difícil se você dividir em pequenos trabalhos.', 'Henry Ford', 'disciplina', 94, true, 'Today and Tomorrow'),
  (NULL, 'citacao-real-095', 'Qualidade significa fazer certo quando ninguém está olhando.', 'Henry Ford', 'sabedoria', 95, true, 'My Life and Work'),
  (NULL, 'citacao-real-096', 'Que maravilha é ninguém precisar esperar um único momento para começar a melhorar o mundo.', 'Anne Frank', 'esperanca', 96, true, 'O Diário de Anne Frank'),
  (NULL, 'citacao-real-097', 'Apesar de tudo, ainda acredito que as pessoas são realmente boas de coração.', 'Anne Frank', 'esperanca', 97, true, 'O Diário de Anne Frank'),
  (NULL, 'citacao-real-098', 'Quem é feliz torna os outros felizes.', 'Anne Frank', 'gratidao', 98, true, 'O Diário de Anne Frank'),
  (NULL, 'citacao-real-099', 'Enquanto você puder olhar sem medo para o céu, saberá que é puro por dentro.', 'Anne Frank', 'coragem', 99, true, 'O Diário de Anne Frank'),
  (NULL, 'citacao-real-100', 'Não penso em toda a miséria, mas na beleza que ainda permanece.', 'Anne Frank', 'esperanca', 100, true, 'O Diário de Anne Frank'),
  (NULL, 'citacao-real-101', 'Feliz aquele que transfere o que sabe e aprende o que ensina.', 'Cora Coralina', 'sabedoria', 101, true, 'Vintém de Cobre: Meias Confissões de Aninha'),
  (NULL, 'citacao-real-102', 'Recria tua vida, sempre, sempre. Remove pedras e planta roseiras e faz doces. Recomeça.', 'Cora Coralina', 'recomeco', 102, true, 'Aninha e Suas Pedras'),
  (NULL, 'citacao-real-103', 'O que vale na vida não é o ponto de partida e sim a caminhada.', 'Cora Coralina', 'perseveranca', 103, true, 'Vintém de Cobre: Meias Confissões de Aninha'),
  (NULL, 'citacao-real-104', 'Mais esperança nos meus passos do que tristeza nos meus ombros.', 'Cora Coralina', 'esperanca', 104, true, 'Poema Assim Eu Vejo a Vida'),
  (NULL, 'citacao-real-105', 'Eu sou aquela mulher a quem o tempo muito ensinou.', 'Cora Coralina', 'sabedoria', 105, true, 'Todas as Vidas'),
  (NULL, 'citacao-real-106', 'No meio do caminho tinha uma pedra.', 'Carlos Drummond de Andrade', 'perseveranca', 106, true, 'Alguma Poesia — No Meio do Caminho'),
  (NULL, 'citacao-real-107', 'Tenho apenas duas mãos e o sentimento do mundo.', 'Carlos Drummond de Andrade', 'reflexao', 107, true, 'Sentimento do Mundo'),
  (NULL, 'citacao-real-108', 'As coisas findas, muito mais que lindas, essas ficarão.', 'Carlos Drummond de Andrade', 'gratidao', 108, true, 'Claro Enigma — Memória'),
  (NULL, 'citacao-real-109', 'O presente é tão grande, não nos afastemos.', 'Carlos Drummond de Andrade', 'proposito', 109, true, 'Sentimento do Mundo — Mãos Dadas'),
  (NULL, 'citacao-real-110', 'Vamos de mãos dadas.', 'Carlos Drummond de Andrade', 'forca', 110, true, 'Sentimento do Mundo — Mãos Dadas'),
  (NULL, 'citacao-real-111', 'Liberdade é pouco. O que eu desejo ainda não tem nome.', 'Clarice Lispector', 'coragem', 111, true, 'Perto do Coração Selvagem'),
  (NULL, 'citacao-real-112', 'Renda-se, como eu me rendi.', 'Clarice Lispector', 'coragem', 112, true, 'A Paixão Segundo G.H.'),
  (NULL, 'citacao-real-113', 'Até cortar os próprios defeitos pode ser perigoso. Nunca se sabe qual é o defeito que sustenta nosso edifício inteiro.', 'Clarice Lispector', 'autocuidado', 113, true, 'A Descoberta do Mundo'),
  (NULL, 'citacao-real-114', 'Que ninguém se engane, só se consegue a simplicidade através de muito trabalho.', 'Clarice Lispector', 'disciplina', 114, true, 'A Hora da Estrela'),
  (NULL, 'citacao-real-115', 'Não se preocupe em entender. Viver ultrapassa todo entendimento.', 'Clarice Lispector', 'sabedoria', 115, true, 'A Descoberta do Mundo'),
  (NULL, 'citacao-real-116', 'Educação não transforma o mundo. Educação muda as pessoas. Pessoas transformam o mundo.', 'Paulo Freire', 'sabedoria', 116, true, 'Pedagogia do Oprimido'),
  (NULL, 'citacao-real-117', 'Ensinar não é transferir conhecimento, mas criar as possibilidades para a sua própria produção ou construção.', 'Paulo Freire', 'sabedoria', 117, true, 'Pedagogia da Autonomia'),
  (NULL, 'citacao-real-118', 'Quem ensina aprende ao ensinar e quem aprende ensina ao aprender.', 'Paulo Freire', 'sabedoria', 118, true, 'Pedagogia da Autonomia'),
  (NULL, 'citacao-real-119', 'Não há saber mais ou saber menos: há saberes diferentes.', 'Paulo Freire', 'sabedoria', 119, true, 'Pedagogia do Oprimido'),
  (NULL, 'citacao-real-120', 'A leitura do mundo precede a leitura da palavra.', 'Paulo Freire', 'sabedoria', 120, true, 'A Importância do Ato de Ler');

ALTER TABLE public.mensagens_inspiradoras
  ALTER COLUMN fonte SET NOT NULL;

ALTER TABLE public.mensagens_inspiradoras
  DROP CONSTRAINT IF EXISTS mensagens_inspiradoras_fonte_chk;

ALTER TABLE public.mensagens_inspiradoras
  ADD CONSTRAINT mensagens_inspiradoras_fonte_chk
  CHECK (char_length(trim(fonte)) >= 3);

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
    ORDER BY random()
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

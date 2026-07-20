-- Substitui paráfrases e complementos editoriais por citações reais.
-- A escolha diária é reiniciada para que nenhuma mensagem antiga permaneça vinculada.

TRUNCATE TABLE public.mensagens_inspiradoras_empresas_dia;
DELETE FROM public.mensagens_inspiradoras;

INSERT INTO public.mensagens_inspiradoras (
  empresa_id,
  codigo,
  texto,
  autor,
  categoria,
  ordem,
  ativo
)
VALUES
  (NULL, 'citacao-real-001', 'Se você quer ser bem-sucedido, precisa ter dedicação total, buscar seu último limite e dar o melhor de si.', 'Ayrton Senna', 'disciplina', 1, true),
  (NULL, 'citacao-real-002', 'No que diz respeito ao empenho, ao compromisso, ao esforço, à dedicação, não existe meio-termo. Ou você faz uma coisa bem-feita ou não faz.', 'Ayrton Senna', 'disciplina', 2, true),
  (NULL, 'citacao-real-003', 'Nas adversidades uns desistem, enquanto outros batem recordes.', 'Ayrton Senna', 'resiliencia', 3, true),
  (NULL, 'citacao-real-004', 'Vencer sem correr riscos é triunfar sem glórias!', 'Ayrton Senna', 'coragem', 4, true),
  (NULL, 'citacao-real-005', 'Vencer é o que importa. O resto é a consequência.', 'Ayrton Senna', 'proposito', 5, true),
  (NULL, 'citacao-real-006', 'A única maneira de fazer um excelente trabalho é amar o que você faz.', 'Steve Jobs', 'proposito', 6, true),
  (NULL, 'citacao-real-007', 'Às vezes, a vida acerta você na cabeça com um tijolo. Não perca a fé.', 'Steve Jobs', 'esperanca', 7, true),
  (NULL, 'citacao-real-008', 'Seu tempo é limitado, então não o desperdice vivendo a vida de outra pessoa.', 'Steve Jobs', 'proposito', 8, true),
  (NULL, 'citacao-real-009', 'Se você ainda não encontrou o que ama, continue procurando. Não se acomode.', 'Steve Jobs', 'perseveranca', 9, true),
  (NULL, 'citacao-real-010', 'Aprendi que a coragem não era a ausência do medo, mas o triunfo sobre ele.', 'Nelson Mandela', 'coragem', 10, true),
  (NULL, 'citacao-real-011', 'A educação é a arma mais poderosa que você pode usar para mudar o mundo.', 'Nelson Mandela', 'sabedoria', 11, true),
  (NULL, 'citacao-real-012', 'Depois de escalar uma grande montanha, descobre-se que há muitas outras montanhas para escalar.', 'Nelson Mandela', 'perseveranca', 12, true),
  (NULL, 'citacao-real-013', 'Uma criança, um professor, um livro e uma caneta podem mudar o mundo.', 'Malala Yousafzai', 'esperanca', 13, true),
  (NULL, 'citacao-real-014', 'Percebemos a importância de nossa voz quando somos silenciados.', 'Malala Yousafzai', 'coragem', 14, true),
  (NULL, 'citacao-real-015', 'A única coisa que devemos temer é o próprio medo.', 'Franklin D. Roosevelt', 'coragem', 15, true),
  (NULL, 'citacao-real-016', 'Tudo vale a pena se a alma não é pequena.', 'Fernando Pessoa', 'coragem', 16, true),
  (NULL, 'citacao-real-017', 'Tenho em mim todos os sonhos do mundo.', 'Fernando Pessoa', 'esperanca', 17, true),
  (NULL, 'citacao-real-018', 'É preciso ter esperança, mas ter esperança do verbo esperançar; porque tem gente que tem esperança do verbo esperar.', 'Paulo Freire', 'esperanca', 18, true),
  (NULL, 'citacao-real-019', 'Ninguém caminha sem aprender a caminhar, sem aprender a fazer o caminho caminhando.', 'Paulo Freire', 'sabedoria', 19, true),
  (NULL, 'citacao-real-020', 'O que a vida quer da gente é coragem.', 'João Guimarães Rosa', 'coragem', 20, true);

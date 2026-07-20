-- Remove uma frase sem fonte primária confiável e preserva o acervo com 120 citações.

UPDATE public.mensagens_inspiradoras
SET
  texto = 'Um negócio que não produz nada além de dinheiro é um negócio pobre.',
  categoria = 'sabedoria',
  fonte = 'My Life and Work',
  updated_at = now()
WHERE codigo = 'citacao-real-092';

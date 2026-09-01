-- Corrige triggers legados que chamavam set_updated_at() em tabelas cujo campo
-- temporal se chama atualizado_em. Sem isso, qualquer UPDATE nessas tabelas
-- falha antes da unificação das obrigações.

DROP TRIGGER IF EXISTS set_updated_at_parametrizacao_protocolos
  ON public.parametrizacao_protocolos_tipos;
CREATE TRIGGER set_updated_at_parametrizacao_protocolos
  BEFORE UPDATE ON public.parametrizacao_protocolos_tipos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atualizado_em();

DROP TRIGGER IF EXISTS set_updated_at_parametrizacao_prazos
  ON public.parametrizacao_prazos_entrega;
CREATE TRIGGER set_updated_at_parametrizacao_prazos
  BEFORE UPDATE ON public.parametrizacao_prazos_entrega
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atualizado_em();

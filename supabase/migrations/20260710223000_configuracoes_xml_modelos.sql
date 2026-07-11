-- Modelos de visualizacao XML fiscal por empresa.

CREATE TABLE IF NOT EXISTS public.configuracoes_xml_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo varchar(20) NOT NULL CHECK (tipo IN ('nfse', 'nfce', 'nfe', 'cte', 'mdfe')),
  estado varchar(20) NOT NULL DEFAULT 'autorizado' CHECK (estado IN ('autorizado', 'cancelado')),
  titulo varchar(120) NOT NULL,
  descricao text NOT NULL DEFAULT '',
  exemplo_url text NOT NULL DEFAULT '',
  campos text[] NOT NULL DEFAULT '{}',
  modelo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  sistema boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo, estado)
);

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(
    coalesce(allowed_mime_types, ARRAY[]::text[])
    || ARRAY['application/xml', 'text/xml']
  )
)
WHERE id = 'documentos';

CREATE INDEX IF NOT EXISTS idx_configuracoes_xml_modelos_empresa
  ON public.configuracoes_xml_modelos(empresa_id, tipo, estado);

DROP TRIGGER IF EXISTS set_configuracoes_xml_modelos_updated_at ON public.configuracoes_xml_modelos;
CREATE TRIGGER set_configuracoes_xml_modelos_updated_at
  BEFORE UPDATE ON public.configuracoes_xml_modelos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.configuracoes_xml_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_xml_modelos_tenant_policy ON public.configuracoes_xml_modelos;
CREATE POLICY configuracoes_xml_modelos_tenant_policy ON public.configuracoes_xml_modelos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

INSERT INTO public.configuracoes_xml_modelos (
  empresa_id, tipo, estado, titulo, descricao, exemplo_url, campos, modelo, ativo, sistema
)
SELECT
  e.id,
  seed.tipo,
  seed.estado,
  seed.titulo,
  seed.descricao,
  seed.exemplo_url,
  defaults.campos,
  defaults.modelo,
  true,
  true
FROM public.empresas e
CROSS JOIN (
  VALUES
    ('nfse', 'autorizado', 'NFS-e autorizada', 'Modelo visual para nota fiscal de servico autorizada.', '/documentos/xml-exemplos/nfse-sergipe.xml'),
    ('nfse', 'cancelado', 'NFS-e cancelada', 'Modelo visual para evento de cancelamento de NFS-e.', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
    ('nfce', 'autorizado', 'NFC-e autorizada', 'Modelo visual para cupom fiscal eletronico autorizado.', '/documentos/xml-exemplos/nfce.xml'),
    ('nfce', 'cancelado', 'NFC-e cancelada', 'Modelo visual para evento de cancelamento de NFC-e.', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
    ('nfe', 'autorizado', 'NF-e autorizada', 'Modelo visual para nota fiscal de venda autorizada.', '/documentos/xml-exemplos/nfe.xml'),
    ('nfe', 'cancelado', 'NF-e cancelada', 'Modelo visual para evento de cancelamento de NF-e.', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
    ('cte', 'autorizado', 'CT-e autorizado', 'Modelo visual para conhecimento de transporte autorizado.', '/documentos/xml-exemplos/cte.xml'),
    ('cte', 'cancelado', 'CT-e cancelado', 'Modelo visual para evento de cancelamento de CT-e.', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
    ('mdfe', 'autorizado', 'Manifesto MDF-e autorizado', 'Modelo visual para manifesto fiscal autorizado.', '/documentos/xml-exemplos/mdfe-manifesto.xml'),
    ('mdfe', 'cancelado', 'Manifesto MDF-e cancelado', 'Modelo visual para evento de cancelamento de manifesto.', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml')
) AS seed(tipo, estado, titulo, descricao, exemplo_url)
CROSS JOIN LATERAL (
  SELECT
    ARRAY['tipo', 'numero', 'emissao', 'emitente', 'destinatario', 'valor', 'status']::text[] AS campos,
    'Cabeçalho: {{tipo}} {{numero}}
Emissão: {{emissao}}
Emitente: {{emitente}}
Destinatário/Tomador: {{destinatario}}
Valor informado: {{valor}}
Status: {{status}}'::text AS modelo
) defaults
ON CONFLICT (empresa_id, tipo, estado) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'configuracoes_xml_modelos'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_xml_modelos;
    END IF;
  END IF;
END;
$$;

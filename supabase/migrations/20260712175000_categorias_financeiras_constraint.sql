-- Alter check constraint to allow 'categorias_financeiras'
ALTER TABLE parametrizacao_catalogos DROP CONSTRAINT IF EXISTS parametrizacao_catalogos_tipo_check;

ALTER TABLE parametrizacao_catalogos ADD CONSTRAINT parametrizacao_catalogos_tipo_check 
CHECK (tipo = ANY (ARRAY[
  'tipos_empresa'::text, 
  'naturezas_juridicas'::text, 
  'tipos_parceiros'::text, 
  'categorias_clientes'::text, 
  'tipos_documentos'::text, 
  'modelos_checklists'::text,
  'categorias_financeiras'::text
]));

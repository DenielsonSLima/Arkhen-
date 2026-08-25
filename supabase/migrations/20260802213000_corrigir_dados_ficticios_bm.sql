-- Corrige somente o registro fictício que reutilizava o CNPJ real da B&M.
-- O CNPJ zerado é excluído do índice único de CNPJs reais.

update public.clientes
set cnpj='00.000.000/0000-00',
    updated_at=now()
where nome='AgroVale Insumos'
  and regexp_replace(cnpj,'[^0-9]','','g')='35898750000107';

-- Identifica o objeto legado sem publicar credenciais.
update storage.objects o
set user_metadata=coalesce(o.user_metadata,'{}'::jsonb)
    || jsonb_build_object(
      'asset_type','cliente-logo',
      'legacy_path',true
    ),
    updated_at=now()
where o.bucket_id='app-assets'
  and o.name='cliente-logos/bm-contabilidade/bm-logo.png';

-- Amplia formatos aceitos no bucket de documentos para rotinas contabeis.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(
    coalesce(allowed_mime_types, ARRAY[]::text[])
    || ARRAY[
      'text/csv',
      'application/csv',
      'application/vnd.ms-outlook',
      'message/rfc822',
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.rar',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-pkcs12',
      'application/pkcs12',
      'application/x-x509-ca-cert',
      'application/pkix-cert',
      'application/pkcs7-signature',
      'application/x-ofx',
      'application/ofx',
      'text/ofx'
    ]
  )
)
WHERE id = 'documentos';

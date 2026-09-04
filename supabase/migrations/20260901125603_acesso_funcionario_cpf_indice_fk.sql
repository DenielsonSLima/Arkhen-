CREATE INDEX IF NOT EXISTS identidades_funcionarios_cpf_config_auth_empresa_idx
  ON private.identidades_funcionarios_cpf (configuracao_usuario_id, auth_user_id, empresa_id);

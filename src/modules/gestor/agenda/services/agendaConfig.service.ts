import { supabase } from '../../../../lib/supabase';
import {
  gerarCorFundo,
  getCurrentEmpresaId,
  isUuid,
  normalizarCor,
  toAgendaPadraoEvento,
  toAgendaPadraoPayload,
  toConfig,
  toEvento,
  toResponsavel,
} from './agenda.mappers';
import type {
  AgendaEventoRow,
  AgendaPadraoEvento,
  AgendaPadraoEventoRow,
  CategoriaEventoConfig,
  ConfigRow,
  Evento,
  ResponsavelRow,
  TipoEventoConfig,
  UsuarioAgenda,
} from './agenda.types';

export const TIPO_EVENTO_CONFIG_DEFAULT: TipoEventoConfig[] = [];
export const CATEGORIAS_EVENTO: CategoriaEventoConfig[] = [];
export const TIPO_EVENTO_CONFIG: Record<string, { label: string; cor: string; corFundo: string }> = {};

export async function getTiposEventoConfig(): Promise<TipoEventoConfig[]> {
  const { data, error } = await supabase
    .from('agenda_tipos_evento')
    .select('id,codigo,label,cor,cor_fundo,ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return ((data || []) as ConfigRow[]).map(toConfig);
}

export async function salvarTiposEventoConfig(itens: TipoEventoConfig[]): Promise<TipoEventoConfig[]> {
  const empresaId = await getCurrentEmpresaId();
  const payload = itens.map((item, index) => ({
    empresa_id: empresaId,
    codigo: item.id,
    label: item.label,
    cor: normalizarCor(item.cor),
    cor_fundo: item.corFundo || gerarCorFundo(item.cor),
    ativo: item.ativo,
    ordem: index + 1,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from('agenda_tipos_evento').upsert(payload, { onConflict: 'empresa_id,codigo' });
    if (error) throw error;
  }
  return getTiposEventoConfig();
}

export async function getCategoriasEventoConfig(): Promise<CategoriaEventoConfig[]> {
  const { data, error } = await supabase
    .from('agenda_categorias_evento')
    .select('id,codigo,label,cor,cor_fundo,ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return ((data || []) as ConfigRow[]).map(toConfig);
}

export async function salvarCategoriasEventoConfig(itens: CategoriaEventoConfig[]): Promise<CategoriaEventoConfig[]> {
  const empresaId = await getCurrentEmpresaId();
  const payload = itens.map((item, index) => ({
    empresa_id: empresaId,
    codigo: item.id,
    label: item.label,
    cor: normalizarCor(item.cor),
    cor_fundo: item.corFundo || gerarCorFundo(item.cor),
    ativo: item.ativo,
    ordem: index + 1,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from('agenda_categorias_evento').upsert(payload, { onConflict: 'empresa_id,codigo' });
    if (error) throw error;
  }
  return getCategoriasEventoConfig();
}

export async function getResponsaveisAgendaConfig(): Promise<UsuarioAgenda[]> {
  const { data, error } = await supabase
    .from('agenda_responsaveis')
    .select('id,nome,perfil,status,cor,ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;
  return ((data || []) as ResponsavelRow[]).map(toResponsavel);
}

export async function salvarResponsaveisAgendaConfig(itens: UsuarioAgenda[]): Promise<UsuarioAgenda[]> {
  const empresaId = await getCurrentEmpresaId();
  const payload = itens.map((item, index) => ({
    id: isUuid(item.id) ? item.id : undefined,
    empresa_id: empresaId,
    nome: item.nome,
    perfil: item.perfil,
    status: item.status,
    cor: normalizarCor(item.cor),
    ativo: item.ativo,
    ordem: index + 1,
  }));

  if (payload.length > 0) {
    const { error } = await supabase.from('agenda_responsaveis').upsert(payload);
    if (error) throw error;
  }
  return getResponsaveisAgendaConfig();
}

export async function getAgendaPodeGerenciarPadroes(): Promise<boolean> {
  const { data, error } = await supabase.rpc('agenda_current_user_can_manage');
  if (error) throw error;
  return Boolean(data);
}

export async function getAgendaPadroesEventos(): Promise<AgendaPadraoEvento[]> {
  const { data, error } = await supabase.rpc('listar_agenda_padroes_eventos');
  if (error) throw error;
  return ((data || []) as AgendaPadraoEventoRow[]).map(toAgendaPadraoEvento);
}

export async function salvarAgendaPadroesEventos(itens: AgendaPadraoEvento[]): Promise<AgendaPadraoEvento[]> {
  const payload = itens.map((item, index) => toAgendaPadraoPayload({ ...item, ordem: index + 1 }));
  const { error } = await supabase.rpc('salvar_agenda_padroes_eventos', { p_itens: payload });
  if (error) throw error;
  return getAgendaPadroesEventos();
}

export async function getAgendaPadroesOcorrencias(
  anoInicio: number,
  mesInicio: number,
  meses: number,
): Promise<Evento[]> {
  const { data, error } = await supabase.rpc('listar_agenda_padroes_ocorrencias', {
    p_ano_inicio: anoInicio,
    p_mes_inicio: mesInicio + 1,
    p_meses: meses,
  });

  if (error) throw error;
  return ((data || []) as AgendaEventoRow[]).map(toEvento);
}

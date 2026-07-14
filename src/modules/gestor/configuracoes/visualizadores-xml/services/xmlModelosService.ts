import { supabase } from '../../../../../lib/supabase';
import { persistedStorage } from '../../../../../lib/persistedStorage';
import type { XmlModelo, XmlModeloEstado, XmlModeloTipo } from '../types';

interface XmlModeloRow {
  tipo: XmlModeloTipo;
  estado: XmlModeloEstado;
  titulo: string;
  descricao: string | null;
  exemplo_url: string | null;
  campos: string[] | null;
  modelo: string;
  ativo: boolean | null;
  sistema: boolean | null;
}

export const XML_MODELO_LABELS: Record<XmlModeloTipo, string> = {
  nfse: 'NFS-e',
  nfce: 'NFC-e',
  nfe: 'NF-e',
  cte: 'CT-e',
  mdfe: 'Manifesto MDF-e',
};

const defaultFields = ['tipo', 'numero', 'emissao', 'emitente', 'destinatario', 'valor', 'status'];

const makeDefault = (tipo: XmlModeloTipo, estado: XmlModeloEstado, exemploUrl: string): XmlModelo => ({
  tipo,
  estado,
  titulo: `${XML_MODELO_LABELS[tipo]} ${estado === 'cancelado' ? 'cancelada' : 'autorizada'}`,
  descricao: estado === 'cancelado'
    ? 'Modelo visual para eventos de cancelamento vinculados ao documento fiscal.'
    : 'Modelo visual para leitura operacional do XML autorizado.',
  exemploUrl,
  campos: defaultFields,
  modelo: [
    'Cabeçalho: {{tipo}} {{numero}}',
    'Emissão: {{emissao}}',
    'Emitente: {{emitente}}',
    'Destinatário/Tomador: {{destinatario}}',
    'Valor informado: {{valor}}',
    'Status: {{status}}',
  ].join('\n'),
  ativo: true,
  sistema: true,
});

export const DEFAULT_XML_MODELOS: XmlModelo[] = [
  makeDefault('nfse', 'autorizado', '/documentos/xml-exemplos/nfse-sergipe.xml'),
  makeDefault('nfse', 'cancelado', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
  makeDefault('nfce', 'autorizado', '/documentos/xml-exemplos/nfce.xml'),
  makeDefault('nfce', 'cancelado', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
  makeDefault('nfe', 'autorizado', '/documentos/xml-exemplos/nfe.xml'),
  makeDefault('nfe', 'cancelado', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
  makeDefault('cte', 'autorizado', '/documentos/xml-exemplos/cte.xml'),
  makeDefault('cte', 'cancelado', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
  makeDefault('mdfe', 'autorizado', '/documentos/xml-exemplos/mdfe-manifesto.xml'),
  makeDefault('mdfe', 'cancelado', '/documentos/xml-exemplos/cancelados/nfe-cancelada.xml'),
];

const rowToModelo = (row: XmlModeloRow): XmlModelo => ({
  tipo: row.tipo,
  estado: row.estado,
  titulo: row.titulo,
  descricao: row.descricao || '',
  exemploUrl: row.exemplo_url || '',
  campos: row.campos || [],
  modelo: row.modelo,
  ativo: row.ativo !== false,
  sistema: row.sistema !== false,
});

const modeloToPayload = (modelo: XmlModelo) => ({
  tipo: modelo.tipo,
  estado: modelo.estado,
  titulo: modelo.titulo,
  descricao: modelo.descricao,
  exemplo_url: modelo.exemploUrl,
  campos: modelo.campos,
  modelo: modelo.modelo,
  ativo: modelo.ativo,
  sistema: modelo.sistema,
});

const mergeWithDefaults = (rows: XmlModelo[]) => {
  const key = (item: XmlModelo) => `${item.tipo}:${item.estado}`;
  const merged = new Map(DEFAULT_XML_MODELOS.map((item) => [key(item), item]));
  rows.forEach((item) => merged.set(key(item), { ...merged.get(key(item)), ...item }));
  return Array.from(merged.values());
};

const localKey = 'contabil_config_xml_modelos';

export const xmlModelosService = {
  async list(): Promise<XmlModelo[]> {
    const { data, error } = await supabase
      .from('configuracoes_xml_modelos')
      .select('tipo,estado,titulo,descricao,exemplo_url,campos,modelo,ativo,sistema')
      .order('tipo', { ascending: true })
      .order('estado', { ascending: true });

    if (!error) return mergeWithDefaults(((data || []) as XmlModeloRow[]).map(rowToModelo));

    const stored = persistedStorage.getItem(localKey);
    if (!stored) return DEFAULT_XML_MODELOS;

    try {
      return mergeWithDefaults(JSON.parse(stored) as XmlModelo[]);
    } catch {
      return DEFAULT_XML_MODELOS;
    }
  },

  async save(modelos: XmlModelo[]): Promise<XmlModelo[]> {
    persistedStorage.setItem(localKey, JSON.stringify(modelos));

    const { error } = await supabase
      .from('configuracoes_xml_modelos')
      .upsert(modelos.map(modeloToPayload), { onConflict: 'empresa_id,tipo,estado' });

    if (error) return modelos;
    return this.list();
  },
};

export type XmlModeloTipo = 'nfse' | 'nfce' | 'nfe' | 'cte' | 'mdfe';
export type XmlModeloEstado = 'autorizado' | 'cancelado';

export interface XmlModelo {
  tipo: XmlModeloTipo;
  estado: XmlModeloEstado;
  titulo: string;
  descricao: string;
  exemploUrl: string;
  campos: string[];
  modelo: string;
  ativo: boolean;
  sistema: boolean;
}

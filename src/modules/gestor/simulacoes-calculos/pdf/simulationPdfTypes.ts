export interface SimulationPdfRow {
  label: string;
  value: string;
}

export interface SimulationPdfSection {
  title: string;
  rows: SimulationPdfRow[];
}

export interface SimulationPdfCompany {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logoDataUrl?: string | null;
}

export interface SimulationPdfWatermark {
  enabled: boolean;
  dataUrl?: string | null;
  opacity?: number;
  size?: number;
  position?: 'topo-esquerda' | 'topo-direita' | 'centro' | 'rodape-direita';
  aspectRatio?: number;
}

export interface SimulationPdfInput {
  title: string;
  generatedAt: Date;
  company: SimulationPdfCompany;
  sections: SimulationPdfSection[];
  watermark?: SimulationPdfWatermark;
}

export interface GeneratedSimulationPdf {
  bytes: Uint8Array;
  pageCount: number;
}

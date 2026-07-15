export interface ExtractedRtcXml {
  arquivoNome: string;
  conteudoXml: string;
}

export const extractRtcXml = async (file: File): Promise<ExtractedRtcXml> => {
  if (!file.name.toLowerCase().endsWith('.xml')) throw new Error('Selecione um arquivo XML.');
  if (file.size > 10 * 1024 * 1024) throw new Error('O XML deve ter no máximo 10 MB.');
  const rawXml = await file.text();
  const xml = new DOMParser().parseFromString(rawXml, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length > 0) throw new Error('O arquivo XML é inválido.');

  return {
    arquivoNome: file.name,
    conteudoXml: rawXml,
  };
};

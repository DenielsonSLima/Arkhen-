import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { empresaService } from '../../configuracoes/empresa/services/empresaService';
import { marcaDaguaService } from '../../configuracoes/marca-dagua/services/marcaDaguaService';
import {
  generateSimulationPdf,
  getImageDetails,
  imageUrlToDataUrl,
} from '../pdf/generateSimulationPdf';
import { resolvePortraitWatermarkSnapshot } from '../pdf/watermarkConfig';
import type { ResultadoRescisao } from '../services/calculos.service';
import { buildRescisaoPdfSections } from './rescisaoPdfSections';
import type { RescisaoEnvelope } from './rescisaoService';
import type { RescisaoParams } from './rescisaoTypes';

export function useRescisaoPdf(
  params: RescisaoParams,
  resultado: ResultadoRescisao,
  envelope?: RescisaoEnvelope,
  tipoRescisaoLabel?: string,
) {
  const companyQuery = useQuery({
    queryKey: ['configuracoes', 'empresa', 'simulacao-rescisao'],
    queryFn: empresaService.getDadosEmpresa,
    staleTime: 60_000,
  });
  const watermarkQuery = useQuery({
    queryKey: ['configuracoes', 'marca-dagua'],
    queryFn: marcaDaguaService.getMarcaDaguaConfig,
    staleTime: 60_000,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const generationRef = useRef(0);

  const generate = useCallback(async () => {
    const company = companyQuery.data;
    const watermarkConfig = watermarkQuery.data;
    if (!envelope) throw new Error('Calcule uma rescisão válida antes de gerar o relatório.');
    if (!company) throw new Error('Os dados do escritório ainda não foram carregados.');
    if (!watermarkConfig) throw new Error('A configuração da marca d’água ainda não foi carregada.');

    const watermarkSnapshot = resolvePortraitWatermarkSnapshot(watermarkConfig);
    if (watermarkSnapshot.enabled && !watermarkSnapshot.sourceUrl) {
      throw new Error('A marca d’água Retrato está habilitada, mas não possui imagem configurada.');
    }

    const [logoDataUrl, watermarkDetails] = await Promise.all([
      imageUrlToDataUrl(company.logoUrl),
      watermarkSnapshot.enabled
        ? getImageDetails(watermarkSnapshot.sourceUrl)
        : Promise.resolve({ dataUrl: null, aspectRatio: 1 }),
    ]);
    if (watermarkSnapshot.enabled && !watermarkDetails.dataUrl) {
      throw new Error('Não foi possível carregar a marca d’água Retrato configurada.');
    }

    return generateSimulationPdf({
      title: 'Calculadora de Rescisão',
      generatedAt: new Date(),
      company: { ...company, logoDataUrl },
      sections: buildRescisaoPdfSections(params, resultado, envelope, tipoRescisaoLabel),
      watermark: {
        enabled: watermarkSnapshot.enabled,
        dataUrl: watermarkDetails.dataUrl,
        opacity: watermarkSnapshot.opacity,
        size: watermarkSnapshot.size,
        position: watermarkSnapshot.position,
        aspectRatio: watermarkDetails.aspectRatio,
      },
    });
  }, [companyQuery.data, envelope, params, resultado, tipoRescisaoLabel, watermarkQuery.data]);

  const prepare = useCallback(async () => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setIsGenerating(true);
    setError('');
    try {
      const generated = await generate();
      if (generationRef.current !== generation) return null;
      setBytes(generated.bytes);
      setPageCount(generated.pageCount);
      return generated.bytes;
    } catch (cause) {
      if (generationRef.current !== generation) return null;
      const message = cause instanceof Error ? cause.message : 'Não foi possível gerar o relatório.';
      setError(message);
      return null;
    } finally {
      if (generationRef.current === generation) setIsGenerating(false);
    }
  }, [generate]);

  const open = useCallback(() => {
    setIsOpen(true);
    setBytes(null);
    setPageCount(0);
    void prepare();
  }, [prepare]);

  const close = useCallback(() => {
    generationRef.current += 1;
    setIsOpen(false);
    setBytes(null);
    setPageCount(0);
    setIsGenerating(false);
    setError('');
  }, []);

  const download = useCallback(async () => {
    const currentBytes = bytes || await prepare();
    if (!currentBytes) return;
    const url = URL.createObjectURL(new Blob([currentBytes.slice()], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Calculo_Rescisao_Arkhen.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }, [bytes, prepare]);

  return {
    isOpen,
    bytes,
    pageCount,
    isGenerating,
    error,
    isConfigLoading: companyQuery.isLoading || watermarkQuery.isLoading,
    open,
    close,
    download,
  };
}

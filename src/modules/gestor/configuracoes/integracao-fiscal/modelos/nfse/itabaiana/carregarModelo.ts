import brasaoUrl from './assets/brasao-itabaiana.png';
import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';
import { type NfseModeloOptions } from './modelo';
import { carregarFontes } from './fontes';

const loadImage = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível carregar a imagem do modelo da NFS-e.');
  return new Uint8Array(await response.arrayBuffer());
};

export async function carregarModelo(_nfse: NfseFiscalData, options: NfseModeloOptions) {
  const [brasaoImagem, fontes] = await Promise.all([
    options.brasaoImagem || loadImage(brasaoUrl), options.fontes || carregarFontes(),
  ]);
  return { ...options, brasaoImagem, fontes };
}

export async function baixarNfsePdf(nfse: NfseFiscalData, options: NfseModeloOptions) {
  const [{ gerarNfsePdf }, loaded] = await Promise.all([import('./gerarNfsePdf'), carregarModelo(nfse, options)]);
  const pdf = gerarNfsePdf(nfse, loaded);
  pdf.save(`NFS-e-${nfse.numero.replace(/[^a-z0-9-]/gi, '')}-${options.ambiente}.pdf`);
}

/** Prepara o mesmo modelo do download sem iniciar um salvamento no navegador. */
export async function prepararNfsePdf(nfse: NfseFiscalData, options: NfseModeloOptions) {
  const [{ gerarNfsePdf }, loaded] = await Promise.all([import('./gerarNfsePdf'), carregarModelo(nfse, options)]);
  const pdf = gerarNfsePdf(nfse, loaded);
  return {
    blob: pdf.output('blob'),
    filename: `NFS-e-${nfse.numero.replace(/[^a-z0-9-]/gi, '')}-${options.ambiente}.pdf`,
  };
}

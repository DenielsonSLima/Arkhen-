import JSZip from 'jszip';

export interface ZipItem {
  name: string;
  url: string;
}

export const downloadAndZipFiles = async (
  items: ZipItem[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  const zip = new JSZip();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length);

    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error(`Falha ao baixar ${item.name}`);
      const blob = await response.blob();
      zip.file(item.name, blob);
    } catch (error) {
      console.error(`Erro ao incluir arquivo no ZIP (${item.name}):`, error);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const urlSafe = window.URL.createObjectURL(content);
  const anchor = document.createElement('a');
  anchor.href = urlSafe;
  anchor.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(urlSafe);
};

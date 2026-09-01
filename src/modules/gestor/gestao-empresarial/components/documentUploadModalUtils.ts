export interface UploadFileItem {
  file: File;
  relativePath: string;
}

export interface UploadProgressState {
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  uploadedBytes: number;
  currentFile: string;
  startedAt: number;
}

interface DragFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (
      successCallback: (entries: DragFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void,
    ) => void;
  };
}

export const ALLOWED_ACCOUNTING_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.ppt',
  '.pptx',
  '.xml',
  '.txt',
  '.efd',
  '.ecd',
  '.ecf',
  '.ofx',
  '.qif',
  '.rem',
  '.ret',
  '.cnab',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.zip',
  '.rar',
  '.7z',
  '.pfx',
  '.p12',
  '.cer',
  '.crt',
  '.pem',
  '.p7s',
  '.key',
  '.eml',
  '.msg',
];

export const ALLOWED_ACCOUNTING_ACCEPT = [
  ...ALLOWED_ACCOUNTING_EXTENSIONS,
  'application/pdf',
  'application/xml',
  'text/xml',
  'text/csv',
  'message/rfc822',
].join(',');

export const ACCEPTED_FORMATS_LABEL = 'PDF, Office, XML, TXT/SPED, CSV, OFX/QIF, CNAB, imagens, certificados (.pfx, .p12, .cer, .crt, .pem, .p7s, .key) e ZIP/RAR/7Z';

export const getFileExtension = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
};

export const getFileRelativePath = (file: File) => (
  (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
);

export const formatBytesLabel = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const formatRemainingTime = (milliseconds: number) => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'calculando...';
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const minutesRest = minutes % 60;
  return minutesRest ? `${hours}h ${minutesRest}min` : `${hours}h`;
};

export const getRelativeFolder = (relativePath: string, fileName: string) => {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  if (parts.at(-1) === fileName) parts.pop();
  return parts.join('/');
};

export const combineFolders = (baseFolder: string | null, relativeFolder: string) => (
  [baseFolder || '', relativeFolder].map((part) => part.trim()).filter(Boolean).join('/')
);

const readDirectoryEntries = (entry: DragFileSystemEntry) => new Promise<DragFileSystemEntry[]>((resolve, reject) => {
  const reader = entry.createReader?.();
  if (!reader) {
    resolve([]);
    return;
  }

  const entries: DragFileSystemEntry[] = [];
  const readBatch = () => {
    reader.readEntries((batch) => {
      if (batch.length === 0) {
        resolve(entries);
        return;
      }
      entries.push(...batch);
      readBatch();
    }, reject);
  };

  readBatch();
});

const collectEntryFiles = async (entry: DragFileSystemEntry, parentPath = ''): Promise<UploadFileItem[]> => {
  if (entry.isFile && entry.file) {
    return new Promise((resolve, reject) => {
      entry.file?.(
        (file) => resolve([{ file, relativePath: `${parentPath}${file.name}` }]),
        reject,
      );
    });
  }

  if (!entry.isDirectory) return [];
  const children = await readDirectoryEntries(entry);
  const nested = await Promise.all(children.map((child) => collectEntryFiles(child, `${parentPath}${entry.name}/`)));
  return nested.flat();
};

export const collectDroppedFiles = async (dataTransfer: DataTransfer): Promise<UploadFileItem[]> => {
  const entries = Array.from(dataTransfer.items || [])
    .map((item) => {
      const getEntry = (item as unknown as { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry;
      return getEntry?.();
    })
    .filter((entry): entry is DragFileSystemEntry => Boolean(entry));

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map((entry) => collectEntryFiles(entry)));
    return nested.flat();
  }

  return Array.from(dataTransfer.files || []).map((file) => ({
    file,
    relativePath: file.name,
  }));
};

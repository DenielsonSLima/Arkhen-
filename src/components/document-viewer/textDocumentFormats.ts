export const TEXT_PREVIEW_EXTENSIONS = [
  'txt', 'csv', 'ofx', 'qif', 'rem', 'ret', 'cnab', 'efd', 'ecd', 'ecf', 'log',
] as const;

export const isTextPreviewableFilename = (filename: string) => {
  const extension = filename.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase().trim() || '';
  return TEXT_PREVIEW_EXTENSIONS.includes(extension as (typeof TEXT_PREVIEW_EXTENSIONS)[number]);
};

import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export const getDirectChildren = (allFolders: string[], parentPath: string | null): string[] => {
  if (parentPath === null) return allFolders.filter(folder => !folder.includes('/'));
  const prefix = parentPath + '/';
  return allFolders
    .filter(folder => folder.startsWith(prefix))
    .map(folder => folder.slice(prefix.length))
    .filter(rest => !rest.includes('/'));
};

export const normalizeFolderPath = (path: string): string => (
  path
    .split('/')
    .map((part) => part.trim().replace(/_+/g, ' ').replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('/')
);

export const normalizeFolderPaths = (paths: string[] | null | undefined): string[] => {
  const byKey = new Map<string, string>();
  (paths || []).forEach((path) => {
    const normalized = normalizeFolderPath(path);
    if (!normalized) return;
    byKey.set(normalized.toLowerCase(), normalized);
  });
  return Array.from(byKey.values());
};

export const folderLabel = (path: string): string => {
  const parts = path.split('/');
  return parts[parts.length - 1];
};

export const buildBreadcrumb = (path: string | null): { label: string; path: string | null }[] => {
  const crumbs: { label: string; path: string | null }[] = [{ label: 'Biblioteca', path: null }];
  if (!path) return crumbs;
  const parts = path.split('/');
  parts.forEach((part, index) => {
    crumbs.push({ label: part, path: parts.slice(0, index + 1).join('/') });
  });
  return crumbs;
};

export const moveFolderTree = (
  sourcePath: string,
  targetPath: string | null,
  folders: string[],
  documents: CompanyDocument[],
) => {
  if (sourcePath === targetPath || (targetPath && targetPath.startsWith(sourcePath + '/'))) return null;
  const nextBasePath = targetPath ? `${targetPath}/${folderLabel(sourcePath)}` : folderLabel(sourcePath);
  if (nextBasePath === sourcePath) return null;
  const sourcePrefix = sourcePath + '/';
  const nextPrefix = nextBasePath + '/';
  if (folders.some((folder) => folder === nextBasePath || folder.startsWith(nextPrefix))) return null;

  const movePath = (path: string) => (
    path === sourcePath ? nextBasePath : path.startsWith(sourcePrefix) ? nextPrefix + path.slice(sourcePrefix.length) : path
  );

  return {
    movePath,
    pastas: folders.map(movePath),
    documentos: documents.map((doc) => (
      doc.pasta && (doc.pasta === sourcePath || doc.pasta.startsWith(sourcePrefix))
        ? { ...doc, pasta: movePath(doc.pasta) }
        : doc
    )),
  };
};

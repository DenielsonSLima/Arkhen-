import type {
  ClientBranch,
  Company,
  CompanyDocument,
} from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { normalizeFolderPath } from './folderPaths';

const BRANCHES_FOLDER_NAME = 'Filiais';
const BRANCHES_FOLDER_KEY = BRANCHES_FOLDER_NAME.toLocaleLowerCase('pt-BR');

export interface CompanyLibraryEntry {
  key: string;
  ownerCompany: Company;
  branch?: ClientBranch;
  displayName: string;
  cnpj: string;
  tipoEstabelecimento: Company['tipoEstabelecimento'];
  status: Company['status'];
  rootFolderPath: string | null;
  documents: CompanyDocument[];
  folders: string[];
  isArchived: boolean;
}

const isSafeFolderSegment = (segment: string) => segment !== '.' && segment !== '..';

const normalizePath = (path?: string | null) => {
  const normalized = normalizeFolderPath(path || '');
  if (!normalized) return '';
  return normalized.split('/').every(isSafeFolderSegment) ? normalized : '';
};

const pathKey = (path?: string | null) => normalizePath(path).toLocaleLowerCase('pt-BR');

/** Returns the physical `Filiais/<segment>` root represented by a path. */
export const getBranchRootPath = (path?: string | null): string | null => {
  const normalized = normalizePath(path);
  if (!normalized) return null;

  const parts = normalized.split('/');
  if (parts.length < 2 || parts[0].toLocaleLowerCase('pt-BR') !== BRANCHES_FOLDER_KEY) return null;
  if (!parts[1] || !isSafeFolderSegment(parts[1])) return null;

  return `${parts[0]}/${parts[1]}`;
};

/** True for a root itself and for every physical descendant of that root. */
export const isPathWithinRoot = (
  path?: string | null,
  rootFolderPath?: string | null,
): boolean => {
  const normalizedPath = pathKey(path);
  const normalizedRoot = pathKey(rootFolderPath);
  if (!normalizedPath || !normalizedRoot) return false;
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
};

export const isDocumentWithinRoot = (
  document: Pick<CompanyDocument, 'pasta'>,
  rootFolderPath?: string | null,
) => isPathWithinRoot(document.pasta, rootFolderPath);

/** Identifies the reserved corporate branch tree, including its `Filiais` root. */
export const isBranchLibraryPath = (path?: string | null): boolean => {
  const normalized = normalizeFolderPath(path || '');
  if (!normalized) return false;
  const [firstPart] = normalized.split('/');
  return firstPart.toLocaleLowerCase('pt-BR') === BRANCHES_FOLDER_KEY;
};

const normalizeDeclaredBranchRoot = (path?: string | null): string | null => {
  const normalized = normalizePath(path);
  if (!normalized || normalized.split('/').length !== 2) return null;
  return getBranchRootPath(normalized);
};

const collectPhysicalFolders = (company: Company): string[] => {
  const foldersByKey = new Map<string, string>();
  const addWithAncestors = (path?: string | null) => {
    const normalized = normalizePath(path);
    if (!normalized) return;

    const parts = normalized.split('/');
    parts.forEach((_, index) => {
      const currentPath = parts.slice(0, index + 1).join('/');
      const currentKey = pathKey(currentPath);
      if (!foldersByKey.has(currentKey)) foldersByKey.set(currentKey, currentPath);
    });
  };

  (company.pastasDocumentos || []).forEach(addWithAncestors);
  (company.documentos || []).forEach((document) => addWithAncestors(document.pasta));
  return Array.from(foldersByKey.values());
};

const makeUniqueKey = (baseKey: string, usedKeys: Set<string>) => {
  if (!usedKeys.has(baseKey)) {
    usedKeys.add(baseKey);
    return baseKey;
  }

  let suffix = 2;
  while (usedKeys.has(`${baseKey}:${suffix}`)) suffix += 1;
  const uniqueKey = `${baseKey}:${suffix}`;
  usedKeys.add(uniqueKey);
  return uniqueKey;
};

const buildMatrixEntry = (
  company: Company,
  physicalFolders: string[],
  usedKeys: Set<string>,
): CompanyLibraryEntry => ({
  key: makeUniqueKey(`company:${company.id}:matrix`, usedKeys),
  ownerCompany: company,
  displayName: company.nome,
  cnpj: company.cnpj,
  tipoEstabelecimento: company.tipoEstabelecimento,
  status: company.status,
  rootFolderPath: null,
  documents: (company.documentos || []).filter((document) => !isBranchLibraryPath(document.pasta)),
  folders: physicalFolders.filter((folder) => !isBranchLibraryPath(folder)),
  isArchived: false,
});

const buildBranchEntry = (
  company: Company,
  branch: ClientBranch,
  physicalFolders: string[],
  assignedRoots: Set<string>,
  usedKeys: Set<string>,
): CompanyLibraryEntry => {
  const declaredRoot = normalizeDeclaredBranchRoot(branch.documentFolderPath);
  const declaredRootKey = pathKey(declaredRoot);
  const physicalRoot = physicalFolders
    .map((folder) => getBranchRootPath(folder))
    .find((root) => pathKey(root) === declaredRootKey);
  const candidateRoot = physicalRoot || declaredRoot;
  const rootFolderPath = candidateRoot && !assignedRoots.has(declaredRootKey) ? candidateRoot : null;
  if (rootFolderPath) assignedRoots.add(declaredRootKey);

  const identity = branch.id?.trim() || declaredRoot || 'sem-identidade';
  return {
    key: makeUniqueKey(`company:${company.id}:branch:${identity}`, usedKeys),
    ownerCompany: company,
    branch,
    displayName: branch.nome || 'Filial sem nome',
    cnpj: branch.cnpj || '',
    tipoEstabelecimento: 'Filial',
    status: company.status === 'Inativa' || branch.ativo === false ? 'Inativa' : 'Ativa',
    rootFolderPath,
    documents: rootFolderPath
      ? (company.documentos || []).filter((document) => isDocumentWithinRoot(document, rootFolderPath))
      : [],
    folders: rootFolderPath
      ? physicalFolders.filter((folder) => isPathWithinRoot(folder, rootFolderPath))
      : [],
    isArchived: false,
  };
};

const buildArchivedBranchEntry = (
  company: Company,
  rootFolderPath: string,
  physicalFolders: string[],
  usedKeys: Set<string>,
): CompanyLibraryEntry => ({
  key: makeUniqueKey(`company:${company.id}:archived-branch:${rootFolderPath}`, usedKeys),
  ownerCompany: company,
  displayName: rootFolderPath.split('/')[1] || 'Filial arquivada',
  cnpj: '',
  tipoEstabelecimento: 'Filial',
  status: 'Inativa',
  rootFolderPath,
  documents: (company.documentos || []).filter((document) => isDocumentWithinRoot(document, rootFolderPath)),
  folders: physicalFolders.filter((folder) => isPathWithinRoot(folder, rootFolderPath)),
  isArchived: true,
});

export const buildCompanyLibraryEntries = (companies: Company[]): CompanyLibraryEntry[] => (
  companies.flatMap((company) => {
    const usedKeys = new Set<string>();
    const assignedRoots = new Set<string>();
    const physicalFolders = collectPhysicalFolders(company);
    const entries: CompanyLibraryEntry[] = [buildMatrixEntry(company, physicalFolders, usedKeys)];

    (company.polos || []).forEach((branch) => {
      entries.push(buildBranchEntry(company, branch, physicalFolders, assignedRoots, usedKeys));
    });

    const archivedRoots = new Map<string, string>();
    physicalFolders.forEach((folder) => {
      const root = getBranchRootPath(folder);
      const rootKey = pathKey(root);
      if (!root || assignedRoots.has(rootKey) || archivedRoots.has(rootKey)) return;
      archivedRoots.set(rootKey, root);
    });

    Array.from(archivedRoots.values())
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
      .forEach((root) => {
        entries.push(buildArchivedBranchEntry(company, root, physicalFolders, usedKeys));
      });

    return entries;
  })
);

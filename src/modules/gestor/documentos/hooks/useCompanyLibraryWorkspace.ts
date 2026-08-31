import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Company,
  CompanyDocument,
} from '../../gestao-empresarial/services/gestaoEmpresarialService';
import {
  buildCompanyLibraryEntries,
  isPathWithinRoot,
  type CompanyLibraryEntry,
} from '../utils/companyLibraryEntries';
import { getDirectChildren } from '../utils/folderPaths';

interface UseCompanyLibraryWorkspaceOptions {
  companies: Company[];
  statusFilter: Company['status'];
  initialSelectedCompanyId?: string | null;
  initialSelectedEntryKey?: string | null;
  selectedFolder: string | null;
  onFolderChange: (folder: string | null) => void;
  onCompanyChange?: (companyId: string | null, companyName?: string, entryKey?: string | null) => void;
}

const matrixEntryKey = (companyId: string) => `company:${companyId}:matrix`;
const EMPTY_FOLDER_PATHS: string[] = [];
const EMPTY_DOCUMENTS: CompanyDocument[] = [];

const isNavigableEntry = (entry: CompanyLibraryEntry) => (
  !entry.branch || Boolean(entry.rootFolderPath)
);

export const useCompanyLibraryWorkspace = ({
  companies,
  statusFilter,
  initialSelectedCompanyId,
  initialSelectedEntryKey,
  selectedFolder,
  onFolderChange,
  onCompanyChange,
}: UseCompanyLibraryWorkspaceOptions) => {
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(() => (
    initialSelectedEntryKey
      || (initialSelectedCompanyId ? matrixEntryKey(initialSelectedCompanyId) : null)
  ));
  const previousSelectedEntryKey = useRef(selectedEntryKey);

  const allEntries = useMemo(
    () => buildCompanyLibraryEntries(companies),
    [companies],
  );
  const entries = useMemo(() => allEntries
    .filter((entry) => entry.status === statusFilter && isNavigableEntry(entry))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'pt-BR')),
  [allEntries, statusFilter]);
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.key === selectedEntryKey) || null,
    [entries, selectedEntryKey],
  );
  const selectedCompany = selectedEntry?.ownerCompany || null;
  const workspaceRootPath = selectedEntry?.rootFolderPath || null;

  const currentFolder = useMemo(() => {
    if (!selectedEntry) return selectedFolder;
    if (workspaceRootPath) {
      return isPathWithinRoot(selectedFolder, workspaceRootPath)
        ? selectedFolder
        : workspaceRootPath;
    }
    if (!selectedFolder) return null;
    return selectedEntry.folders.includes(selectedFolder) ? selectedFolder : null;
  }, [selectedEntry, selectedFolder, workspaceRootPath]);

  useEffect(() => {
    if (!selectedEntryKey || selectedEntry) return;
    previousSelectedEntryKey.current = null;
    setSelectedEntryKey(null);
    onFolderChange(null);
  }, [onFolderChange, selectedEntry, selectedEntryKey]);

  useEffect(() => {
    if (selectedEntryKey && !selectedEntry) return;
    onCompanyChange?.(
      selectedEntry?.ownerCompany.id || null,
      selectedEntry?.displayName,
      selectedEntry?.key || null,
    );
  }, [onCompanyChange, selectedEntry, selectedEntryKey]);

  useEffect(() => {
    if (selectedEntryKey && !selectedEntry) return;
    const selectedEntryChanged = previousSelectedEntryKey.current !== selectedEntryKey;
    const targetFolder = selectedEntry ? currentFolder : null;
    if (selectedEntryChanged || selectedFolder !== targetFolder) {
      onFolderChange(targetFolder);
    }
    previousSelectedEntryKey.current = selectedEntryKey;
  }, [currentFolder, onFolderChange, selectedEntry, selectedEntryKey, selectedFolder]);

  const foldersList = selectedEntry?.folders || EMPTY_FOLDER_PATHS;
  const workspaceDocuments = selectedEntry?.documents || EMPTY_DOCUMENTS;
  const ownerFolders = selectedCompany?.pastasDocumentos || EMPTY_FOLDER_PATHS;
  const ownerDocuments = selectedCompany?.documentos || EMPTY_DOCUMENTS;
  const currentSubFolders = useMemo(
    () => getDirectChildren(foldersList, currentFolder),
    [currentFolder, foldersList],
  );
  const isAtWorkspaceRoot = currentFolder === workspaceRootPath;
  const parentFolder = useMemo(() => {
    if (!currentFolder || isAtWorkspaceRoot) return null;
    const parts = currentFolder.split('/');
    parts.pop();
    const parent = parts.length > 0 ? parts.join('/') : null;
    if (workspaceRootPath && !isPathWithinRoot(parent, workspaceRootPath)) {
      return workspaceRootPath;
    }
    return parent;
  }, [currentFolder, isAtWorkspaceRoot, workspaceRootPath]);
  const siblingFolders = useMemo(() => {
    if (!currentFolder || isAtWorkspaceRoot) return [];
    const currentName = currentFolder.split('/').at(-1);
    return getDirectChildren(foldersList, parentFolder).filter((folder) => folder !== currentName);
  }, [currentFolder, foldersList, isAtWorkspaceRoot, parentFolder]);
  const breadcrumbs = useMemo(() => {
    if (!selectedEntry) return [];
    const crumbs: Array<{ label: string; path: string | null }> = [{
      label: selectedEntry.displayName,
      path: workspaceRootPath,
    }];
    if (!currentFolder || isAtWorkspaceRoot) return crumbs;

    const relativePath = workspaceRootPath
      ? currentFolder.slice(workspaceRootPath.length + 1)
      : currentFolder;
    relativePath.split('/').filter(Boolean).forEach((part, index, parts) => {
      const relative = parts.slice(0, index + 1).join('/');
      crumbs.push({
        label: part,
        path: workspaceRootPath ? `${workspaceRootPath}/${relative}` : relative,
      });
    });
    return crumbs;
  }, [currentFolder, isAtWorkspaceRoot, selectedEntry, workspaceRootPath]);
  const protectedBranchRoots = useMemo(() => allEntries
    .filter((entry) => entry.ownerCompany.id === selectedCompany?.id && entry.rootFolderPath)
    .map((entry) => entry.rootFolderPath as string),
  [allEntries, selectedCompany?.id]);

  return {
    entries,
    selectedEntryKey,
    setSelectedEntryKey,
    selectedEntry,
    selectedCompany,
    workspaceRootPath,
    currentFolder,
    foldersList,
    workspaceDocuments,
    ownerFolders,
    ownerDocuments,
    currentSubFolders,
    isAtWorkspaceRoot,
    parentFolder,
    siblingFolders,
    breadcrumbs,
    protectedBranchRoots,
  };
};

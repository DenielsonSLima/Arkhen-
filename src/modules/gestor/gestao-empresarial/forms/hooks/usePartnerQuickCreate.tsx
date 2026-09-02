import { useCallback, useMemo, useState } from 'react';
import type { CatalogoItem } from '../../../parametrizacao/services/catalogosService';
import type { PartnerClassificationKind } from '../../hooks/usePartnerClassifications';
import type { QuickCreateTarget } from '../clienteFormModel';
import { NovaCategoriaClienteModal } from '../components/NovaCategoriaClienteModal';

type QuickCreateResult = {
  target: QuickCreateTarget;
  id?: string;
  name: string;
};

type UsePartnerQuickCreateOptions = {
  addCategory: (input: { nome: string; descricao: string }) => Promise<string>;
  createClassification: (input: {
    tipo: PartnerClassificationKind;
    nome: string;
    descricao: string;
  }) => Promise<CatalogoItem>;
  isAddingCategory: boolean;
  isCreatingClassification: boolean;
  onCreated: (result: QuickCreateResult) => void;
};

const TARGET_CONFIG: Record<QuickCreateTarget, {
  title: string;
  subtitle: string;
  placeholder: string;
  catalogType?: PartnerClassificationKind;
}> = {
  category: {
    title: 'Nova categoria de cliente',
    subtitle: 'Cadastre o segmento de atividade do cliente.',
    placeholder: 'Ex: Clínica',
  },
  partnerType: {
    title: 'Novo tipo de parceiro',
    subtitle: 'Cadastre uma nova relação comercial ou operacional.',
    placeholder: 'Ex: Consultor',
    catalogType: 'tipos_parceiros',
  },
  companyType: {
    title: 'Novo enquadramento',
    subtitle: 'Cadastre um porte ou enquadramento adicional.',
    placeholder: 'Ex: Demais',
    catalogType: 'tipos_empresa',
  },
  legalNature: {
    title: 'Nova natureza jurídica',
    subtitle: 'Cadastre uma natureza jurídica ainda não disponível.',
    placeholder: 'Ex: Consórcio de Sociedades',
    catalogType: 'naturezas_juridicas',
  },
};

export const usePartnerQuickCreate = ({
  addCategory,
  createClassification,
  isAddingCategory,
  isCreatingClassification,
  onCreated,
}: UsePartnerQuickCreateOptions) => {
  const [target, setTarget] = useState<QuickCreateTarget | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [error, setError] = useState('');

  const close = useCallback(() => {
    setTarget(null);
    setNome('');
    setDescricao('');
    setError('');
  }, []);

  const open = useCallback((nextTarget: QuickCreateTarget) => {
    setTarget(nextTarget);
    setNome('');
    setDescricao('');
    setError('');
  }, []);

  const submit = useCallback(async () => {
    const createdName = nome.trim();
    if (!target || !createdName) {
      setError('Informe o nome da nova opção.');
      return;
    }

    try {
      if (target === 'category') {
        const normalizedName = await addCategory({ nome: createdName, descricao });
        onCreated({ target, name: normalizedName });
      } else {
        const catalogType = TARGET_CONFIG[target].catalogType;
        if (!catalogType) throw new Error('Catálogo inválido.');
        const created = await createClassification({
          tipo: catalogType,
          nome: createdName,
          descricao,
        });
        onCreated({ target, id: created.id, name: created.nome });
      }
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar a opção.');
    }
  }, [addCategory, close, createClassification, descricao, nome, onCreated, target]);

  const modal = useMemo(() => {
    if (!target) return null;
    const config = TARGET_CONFIG[target];
    const isSaving = target === 'category' ? isAddingCategory : isCreatingClassification;
    return (
      <NovaCategoriaClienteModal
        nome={nome}
        descricao={descricao}
        error={error}
        isSaving={isSaving}
        title={config.title}
        subtitle={config.subtitle}
        namePlaceholder={config.placeholder}
        onNomeChange={setNome}
        onDescricaoChange={setDescricao}
        onCancel={close}
        onSubmit={() => { void submit(); }}
      />
    );
  }, [close, descricao, error, isAddingCategory, isCreatingClassification, nome, submit, target]);

  return { openQuickCreate: open, quickCreateModal: modal };
};

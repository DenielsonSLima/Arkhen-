import { supabase } from '../../../../lib/supabase';

export const deleteDocumentsSafely = async (documentIds: string[]): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('delete-documents', { body: { documentIds } });
  if (error || data?.ok !== true) {
    let message = data?.error;
    if (!message && error && 'context' in error && error.context instanceof Response) {
      try { message = (await error.context.clone().json()).error; } catch { /* generic below */ }
    }
    throw new Error(message || 'Não foi possível concluir a exclusão dos documentos.');
  }
};

export const resumePendingDocumentDeletions = () => deleteDocumentsSafely([]);

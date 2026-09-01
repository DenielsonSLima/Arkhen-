import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabase';

interface ChangeOwnPasswordResponse {
  ok?: boolean;
  error?: string;
  message?: string;
}

const readFunctionError = async (error: unknown): Promise<string | undefined> => {
  if (!(error instanceof FunctionsHttpError)) return undefined;

  try {
    const body = await error.context.clone().json() as ChangeOwnPasswordResponse;
    return body.error || body.message;
  } catch {
    return undefined;
  }
};

export const profilePasswordService = {
  async changeOwnCpfPassword(password: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke<ChangeOwnPasswordResponse>(
      'manage-employee-user',
      { body: { action: 'change_own_password', password } },
    );

    if (error || !data?.ok) {
      const functionMessage = await readFunctionError(error);
      throw new Error(
        data?.error
        || data?.message
        || functionMessage
        || error?.message
        || 'Não foi possível alterar a senha.',
      );
    }
  },
};

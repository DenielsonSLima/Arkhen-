import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  createIsolatedPasswordRecoveryClient,
  supabase,
  takeInitialPasswordRecoveryTokens,
  type PasswordSetupMode,
} from '../../../../lib/supabase';

export type { PasswordSetupMode } from '../../../../lib/supabase';

export const PASSWORD_RECOVERY_PATH = '/redefinir-senha';
export const PASSWORD_RECOVERY_SESSION_ERROR =
  'A sessão de recuperação mudou ou expirou. Solicite um novo link.';
export const isPasswordRecoveryPath = (pathname: string) => (
  pathname.replace(/\/+$/, '') === PASSWORD_RECOVERY_PATH
);

export interface PasswordRecoveryCallback {
  mode: PasswordSetupMode | null;
  isRecovery: boolean;
  hasRecoveryProof: boolean;
  errorMessage: string | null;
}

export interface PasswordRecoverySession {
  readonly userId: string;
  readonly mode: PasswordSetupMode;
  updatePassword: (password: string) => Promise<void>;
  cancel: () => Promise<void>;
}

const readAuthParams = (search: string, hash: string) => {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

  return {
    type: hashParams.get('type') || searchParams.get('type'),
    error: hashParams.get('error') || searchParams.get('error'),
    errorCode: hashParams.get('error_code') || searchParams.get('error_code'),
    errorDescription: hashParams.get('error_description') || searchParams.get('error_description'),
    code: searchParams.get('code'),
  };
};

export const inspectPasswordRecoveryCallback = (
  location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
): PasswordRecoveryCallback => {
  const params = readAuthParams(location.search, location.hash);
  const mode: PasswordSetupMode | null = params.type === 'invite' || params.type === 'recovery'
    ? params.type
    : null;
  // Os nomes legados são mantidos porque o App usa este gate para os dois tipos de link.
  const hasRecoveryProof = mode !== null;
  const isRecovery = isPasswordRecoveryPath(location.pathname) || hasRecoveryProof;

  if (!isRecovery) {
    return { mode: null, isRecovery: false, hasRecoveryProof: false, errorMessage: null };
  }

  if (params.errorCode === 'otp_expired') {
    return {
      mode,
      isRecovery: true,
      hasRecoveryProof,
      errorMessage: mode === 'invite'
        ? 'Este convite expirou ou já foi utilizado. Solicite um novo convite ao gestor.'
        : 'Este link de recuperação expirou ou já foi utilizado. Solicite um novo link.',
    };
  }

  if (params.error || params.errorCode || params.errorDescription) {
    return {
      mode,
      isRecovery: true,
      hasRecoveryProof,
      errorMessage: mode === 'invite'
        ? 'Não foi possível validar este convite. Solicite um novo convite ao gestor.'
        : 'Não foi possível validar este link de recuperação. Solicite um novo link.',
    };
  }

  if (params.code) {
    return {
      mode,
      isRecovery: true,
      hasRecoveryProof,
      errorMessage: mode === 'invite'
        ? 'Este convite não pôde ser validado. Solicite um novo convite ao gestor.'
        : 'Este link de recuperação não pôde ser validado. Solicite um novo link.',
    };
  }

  return { mode, isRecovery: true, hasRecoveryProof, errorMessage: null };
};

export const getPasswordRecoveryRedirectUrl = (origin = window.location.origin) => (
  new URL(PASSWORD_RECOVERY_PATH, origin).toString()
);

type RecoveryState = 'active' | 'updating' | 'terminal';
type RecoveryClient = ReturnType<typeof createIsolatedPasswordRecoveryClient>;

interface CompleteFirstAccessResponse {
  ok?: boolean;
  error?: string;
  message?: string;
}

const readFunctionError = async (error: unknown): Promise<string | undefined> => {
  if (!(error instanceof FunctionsHttpError)) return undefined;

  try {
    const body = await error.context.clone().json() as CompleteFirstAccessResponse;
    return body.error || body.message;
  } catch {
    return undefined;
  }
};

const disposeRecoveryClient = async (client: RecoveryClient) => {
  try {
    await client.auth.dispose();
  } catch {
    // O cliente não será reutilizado; a referência é descartada mesmo se o SDK falhar ao finalizar.
  }
};

const initializePasswordRecoverySession = async (): Promise<PasswordRecoverySession> => {
  const tokens = takeInitialPasswordRecoveryTokens();
  if (!tokens) throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);

  let recoveryClient: RecoveryClient | null = createIsolatedPasswordRecoveryClient();
  let sessionResult;
  try {
    sessionResult = await recoveryClient.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch {
    await disposeRecoveryClient(recoveryClient);
    recoveryClient = null;
    throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
  }

  const { data, error } = sessionResult;
  if (error || !data.user?.id) {
    await disposeRecoveryClient(recoveryClient);
    recoveryClient = null;
    throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
  }

  const userId = data.user.id;
  const mode = tokens.mode;
  let state: RecoveryState = 'active';
  const closeTemporarySession = async () => {
    const client = recoveryClient;
    recoveryClient = null;
    if (!client) return;
    try {
      const revocation = client.auth.signOut({ scope: 'local' });
      void revocation.catch(() => undefined);
    } catch {
      // A revogação remota é complementar; o descarte local não pode depender da rede.
    }
    await disposeRecoveryClient(client);
  };

  return {
    userId,
    mode,
    async updatePassword(password: string) {
      if (state !== 'active' || !recoveryClient) {
        throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
      }

      state = 'updating';
      try {
        if (mode === 'invite') {
          const { data: completion, error: completionError } = await recoveryClient.functions.invoke<
            CompleteFirstAccessResponse
          >('manage-employee-user', {
            body: { action: 'complete_first_access', password },
          });
          if (completionError || !completion?.ok) {
            const functionMessage = await readFunctionError(completionError);
            throw new Error(
              completion?.error
              || completion?.message
              || functionMessage
              || completionError?.message
              || 'Não foi possível concluir o primeiro acesso.',
            );
          }
        } else {
          const updateResult = await recoveryClient.auth.updateUser({ password });
          if (updateResult.error) {
            throw new Error(updateResult.error.message || 'Erro ao atualizar a senha.');
          }
          if (!updateResult.data.user || updateResult.data.user.id !== userId) {
            throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
          }
        }
      } catch (updateError) {
        if (mode === 'invite' && recoveryClient) {
          // O banco pode ter confirmado a troca antes de uma falha transitória no Auth.
          // Manter a sessão isolada permite repetir a etapa final sem reutilizar o link.
          state = 'active';
          if (updateError instanceof Error) throw updateError;
          throw new Error('Não foi possível concluir o primeiro acesso. Tente novamente.');
        }

        state = 'terminal';
        await closeTemporarySession();
        if (updateError instanceof Error) throw updateError;
        throw new Error('Não foi possível confirmar a alteração da senha. Solicite um novo link.');
      }

      state = 'terminal';
      await closeTemporarySession();
    },
    async cancel() {
      if (state === 'terminal') return;
      if (state === 'updating') throw new Error('A alteração da senha ainda está em andamento.');
      state = 'terminal';
      await closeTemporarySession();
    },
  };
};

let initialRecoverySessionPromise: Promise<PasswordRecoverySession> | null = null;

export const passwordRecoveryService = {
  async sendRecoveryEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRecoveryRedirectUrl(),
    });

    if (error) {
      throw new Error(error.message || 'Erro ao enviar recuperação de senha.');
    }
  },

  getInitialSession(): Promise<PasswordRecoverySession> {
    if (!initialRecoverySessionPromise) {
      initialRecoverySessionPromise = initializePasswordRecoverySession();
    }
    return initialRecoverySessionPromise;
  },
};

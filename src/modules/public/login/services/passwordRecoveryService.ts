import {
  createIsolatedPasswordRecoveryClient,
  supabase,
  takeInitialPasswordRecoveryTokens,
} from '../../../../lib/supabase';

export const PASSWORD_RECOVERY_PATH = '/redefinir-senha';
export const PASSWORD_RECOVERY_SESSION_ERROR =
  'A sessão de recuperação mudou ou expirou. Solicite um novo link.';

export interface PasswordRecoveryCallback {
  isRecovery: boolean;
  hasRecoveryProof: boolean;
  errorMessage: string | null;
}

export interface PasswordRecoverySession {
  readonly userId: string;
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
  const hasRecoveryProof = params.type === 'recovery';
  const isRecovery = location.pathname === PASSWORD_RECOVERY_PATH || hasRecoveryProof;

  if (!isRecovery) {
    return { isRecovery: false, hasRecoveryProof: false, errorMessage: null };
  }

  if (params.errorCode === 'otp_expired') {
    return {
      isRecovery: true,
      hasRecoveryProof,
      errorMessage: 'Este link de recuperação expirou ou já foi utilizado. Solicite um novo link.',
    };
  }

  if (params.error || params.errorCode || params.errorDescription) {
    return {
      isRecovery: true,
      hasRecoveryProof,
      errorMessage: 'Não foi possível validar este link de recuperação. Solicite um novo link.',
    };
  }

  if (params.code) {
    return {
      isRecovery: true,
      hasRecoveryProof,
      errorMessage: 'Este link de recuperação não pôde ser validado. Solicite um novo link.',
    };
  }

  return { isRecovery: true, hasRecoveryProof, errorMessage: null };
};

export const getPasswordRecoveryRedirectUrl = (origin = window.location.origin) => (
  new URL(PASSWORD_RECOVERY_PATH, origin).toString()
);

type RecoveryState = 'active' | 'updating' | 'terminal';
type RecoveryClient = ReturnType<typeof createIsolatedPasswordRecoveryClient>;

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
    async updatePassword(password: string) {
      if (state !== 'active' || !recoveryClient) {
        throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
      }

      state = 'updating';
      let updateResult;
      try {
        updateResult = await recoveryClient.auth.updateUser({ password });
      } catch {
        state = 'terminal';
        await closeTemporarySession();
        throw new Error('Não foi possível confirmar a alteração da senha. Solicite um novo link.');
      }

      if (updateResult.error) {
        state = 'active';
        throw new Error(updateResult.error.message || 'Erro ao atualizar a senha.');
      }
      if (!updateResult.data.user || updateResult.data.user.id !== userId) {
        state = 'terminal';
        await closeTemporarySession();
        throw new Error(PASSWORD_RECOVERY_SESSION_ERROR);
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

import { getInitialAuthLocation } from '../../../lib/supabase';
import { PasswordResetPage } from './PasswordResetPage';
import { PasswordResetSuccessPage } from './PasswordResetSuccessPage';
import {
  inspectPasswordRecoveryCallback,
  type PasswordSetupMode,
} from './services/passwordRecoveryService';

interface PasswordRecoveryGateProps {
  mode?: PasswordSetupMode;
  status: 'validating' | 'ready' | 'error' | 'complete';
  callbackError: string | null;
  onSubmitPassword: (password: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onContinue: () => Promise<void>;
}

export const PasswordRecoveryGate = ({
  mode,
  status,
  callbackError,
  onSubmitPassword,
  onCancel,
  onContinue,
}: PasswordRecoveryGateProps) => {
  const initialLocation = getInitialAuthLocation();
  const resolvedMode = mode
    || (initialLocation ? inspectPasswordRecoveryCallback(initialLocation).mode : null)
    || 'recovery';

  return (
    <div className="animate-page-fade">
      {status === 'complete' ? (
        <PasswordResetSuccessPage mode={resolvedMode} onContinue={onContinue} />
      ) : (
        <PasswordResetPage
          mode={resolvedMode}
          isValidating={status === 'validating'}
          isSessionReady={status === 'ready'}
          callbackError={callbackError}
          onSubmitPassword={onSubmitPassword}
          onCancel={onCancel}
        />
      )}
    </div>
  );
};

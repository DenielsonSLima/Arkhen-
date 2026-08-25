import { PasswordResetPage } from './PasswordResetPage';
import { PasswordResetSuccessPage } from './PasswordResetSuccessPage';

interface PasswordRecoveryGateProps {
  status: 'validating' | 'ready' | 'error' | 'complete';
  callbackError: string | null;
  onSubmitPassword: (password: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onContinue: () => Promise<void>;
}

export const PasswordRecoveryGate = ({
  status,
  callbackError,
  onSubmitPassword,
  onCancel,
  onContinue,
}: PasswordRecoveryGateProps) => (
  <div className="animate-page-fade">
    {status === 'complete' ? (
      <PasswordResetSuccessPage onContinue={onContinue} />
    ) : (
      <PasswordResetPage
        isValidating={status === 'validating'}
        isSessionReady={status === 'ready'}
        callbackError={callbackError}
        onSubmitPassword={onSubmitPassword}
        onCancel={onCancel}
      />
    )}
  </div>
);

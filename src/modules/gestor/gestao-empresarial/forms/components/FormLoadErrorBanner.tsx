import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormLoadErrorBannerProps {
  visible: boolean;
  message: string;
  onRetry: () => void;
  withSpacing?: boolean;
}

export const FormLoadErrorBanner: React.FC<FormLoadErrorBannerProps> = ({
  visible,
  message,
  onRetry,
  withSpacing = false,
}) => {
  if (!visible) return null;

  return (
    <div
      className="form-alert-banner error"
      role="alert"
      style={withSpacing ? { marginBottom: 16 } : undefined}
    >
      <AlertCircle size={18} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Tentar novamente</button>
    </div>
  );
};

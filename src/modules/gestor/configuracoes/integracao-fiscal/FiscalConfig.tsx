import React from 'react';
import { FiscalConfigContent } from './components/FiscalConfigContent';
import { useFiscalConfigController } from './hooks/useFiscalConfigController';
import './FiscalConfig.css';

export const FiscalConfig: React.FC = () => {
  const controller = useFiscalConfigController();
  return <FiscalConfigContent controller={controller} />;
};

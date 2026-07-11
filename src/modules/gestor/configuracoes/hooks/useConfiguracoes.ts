import { useState } from 'react';

export const useConfiguracoes = () => {
  const [status] = useState('Em Desenvolvimento');
  return { status };
};

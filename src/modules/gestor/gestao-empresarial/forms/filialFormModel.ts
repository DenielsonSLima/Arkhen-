import { z } from 'zod';
import { isValidCnpj } from '../services/cnpjDocument';

const optionalText = (maxLength: number) => z.string().trim().max(maxLength);

export const filialFormSchema = z.object({
  nome: z.string().trim().min(2, 'O nome da filial deve ter pelo menos 2 caracteres.').max(180),
  cnpj: z.string().trim().refine(
    isValidCnpj,
    'CNPJ da filial deve conter 14 caracteres e dígitos verificadores válidos.',
  ),
  email: optionalText(254).refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    'Informe um e-mail válido para a filial.',
  ),
  telefone: optionalText(24),
  contato: optionalText(180),
  endereco: optionalText(240),
  bairro: optionalText(120),
  cep: optionalText(12).refine(
    (value) => !value || value.replace(/\D/g, '').length === 8,
    'CEP da filial deve conter 8 dígitos.',
  ),
  cidade: optionalText(120),
  uf: optionalText(2).transform((value) => value.toUpperCase()).refine(
    (value) => !value || /^[A-Z]{2}$/.test(value),
    'Informe a UF com duas letras.',
  ),
});

export type FilialFormValues = z.infer<typeof filialFormSchema>;

export const parseFilialForm = (input: FilialFormValues) => {
  const parsed = filialFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Revise os dados da filial.');
  }
  return parsed.data;
};

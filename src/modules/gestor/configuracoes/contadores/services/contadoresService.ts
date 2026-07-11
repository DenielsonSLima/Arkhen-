import { supabase } from '../../../../../lib/supabase';

export interface Contador {
  id: string;
  nome: string;
  crc: string;
  cpfCnpj: string;
  email: string;
  isResponsavel: boolean;
}

interface ContadorRow {
  id: string;
  nome: string;
  crc: string;
  cpf_cnpj: string;
  email: string;
  is_responsavel: boolean;
}

const fromRow = (row: ContadorRow): Contador => ({
  id: row.id,
  nome: row.nome,
  crc: row.crc,
  cpfCnpj: row.cpf_cnpj,
  email: row.email,
  isResponsavel: row.is_responsavel,
});

export const contadoresService = {
  async getContadores(): Promise<Contador[]> {
    const { data, error } = await supabase
      .from('configuracoes_contadores')
      .select('id,nome,crc,cpf_cnpj,email,is_responsavel')
      .order('is_responsavel', { ascending: false })
      .order('nome', { ascending: true });

    if (error) throw new Error(`Erro ao carregar contadores: ${error.message}`);
    return ((data || []) as ContadorRow[]).map(fromRow);
  },

  async addContador(contador: Omit<Contador, 'id' | 'isResponsavel'>): Promise<Contador> {
    const { data: empresaId, error: empresaError } = await supabase.rpc('current_empresa_id');
    if (empresaError || !empresaId) throw new Error('Empresa atual não encontrada para cadastrar contador.');

    const { data, error } = await supabase
      .from('configuracoes_contadores')
      .insert({
        empresa_id: String(empresaId),
        nome: contador.nome.trim(),
        crc: contador.crc.trim(),
        cpf_cnpj: contador.cpfCnpj.trim(),
        email: contador.email.trim().toLowerCase(),
        is_responsavel: false,
      })
      .select('id,nome,crc,cpf_cnpj,email,is_responsavel')
      .single();

    if (error) throw new Error(`Erro ao cadastrar contador: ${error.message}`);
    return fromRow(data as ContadorRow);
  },

  async setResponsavel(id: string): Promise<Contador> {
    const { data, error } = await supabase.rpc('set_contador_responsavel', {
      p_contador_id: id,
    });

    if (error) throw new Error(`Erro ao definir responsável técnico: ${error.message}`);
    return fromRow(data as ContadorRow);
  },
};

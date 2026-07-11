export interface Contador {
  id: string;
  nome: string;
  crc: string;
  cpfCnpj: string;
  email: string;
  isResponsavel: boolean;
}

export const contadoresService = {
  async getContadores(): Promise<Contador[]> {
    return [
      {
        id: '1',
        nome: 'João Silva',
        crc: 'SP-123456/O',
        cpfCnpj: '123.456.789-00',
        email: 'joao@auracontabil.com.br',
        isResponsavel: true,
      },
      {
        id: '2',
        nome: 'Luciana Mendes',
        crc: 'SP-987654/O',
        cpfCnpj: '987.654.321-11',
        email: 'luciana@auracontabil.com.br',
        isResponsavel: false,
      },
    ];
  },

  async addContador(contador: Omit<Contador, 'id' | 'isResponsavel'>): Promise<Contador> {
    console.log('Adicionando contador no frontend:', contador);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      id: Math.random().toString(36).substr(2, 9),
      ...contador,
      isResponsavel: false,
    };
  },

  async setResponsavel(id: string): Promise<boolean> {
    console.log('Definindo contador responsável no frontend, id:', id);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  },
};

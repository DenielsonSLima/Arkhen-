export interface CompanyLookupDraft {
  cnpj: string;
  razaoSocial: string;
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export const cnpjLookupService = {
  async lookup(cnpjRaw: string): Promise<CompanyLookupDraft> {
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (cnpj.length !== 14) throw new Error('CNPJ inválido. Digite 14 números.');

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!response.ok) throw new Error('Não foi possível localizar o CNPJ informado.');

    const data = await response.json();
    return {
      cnpj: cnpjRaw,
      razaoSocial: data.razao_social || '',
      nome: data.nome_fantasia || data.razao_social || '',
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : '',
      email: data.email || '',
      endereco: `${data.logradouro || ''}${data.numero ? `, ${data.numero}` : ''}${data.complemento ? ` - ${data.complemento}` : ''}`.trim(),
      bairro: data.bairro || '',
      cidade: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
    };
  },
};

export interface RegimeTributario {
  id: string; // 'mei' | 'simples' | 'presumido' | 'real' | 'pf' | 'isenta'
  title: string;
  limit: string;
  desc: string;
  positives: string[]; // Vantagens / O que tem
  negatives: string[]; // Restrições / O que não tem
  color: string; // Classe de cor do badge / estilo
}

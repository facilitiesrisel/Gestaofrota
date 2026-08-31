
export enum StatusMulta {
  AGUARDANDO_BOLETO = "AGUARDANDO BOLETO",
  AGUARDANDO_RETORNO = "AGUARDANDO RETORNO",
  FINALIZADA = "FINALIZADA",
  INDICACAO_ENVIADA = "INDICAÇÃO ENVIADA",
  RECURSO = "RECURSO"
}

export enum TipoMulta {
  NOTIFICACAO = "NOTIFICAÇÃO",
  BOLETO = "BOLETO",
  NIC = "NIC"
}

export interface Veiculo {
  id: string; // Frota number (FROTA)
  status?: string; // STATUS
  placa: string; // PLACA
  marca?: string; // MARCA
  modelo?: string; // MODELO
  ano?: string; // ANO
  filial: string; // FILIAL
  regiao?: string; // REGIÃO
  tipo?: string; // TIPO
  capacidade?: string; // CAPACIDADE
  proprietario?: string; // PROPRIETÁRIO
  validadeLicenciamento?: string; // LICENCIAMENTO
  
  // Novos campos Financeiros 2026
  custoLicenciamento2026?: number;
  custoIpva2026?: number;
  custoMultas2026?: number;
  custoTotal2026?: number;
}

export interface Motorista {
  status?: string; // ATIVO ou INATIVO
  login: string; // ID/Code
  nome: string;
  base?: string; // Coluna C
}

export interface CodigoMulta {
  codigo: string; // Enquadramento
  baseLegal: string; // Artigo CTB
  descricao: string;
  pontos: number;
  valor: number;
  desconto: number; // Value of discount
}

export interface Multa {
  id: string;
  status: StatusMulta;
  frota: string;
  placa: string;
  base: string;
  ait: string;
  tipo: TipoMulta;
  dataHoraInfracao: string;
  dataRecebimento: string;
  prazoIndicacao: string;
  recebidaComPrazo: 'SIM' | 'NÃO';
  enquadramento: string;
  artigoCtb: string;
  descricaoInfracao: string;
  pontosCnh: number;
  responsavelCodigo: string;
  responsavelNome: string;
  orgaoAutuador: string;
  endereco: string;
  municipio: string;
  uf: string;
  rodoviaOuUrbano: 'RODOVIA' | 'URBANO';
  retornouComPrazo: 'SIM' | 'NÃO';
  valor: number;
  desconto: number;
  valorComDesconto: number;
  empresaOuCondutor: 'EMPRESA' | 'CONDUTOR';
  descontarMotorista: 'SIM' | 'NÃO';
  pagoComDesconto: 'SIM' | 'NÃO';
  descontoEnviadoRH: string; // Date
  numDocumento: string;
  vencimento: string; // Date
  obs: string;
  latitude?: number;
  longitude?: number;
  linkAit?: string; // Link para o arquivo AIT no Drive
  linkAuth?: string; // Link para o PDF de Autorização gerado
}

// Navigation Types
export type Page = 'DASHBOARD' | 'MULTAS' | 'ALERTAS' | 'FROTAS' | 'MOTORISTAS' | 'CONFIG';

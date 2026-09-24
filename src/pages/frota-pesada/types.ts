
export enum StatusMulta {
  AGUARDANDO_BOLETO = "AGUARDANDO BOLETO",
  AGUARDANDO_RETORNO = "AGUARDANDO RETORNO",
  FINALIZADA = "FINALIZADA",
  INDICACAO_ENVIADA = "INDICAÇÃO ENVIADA",
  RECURSO = "RECURSO",
  IMPORTACAO_VAMOS = "IMPORTAÇÃO VAMOS"
}

export enum TipoMulta {
  NOTIFICACAO = "NOTIFICAÇÃO",
  BOLETO = "BOLETO",
  NIC = "NIC"
}

export interface Veiculo {
  id: string; // ID (será a Placa)
  status?: string; // STATUS
  placa: string; // PLACA
  modelo?: string; // MODELO
  filial: string; // FILIAL
  
  // Campos específicos da nova planilha de frotas (Frota Completa)
  vencContrato?: string; // Venc. Contrato
  condutor?: string; // Condutor
  funcao?: string; // Função
  contatoMotorista?: string; // Contato Motorista
  gestorResp?: string; // Gestor Resp.
  email?: string; // E-mail
  locadora?: string; // Locadora
  base?: string; // Base
  diasVenc?: number; // Dias p/ Venc.

  // Legados/financeiros mantidos para compatibilidade
  marca?: string; // MARCA (opcional)
  ano?: string; // ANO (opcional)
  regiao?: string; // REGIÃO (opcional)
  tipo?: string; // TIPO (opcional)
  capacidade?: string; // CAPACIDADE (opcional)
  proprietario?: string; // PROPRIETÁRIO (opcional)
  validadeLicenciamento?: string; // LICENCIAMENTO (opcional)
  
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
  frota?: string;
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
  responsavelCodigo?: string;
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
  linkAit?: string; // Link para o arquivo AIT no Drive
  linkAuth?: string; // Link para o PDF de Autorização gerado
}

export type GravidadeSinistro = 'Leve' | 'Média' | 'Grave' | 'Gravíssima';

export type StatusSinistro = 
  | 'Em Apuração' 
  | 'Aberto na Seguradora' 
  | 'Aguardando Orçamento' 
  | 'Em Reparo' 
  | 'Regulado' 
  | 'Indenizado' 
  | 'Finalizado / Concluído';

export type CulpabilidadeSinistro = 
  | 'Condutor Risel' 
  | 'Terceiro' 
  | 'Sem Culpa / Condições Adversas' 
  | 'Em Apuração';

export interface SinistroAnexo {
  id: string;
  nome: string;
  url?: string;
  driveFileId?: string;
  tamanho?: number;
  tipo?: string;
  dataUpload?: string;
}

export interface Sinistro {
  id: string;
  numeroProtocolo: string; // Ex: SIN-2026-001 ou ID do Forms
  dataHora: string; // Data e horário do evento (ISO ou DD/MM/AAAA HH:mm)
  dataComunicado?: string; // Data de registro no sistema
  placa: string; // Placa do cavalo / veículo principal
  placaCarreta?: string; // Carreta / Semirreboque envolvido (se houver)
  base: string; // Filial / Base operacional (Paulínia, Aguaí, Santos, Betim, etc.)
  motorista: string; // Nome do motorista / condutor
  cnhMotorista?: string;
  cpfMotorista?: string;
  tipoEvento: string; // Colisão Traseira, Tombamento, Abalroamento Lateral, etc.
  gravidade: GravidadeSinistro;
  status: StatusSinistro;
  culpabilidade: CulpabilidadeSinistro;
  local: string; // Rodovia / Rua / KM
  municipio: string;
  uf: string;
  rodoviaOuUrbano: 'Rodovia' | 'Urbano';
  boletimOcorrencia?: string; // Nº do B.O.
  orgaoPolicial?: string; // PRF, PM, Polícia Civil
  houveVitimas: 'Não' | 'Feridos Leves' | 'Feridos Graves' | 'Óbito';
  houveTerceiros: 'Sim' | 'Não';
  dadosTerceiro?: string; // Placa, condutor, telefone, veículo do terceiro
  seguradoraAcionada: 'Sim' | 'Não';
  nomeSeguradora?: string;
  numeroSinistroSeguradora?: string;
  valorEstimadoPrejuizo: number;
  valorFranquia: number;
  valorPagoSeguradora: number;
  custoEfetivoRisel: number;
  descricao: string; // Dinâmica detalhada do evento
  danosVeiculo?: string; // Danos ao veículo resumido
  condutorAssumiu?: 'SIM' | 'NÃO' | string; // Se condutor Risel assume a responsabilidade
  cidade?: string;
  endereco?: string;
  avariasVeiculo?: string; // Avarias cavalo / tanque
  driveFolderId?: string;
  driveFolderUrl?: string;
  anexos?: SinistroAnexo[];
  origem?: 'Microsoft Forms' | 'SharePoint Excel' | 'Lançamento Manual' | string;
  enviadoPor?: string;
  emailEnviadoPor?: string;
  gestorImediato?: string;
  nomeTerceiro?: string;
  contatoTerceiro?: string;
  placaTerceiro?: string;
  boletimOcorrenciaUrl?: string;
  anexosSharePoint?: string[];
  sharepointLinks?: {
    avisoSinistro?: string;
    boletim?: string;
    cnhMotorista?: string;
    docVeiculoFrota?: string;
    docVeiculoTerceiro?: string;
    cnhTerceiro?: string;
    declaracao?: string;
    fotos?: string[];
  };
}

// Navigation Types
export type Page = 'DASHBOARD' | 'MULTAS' | 'ALERTAS' | 'FROTAS' | 'MOTORISTAS' | 'SINISTROS_DASHBOARD' | 'SINISTROS' | 'CONFIG';


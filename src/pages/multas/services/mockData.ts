import { Veiculo, Motorista, CodigoMulta, Multa, StatusMulta, TipoMulta } from '../types';

export const mockVeiculos: Veiculo[] = [];

export const mockMotoristas: Motorista[] = [];

// Base abrangente de Códigos de Infração do CTB (DETRAN/DENATRAN/PRF/Municipais)
export const mockCodigosMulta: CodigoMulta[] = [
  // Excesso de Velocidade
  { codigo: '745-50', baseLegal: 'Art. 218, I', descricao: 'Transitar em velocidade superior à máxima permitida em até 20%', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '74550', baseLegal: 'Art. 218, I', descricao: 'Transitar em velocidade superior à máxima permitida em até 20%', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '745-5', baseLegal: 'Art. 218, I', descricao: 'Transitar em velocidade superior à máxima permitida em até 20%', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '746-30', baseLegal: 'Art. 218, II', descricao: 'Transitar em velocidade superior à máxima permitida em mais de 20% até 50%', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '74630', baseLegal: 'Art. 218, II', descricao: 'Transitar em velocidade superior à máxima permitida em mais de 20% até 50%', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '747-10', baseLegal: 'Art. 218, III', descricao: 'Transitar em velocidade superior à máxima permitida em mais de 50%', pontos: 7, valor: 880.41, desconto: 176.08 },
  { codigo: '74710', baseLegal: 'Art. 218, III', descricao: 'Transitar em velocidade superior à máxima permitida em mais de 50%', pontos: 7, valor: 880.41, desconto: 176.08 },
  
  // Multa NIC (Não Indicação de Condutor)
  { codigo: '500-20', baseLegal: 'Art. 257, § 8º', descricao: 'Multa NIC - Não Indicação do Condutor Infrator (Pessoa Jurídica)', pontos: 0, valor: 260.32, desconto: 0.00 },
  { codigo: '50020', baseLegal: 'Art. 257, § 8º', descricao: 'Multa NIC - Não Indicação do Condutor Infrator (Pessoa Jurídica)', pontos: 0, valor: 260.32, desconto: 0.00 },

  // Sinal Vermelho & Parada Obrigatória
  { codigo: '605-03', baseLegal: 'Art. 208', descricao: 'Avançar o sinal vermelho do semáforo - fiscalização eletrônica', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '60503', baseLegal: 'Art. 208', descricao: 'Avançar o sinal vermelho do semáforo - fiscalização eletrônica', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '605-01', baseLegal: 'Art. 208', descricao: 'Avançar o sinal vermelho do semáforo ou o de parada obrigatória', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '60501', baseLegal: 'Art. 208', descricao: 'Avançar o sinal vermelho do semáforo ou o de parada obrigatória', pontos: 7, valor: 293.47, desconto: 58.70 },

  // Uso de Telefone Celular
  { codigo: '763-31', baseLegal: 'Art. 252, P.Ú.', descricao: 'Dirigir veículo segurando telefone celular', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '76331', baseLegal: 'Art. 252, P.Ú.', descricao: 'Dirigir veículo segurando telefone celular', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '763-32', baseLegal: 'Art. 252, P.Ú.', descricao: 'Dirigir veículo manuseando telefone celular', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '76332', baseLegal: 'Art. 252, P.Ú.', descricao: 'Dirigir veículo manuseando telefone celular', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '736-62', baseLegal: 'Art. 252, VI', descricao: 'Dirigir veículo utilizando-se de fones nos ouvidos ou telefone celular', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '73662', baseLegal: 'Art. 252, VI', descricao: 'Dirigir veículo utilizando-se de fones nos ouvidos ou telefone celular', pontos: 4, valor: 130.16, desconto: 26.03 },

  // Cinto de Segurança
  { codigo: '518-51', baseLegal: 'Art. 167', descricao: 'Deixar o condutor de usar o cinto de segurança', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '51851', baseLegal: 'Art. 167', descricao: 'Deixar o condutor de usar o cinto de segurança', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '518-52', baseLegal: 'Art. 167', descricao: 'Deixar o passageiro de usar o cinto de segurança', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '51852', baseLegal: 'Art. 167', descricao: 'Deixar o passageiro de usar o cinto de segurança', pontos: 5, valor: 195.23, desconto: 39.05 },

  // Rodízio e Restrição de Circulação
  { codigo: '574-61', baseLegal: 'Art. 187, I', descricao: 'Transitar em local/horário não permitido pela regulamentação - Rodízio', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '57461', baseLegal: 'Art. 187, I', descricao: 'Transitar em local/horário não permitido pela regulamentação - Rodízio', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '574-63', baseLegal: 'Art. 187, I', descricao: 'Transitar em local/horário não permitido pela regulamentação estabelecida pela autoridade', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '57463', baseLegal: 'Art. 187, I', descricao: 'Transitar em local/horário não permitido pela regulamentação estabelecida pela autoridade', pontos: 4, valor: 130.16, desconto: 26.03 },

  // Faixa Exclusiva de Ônibus / Trânsito
  { codigo: '567-31', baseLegal: 'Art. 184, I', descricao: 'Transitar na faixa ou pista regulamentada da direita de circulação exclusiva de transporte público', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '56731', baseLegal: 'Art. 184, I', descricao: 'Transitar na faixa ou pista regulamentada da direita de circulação exclusiva de transporte público', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '567-32', baseLegal: 'Art. 184, II', descricao: 'Transitar na faixa ou via de trânsito exclusivo da esquerda regulamentada para transporte público', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '56732', baseLegal: 'Art. 184, II', descricao: 'Transitar na faixa ou via de trânsito exclusivo da esquerda regulamentada para transporte público', pontos: 7, valor: 293.47, desconto: 58.70 },

  // Estacionamento Proibido / Irregular
  { codigo: '545-21', baseLegal: 'Art. 181, XVIII', descricao: 'Estacionar em local/horário proibido especificamente pela sinalização (placa Proibido Estacionar)', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '54521', baseLegal: 'Art. 181, XVIII', descricao: 'Estacionar em local/horário proibido especificamente pela sinalização (placa Proibido Estacionar)', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '545-22', baseLegal: 'Art. 181, XIX', descricao: 'Estacionar em local/horário de parada e estacionamento proibidos (placa Proibido Parar e Estacionar)', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '54522', baseLegal: 'Art. 181, XIX', descricao: 'Estacionar em local/horário de parada e estacionamento proibidos (placa Proibido Parar e Estacionar)', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '554-12', baseLegal: 'Art. 181, XVII', descricao: 'Estacionar em desacordo com a regulamentação - vaga rápida, carga/descarga ou rotativo', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '55412', baseLegal: 'Art. 181, XVII', descricao: 'Estacionar em desacordo com a regulamentação - vaga rápida, carga/descarga ou rotativo', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '556-80', baseLegal: 'Art. 181, VII', descricao: 'Estacionar o veículo nos acostamentos ou na área de cruzamento de vias', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '55680', baseLegal: 'Art. 181, VII', descricao: 'Estacionar o veículo nos acostamentos ou na área de cruzamento de vias', pontos: 4, valor: 130.16, desconto: 26.03 },

  // Ultrapassagem Indevida e Conversão Proibida
  { codigo: '596-70', baseLegal: 'Art. 203, V', descricao: 'Ultrapassar pela contramão outro veículo onde houver linha de divisão de fluxos opostos contínua amarela', pontos: 7, valor: 1467.35, desconto: 293.47 },
  { codigo: '59670', baseLegal: 'Art. 203, V', descricao: 'Ultrapassar pela contramão outro veículo onde houver linha de divisão de fluxos opostos contínua amarela', pontos: 7, valor: 1467.35, desconto: 293.47 },
  { codigo: '604-11', baseLegal: 'Art. 206, I', descricao: 'Executar operação de retorno em locais proibidos pela sinalização', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '60411', baseLegal: 'Art. 206, I', descricao: 'Executar operação de retorno em locais proibidos pela sinalização', pontos: 7, valor: 293.47, desconto: 58.70 },

  // Faróis e Iluminação
  { codigo: '676-90', baseLegal: 'Art. 230, XXII', descricao: 'Conduzir veículo com defeito no sistema de iluminação, de sinalização ou com lâmpadas queimadas', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '67690', baseLegal: 'Art. 230, XXII', descricao: 'Conduzir veículo com defeito no sistema de iluminação, de sinalização ou com lâmpadas queimadas', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '723-40', baseLegal: 'Art. 250, I, b', descricao: 'Deixar de manter acesa a luz baixa de dia, nos túneis providos de iluminação pública ou rodovias', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '72340', baseLegal: 'Art. 250, I, b', descricao: 'Deixar de manter acesa a luz baixa de dia, nos túneis providos de iluminação pública ou rodovias', pontos: 4, valor: 130.16, desconto: 26.03 },

  // Licenciamento e Documentos
  { codigo: '659-92', baseLegal: 'Art. 230, V', descricao: 'Conduzir o veículo registrado que não esteja devidamente licenciado', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '65992', baseLegal: 'Art. 230, V', descricao: 'Conduzir o veículo registrado que não esteja devidamente licenciado', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '663-71', baseLegal: 'Art. 232', descricao: 'Conduzir veículo sem os documentos de porte obrigatório referidos no CTB', pontos: 3, valor: 88.38, desconto: 17.68 },
  { codigo: '66371', baseLegal: 'Art. 232', descricao: 'Conduzir veículo sem os documentos de porte obrigatório referidos no CTB', pontos: 3, valor: 88.38, desconto: 17.68 },
  { codigo: '663-72', baseLegal: 'Art. 162, V', descricao: 'Conduzir veículo com a Carteira Nacional de Habilitação vencida há mais de trinta dias', pontos: 7, valor: 293.47, desconto: 58.70 },
  { codigo: '66372', baseLegal: 'Art. 162, V', descricao: 'Conduzir veículo com a Carteira Nacional de Habilitação vencida há mais de trinta dias', pontos: 7, valor: 293.47, desconto: 58.70 },

  // Desobediência e Outras
  { codigo: '583-50', baseLegal: 'Art. 195', descricao: 'Desobedecer às ordens emanadas da autoridade competente de trânsito ou de seus agentes', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '58350', baseLegal: 'Art. 195', descricao: 'Desobedecer às ordens emanadas da autoridade competente de trânsito ou de seus agentes', pontos: 5, valor: 195.23, desconto: 39.05 },
  { codigo: '581-91', baseLegal: 'Art. 219', descricao: 'Transitar com o veículo em velocidade inferior à metade da máxima estabelecida para a via', pontos: 4, valor: 130.16, desconto: 26.03 },
  { codigo: '58191', baseLegal: 'Art. 219', descricao: 'Transitar com o veículo em velocidade inferior à metade da máxima estabelecida para a via', pontos: 4, valor: 130.16, desconto: 26.03 }
];

export const mockMultas: Multa[] = [];
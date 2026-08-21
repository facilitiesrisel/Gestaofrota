
import { Veiculo, Motorista, CodigoMulta, Multa, StatusMulta, TipoMulta } from '../types';

export const mockVeiculos: Veiculo[] = [];

export const mockMotoristas: Motorista[] = [];

export const mockCodigosMulta: CodigoMulta[] = [
  { codigo: '74550', baseLegal: 'Art. 218, I', descricao: 'Transitar em velocidade superior à máxima permitida em até 20%', pontos: 4, valor: 130.16, desconto: 104.13 },
  { codigo: '74630', baseLegal: 'Art. 218, II', descricao: 'Transitar em velocidade superior à máxima permitida em mais de 20% até 50%', pontos: 5, valor: 195.23, desconto: 156.18 },
  { codigo: '50020', baseLegal: 'Art. 257, § 8º', descricao: 'Multa NIC - Não Indicação de Condutor', pontos: 0, valor: 260.32, desconto: 260.32 },
  { codigo: '60501', baseLegal: 'Art. 208', descricao: 'Avançar o sinal vermelho do semáforo', pontos: 7, valor: 293.47, desconto: 234.77 },
];

export const mockMultas: Multa[] = [];
export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  year: number;
  initialKm?: number;
  lastKm?: number;
  lastServiceDate?: Date;
  lastServiceKm?: number;
  lastWashDate?: Date;
  isActive?: boolean; // false if the vehicle is inactive
  type?: 'Operações' | 'Gestão';
  isManual?: boolean; // true if manually registered or enabled, false if imported from tracker only
}

export enum ReservationStatus {
  Pending = 'Pendente',
  Approved = 'Aprovada',
  Rejected = 'Rejeitada',
  InUse = 'Em Uso',
  Completed = 'Concluída',
  Cancelled = 'Cancelada',
}

export enum FuelLevel {
  Empty = 'Vazio',
  Quarter = '1/4',
  Half = '1/2',
  ThreeQuarters = '3/4',
  Full = 'Cheio',
}

export interface Reservation {
  id: string;
  requesterName: string;
  department: string;
  role: string;
  email: string;
  departureDateTime: Date;
  returnDate: Date;
  destination: string;
  destinationCity: string;
  distanceKm?: number;
  vehicleId: string;
  status: ReservationStatus;
  driverName?: string;
  actualReturnDateTime?: Date;
  finalKm?: number;
  purpose?: string;
  rejectReason?: string;
  adminNotes?: string;
  requestTimestamp?: Date;
}

export interface DailyTrip {
  id: string;
  requesterName: string;
  department: string;
  driverName: string;
  vehicleId: string;
  departureDateTime: Date;
  destination: string;
  destinationCity: string;
  distanceKm?: number;
  status: ReservationStatus.InUse | ReservationStatus.Completed;
  actualReturnDateTime?: Date;
  finalKm?: number;
  purpose?: string;
  initialKm?: number;
  initialFuelLevel?: FuelLevel;
  finalFuelLevel?: FuelLevel;
}

export interface GeoFrotasPosition {
  id: number;
  plate: string;
  model: string;
  address: string;
  geoLocation: string; // Format: "lat,lng"
  lastUpdate?: string; // Data/Hora Recebimento
  gpsTime?: string; // Data/Hora Evento
  speed?: number;
  voltage?: number;
  signal?: number;
  serialNumber?: string;
  type?: string; // ignitionStatus or similar often mapped to Type/Event
  ignitionStatus?: boolean;
  odometer?: number;
  driverName?: string;
}

export interface RacRental {
  id: string;
  rentalCompany: 'Localiza' | 'Movida' | 'Outras' | string;
  plate: string;
  requesterName: string; // Solicitante
  requesterSector?: string; // Setor do Solicitante
  requesterRole?: string; // Cargo do Solicitante
  requesterEmail?: string; // E-mail do Solicitante
  requesterPhone?: string; // Telefone do Solicitante
  value?: number; // Valor da locação
  reservationNumber: string; // Nº Reserva
  driverName: string; // Condutor
  driverRole?: string; // Cargo do Condutor
  status: 'Solicitada' | 'Aguardando retirada' | 'Em Uso' | 'Finalizada' | string;
  base?: string; // Base operacional (ex: Matriz, Filial RJ, etc)
  createdByUser: string; // Usuário de Criação da Reserva
  reservationDate: Date; // Data Reserva
  pickupDate: Date; // Data Retirada
  pickupStore: string; // Loja Retirada
  returnDate: Date; // Data Devolução
  returnStore: string; // Loja Devolução
  pickupCity?: string; // Cidade onde deseja retirar o veículo (Obrigatório)
  returnCity?: string; // Cidade onde pretende devolver o veículo (Obrigatório)
  category?: string; // Categoria do Veículo pretendido
  purpose?: string; // Finalidade / Justificativa
  observations?: string; // Observações adicionais do solicitante
  adminNotes?: string; // Observações do administrador / parecer da gestão
  rejectReason?: string; // Motivo da recusa (quando reprovada)
  hasCnhCopy?: boolean; // Se possui cópia da CNH vinculada
  cnhFileName?: string; // Nome do arquivo da CNH
  cnhBase64?: string; // Cópia da CNH em formato base64/dataURL para anexo
  cnhUploadDate?: Date; // Data em que a CNH foi enviada
  protocolNumber?: string; // Número de protocolo da solicitação (ex: RAC-2026-0829-01)
  protocol?: string; // Alias de protocolo para compatibilidade
  cnhAlreadyOnRecord?: boolean; // Se a CNH já consta no arquivo
  hasVoucher?: boolean; // Se possui voucher anexado
  voucherFileName?: string; // Nome do arquivo do voucher
  voucherBase64?: string; // Voucher da reserva em base64/dataURL
  voucherUploadDate?: Date; // Data em que o voucher foi anexado
}

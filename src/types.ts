export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  prefix: string;
  lastOdometer: number;
  vehicle_type: 'veiculo' | 'maquina';
  initial_odometer: number;
  current_odometer: number;
  initial_hourmeter: number;
  current_hourmeter: number;
}

export interface RefuelingRecord {
  id: string;
  date: string;
  odometer: number;
  quantity: number;
  fuelType: 'Gasolina' | 'Álcool' | 'Diesel';
  vehicleId: string;
  location?: string;
  totalValue?: number;
}

export type MaintenanceType = 'Mecanica' | 'Eletrica' | 'Acessórios' | 'Borracharia' | 'Ar de serviço';

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: MaintenanceType;
  provider: string;
  mileage: number;
  description: string;
  vehicleId: string;
  totalValue?: number;
  requestId?: string;
  status: 'pendente' | 'executada' | 'cancelada';
}

export interface MaintenanceRequest {
  id: string;
  userId: string;
  vehicleId: string;
  date: string;
  odometer: number;
  type: MaintenanceType;
  description: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'concluida' | 'cancelada';
  budgetValue?: number;
  documentUrl?: string;
  serviceRequestNumber?: string;
  materialRequestNumber?: string;
}

export interface Provider {
  id: string;
  name: string;
  type: MaintenanceType;
}

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  password?: string;
  role: 'Root' | 'Admin' | 'Motorista' | 'Gestor Frota';
  avatar?: string;
  phone?: string;
}

export interface Journey {
  id: string;
  userId: string;
  vehicleId: string;
  startTime: string;
  endTime?: string;
  endDate?: string;
  endTimeManual?: string;
  startOdometer: number;
  endOdometer?: number;
  distanceTraveled?: number;
  status: 'aberta' | 'encerrada';
  observations?: string;
  start_location?: string;
  destination?: string;
  end_location?: string;
  interval_ini?: string;
  interval_fim?: string;
  tipo_transp?: string;
  validation_status?: 'pendente' | 'validada';
  validated_by?: string;
}

export interface BancoDeHoras {
  id: string;
  userId: string;
  journeyId: string;
  horasAdquiridas: string; // Format "HH:MM"
  createdAt: string;
}

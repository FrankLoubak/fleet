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
  status: 'pendente' | 'executada';
}

export interface MaintenanceRequest {
  id: string;
  userId: string;
  vehicleId: string;
  date: string;
  odometer: number;
  type: MaintenanceType;
  description: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'concluida';
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
  password?: string;
  role: 'Admin' | 'Motorista';
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
}

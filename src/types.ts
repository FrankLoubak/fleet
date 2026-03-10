export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  prefix: string;
  lastOdometer: number;
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
  startOdometer: number;
  endOdometer?: number;
  distanceTraveled?: number;
  status: 'aberta' | 'encerrada';
  observations?: string;
}

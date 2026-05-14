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
  configId?: string | null;
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
  role: 'Root' | 'Admin' | 'Operador';
  avatar?: string;
  phone?: string;
  invited_by?: string;
}

/**
 * Subconjunto mínimo do usuário autenticado armazenado no localStorage.
 * Usado pelo fluxo de autenticação e proteção de rotas.
 * Relação com User: AuthUser contém apenas os campos essenciais de sessão;
 * User é o perfil completo lido da tabela profiles do Supabase.
 */
export interface AuthUser {
  id: string;
  cpf: string;
  name: string;
  role: 'Root' | 'Admin' | 'Operador';
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
  validation_status?: 'pendente' | 'validada';
  validated_by?: string;
  horasExcedentes?: number;
  intervalIni?: string;
  intervalFim?: string;
}

export interface BancoDeHoras {
  id: string;
  userId: string;
  journeyId: string;
  horasAdquiridas: number; // decimal hours e.g. 2.58
  createdAt: string;
}

export interface VehicleConfig {
  id: string;
  nome: string;
  eixo1: number;
  eixo2?: number | null;
  eixo3?: number | null;
  eixo4?: number | null;
  pneusReserva: number;
  createdAt: string;
}

export interface Pneu {
  id: string;
  numeroFogo: string;
  marca: string;
  medida: string;
  dataCompra: string;
  data1Reforma?: string | null;
  data2Reforma?: string | null;
  kmTotal: number;
  status: 'estoque' | 'montado' | 'conserto' | 'sucata';
  vehicleId?: string | null;
  posicao?: string | null;
  createdAt: string;
  // Sulco (profundidade de desgaste)
  profundidadeSulco1vida?: number | null;
  profundidadeSulco2vida?: number | null;
  profundidadeSulco3vida?: number | null;
  kmNoUltimoSulco: number;
}

export interface MovimentacaoPneu {
  id: string;
  pneuId: string;
  tipo: 'entrada_estoque' | 'montagem' | 'desmontagem' | 'saida_conserto' | 'retorno_conserto' | 'sucata' | 'medicao_sulco';
  vehicleId?: string | null;
  posicaoAnterior?: string | null;
  posicaoNova?: string | null;
  data: string;
  kmTotalPneu?: number | null;
  houveRecape: boolean;
  observacao?: string | null;
  userId: string;
  createdAt: string;
  motivoSucateamento?: string | null;
  profundidadeSulco?: number | null;
}

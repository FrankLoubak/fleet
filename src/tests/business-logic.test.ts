/**
 * Testes de lógica de negócio do FleetManager
 *
 * Testa funções puras e lógica de domínio que espelha o que está nos componentes.
 * Foco em aumentar cobertura de branches e statements.
 */

import { describe, it, expect } from 'vitest';
import type { Journey, Vehicle, MaintenanceRequest, RefuelingRecord, BancoDeHoras } from '../types';
import {
  minutesToHHMM,
  hhmmToMinutes,
  sumHours,
  calcDistance,
  cleanCpf,
  isCpfLengthValid,
  cpfToEmail,
  formatDateBR,
  roleLabel,
  MOCK_VEHICLES,
  MOCK_USERS,
  MOCK_PROVIDERS,
} from '../utils';

// ---------------------------------------------------------------------------
// Lógica de cálculo de banco de horas (réplica de TimeBank.tsx)
// ---------------------------------------------------------------------------
function calcTimeBankTotal(records: Array<{ horas_adquiridas: string }>): string {
  let totalMins = 0;
  records.forEach(r => {
    const [h, m] = r.horas_adquiridas.split(':').map(Number);
    totalMins += (h * 60) + m;
  });
  const totalH = Math.floor(totalMins / 60);
  const totalM = totalMins % 60;
  return `${totalH.toString().padStart(2, '0')}:${totalM.toString().padStart(2, '0')}`;
}

describe('Cálculo de banco de horas', () => {
  it('retorna 00:00 para array vazio', () => {
    expect(calcTimeBankTotal([])).toBe('00:00');
  });

  it('soma um único registro', () => {
    expect(calcTimeBankTotal([{ horas_adquiridas: '02:30' }])).toBe('02:30');
  });

  it('soma múltiplos registros', () => {
    const records = [
      { horas_adquiridas: '01:30' },
      { horas_adquiridas: '02:45' },
      { horas_adquiridas: '00:15' },
    ];
    expect(calcTimeBankTotal(records)).toBe('04:30');
  });

  it('trata minutos que ultrapassam 60', () => {
    const records = [
      { horas_adquiridas: '00:45' },
      { horas_adquiridas: '00:30' },
    ];
    expect(calcTimeBankTotal(records)).toBe('01:15');
  });

  it('total de horas com padding correto', () => {
    expect(calcTimeBankTotal([{ horas_adquiridas: '09:05' }])).toBe('09:05');
  });
});

// ---------------------------------------------------------------------------
// Lógica de filtro de jornadas por busca (réplica de Journeys.tsx)
// ---------------------------------------------------------------------------
function filterJourneys(
  journeys: Journey[],
  vehicles: Vehicle[],
  users: Array<{ id: string; name: string }>,
  query: string
): Journey[] {
  if (!query) return journeys;
  const q = query.toLowerCase();
  return journeys.filter(j => {
    const vehicle = vehicles.find(v => v.id === j.vehicleId);
    const user = users.find(u => u.id === j.userId);
    return (
      vehicle?.plate.toLowerCase().includes(q) ||
      vehicle?.model.toLowerCase().includes(q) ||
      user?.name.toLowerCase().includes(q) ||
      j.observations?.toLowerCase().includes(q)
    );
  });
}

const vehicleFixtures: Vehicle[] = [
  {
    id: 'v1', plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-01',
    lastOdometer: 100000, vehicle_type: 'veiculo',
    initial_odometer: 90000, current_odometer: 100000,
    initial_hourmeter: 0, current_hourmeter: 0
  },
  {
    id: 'v2', plate: 'XYZ-9876', model: 'VW Gol', prefix: 'FT-02',
    lastOdometer: 50000, vehicle_type: 'veiculo',
    initial_odometer: 45000, current_odometer: 50000,
    initial_hourmeter: 0, current_hourmeter: 0
  },
];

const userFixtures = [
  { id: 'u1', name: 'Carlos Oliveira' },
  { id: 'u2', name: 'Maria Santos' },
];

const journeyFixtures: Journey[] = [
  {
    id: 'j1', userId: 'u1', vehicleId: 'v1',
    startTime: '2026-05-01T08:00:00', endTime: '2026-05-01T18:00:00',
    startOdometer: 100000, endOdometer: 100250, distanceTraveled: 250,
    status: 'encerrada', observations: 'Entrega concluída'
  },
  {
    id: 'j2', userId: 'u2', vehicleId: 'v2',
    startTime: '2026-05-01T09:00:00', endTime: '2026-05-01T17:00:00',
    startOdometer: 50000, endOdometer: 50180, distanceTraveled: 180,
    status: 'encerrada', observations: 'Rotina normal'
  },
];

describe('Filtro de jornadas por query', () => {
  it('retorna todas as jornadas quando query está vazia', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, '');
    expect(result.length).toBe(2);
  });

  it('filtra por placa do veículo', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, 'ABC');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('j1');
  });

  it('filtra por modelo do veículo', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, 'toyota');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('j1');
  });

  it('filtra por nome do motorista', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, 'Maria');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('j2');
  });

  it('filtra por observação', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, 'entrega');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('j1');
  });

  it('retorna vazio quando não há correspondência', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, 'xyz-inexistente');
    expect(result.length).toBe(0);
  });

  it('busca case-insensitive', () => {
    const result = filterJourneys(journeyFixtures, vehicleFixtures, userFixtures, 'VW GOL');
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Lógica de status de manutenção (réplica de MaintenanceList.tsx)
// ---------------------------------------------------------------------------
function getStatusLabel(status: MaintenanceRequest['status']): string {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    aprovada: 'Aprovada',
    rejeitada: 'Rejeitada',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };
  return labels[status] || status;
}

function canApproveRequest(request: MaintenanceRequest): boolean {
  return request.status === 'pendente';
}

function canRejectRequest(request: MaintenanceRequest): boolean {
  return request.status === 'pendente';
}

function canCancelRequest(request: MaintenanceRequest): boolean {
  return request.status === 'pendente' || request.status === 'aprovada';
}

describe('Lógica de status de manutenção', () => {
  it('retorna label correto para cada status', () => {
    expect(getStatusLabel('pendente')).toBe('Pendente');
    expect(getStatusLabel('aprovada')).toBe('Aprovada');
    expect(getStatusLabel('rejeitada')).toBe('Rejeitada');
    expect(getStatusLabel('concluida')).toBe('Concluída');
    expect(getStatusLabel('cancelada')).toBe('Cancelada');
  });

  it('pode aprovar solicitação pendente', () => {
    const req: MaintenanceRequest = {
      id: 'r1', userId: 'u1', vehicleId: 'v1', date: '2026-05-01',
      odometer: 50000, type: 'Mecanica', description: 'Troca de óleo',
      status: 'pendente'
    };
    expect(canApproveRequest(req)).toBe(true);
  });

  it('não pode aprovar solicitação já aprovada', () => {
    const req: MaintenanceRequest = {
      id: 'r1', userId: 'u1', vehicleId: 'v1', date: '2026-05-01',
      odometer: 50000, type: 'Mecanica', description: 'Troca de óleo',
      status: 'aprovada'
    };
    expect(canApproveRequest(req)).toBe(false);
  });

  it('pode rejeitar solicitação pendente', () => {
    const req: MaintenanceRequest = {
      id: 'r1', userId: 'u1', vehicleId: 'v1', date: '2026-05-01',
      odometer: 50000, type: 'Mecanica', description: 'Troca de óleo',
      status: 'pendente'
    };
    expect(canRejectRequest(req)).toBe(true);
  });

  it('pode cancelar solicitação pendente', () => {
    const req: MaintenanceRequest = {
      id: 'r1', userId: 'u1', vehicleId: 'v1', date: '2026-05-01',
      odometer: 50000, type: 'Mecanica', description: 'Troca de óleo',
      status: 'pendente'
    };
    expect(canCancelRequest(req)).toBe(true);
  });

  it('pode cancelar solicitação aprovada', () => {
    const req: MaintenanceRequest = {
      id: 'r1', userId: 'u1', vehicleId: 'v1', date: '2026-05-01',
      odometer: 50000, type: 'Mecanica', description: 'Troca de óleo',
      status: 'aprovada'
    };
    expect(canCancelRequest(req)).toBe(true);
  });

  it('não pode cancelar solicitação concluída', () => {
    const req: MaintenanceRequest = {
      id: 'r1', userId: 'u1', vehicleId: 'v1', date: '2026-05-01',
      odometer: 50000, type: 'Mecanica', description: 'Troca de óleo',
      status: 'concluida'
    };
    expect(canCancelRequest(req)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lógica de filtro de abastecimento por tipo de combustível
// ---------------------------------------------------------------------------
function filterRefuelingsByFuelType(
  refuelings: RefuelingRecord[],
  fuelType: string | 'all'
): RefuelingRecord[] {
  if (fuelType === 'all') return refuelings;
  return refuelings.filter(r => r.fuelType === fuelType);
}

function calcAverageConsumption(
  refuelings: RefuelingRecord[]
): number {
  if (refuelings.length < 2) return 0;
  const sorted = [...refuelings].sort((a, b) => a.odometer - b.odometer);
  let totalDistance = 0;
  let totalLiters = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalDistance += sorted[i].odometer - sorted[i - 1].odometer;
    totalLiters += sorted[i].quantity;
  }
  if (totalLiters === 0) return 0;
  return totalDistance / totalLiters;
}

const refuelingFixtures: RefuelingRecord[] = [
  { id: 'r1', date: '2026-04-01', odometer: 1000, quantity: 40, fuelType: 'Diesel', vehicleId: 'v1' },
  { id: 'r2', date: '2026-04-15', odometer: 1400, quantity: 45, fuelType: 'Diesel', vehicleId: 'v1' },
  { id: 'r3', date: '2026-04-20', odometer: 2000, quantity: 30, fuelType: 'Gasolina', vehicleId: 'v2' },
];

describe('Lógica de abastecimento', () => {
  it('filtra por tipo de combustível Diesel', () => {
    const result = filterRefuelingsByFuelType(refuelingFixtures, 'Diesel');
    expect(result.length).toBe(2);
    result.forEach(r => expect(r.fuelType).toBe('Diesel'));
  });

  it('filtra por tipo de combustível Gasolina', () => {
    const result = filterRefuelingsByFuelType(refuelingFixtures, 'Gasolina');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('r3');
  });

  it('retorna todos quando fuelType é "all"', () => {
    const result = filterRefuelingsByFuelType(refuelingFixtures, 'all');
    expect(result.length).toBe(3);
  });

  it('calcula consumo médio correto para 2 abastecimentos', () => {
    const diesel = refuelingFixtures.filter(r => r.fuelType === 'Diesel');
    const consumption = calcAverageConsumption(diesel);
    // (1400 - 1000) / 45 = 400 / 45 ≈ 8.88
    expect(consumption).toBeCloseTo(400 / 45, 1);
  });

  it('retorna 0 quando há menos de 2 registros', () => {
    expect(calcAverageConsumption([refuelingFixtures[0]])).toBe(0);
    expect(calcAverageConsumption([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Lógica de construção do roleLabel (réplica de Login.tsx)
// ---------------------------------------------------------------------------
function inviteRoleLabel(inviteRole: string | null): string {
  if (inviteRole === 'Admin') return 'Administrador';
  if (inviteRole === 'Operador') return 'Operador';
  return inviteRole ?? '';
}

describe('inviteRoleLabel (réplica de Login.tsx)', () => {
  it('retorna Administrador para Admin', () => {
    expect(inviteRoleLabel('Admin')).toBe('Administrador');
  });

  it('retorna Operador para Operador', () => {
    expect(inviteRoleLabel('Operador')).toBe('Operador');
  });

  it('retorna string vazia para null', () => {
    expect(inviteRoleLabel(null)).toBe('');
  });

  it('retorna o valor para roles desconhecidos', () => {
    expect(inviteRoleLabel('Root')).toBe('Root');
  });
});

// ---------------------------------------------------------------------------
// Lógica de validação de CPF inline (réplica de Login.tsx handleSignUp)
// ---------------------------------------------------------------------------
function validateCpfForLogin(cpf: string): { valid: boolean; error?: string } {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) {
    return { valid: false, error: 'CPF deve ter 11 dígitos.' };
  }
  return { valid: true };
}

describe('Validação de CPF para login (réplica de Login.tsx)', () => {
  it('valida CPF com 11 dígitos', () => {
    expect(validateCpfForLogin('12345678901').valid).toBe(true);
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    const result = validateCpfForLogin('1234567890');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('CPF deve ter 11 dígitos.');
  });

  it('limpa e valida CPF formatado', () => {
    expect(validateCpfForLogin('123.456.789-01').valid).toBe(true);
  });

  it('rejeita string vazia', () => {
    expect(validateCpfForLogin('').valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lógica de cálculo do Dashboard (réplica do loadData)
// ---------------------------------------------------------------------------
function calcFuelTotal(
  refuelings: Array<{ quantity: number; fuelType: string; totalValue?: number }>
): number {
  return refuelings.reduce((acc, r) => {
    const value = r.totalValue || (r.quantity * (r.fuelType === 'Diesel' ? 6.20 : 5.80));
    return acc + value;
  }, 0);
}

function calcMaintenanceTotal(
  maintenances: Array<{ totalValue?: number }>
): number {
  return maintenances.reduce((acc, m) => acc + (m.totalValue || 1200), 0);
}

describe('Cálculo de totais do Dashboard', () => {
  it('calcula total de combustível com totalValue', () => {
    const refuelings = [
      { quantity: 40, fuelType: 'Diesel', totalValue: 248 },
      { quantity: 30, fuelType: 'Gasolina', totalValue: 174 },
    ];
    expect(calcFuelTotal(refuelings)).toBe(422);
  });

  it('calcula total de combustível sem totalValue (usa preço padrão)', () => {
    const refuelings = [
      { quantity: 10, fuelType: 'Diesel' },  // 10 * 6.20 = 62
      { quantity: 10, fuelType: 'Gasolina' }, // 10 * 5.80 = 58
    ];
    expect(calcFuelTotal(refuelings)).toBe(120);
  });

  it('retorna 0 para array vazio', () => {
    expect(calcFuelTotal([])).toBe(0);
    expect(calcMaintenanceTotal([])).toBe(0);
  });

  it('calcula total de manutenção com totalValue', () => {
    const maintenances = [
      { totalValue: 500 },
      { totalValue: 350 },
    ];
    expect(calcMaintenanceTotal(maintenances)).toBe(850);
  });

  it('usa valor padrão 1200 quando totalValue não definido', () => {
    const maintenances = [
      { totalValue: undefined },
      { totalValue: undefined },
    ];
    expect(calcMaintenanceTotal(maintenances)).toBe(2400);
  });
});

// ---------------------------------------------------------------------------
// Lógica de normalização de veículos (réplica de DailyReport.tsx / Journeys.tsx)
// ---------------------------------------------------------------------------
function normalizeVehicleFromDB(dbRow: Record<string, unknown>): Record<string, unknown> {
  return {
    ...dbRow,
    lastOdometer: dbRow.last_odometer
  };
}

function normalizeJourneyFromDB(dbRow: Record<string, unknown>): Journey {
  return {
    id: dbRow.id as string,
    userId: dbRow.user_id as string,
    vehicleId: dbRow.vehicle_id as string,
    startTime: dbRow.start_time as string,
    endTime: dbRow.end_time as string | undefined,
    startOdometer: dbRow.start_odometer as number,
    endOdometer: dbRow.end_odometer as number | undefined,
    distanceTraveled: dbRow.distance_traveled as number | undefined,
    status: dbRow.status as 'aberta' | 'encerrada',
    observations: dbRow.observations as string | undefined,
    validation_status: dbRow.validation_status as 'pendente' | 'validada' | undefined,
    validated_by: dbRow.validated_by as string | undefined,
  };
}

describe('Normalização de dados do banco', () => {
  it('normaliza veículo do formato DB para camelCase', () => {
    const dbVehicle = { id: 'v1', plate: 'ABC-1234', last_odometer: 125000 };
    const normalized = normalizeVehicleFromDB(dbVehicle);
    expect(normalized.lastOdometer).toBe(125000);
  });

  it('normaliza jornada do formato DB para camelCase', () => {
    const dbJourney = {
      id: 'j1', user_id: 'u1', vehicle_id: 'v1',
      start_time: '2026-05-01T08:00:00', end_time: '2026-05-01T18:00:00',
      start_odometer: 100000, end_odometer: 100250,
      distance_traveled: 250, status: 'encerrada', observations: 'ok',
      validation_status: 'pendente', validated_by: null
    };
    const normalized = normalizeJourneyFromDB(dbJourney);
    expect(normalized.userId).toBe('u1');
    expect(normalized.vehicleId).toBe('v1');
    expect(normalized.startTime).toBe('2026-05-01T08:00:00');
    expect(normalized.startOdometer).toBe(100000);
  });
});

// ---------------------------------------------------------------------------
// Lógica de filtro de veículos por busca
// ---------------------------------------------------------------------------
function filterVehiclesByQuery(
  vehicles: Array<{ plate: string; model: string; prefix: string }>,
  query: string
): Array<{ plate: string; model: string; prefix: string }> {
  if (!query) return vehicles;
  const q = query.toLowerCase();
  return vehicles.filter(v =>
    v.plate.toLowerCase().includes(q) ||
    v.model.toLowerCase().includes(q) ||
    v.prefix.toLowerCase().includes(q)
  );
}

describe('Filtro de veículos por query', () => {
  const vehicles = [
    { plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-089' },
    { plate: 'XYZ-9876', model: 'VW Gol', prefix: 'FT-042' },
    { plate: 'DEF-4567', model: 'Ford Cargo', prefix: 'FT-115' },
  ];

  it('retorna todos quando query está vazia', () => {
    expect(filterVehiclesByQuery(vehicles, '').length).toBe(3);
  });

  it('filtra por placa', () => {
    const result = filterVehiclesByQuery(vehicles, 'ABC');
    expect(result.length).toBe(1);
    expect(result[0].model).toBe('Toyota Hilux');
  });

  it('filtra por modelo', () => {
    const result = filterVehiclesByQuery(vehicles, 'ford');
    expect(result.length).toBe(1);
    expect(result[0].plate).toBe('DEF-4567');
  });

  it('filtra por prefixo', () => {
    const result = filterVehiclesByQuery(vehicles, 'FT-042');
    expect(result.length).toBe(1);
  });

  it('retorna vazio quando não há correspondência', () => {
    expect(filterVehiclesByQuery(vehicles, 'ZZZ-9999').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Testes adicionais das funções de utils já importadas
// ---------------------------------------------------------------------------
describe('Integração com utils exportadas', () => {
  it('MOCK_VEHICLES tem exatamente 8 veículos', () => {
    expect(MOCK_VEHICLES.length).toBe(8);
  });

  it('MOCK_PROVIDERS tem pelo menos 20 fornecedores', () => {
    expect(MOCK_PROVIDERS.length).toBeGreaterThanOrEqual(20);
  });

  it('MOCK_USERS tem exatamente 5 usuários', () => {
    expect(MOCK_USERS.length).toBe(5);
  });

  it('calcDistance e hhmmToMinutes são consistentes com minutesToHHMM', () => {
    const dist = calcDistance(1000, 1500);
    expect(dist).toBe(500);

    const mins = hhmmToMinutes('08:30');
    expect(minutesToHHMM(mins)).toBe('08:30');
  });

  it('cleanCpf + isCpfLengthValid + cpfToEmail formam um pipeline de validação', () => {
    const raw = '123.456.789-01';
    const clean = cleanCpf(raw);
    expect(isCpfLengthValid(clean)).toBe(true);
    const email = cpfToEmail(clean);
    expect(email).toBe('12345678901@fleetmanager.com');
  });

  it('formatDateBR + roleLabel são funções independentes e estáveis', () => {
    expect(formatDateBR('2026-01-01')).toBe('01/01/2026');
    expect(roleLabel('Root')).toBe('Root');
    expect(roleLabel('Admin')).toBe('Administrador');
    expect(roleLabel('Operador')).toBe('Operador');
  });

  it('sumHours funciona com horas grandes', () => {
    const result = sumHours(['10:00', '15:30', '08:45']);
    expect(result).toBe('34:15');
  });
});

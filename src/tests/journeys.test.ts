/**
 * Testes de validação de odômetro/horímetro para jornadas — FleetManager
 *
 * Testa a lógica pura de validação extraída de DailyReport.tsx,
 * sem renderizar o componente completo.
 * Não chama o banco real — funções auxiliares são puramente síncronas.
 */

import { describe, it, expect } from 'vitest';
import type { Vehicle } from '../types';

// ---------------------------------------------------------------------------
// Funções auxiliares que replicam a lógica de validação de DailyReport.tsx
// Linha ~203-219: handleStartJourney — validação frontend imediata
// ---------------------------------------------------------------------------

/**
 * Replica a validação do odômetro/horímetro inicial de handleStartJourney.
 * Condição real: currentMedidor > 0 && startValue < currentMedidor → inválido
 * (aceita startValue === currentMedidor quando currentMedidor > 0)
 */
function validateStartOdometer(
  startValue: number,
  vehicle: Vehicle
): { valid: boolean; errorMessage?: string } {
  const isMaquina = vehicle.vehicle_type === 'maquina';
  const currentMedidor = isMaquina
    ? (vehicle.current_hourmeter || 0)
    : (vehicle.current_odometer || vehicle.lastOdometer || 0);
  const medidorNome = isMaquina ? 'horímetro' : 'odômetro';
  const unidade = isMaquina ? 'h' : 'km';

  if (currentMedidor > 0 && startValue < currentMedidor) {
    return {
      valid: false,
      errorMessage: `O ${medidorNome} inicial (${startValue} ${unidade}) deve ser maior ou igual ao ${medidorNome} atual do veículo (${currentMedidor} ${unidade}).`,
    };
  }
  return { valid: true };
}

/**
 * Replica a validação do odômetro/horímetro final de handleEndJourney.
 * Condição real: endValue <= startOdometer → inválido (deve ser estritamente maior)
 */
function validateEndOdometer(
  endValue: number,
  startOdometer: number,
  vehicle: Vehicle
): { valid: boolean; errorMessage?: string } {
  const isMaquina = vehicle.vehicle_type === 'maquina';
  const medidorNome = isMaquina ? 'horímetro' : 'odômetro';
  const unidade = isMaquina ? 'h' : 'km';

  if (endValue <= startOdometer) {
    return {
      valid: false,
      errorMessage: `O ${medidorNome} final deve ser maior que o ${medidorNome} inicial (${startOdometer} ${unidade}).`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const vehicleBase: Vehicle = {
  id: 'v-001',
  plate: 'ABC-1234',
  model: 'Fiat Ducato',
  prefix: 'FLT-01',
  lastOdometer: 10000,
  vehicle_type: 'veiculo',
  initial_odometer: 0,
  current_odometer: 15000,
  initial_hourmeter: 0,
  current_hourmeter: 0,
};

const maquinaBase: Vehicle = {
  id: 'm-001',
  plate: 'SEM-PLACA',
  model: 'Caterpillar 320',
  prefix: 'MAQ-01',
  lastOdometer: 0,
  vehicle_type: 'maquina',
  initial_odometer: 0,
  current_odometer: 0,
  initial_hourmeter: 0,
  current_hourmeter: 500,
};

// ---------------------------------------------------------------------------
// Suite 1 — Validação de odômetro: abertura de jornada
// ---------------------------------------------------------------------------

describe('Validação de odômetro — abertura de jornada', () => {
  it('rejeita start_odometer menor que current_odometer do veículo', () => {
    const result = validateStartOdometer(14000, vehicleBase);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  it('aceita start_odometer igual a current_odometer do veículo (válido)', () => {
    // A condição usa `<` portanto igual é permitido
    const result = validateStartOdometer(15000, vehicleBase);
    expect(result.valid).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('aceita start_odometer maior que current_odometer do veículo', () => {
    const result = validateStartOdometer(16000, vehicleBase);
    expect(result.valid).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('usa current_hourmeter para máquina em vez de current_odometer', () => {
    // A máquina tem current_hourmeter=500; tentar iniciar com 300 deve falhar
    const result = validateStartOdometer(300, maquinaBase);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('500');
  });

  it('mensagem de erro menciona os valores concretos (valor fornecido e valor atual)', () => {
    const result = validateStartOdometer(12000, vehicleBase);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('12000');
    expect(result.errorMessage).toContain('15000');
  });

  it('mensagem usa "horímetro" para máquina e "odômetro" para veículo', () => {
    const resultMaquina = validateStartOdometer(100, maquinaBase);
    expect(resultMaquina.errorMessage).toContain('horímetro');
    expect(resultMaquina.errorMessage).not.toContain('odômetro');

    const resultVeiculo = validateStartOdometer(1000, vehicleBase);
    expect(resultVeiculo.errorMessage).toContain('odômetro');
    expect(resultVeiculo.errorMessage).not.toContain('horímetro');
  });

  it('mensagem usa unidade "h" para máquina e "km" para veículo', () => {
    const resultMaquina = validateStartOdometer(100, maquinaBase);
    expect(resultMaquina.errorMessage).toContain('h');

    const resultVeiculo = validateStartOdometer(1000, vehicleBase);
    expect(resultVeiculo.errorMessage).toContain('km');
  });

  it('aceita qualquer valor quando current_odometer é zero (nenhum medidor registrado)', () => {
    const noOdoVehicle: Vehicle = { ...vehicleBase, current_odometer: 0, lastOdometer: 0 };
    const result = validateStartOdometer(0, noOdoVehicle);
    expect(result.valid).toBe(true);
  });

  it('usa lastOdometer como fallback quando current_odometer é zero', () => {
    const vehicleWithLastOdo: Vehicle = {
      ...vehicleBase,
      current_odometer: 0,
      lastOdometer: 20000,
    };
    // 10000 < 20000 → inválido
    const result = validateStartOdometer(10000, vehicleWithLastOdo);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('20000');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Validação de odômetro: encerramento de jornada
// ---------------------------------------------------------------------------

describe('Validação de odômetro — encerramento de jornada', () => {
  it('rejeita end_odometer menor que start_odometer', () => {
    const result = validateEndOdometer(14000, 15000, vehicleBase);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  it('rejeita end_odometer igual a start_odometer', () => {
    // Condição usa `<=` portanto igual é inválido
    const result = validateEndOdometer(15000, 15000, vehicleBase);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toBeDefined();
  });

  it('aceita end_odometer maior que start_odometer', () => {
    const result = validateEndOdometer(16000, 15000, vehicleBase);
    expect(result.valid).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  it('veículo tipo maquina usa "horímetro" na mensagem de erro', () => {
    const result = validateEndOdometer(400, 500, maquinaBase);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain('horímetro');
    expect(result.errorMessage).not.toContain('odômetro');
  });

  it('mensagem de encerramento menciona o start_odometer como referência', () => {
    const result = validateEndOdometer(14000, 15000, vehicleBase);
    expect(result.errorMessage).toContain('15000');
  });

  it('mensagem usa unidade "h" para máquina e "km" para veículo', () => {
    const resultMaquina = validateEndOdometer(400, 500, maquinaBase);
    expect(resultMaquina.errorMessage).toContain('h');

    const resultVeiculo = validateEndOdometer(14000, 15000, vehicleBase);
    expect(resultVeiculo.errorMessage).toContain('km');
  });
});

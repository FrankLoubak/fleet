/**
 * Testes de interface Vehicle do FleetManager
 *
 * Cobre: campos obrigatórios, vehicle_type, odômetro e horímetro
 * Não chama o banco real — usa apenas valores locais em memória.
 */

import { describe, it, expect } from 'vitest';
import type { Vehicle } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const veiculoFixture: Vehicle = {
  id: 'v-001',
  plate: 'XYZ-9876',
  model: 'Volkswagen Delivery',
  prefix: 'VW-01',
  lastOdometer: 45000,
  vehicle_type: 'veiculo',
  initial_odometer: 40000,
  current_odometer: 45000,
  initial_hourmeter: 0,
  current_hourmeter: 0,
};

const maquinaFixture: Vehicle = {
  id: 'm-002',
  plate: 'MAQ-0002',
  model: 'Retroescavadeira JCB',
  prefix: 'JCB-01',
  lastOdometer: 0,
  vehicle_type: 'maquina',
  initial_odometer: 0,
  current_odometer: 0,
  initial_hourmeter: 200,
  current_hourmeter: 850,
};

// ---------------------------------------------------------------------------
// Helper: identifica tipo de medidor principal do veículo
// ---------------------------------------------------------------------------

function getMedidorPrincipal(vehicle: Vehicle): 'odometro' | 'horimetro' {
  return vehicle.vehicle_type === 'maquina' ? 'horimetro' : 'odometro';
}

// ---------------------------------------------------------------------------
// Suite 1 — Interface Vehicle
// ---------------------------------------------------------------------------

describe('Interface Vehicle', () => {
  it('veículo (veiculo) tem current_odometer definido', () => {
    expect(veiculoFixture.current_odometer).toBeDefined();
    expect(typeof veiculoFixture.current_odometer).toBe('number');
  });

  it('máquina tem current_hourmeter definido', () => {
    expect(maquinaFixture.current_hourmeter).toBeDefined();
    expect(typeof maquinaFixture.current_hourmeter).toBe('number');
  });

  it('vehicle_type aceita "veiculo" ou "maquina"', () => {
    const tiposValidos: Vehicle['vehicle_type'][] = ['veiculo', 'maquina'];
    expect(tiposValidos).toContain(veiculoFixture.vehicle_type);
    expect(tiposValidos).toContain(maquinaFixture.vehicle_type);
  });

  it('veículo com odômetro zero é válido', () => {
    const veiculoZero: Vehicle = {
      ...veiculoFixture,
      id: 'v-zero',
      initial_odometer: 0,
      current_odometer: 0,
      lastOdometer: 0,
    };
    expect(veiculoZero.current_odometer).toBe(0);
    // Zero é um valor numérico válido — o campo existe
    expect(typeof veiculoZero.current_odometer).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Validação de tipo de veículo
// ---------------------------------------------------------------------------

describe('Validação de tipo de veículo', () => {
  it('identifica corretamente veiculo vs maquina pelo vehicle_type', () => {
    expect(getMedidorPrincipal(veiculoFixture)).toBe('odometro');
    expect(getMedidorPrincipal(maquinaFixture)).toBe('horimetro');
  });
});

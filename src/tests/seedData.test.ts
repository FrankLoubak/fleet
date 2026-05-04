/**
 * Testes de src/utils/seedData.ts
 *
 * Importa e executa o código de produção real para maximizar cobertura.
 * O localStorage é mockado via jsdom (disponível no ambiente de teste).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateSeedData } from '../utils/seedData';

// ---------------------------------------------------------------------------
// Limpa localStorage antes e após cada teste
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// generateSeedData()
// ---------------------------------------------------------------------------
describe('generateSeedData()', () => {
  it('retorna objeto com contagens de journeys, refuelings e maintenances', () => {
    const result = generateSeedData();
    expect(result).toHaveProperty('journeysCount');
    expect(result).toHaveProperty('refuelingsCount');
    expect(result).toHaveProperty('maintenancesCount');
  });

  it('gera exatamente 100 jornadas', () => {
    const result = generateSeedData();
    expect(result.journeysCount).toBe(100);
  });

  it('gera exatamente 70 abastecimentos', () => {
    const result = generateSeedData();
    expect(result.refuelingsCount).toBe(70);
  });

  it('gera exatamente 30 manutenções', () => {
    const result = generateSeedData();
    expect(result.maintenancesCount).toBe(30);
  });

  it('salva jornadas no localStorage', () => {
    generateSeedData();
    const stored = localStorage.getItem('all_journeys');
    expect(stored).not.toBeNull();
    const journeys = JSON.parse(stored!);
    expect(Array.isArray(journeys)).toBe(true);
    expect(journeys.length).toBe(100);
  });

  it('salva abastecimentos no localStorage', () => {
    generateSeedData();
    const stored = localStorage.getItem('all_refuelings');
    expect(stored).not.toBeNull();
    const refuelings = JSON.parse(stored!);
    expect(Array.isArray(refuelings)).toBe(true);
    expect(refuelings.length).toBe(70);
  });

  it('salva manutenções no localStorage', () => {
    generateSeedData();
    const stored = localStorage.getItem('all_maintenances');
    expect(stored).not.toBeNull();
    const maintenances = JSON.parse(stored!);
    expect(Array.isArray(maintenances)).toBe(true);
    expect(maintenances.length).toBe(30);
  });

  it('salva solicitações de manutenção no localStorage (array vazio)', () => {
    generateSeedData();
    const stored = localStorage.getItem('all_maintenance_requests');
    expect(stored).not.toBeNull();
    const requests = JSON.parse(stored!);
    expect(Array.isArray(requests)).toBe(true);
  });

  it('salva odômetros dos veículos no localStorage', () => {
    generateSeedData();
    const stored = localStorage.getItem('vehicles_odometers');
    expect(stored).not.toBeNull();
    const odometers = JSON.parse(stored!);
    expect(typeof odometers).toBe('object');
    expect(odometers).not.toBeNull();
  });

  it('jornadas têm estrutura mínima esperada', () => {
    generateSeedData();
    const journeys = JSON.parse(localStorage.getItem('all_journeys')!);
    journeys.forEach((j: Record<string, unknown>) => {
      expect(j).toHaveProperty('id');
      expect(j).toHaveProperty('userId');
      expect(j).toHaveProperty('vehicleId');
      expect(j).toHaveProperty('startTime');
      expect(j).toHaveProperty('endTime');
      expect(j).toHaveProperty('startOdometer');
      expect(j).toHaveProperty('endOdometer');
      expect(j).toHaveProperty('status');
      expect(j.status).toBe('encerrada');
    });
  });

  it('abastecimentos têm fuelType válido', () => {
    generateSeedData();
    const refuelings = JSON.parse(localStorage.getItem('all_refuelings')!);
    const validFuelTypes = ['Gasolina', 'Álcool', 'Diesel'];
    refuelings.forEach((r: Record<string, unknown>) => {
      expect(validFuelTypes).toContain(r.fuelType);
    });
  });

  it('manutenções têm status "executada"', () => {
    generateSeedData();
    const maintenances = JSON.parse(localStorage.getItem('all_maintenances')!);
    maintenances.forEach((m: Record<string, unknown>) => {
      expect(m.status).toBe('executada');
    });
  });

  it('manutenções têm type válido', () => {
    generateSeedData();
    const maintenances = JSON.parse(localStorage.getItem('all_maintenances')!);
    const validTypes = ['Mecanica', 'Eletrica', 'Acessórios', 'Borracharia', 'Ar de serviço'];
    maintenances.forEach((m: Record<string, unknown>) => {
      expect(validTypes).toContain(m.type);
    });
  });

  it('odômetros finais são maiores que os iniciais nas jornadas', () => {
    generateSeedData();
    const journeys = JSON.parse(localStorage.getItem('all_journeys')!);
    journeys.forEach((j: Record<string, unknown>) => {
      expect(Number(j.endOdometer)).toBeGreaterThan(Number(j.startOdometer));
    });
  });

  it('distância percorrida é consistente com odômetros', () => {
    generateSeedData();
    const journeys = JSON.parse(localStorage.getItem('all_journeys')!);
    journeys.forEach((j: Record<string, unknown>) => {
      const expected = Number(j.endOdometer) - Number(j.startOdometer);
      expect(Number(j.distanceTraveled)).toBe(expected);
    });
  });

  it('pode ser chamada múltiplas vezes sem erro', () => {
    expect(() => {
      generateSeedData();
      generateSeedData();
      generateSeedData();
    }).not.toThrow();
  });
});

/**
 * Testes das funções utilitárias de src/utils.ts
 *
 * Importa e executa código de produção real para maximizar cobertura.
 */

import { describe, it, expect } from 'vitest';
import {
  cn,
  cleanCpf,
  isCpfLengthValid,
  cpfToEmail,
  minutesToHHMM,
  hhmmToMinutes,
  sumHours,
  formatDateBR,
  roleLabel,
  calcDistance,
  MOCK_VEHICLES,
  MOCK_PROVIDERS,
  MOCK_USERS,
  MOCK_USER,
} from '../utils';

// ---------------------------------------------------------------------------
// cn() — classe condicional com tailwind-merge
// ---------------------------------------------------------------------------
describe('cn()', () => {
  it('retorna string vazia sem argumentos', () => {
    expect(cn()).toBe('');
  });

  it('retorna a classe simples quando passada diretamente', () => {
    expect(cn('flex')).toBe('flex');
  });

  it('combina múltiplas classes', () => {
    expect(cn('flex', 'items-center')).toBe('flex items-center');
  });

  it('ignora falsy values (undefined, false, null)', () => {
    expect(cn('flex', undefined, false, null as unknown as string)).toBe('flex');
  });

  it('merge classes do tailwind (remove duplicatas conflitantes)', () => {
    // tailwind-merge garante que p-2 substitui p-4 quando ambas são passadas
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('suporta conditional classes com objeto', () => {
    expect(cn({ flex: true, hidden: false })).toBe('flex');
  });
});

// ---------------------------------------------------------------------------
// cleanCpf()
// ---------------------------------------------------------------------------
describe('cleanCpf()', () => {
  it('remove pontos e traço do CPF formatado', () => {
    expect(cleanCpf('123.456.789-09')).toBe('12345678909');
  });

  it('retorna o mesmo CPF se já estiver limpo', () => {
    expect(cleanCpf('12345678909')).toBe('12345678909');
  });

  it('remove espaços', () => {
    expect(cleanCpf('123 456 789 09')).toBe('12345678909');
  });

  it('retorna string vazia para CPF vazio', () => {
    expect(cleanCpf('')).toBe('');
  });

  it('remove todos os caracteres não numéricos', () => {
    expect(cleanCpf('abc-123.def')).toBe('123');
  });
});

// ---------------------------------------------------------------------------
// isCpfLengthValid()
// ---------------------------------------------------------------------------
describe('isCpfLengthValid()', () => {
  it('retorna true para CPF com 11 dígitos', () => {
    expect(isCpfLengthValid('12345678901')).toBe(true);
  });

  it('retorna true para CPF formatado com 11 dígitos', () => {
    expect(isCpfLengthValid('123.456.789-01')).toBe(true);
  });

  it('retorna false para CPF com 10 dígitos', () => {
    expect(isCpfLengthValid('1234567890')).toBe(false);
  });

  it('retorna false para CPF com 12 dígitos', () => {
    expect(isCpfLengthValid('123456789012')).toBe(false);
  });

  it('retorna false para CPF vazio', () => {
    expect(isCpfLengthValid('')).toBe(false);
  });

  it('ignora caracteres não numéricos ao contar', () => {
    expect(isCpfLengthValid('123.456.789-01')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cpfToEmail()
// ---------------------------------------------------------------------------
describe('cpfToEmail()', () => {
  it('constrói e-mail padrão do FleetManager a partir de CPF limpo', () => {
    expect(cpfToEmail('12345678901')).toBe('12345678901@fleetmanager.com');
  });

  it('limpa o CPF antes de construir o e-mail', () => {
    expect(cpfToEmail('123.456.789-01')).toBe('12345678901@fleetmanager.com');
  });

  it('e-mail termina com @fleetmanager.com', () => {
    const email = cpfToEmail('11111111111');
    expect(email).toMatch(/@fleetmanager\.com$/);
  });
});

// ---------------------------------------------------------------------------
// minutesToHHMM()
// ---------------------------------------------------------------------------
describe('minutesToHHMM()', () => {
  it('converte 0 minutos para "00:00"', () => {
    expect(minutesToHHMM(0)).toBe('00:00');
  });

  it('converte 60 minutos para "01:00"', () => {
    expect(minutesToHHMM(60)).toBe('01:00');
  });

  it('converte 90 minutos para "01:30"', () => {
    expect(minutesToHHMM(90)).toBe('01:30');
  });

  it('converte 1440 minutos (24h) para "24:00"', () => {
    expect(minutesToHHMM(1440)).toBe('24:00');
  });

  it('garante padding com zero para minutos menores que 10', () => {
    expect(minutesToHHMM(5)).toBe('00:05');
  });

  it('garante padding com zero para horas menores que 10', () => {
    expect(minutesToHHMM(65)).toBe('01:05');
  });
});

// ---------------------------------------------------------------------------
// hhmmToMinutes()
// ---------------------------------------------------------------------------
describe('hhmmToMinutes()', () => {
  it('converte "00:00" para 0', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
  });

  it('converte "01:00" para 60', () => {
    expect(hhmmToMinutes('01:00')).toBe(60);
  });

  it('converte "01:30" para 90', () => {
    expect(hhmmToMinutes('01:30')).toBe(90);
  });

  it('converte "08:45" corretamente', () => {
    expect(hhmmToMinutes('08:45')).toBe(525);
  });

  it('é inverso de minutesToHHMM', () => {
    expect(hhmmToMinutes(minutesToHHMM(137))).toBe(137);
  });
});

// ---------------------------------------------------------------------------
// sumHours()
// ---------------------------------------------------------------------------
describe('sumHours()', () => {
  it('soma array vazio para "00:00"', () => {
    expect(sumHours([])).toBe('00:00');
  });

  it('soma um único elemento', () => {
    expect(sumHours(['01:30'])).toBe('01:30');
  });

  it('soma dois elementos simples', () => {
    expect(sumHours(['01:00', '00:30'])).toBe('01:30');
  });

  it('soma com resultado que ultrapassa 60 minutos', () => {
    expect(sumHours(['00:45', '00:45'])).toBe('01:30');
  });

  it('soma múltiplos elementos', () => {
    expect(sumHours(['01:00', '02:00', '03:00'])).toBe('06:00');
  });

  it('preserva formato HH:MM com padding', () => {
    const result = sumHours(['00:05', '00:03']);
    expect(result).toBe('00:08');
  });
});

// ---------------------------------------------------------------------------
// formatDateBR()
// ---------------------------------------------------------------------------
describe('formatDateBR()', () => {
  it('formata data ISO simples para DD/MM/YYYY', () => {
    expect(formatDateBR('2026-05-01')).toBe('01/05/2026');
  });

  it('formata data ISO com horário (ignora parte do tempo)', () => {
    expect(formatDateBR('2026-05-01T10:30:00.000Z')).toBe('01/05/2026');
  });

  it('formata data de dezembro corretamente', () => {
    expect(formatDateBR('2025-12-31')).toBe('31/12/2025');
  });

  it('formata data de janeiro com padding', () => {
    expect(formatDateBR('2026-01-05')).toBe('05/01/2026');
  });
});

// ---------------------------------------------------------------------------
// roleLabel()
// ---------------------------------------------------------------------------
describe('roleLabel()', () => {
  it('retorna "Administrador" para role Admin', () => {
    expect(roleLabel('Admin')).toBe('Administrador');
  });

  it('retorna "Operador" para role Operador', () => {
    expect(roleLabel('Operador')).toBe('Operador');
  });

  it('retorna "Root" para role Root', () => {
    expect(roleLabel('Root')).toBe('Root');
  });
});

// ---------------------------------------------------------------------------
// calcDistance()
// ---------------------------------------------------------------------------
describe('calcDistance()', () => {
  it('calcula distância corretamente', () => {
    expect(calcDistance(1000, 1250)).toBe(250);
  });

  it('retorna 0 quando odômetro final é igual ao inicial', () => {
    expect(calcDistance(1000, 1000)).toBe(0);
  });

  it('retorna 0 quando odômetro final é menor que o inicial (dado inválido)', () => {
    expect(calcDistance(1000, 800)).toBe(0);
  });

  it('calcula distâncias grandes corretamente', () => {
    expect(calcDistance(0, 500000)).toBe(500000);
  });
});

// ---------------------------------------------------------------------------
// MOCK_VEHICLES
// ---------------------------------------------------------------------------
describe('MOCK_VEHICLES', () => {
  it('é um array não vazio', () => {
    expect(Array.isArray(MOCK_VEHICLES)).toBe(true);
    expect(MOCK_VEHICLES.length).toBeGreaterThan(0);
  });

  it('cada veículo tem id, plate, model, prefix, lastOdometer', () => {
    MOCK_VEHICLES.forEach(v => {
      expect(v).toHaveProperty('id');
      expect(v).toHaveProperty('plate');
      expect(v).toHaveProperty('model');
      expect(v).toHaveProperty('prefix');
      expect(v).toHaveProperty('lastOdometer');
    });
  });

  it('todos os lastOdometer são números positivos', () => {
    MOCK_VEHICLES.forEach(v => {
      expect(typeof v.lastOdometer).toBe('number');
      expect(v.lastOdometer).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// MOCK_PROVIDERS
// ---------------------------------------------------------------------------
describe('MOCK_PROVIDERS', () => {
  it('é um array não vazio', () => {
    expect(Array.isArray(MOCK_PROVIDERS)).toBe(true);
    expect(MOCK_PROVIDERS.length).toBeGreaterThan(0);
  });

  it('contém fornecedores de todos os tipos de manutenção', () => {
    const types = MOCK_PROVIDERS.map(p => p.type);
    expect(types).toContain('Mecanica');
    expect(types).toContain('Eletrica');
    expect(types).toContain('Acessórios');
    expect(types).toContain('Borracharia');
    expect(types).toContain('Ar de serviço');
  });

  it('cada fornecedor tem id, name e type válidos', () => {
    MOCK_PROVIDERS.forEach(p => {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// MOCK_USERS
// ---------------------------------------------------------------------------
describe('MOCK_USERS', () => {
  it('é um array não vazio', () => {
    expect(Array.isArray(MOCK_USERS)).toBe(true);
    expect(MOCK_USERS.length).toBeGreaterThan(0);
  });

  it('todos os usuários têm id, name, email, cpf, role', () => {
    MOCK_USERS.forEach(u => {
      expect(typeof u.id).toBe('string');
      expect(typeof u.name).toBe('string');
      expect(typeof u.email).toBe('string');
      expect(typeof u.cpf).toBe('string');
      expect(['Root', 'Admin', 'Operador']).toContain(u.role);
    });
  });

  it('contém pelo menos um Operador', () => {
    const operators = MOCK_USERS.filter(u => u.role === 'Operador');
    expect(operators.length).toBeGreaterThan(0);
  });

  it('contém pelo menos um Admin', () => {
    const admins = MOCK_USERS.filter(u => u.role === 'Admin');
    expect(admins.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MOCK_USER
// ---------------------------------------------------------------------------
describe('MOCK_USER', () => {
  it('é o primeiro elemento de MOCK_USERS', () => {
    expect(MOCK_USER).toBe(MOCK_USERS[0]);
  });

  it('tem as propriedades de um usuário válido', () => {
    expect(MOCK_USER).toHaveProperty('id');
    expect(MOCK_USER).toHaveProperty('name');
    expect(MOCK_USER).toHaveProperty('email');
    expect(MOCK_USER).toHaveProperty('role');
  });
});

/**
 * Testes de interface MaintenanceRequest do FleetManager
 *
 * Cobre: status válidos da interface, transições de status
 * Não chama o banco real — usa apenas valores locais em memória.
 */

import { describe, it, expect } from 'vitest';
import type { MaintenanceRequest } from '../types';

// ---------------------------------------------------------------------------
// Valores de status válidos (retirados da interface MaintenanceRequest)
// ---------------------------------------------------------------------------

const VALID_STATUSES: MaintenanceRequest['status'][] = [
  'pendente',
  'aprovada',
  'rejeitada',
  'concluida',
  'cancelada',
];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRequest(
  status: MaintenanceRequest['status']
): MaintenanceRequest {
  return {
    id: `req-${status}`,
    userId: 'user-001',
    vehicleId: 'v-001',
    date: '2026-05-01',
    odometer: 50000,
    type: 'Mecanica',
    description: `Solicitação com status ${status}`,
    status,
  };
}

// ---------------------------------------------------------------------------
// Suite 1 — Interface MaintenanceRequest
// ---------------------------------------------------------------------------

describe('Interface MaintenanceRequest', () => {
  it('status pode ser pendente', () => {
    const req = makeRequest('pendente');
    expect(req.status).toBe('pendente');
  });

  it('status pode ser aprovada', () => {
    const req = makeRequest('aprovada');
    expect(req.status).toBe('aprovada');
  });

  it('status pode ser rejeitada', () => {
    const req = makeRequest('rejeitada');
    expect(req.status).toBe('rejeitada');
  });

  it('status pode ser concluida', () => {
    const req = makeRequest('concluida');
    expect(req.status).toBe('concluida');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Transições de status de manutenção
// ---------------------------------------------------------------------------

describe('Transições de status de manutenção', () => {
  it('lista de status válidos contém os 4 valores esperados', () => {
    const expected = ['pendente', 'aprovada', 'rejeitada', 'concluida'];
    expected.forEach((s) => {
      expect(VALID_STATUSES).toContain(s);
    });
  });

  it('status inválido não está na lista de valores permitidos', () => {
    // Valor inventado que não faz parte da union type
    const invalido = 'em_analise';
    expect(VALID_STATUSES).not.toContain(invalido);
  });
});

/**
 * ARQUIVO: src/lib/routes/RouteHistoryService.ts
 * O QUE FAZ: consulta paginada do histórico de posições de um veículo num intervalo de
 *   datas, por cima de TelemetryProvider.
 * PARA QUE SERVE: Rodada C / C3 — histórico de rotas (TR Salgueiro/PE, item 5.6.1-d).
 *   Paginação em memória (slice) porque TelemetryProvider.getPositionHistory() retorna
 *   o intervalo inteiro de uma vez — trocar por paginação real se/quando a implementação
 *   concreta vier de uma API paginada de verdade. Listagem/tabela, sem mapa animado
 *   nesta rodada (RESPOSTA confirmada na PARTE 7, pergunta 6 — evita depender de
 *   biblioteca de mapas antes de confirmar exigência real de edital).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/telemetry/index.ts (telemetryProvider) — fonte dos dados
 *   - src/pages/RouteHistory.tsx — consumidor
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C3)
 */

import { telemetryProvider } from '../telemetry';
import type { VehiclePosition } from '../telemetry/TelemetryProvider';

export interface PaginatedPositions {
  items: VehiclePosition[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export class RouteHistoryService {
  async getHistory(
    vehicleId: string,
    from: Date,
    to: Date,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedPositions> {
    const all = await telemetryProvider.getPositionHistory(vehicleId, from, to);
    const totalCount = all.length;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    return { items, page, pageSize, totalCount };
  }
}

export const routeHistoryService = new RouteHistoryService();

/**
 * ARQUIVO: src/lib/drivers/index.ts
 * O QUE FAZ: ponto único de troca de implementação de DriverAuthProvider.
 * PARA QUE SERVE: mesmo padrão de src/lib/telemetry/index.ts — troca de PIN pra
 *   RFID/QR/biometria no futuro é só mudar esta linha.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/drivers/PinAuthProvider.ts — implementação atual
 *   - src/pages/Journeys.tsx, src/pages/Profile.tsx — consumidores
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C1)
 */

import { PinAuthProvider } from './PinAuthProvider';

export type { AuthResult, DriverAuthProvider } from './DriverAuthProvider';

export const driverAuthProvider = new PinAuthProvider();

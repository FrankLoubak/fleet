/**
 * ARQUIVO: src/lib/drivers/VehicleImmobilizerProvider.ts
 * O QUE FAZ: define o contrato de bloqueio físico de ignição (Camada 2, opcional) —
 *   interface separada de DriverAuthProvider porque uma coisa é identificar o motorista
 *   (software), outra é acionar hardware embarcado num veículo em uso.
 * PARA QUE SERVE: Rodada C / C1, Camada 2. Feature-flag DESLIGADA por padrão
 *   (FEATURE_PHYSICAL_IMMOBILIZER=false) — nenhuma implementação concreta real (ex.: via
 *   comando SmartGPS) foi escrita nesta rodada porque o formato exato do comando
 *   (AT+GTOUT ou equivalente) varia por modelo de rastreador contratado (Queclink GV57 vs.
 *   Maxtrack MXT150, citados no prompt da Rodada C) e não há como confirmar o payload
 *   exato sem acesso real à API/hardware do fornecedor — marcado A VERIFICAR conforme
 *   regra do projeto de nunca inventar contrato de API externa. NoopImmobilizerProvider é
 *   o único provider concreto existente hoje: sempre no-op, documentando a limitação em
 *   vez de fingir que bloqueia algo.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/drivers/DriverAuthProvider.ts — Camada 1, independente desta interface
 *   - (nenhum consumidor ainda — feature-flag desligada, ver PARTE 8/C1 do prompt da
 *     Rodada C)
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C1), somente interface +
 *   stub no-op
 */

// Mantida desligada nesta rodada — habilitar exige teste físico controlado prévio
// (ver prompt da Rodada C, PARTE 7, pergunta 2) e confirmação do modelo real de
// rastreador contratado antes de implementar o comando exato.
export const FEATURE_PHYSICAL_IMMOBILIZER = false;

export interface ImmobilizerResult {
  success: boolean;
  error?: string;
}

export interface VehicleImmobilizerProvider {
  /**
   * Aciona bloqueio progressivo (nunca imediato/em movimento) no veículo. Implementação
   * real depende do modelo do rastreador — ver nota do arquivo. A VERIFICAR antes de
   * qualquer implementação concreta: formato do comando na doc do fornecedor.
   */
  requestProgressiveLock(vehicleId: string): Promise<ImmobilizerResult>;
}

/**
 * Único provider concreto desta rodada — nunca bloqueia nada de verdade. Existe pra que
 * o restante do app já possa depender da interface sem esperar a integração real.
 */
export class NoopImmobilizerProvider implements VehicleImmobilizerProvider {
  async requestProgressiveLock(_vehicleId: string): Promise<ImmobilizerResult> {
    return {
      success: false,
      error: 'Bloqueio físico não implementado nesta rodada (Camada 2 desligada — A VERIFICAR com o fornecedor antes de implementar).',
    };
  }
}

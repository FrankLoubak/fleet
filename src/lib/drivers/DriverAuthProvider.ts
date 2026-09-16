/**
 * ARQUIVO: src/lib/drivers/DriverAuthProvider.ts
 * O QUE FAZ: define o contrato de identificação do motorista antes da abertura de uma
 *   jornada — hoje implementado por PIN (PinAuthProvider), trocável por RFID/QR/biometria
 *   em rodada futura sem alterar quem consome esta interface.
 * PARA QUE SERVE: Rodada C / C1 — exigência de identificação do motorista (TR
 *   Salgueiro/PE, item 5.6.1-b), seguindo o mesmo padrão de provider desacoplado já usado
 *   em TelemetryProvider (Rodada B).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/drivers/PinAuthProvider.ts — implementação concreta consumida via index.ts
 *   - src/pages/Journeys.tsx — consome esta interface para bloquear abertura de jornada
 *   - src/pages/Profile.tsx — consome setPin() (mesmo provider) pra cadastro do PIN
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C1)
 */

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface DriverAuthProvider {
  /**
   * Verifica a credencial do motorista autenticado (auth.uid()) para abrir uma jornada
   * no veículo informado. vehicleId existe na assinatura para implementações futuras que
   * dependam do veículo (ex.: RFID lido pelo próprio equipamento embarcado); a
   * implementação por PIN não usa esse parâmetro na verificação em si.
   */
  authenticate(vehicleId: string, credential: string): Promise<AuthResult>;
}

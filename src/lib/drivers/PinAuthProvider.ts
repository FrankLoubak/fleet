/**
 * ARQUIVO: src/lib/drivers/PinAuthProvider.ts
 * O QUE FAZ: implementa DriverAuthProvider via PIN numérico (4-6 dígitos), delegando
 *   toda validação/hash a funções SQL (verify_driver_pin/record_driver_checkin) —
 *   nunca compara o PIN no cliente, só encaminha pro servidor.
 * PARA QUE SERVE: Rodada C / C1, Camada 1 (identificação por software, sem hardware).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/drivers/DriverAuthProvider.ts — interface implementada aqui
 *   - supabase/migrations/20260916000002_driver_identification.sql — funções RPC consumidas
 *   - src/pages/Journeys.tsx — usa authenticate() e recordCheckin()
 *   - src/pages/Profile.tsx — usa setPin()
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C1)
 */

import { supabase } from '../supabase';
import type { AuthResult, DriverAuthProvider } from './DriverAuthProvider';

export class PinAuthProvider implements DriverAuthProvider {
  async authenticate(_vehicleId: string, credential: string): Promise<AuthResult> {
    const { data, error } = await supabase.rpc('verify_driver_pin', { pin: credential });
    if (error) {
      return { success: false, error: error.message };
    }
    return data === true
      ? { success: true }
      : { success: false, error: 'PIN incorreto ou não cadastrado.' };
  }

  async setPin(newPin: string): Promise<AuthResult> {
    const { error } = await supabase.rpc('set_driver_pin', { new_pin: newPin });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async recordCheckin(journeyId: string, credential: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('record_driver_checkin', {
      p_journey_id: journeyId,
      pin: credential,
    });
    if (error) return false;
    return data === true;
  }
}

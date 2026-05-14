import { Pneu } from '../types';

/**
 * Gera nomes de posição para um eixo com N pneus.
 * Sempre N é par. Retorna array da esquerda para direita.
 */
export function getPositionsForAxle(count: number): string[] {
  if (count === 2) return ['E', 'D'];
  if (count === 4) return ['EE', 'EI', 'DI', 'DE'];
  if (count === 6) return ['EE', 'EM', 'EI', 'DI', 'DM', 'DE'];
  if (count === 8) return ['EEE', 'EEM', 'EEI', 'EI', 'DI', 'DEI', 'DEM', 'DEE'];
  // fallback genérico para counts não mapeados
  return Array.from({ length: count }, (_, i) =>
    i < count / 2 ? `E${i + 1}` : `D${count - i}`
  );
}

/**
 * Constrói posição qualificada: eixo 2, slot "DI" → "E2_DI"
 * Reserva: "RESERVA_1", "RESERVA_2" etc.
 */
export function buildPosition(eixoIndex: number, slot: string): string {
  return `E${eixoIndex}_${slot}`;
}

export function buildReservaPosition(index: number): string {
  return `RESERVA_${index}`;
}

/**
 * Parse de "E2_DI" → { eixo: 2, slot: "DI" }
 * Parse de "RESERVA_1" → { eixo: 0, slot: "RESERVA_1" }
 * Retorna null se formato inválido.
 */
export function parsePosition(pos: string): { eixo: number; slot: string } | null {
  if (pos.startsWith('RESERVA_')) return { eixo: 0, slot: pos };
  const m = pos.match(/^E(\d+)_(.+)$/);
  if (!m) return null;
  return { eixo: Number(m[1]), slot: m[2] };
}

/**
 * Deriva vida do pneu a partir das datas de reforma.
 * 0 = 1ª vida (verde), 1 = 2ª vida (amarelo), 2 = 3ª vida (vermelho)
 */
export function derivarVida(pneu: Pick<Pneu, 'data1Reforma' | 'data2Reforma'>): 0 | 1 | 2 {
  if (pneu.data2Reforma) return 2;
  if (pneu.data1Reforma) return 1;
  return 0;
}

/** Classes Tailwind por vida */
export const VIDA_CLASSES: Record<0 | 1 | 2, string> = {
  0: 'bg-green-600 text-white',
  1: 'bg-amber-400 text-white',
  2: 'bg-red-600 text-white',
};

/** Label de vida */
export const VIDA_LABEL: Record<0 | 1 | 2, string> = {
  0: '1ª Vida',
  1: '2ª Vida',
  2: '3ª Vida',
};

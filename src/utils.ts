import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove todos os caracteres não numéricos de um CPF.
 * Exemplo: "123.456.789-09" → "12345678909"
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida se um CPF (já limpo ou formatado) tem exatamente 11 dígitos.
 * Não verifica o dígito verificador — apenas o comprimento.
 */
export function isCpfLengthValid(cpf: string): boolean {
  return cleanCpf(cpf).length === 11;
}

/**
 * Constrói o e-mail de autenticação a partir do CPF limpo.
 * Padrão do FleetManager: `{cpf}@fleetmanager.com`
 */
export function cpfToEmail(cpf: string): string {
  return `${cleanCpf(cpf)}@fleetmanager.com`;
}

/**
 * Formata minutos totais para o formato "HH:MM".
 * Exemplo: 90 → "01:30"
 */
export function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Converte uma string no formato "HH:MM" para o total de minutos.
 * Exemplo: "01:30" → 90
 */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Soma um array de strings no formato "HH:MM" e retorna o total em "HH:MM".
 * Exemplo: ["01:30", "00:45"] → "02:15"
 */
export function sumHours(hours: string[]): string {
  const totalMinutes = hours.reduce((acc, hhmm) => acc + hhmmToMinutes(hhmm), 0);
  return minutesToHHMM(totalMinutes);
}

/**
 * Formata uma data ISO para o formato brasileiro (DD/MM/YYYY).
 * Exemplo: "2026-05-01" → "01/05/2026"
 */
export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Retorna o label em português para o role do usuário.
 */
export function roleLabel(role: 'Root' | 'Admin' | 'Operador'): string {
  const labels: Record<string, string> = {
    Root: 'Root',
    Admin: 'Administrador',
    Operador: 'Operador',
  };
  return labels[role] ?? role;
}

/**
 * Calcula a distância percorrida entre dois odômetros.
 * Retorna 0 se o valor final for menor ou igual ao inicial.
 */
export function calcDistance(startOdometer: number, endOdometer: number): number {
  if (endOdometer <= startOdometer) return 0;
  return endOdometer - startOdometer;
}

export const MOCK_VEHICLES = [
  { id: '1', plate: 'ABC-1234', model: 'Toyota Hilux', prefix: 'FT-089', lastOdometer: 125000 },
  { id: '2', plate: 'XYZ-9876', model: 'VW Gol', prefix: 'FT-042', lastOdometer: 45200 },
  { id: '3', plate: 'DEF-4567', model: 'Ford Cargo', prefix: 'FT-115', lastOdometer: 210500 },
  { id: '4', plate: 'GHI-5678', model: 'Mercedes-Benz Accelo', prefix: 'FT-201', lastOdometer: 85400 },
  { id: '5', plate: 'JKL-9012', model: 'Fiat Strada', prefix: 'FT-055', lastOdometer: 12300 },
  { id: '6', plate: 'MNO-3456', model: 'Scania R450', prefix: 'FT-310', lastOdometer: 320000 },
  { id: '7', plate: 'PQR-7890', model: 'Chevrolet Onix', prefix: 'FT-012', lastOdometer: 15600 },
  { id: '8', plate: 'STU-1234', model: 'Volvo FH 540', prefix: 'FT-405', lastOdometer: 412000 },
];

import { User, Provider } from './types';

export const MOCK_PROVIDERS: Provider[] = [
  // Mecânica
  { id: 'p1', name: 'Oficina Central S.A.', type: 'Mecanica' },
  { id: 'p2', name: 'Mecânica do João', type: 'Mecanica' },
  { id: 'p3', name: 'Centro Automotivo Pro', type: 'Mecanica' },
  { id: 'p4', name: 'Turbo Mecânica', type: 'Mecanica' },
  { id: 'p5', name: 'Oficina das Nações', type: 'Mecanica' },
  // Elétrica
  { id: 'p6', name: 'Auto Elétrica Silva', type: 'Eletrica' },
  { id: 'p7', name: 'Spark Auto Elétrica', type: 'Eletrica' },
  { id: 'p8', name: 'Volt Soluções Automotivas', type: 'Eletrica' },
  { id: 'p9', name: 'Elétrica Rápida', type: 'Eletrica' },
  { id: 'p10', name: 'Power Auto Elétrica', type: 'Eletrica' },
  // Acessórios
  { id: 'p11', name: 'Acessórios & Cia', type: 'Acessórios' },
  { id: 'p12', name: 'Som e Alarme VIP', type: 'Acessórios' },
  { id: 'p13', name: 'Equipa Car', type: 'Acessórios' },
  { id: 'p14', name: 'Tuning Shop', type: 'Acessórios' },
  { id: 'p15', name: 'Auto Style Acessórios', type: 'Acessórios' },
  // Borracharia
  { id: 'p16', name: 'Borracharia 24h', type: 'Borracharia' },
  { id: 'p17', name: 'Pneus e Rodas Express', type: 'Borracharia' },
  { id: 'p18', name: 'Borracharia do Trevo', type: 'Borracharia' },
  { id: 'p19', name: 'Alinhamento e Balanceamento Silva', type: 'Borracharia' },
  { id: 'p20', name: 'Borracharia Central', type: 'Borracharia' },
  // Ar de serviço (Sistemas de Freios)
  { id: 'p21', name: 'Freios & Ar Central', type: 'Ar de serviço' },
  { id: 'p22', name: 'Stop Car Sistemas de Freio', type: 'Ar de serviço' },
  { id: 'p23', name: 'Master Freios a Ar', type: 'Ar de serviço' },
  { id: 'p24', name: 'Soluções em Freios Hidráulicos', type: 'Ar de serviço' },
  { id: 'p25', name: 'Freio Rápido e Ar de Serviço', type: 'Ar de serviço' },
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Ricardo Silva',
    email: 'ricardo@fleet.com',
    role: 'Admin',
    cpf: '11111111111',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    phone: '(11) 98765-4321'
  },
  {
    id: 'u2',
    name: 'Carlos Oliveira',
    email: 'carlos@fleet.com',
    role: 'Operador',
    cpf: '22222222222',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    phone: '(11) 91234-5678'
  },
  {
    id: 'u3',
    name: 'Ana Santos',
    email: 'ana@fleet.com',
    role: 'Admin',
    cpf: '33333333333',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    phone: '(11) 97777-8888'
  },
  {
    id: 'u4',
    name: 'João Pereira',
    email: 'joao@fleet.com',
    role: 'Operador',
    cpf: '44444444444',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    phone: '(11) 96666-5555'
  },
  {
    id: 'u5',
    name: 'Maria Souza',
    email: 'maria@fleet.com',
    role: 'Operador',
    cpf: '55555555555',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    phone: '(11) 95555-4444'
  }
];

export const MOCK_USER = MOCK_USERS[0];

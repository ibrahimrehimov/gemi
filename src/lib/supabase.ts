// Supabase client singleton — reads env vars injected by Vite.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars are missing. Check .env for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Database row type for the rooms table.
export interface RoomRow {
  id: string;
  code: string;
  status: 'waiting' | 'placing' | 'playing' | 'finished';
  host_token: string;
  host_name: string;
  host_ships: ShipJson[];
  host_shots: Record<string, 'hit' | 'miss'>;
  guest_token: string | null;
  guest_name: string | null;
  guest_ships: ShipJson[];
  guest_shots: Record<string, 'hit' | 'miss'>;
  turn: 'host' | 'guest';
  winner: 'host' | 'guest' | null;
  host_ready: boolean;
  guest_ready: boolean;
  created_at: string;
  updated_at: string;
}

// Minimal ship shape stored in JSON (no class methods, just data).
export interface ShipJson {
  id: string;
  defId: string;
  name: string;
  size: number;
  row: number;
  col: number;
  orientation: 'h' | 'v';
  hits: boolean[];
}

export interface ShotRow {
  id: string;
  room_id: string;
  attacker: 'host' | 'guest';
  row: number;
  col: number;
  result: 'hit' | 'miss' | 'sunk';
  created_at: string;
}

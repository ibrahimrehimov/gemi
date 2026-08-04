// Online multiplayer API: room creation, joining, placement, and firing.
// All operations go through Supabase. Real-time updates arrive via the
// useOnlineGame hook's subscriptions.

import { supabase, type RoomRow, type ShipJson, type ShotRow } from './supabase';

// Generate a random 6-char room code (uppercase letters + digits, no ambiguous chars).
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Generate a random session token for the local player.
export function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Get or create a persistent session token in localStorage.
export function getSessionToken(): string {
  const key = 'bs_session_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = generateToken();
    localStorage.setItem(key, token);
  }
  return token;
}

export function getPlayerName(): string {
  return localStorage.getItem('bs_player_name') || 'Oyunçu';
}

export function setPlayerName(name: string): void {
  localStorage.setItem('bs_player_name', name);
}

// ---- Room lifecycle -----------------------------------------------------

export interface CreateRoomResult {
  room: RoomRow;
  role: 'host';
}

export async function createRoom(hostName: string): Promise<CreateRoomResult> {
  const token = getSessionToken();
  const code = generateRoomCode();

  // Try inserting with a fresh code; retry on collision (extremely rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        status: 'waiting',
        host_token: token,
        host_name: hostName,
        turn: 'host',
      })
      .select()
      .single();

    if (!error && data) {
      return { room: data as RoomRow, role: 'host' };
    }
    // If it's a unique-constraint violation on code, retry with new code.
    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  }
  throw new Error('Otaq yaradıla bilmədi. Yenidən cəhd edin.');
}

export interface JoinRoomResult {
  room: RoomRow;
  role: 'host' | 'guest';
  error?: string;
}

export async function joinRoom(code: string, guestName: string): Promise<JoinRoomResult> {
  const token = getSessionToken();
  const cleanCode = code.trim().toUpperCase();

  // Look up the room.
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', cleanCode)
    .maybeSingle();

  if (error) throw error;
  if (!room) return { room: null as unknown as RoomRow, role: 'guest', error: 'Otaq tapılmadı. Kodu yoxlayın.' };

  const row = room as RoomRow;

  // If this is the host rejoining (same token), return as host.
  if (row.host_token === token) {
    return { room: row, role: 'host' };
  }

  // If already has a guest (and it's not us), room is full.
  if (row.guest_token && row.guest_token !== token) {
    return { room: row, role: 'guest', error: 'Otaq doludur. Başqa kod istifadə edin.' };
  }

  // Join as guest.
  const { data: updated, error: updateError } = await supabase
    .from('rooms')
    .update({
      guest_token: token,
      guest_name: guestName,
      status: 'placing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .is('guest_token', null) // optimistic: only if still empty
    .select()
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    return { room: row, role: 'guest', error: 'Otaq doludur. Başqa kod istefadə edin.' };
  }

  return { room: updated as RoomRow, role: 'guest' };
}

// Fetch the latest room state by id.
export async function fetchRoom(roomId: string): Promise<RoomRow | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return data as RoomRow | null;
}

// ---- Placement ----------------------------------------------------------

// Submit fleet placement and mark ready.
export async function submitPlacement(
  roomId: string,
  role: 'host' | 'guest',
  ships: ShipJson[]
): Promise<void> {
  const updates =
    role === 'host'
      ? { host_ships: ships, host_ready: true, updated_at: new Date().toISOString() }
      : { guest_ships: ships, guest_ready: true, updated_at: new Date().toISOString() };

  const { error } = await supabase.from('rooms').update(updates).eq('id', roomId);
  if (error) throw error;

  // Check if both are ready → transition to playing.
  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (room && room.host_ready && room.guest_ready && room.status === 'placing') {
    await supabase
      .from('rooms')
      .update({ status: 'playing', turn: 'host', updated_at: new Date().toISOString() })
      .eq('id', roomId);
  }
}

// ---- Firing -------------------------------------------------------------

export interface FireResult {
  result: 'hit' | 'miss' | 'sunk';
  shipSunk?: ShipJson;
  winner?: 'host' | 'guest';
}

// Fire a shot. Resolves the hit against the opponent's fleet on the server
// side (we read the room, compute the result, update shots + fleet, and
// insert a shot log row). Returns the result.
export async function fireShot(
  roomId: string,
  attacker: 'host' | 'guest',
  r: number,
  c: number
): Promise<FireResult> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  if (!room) throw new Error('Otaq tapılmadı.');

  const row = room as RoomRow;

  // Verify it's the attacker's turn.
  if (row.turn !== attacker) {
    throw new Error('Sizin növbəniz deyil.');
  }

  if (row.status !== 'playing') {
    throw new Error('Oyun aktiv deyil.');
  }

  const defender: 'host' | 'guest' = attacker === 'host' ? 'guest' : 'host';
  const defenderShips: ShipJson[] =
    defender === 'host' ? row.host_ships : row.guest_ships;
  const defenderShots: Record<string, 'hit' | 'miss'> =
    defender === 'host' ? row.host_shots : row.guest_shots;

  const k = `${r},${c}`;
  if (defenderShots[k]) {
    throw new Error('Bu xanaya artıq atəş açılıb.');
  }

  // Resolve the shot.
  let result: 'hit' | 'miss' | 'sunk' = 'miss';
  let sunkShip: ShipJson | undefined;

  for (const ship of defenderShips) {
    const cells = shipCellsOf(ship);
    const idx = cells.findIndex((cell) => cell.r === r && cell.c === c);
    if (idx >= 0) {
      ship.hits[idx] = true;
      defenderShots[k] = 'hit';
      const sunk = ship.hits.every(Boolean);
      result = sunk ? 'sunk' : 'hit';
      if (sunk) sunkShip = ship;
      break;
    }
  }
  if (result === 'miss') {
    defenderShots[k] = 'miss';
  }

  // Check win: all defender ships sunk.
  const allSunk = defenderShips.every((s) => s.hits.every(Boolean));
  const winner: 'host' | 'guest' | undefined = allSunk ? attacker : undefined;

  // Prepare the update.
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (defender === 'host') {
    updates.host_ships = defenderShips;
    updates.host_shots = defenderShots;
  } else {
    updates.guest_ships = defenderShips;
    updates.guest_shots = defenderShots;
  }

  if (winner) {
    updates.status = 'finished';
    updates.winner = winner;
  } else if (result === 'miss') {
    // Pass turn to the defender.
    updates.turn = defender;
  }
  // On hit/sunk, turn stays with the attacker (no update needed).

  const { error: updateError } = await supabase.from('rooms').update(updates).eq('id', roomId);
  if (updateError) throw updateError;

  // Log the shot for the real-time feed.
  const { error: shotError } = await supabase.from('shots').insert({
    room_id: roomId,
    attacker,
    row: r,
    col: c,
    result,
  });
  if (shotError) throw shotError;

  return { result, shipSunk: sunkShip, winner };
}

// Fetch shot history for a room (used to replay the board state).
export async function fetchShots(roomId: string): Promise<ShotRow[]> {
  const { data, error } = await supabase
    .from('shots')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ShotRow[];
}

// ---- Helpers ------------------------------------------------------------

function shipCellsOf(ship: ShipJson): Array<{ r: number; c: number }> {
  const cells: Array<{ r: number; c: number }> = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push({
      r: ship.orientation === 'h' ? ship.row : ship.row + i,
      c: ship.orientation === 'h' ? ship.col + i : ship.col,
    });
  }
  return cells;
}

// Leave a room (host cancels / guest disconnects). Sets status to finished.
export async function leaveRoom(roomId: string, role: 'host' | 'guest'): Promise<void> {
  const updates: Record<string, unknown> = {
    status: 'finished',
    winner: role === 'host' ? 'guest' : 'host',
    updated_at: new Date().toISOString(),
  };
  await supabase.from('rooms').update(updates).eq('id', roomId);
}

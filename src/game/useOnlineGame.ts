// useOnlineGame: subscribes to realtime room + shot updates and exposes
// a clean view model for the UI. Manages the full online game lifecycle.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, type RoomRow, type ShipJson, type ShotRow } from '@/lib/supabase';
import {
  fireShot as apiFireShot,
  submitPlacement as apiSubmitPlacement,
  fetchRoom,
  fetchShots,
  leaveRoom,
} from '@/lib/online';
import { buildCellGrid, allSunk, shipCells } from '@/game/board';
import type { Board, Ship } from '@/types';
import { sound } from '@/game/sound';

export type OnlineRole = 'host' | 'guest';

export interface OnlineView {
  room: RoomRow | null;
  role: OnlineRole;
  myShips: ShipJson[];
  oppShips: ShipJson[]; // opponent's fleet — only fully visible at gameover
  myShots: Record<string, 'hit' | 'miss'>; // shots I've fired at opponent
  oppShots: Record<string, 'hit' | 'miss'>; // shots opponent fired at me
  myBoard: Board; // my board (with ships)
  oppBoard: Board; // opponent's board (fogged until gameover)
  myCellGrid: string[][];
  oppCellGrid: string[][];
  isMyTurn: boolean;
  phase: 'waiting' | 'placing' | 'playing' | 'finished';
  winner: 'host' | 'guest' | null;
  iWon: boolean;
  shots: ShotRow[];
  lastShot: { attacker: 'host' | 'guest'; r: number; c: number; result: string } | null;
  connected: boolean;
  error: string | null;
}

interface UseOnlineGameOpts {
  roomId: string;
  role: OnlineRole;
}

export function useOnlineGame({ roomId, role }: UseOnlineGameOpts) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastShot, setLastShot] = useState<
    { attacker: 'host' | 'guest'; r: number; c: number; result: string } | null
  >(null);
  const lastShotKeyRef = useRef<string>('');

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRoom(roomId);
        if (cancelled) return;
        setRoom(r);
        const s = await fetchShots(roomId);
        if (cancelled) return;
        setShots(s);
        setConnected(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Bağlantı xətası');
      }
    })();

    // ---- Realtime: rooms ----
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new as RoomRow);
        }
      )
      .on('system', { event: 'connected' }, () => setConnected(true))
      .on('system', { event: 'disconnected' }, () => setConnected(false))
      .subscribe();

    // ---- Realtime: shots ----
    const shotChannel = supabase
      .channel(`shots:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shots', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newShot = payload.new as ShotRow;
          setShots((prev) => [...prev, newShot]);
          setLastShot({
            attacker: newShot.attacker,
            r: newShot.row,
            c: newShot.col,
            result: newShot.result,
          });
          lastShotKeyRef.current = `${newShot.row},${newShot.col},${newShot.created_at}`;
          // Play sound based on who fired and result.
          if (newShot.attacker === role) {
            if (newShot.result === 'miss') sound.play('splash');
            else if (newShot.result === 'hit') sound.play('explosion');
            else sound.play('sunk');
          } else {
            // Opponent fired at me.
            if (newShot.result === 'miss') sound.play('splash');
            else if (newShot.result === 'hit') sound.play('explosion');
            else sound.play('sunk');
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(shotChannel);
    };
  }, [roomId, role]);

  // ---- Derived view ----
  const view: OnlineView = (() => {
    const r = room;
    if (!r) {
      return {
        room: null,
        role,
        myShips: [],
        oppShips: [],
        myShots: {},
        oppShots: {},
        myBoard: { ships: [], shots: {} },
        oppBoard: { ships: [], shots: {} },
        myCellGrid: [],
        oppCellGrid: [],
        isMyTurn: false,
        phase: 'waiting',
        winner: null,
        iWon: false,
        shots,
        lastShot,
        connected,
        error,
      };
    }

    const isHost = role === 'host';
    const myShips: ShipJson[] = isHost ? r.host_ships : r.guest_ships;
    const oppShips: ShipJson[] = isHost ? r.guest_ships : r.host_ships;
    const myShots: Record<string, 'hit' | 'miss'> = isHost ? r.guest_shots : r.host_shots;
    // "my shots" = the shots the opponent has received = shots on the opponent's board.
    // If I'm host, I fire at guest's board → guest_shots are the shots on guest's board.
    const shotsIOpponentReceived: Record<string, 'hit' | 'miss'> = isHost ? r.guest_shots : r.host_shots;
    const shotsIReceived: Record<string, 'hit' | 'miss'> = isHost ? r.host_shots : r.guest_shots;

    const myBoard: Board = {
      ships: myShips as unknown as Ship[],
      shots: shotsIReceived,
    };
    const oppBoard: Board = {
      ships: oppShips as unknown as Ship[],
      shots: shotsIOpponentReceived,
    };

    const myCellGrid = buildCellGrid(myBoard, true);
    const showOppShips = r.status === 'finished';
    const oppCellGrid = buildCellGrid(oppBoard, showOppShips);

    const isMyTurn = r.turn === role && r.status === 'playing';
    const iWon = r.winner === role;

    return {
      room: r,
      role,
      myShips,
      oppShips,
      myShots: shotsIOpponentReceived,
      oppShots: shotsIReceived,
      myBoard,
      oppBoard,
      myCellGrid,
      oppCellGrid,
      isMyTurn,
      phase: r.status,
      winner: r.winner,
      iWon,
      shots,
      lastShot,
      connected,
      error,
    };
  })();

  // ---- Actions ----

  const submitPlacement = useCallback(
    async (ships: ShipJson[]) => {
      try {
        setError(null);
        await apiSubmitPlacement(roomId, role, ships);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Yerləşdirmə xətası');
      }
    },
    [roomId, role]
  );

  const fire = useCallback(
    async (r: number, c: number) => {
      if (!view.isMyTurn) return;
      try {
        setError(null);
        await apiFireShot(roomId, role, r, c);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Atəş xətası');
      }
    },
    [roomId, role, view.isMyTurn]
  );

  const leave = useCallback(async () => {
    if (room && room.status !== 'finished') {
      try {
        await leaveRoom(roomId, role);
      } catch {
        /* ignore */
      }
    }
  }, [roomId, role, room]);

  return { view, submitPlacement, fire, leave, setError };
}

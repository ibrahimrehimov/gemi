// Pure helpers for board geometry, ship validation, and shot resolution.
// No React dependencies — these are the deterministic core of the game.

import type { Board, Orientation, Ship, ShipDef } from '@/types';
import { BOARD_SIZE, FLEET, FLEET_COUNTS, TOTAL_SHIPS } from './constants';

export const key = (r: number, c: number): string => `${r},${c}`;

export const parseKey = (k: string): [number, number] => {
  const [r, c] = k.split(',').map(Number);
  return [r, c];
};

export const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

// Cells occupied by a ship (row/col for every segment).
export function shipCells(ship: Ship): Array<{ r: number; c: number }> {
  const cells: Array<{ r: number; c: number }> = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push({
      r: ship.orientation === 'h' ? ship.row : ship.row + i,
      c: ship.orientation === 'h' ? ship.col + i : ship.col,
    });
  }
  return cells;
}

// A placement is valid when every segment is in-bounds and no segment
// overlaps another ship or touches one (no diagonal/edge adjacency).
export function canPlace(ships: Ship[], candidate: Ship): boolean {
  const cells = shipCells(candidate);
  for (const { r, c } of cells) {
    if (!inBounds(r, c)) return false;
  }
  const blocked = new Set<string>();
  for (const s of ships) {
    for (const { r, c } of shipCells(s)) {
      // block the cell itself plus its 8 neighbours
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          blocked.add(key(r + dr, c + dc));
        }
      }
    }
  }
  return cells.every(({ r, c }) => !blocked.has(key(r, c)));
}

// Build an empty board.
export function emptyBoard(): Board {
  return { ships: [], shots: {} };
}

// Remaining ship classes (defId -> count still to place) for a partial fleet.
export function remainingCounts(ships: Ship[]): Record<string, number> {
  const left: Record<string, number> = { ...FLEET_COUNTS };
  for (const s of ships) left[s.defId] = (left[s.defId] ?? 0) - 1;
  return left;
}

export function fleetComplete(ships: Ship[]): boolean {
  return ships.length === TOTAL_SHIPS;
}

export function shipDef(defId: string): ShipDef {
  const def = FLEET.find((d) => d.id === defId);
  if (!def) throw new Error(`Unknown ship def: ${defId}`);
  return def;
}

// Create a Ship instance with a unique id.
let shipSeq = 0;
export function makeShip(defId: string, row: number, col: number, orientation: Orientation): Ship {
  const def = shipDef(defId);
  shipSeq += 1;
  return {
    id: `${defId}-${shipSeq}-${Math.random().toString(36).slice(2, 7)}`,
    defId,
    name: def.name,
    size: def.size,
    row,
    col,
    orientation,
    hits: new Array(def.size).fill(false),
  };
}

// Resolve a shot against a board. Returns the result plus the sunk ship (if any).
export function resolveShot(
  board: Board,
  r: number,
  c: number
): { result: 'hit' | 'miss' | 'sunk'; ship: Ship | null } {
  const k = key(r, c);
  if (board.shots[k]) return { result: board.shots[k] === 'hit' ? 'hit' : 'miss', ship: null };

  for (const ship of board.ships) {
    const idx = shipCells(ship).findIndex((cell) => cell.r === r && cell.c === c);
    if (idx >= 0) {
      ship.hits[idx] = true;
      board.shots[k] = 'hit';
      const sunk = ship.hits.every(Boolean);
      return { result: sunk ? 'sunk' : 'hit', ship: sunk ? ship : null };
    }
  }
  board.shots[k] = 'miss';
  return { result: 'miss', ship: null };
}

// Mark all cells of a sunk ship as 'sunk' in the shots map (for rendering).
export function markSunk(board: Board, ship: Ship): void {
  for (const { r, c } of shipCells(ship)) {
    board.shots[key(r, c)] = 'hit'; // keep as 'hit'; sunk styling derived from ship
  }
}

export function isShipSunk(ship: Ship): boolean {
  return ship.hits.every(Boolean);
}

// Count fully-sunk ships on a board.
export function sunkCount(board: Board): number {
  return board.ships.filter(isShipSunk).length;
}

export function allSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isShipSunk);
}

// Random helpers for fleet auto-placement.
function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

// Generate a full valid fleet placed at random.
export function randomFleet(): Ship[] {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const ships: Ship[] = [];
    let ok = true;
    for (const def of FLEET) {
      for (let n = 0; n < FLEET_COUNTS[def.id]; n++) {
        let placed = false;
        for (let tries = 0; tries < 200 && !placed; tries++) {
          const orientation: Orientation = Math.random() < 0.5 ? 'h' : 'v';
          const row = randInt(BOARD_SIZE);
          const col = randInt(BOARD_SIZE);
          const ship = makeShip(def.id, row, col, orientation);
          if (canPlace(ships, ship)) {
            ships.push(ship);
            placed = true;
          }
        }
        if (!placed) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (ok) return ships;
  }
  // Extremely unlikely fallback: keep trying with fresh sequence.
  return randomFleet();
}

// Cells that are fired upon (hit or miss) on a board.
export function firedCells(board: Board): Set<string> {
  return new Set(Object.keys(board.shots));
}

// Map every cell of a board to its visual state, from the perspective of
// `asOwner` (own board shows ships) vs an attacker (shows fog + results).
export function buildCellGrid(board: Board, asOwner: boolean): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const k = key(r, c);
      const shot = board.shots[k];
      if (shot === 'miss') {
        row.push('miss');
      } else if (shot === 'hit') {
        // 'sunk' if the hit cell belongs to a fully-sunk ship.
        const sunk = board.ships.some(
          (s) => isShipSunk(s) && shipCells(s).some((cell) => cell.r === r && cell.c === c)
        );
        row.push(sunk ? 'sunk' : 'hit');
      } else if (asOwner) {
        const hasShip = board.ships.some((s) =>
          shipCells(s).some((cell) => cell.r === r && cell.c === c)
        );
        row.push(hasShip ? 'ship' : 'empty');
      } else {
        row.push('fog');
      }
    }
    grid.push(row);
  }
  return grid;
}

// Build a quick lookup of ship id per occupied cell (used for placement drag).
export function shipIdAt(board: Board, r: number, c: number): string | null {
  for (const s of board.ships) {
    if (shipCells(s).some((cell) => cell.r === r && cell.c === c)) return s.id;
  }
  return null;
}

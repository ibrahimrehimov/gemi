// Core type definitions for the Battleship game.

// Cell states used to render a single grid cell.
// 'fog'   -> unfired cell on an opponent board (hidden from attacker)
// 'empty' -> water on own board (no ship, not yet fired upon)
// 'ship'  -> intact ship segment on own board
// 'hit'   -> ship segment struck but ship not yet fully sunk
// 'miss'  -> shot landed in water
// 'sunk'  -> segment of a fully destroyed ship
export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk' | 'fog';

export type Orientation = 'h' | 'v';

export type GameMode = 'single' | 'two';

export type PlayerId = 'p1' | 'p2';

export type GamePhase = 'menu' | 'placement' | 'transition' | 'playing' | 'gameover';

// Static definition of a ship class (e.g. "Linkor", size 4).
export interface ShipDef {
  id: string;
  name: string;
  shortName: string;
  size: number;
}

// A concrete ship placed on a board.
export interface Ship {
  id: string; // unique instance id
  defId: string;
  name: string;
  size: number;
  row: number; // top-left row (0-indexed)
  col: number; // top-left col (0-indexed)
  orientation: Orientation;
  hits: boolean[]; // per-segment hit flag (length === size)
}

// A full board: placed ships + a record of shots received.
export interface Board {
  ships: Ship[];
  shots: Record<string, 'hit' | 'miss'>; // key "r,c" -> result
}

// Internal state machine carried inside a ref (source of truth).
export interface InternalState {
  phase: GamePhase;
  mode: GameMode;
  turn: PlayerId;
  boards: { p1: Board; p2: Board };
  ai: AIState;
  placement: {
    player: PlayerId;
    ships: Ship[];
    selectedDefId: string | null;
    orientation: Orientation;
  };
  stats: { startTime: number; elapsedMs: number };
  winner: PlayerId | null;
  lastShot: { board: PlayerId; r: number; c: number; result: 'hit' | 'miss' | 'sunk' } | null;
  aiThinking: boolean;
  transition: { kind: 'placement' | 'turn'; to: PlayerId } | null;
}

// AI brain state: hunt/target mode plus unsunk hits and a prioritised queue.
export interface AIState {
  mode: 'hunt' | 'target';
  parity: 0 | 1; // checkerboard parity currently being hunted
  hits: string[]; // unsunk hit cells ("r,c")
  targetQueue: string[]; // ordered candidate cells for target mode
}

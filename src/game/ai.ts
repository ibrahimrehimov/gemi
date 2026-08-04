// AI strategy: a two-phase Hunt/Target brain.
//
// Hunt mode scans the board on a checkerboard parity (ships of size >=2
// always cover at least one parity cell, so this halves the search space).
// When a hit lands, we switch to Target mode: collect the unsunk hits,
// deduce the ship's line, and prioritise cells along that line's ends.

import type { AIState, Board } from '@/types';
import { BOARD_SIZE } from './constants';
import { inBounds, key, parseKey, shipCells, isShipSunk } from './board';

export function createAIState(): AIState {
  return { mode: 'hunt', parity: 0, hits: [], targetQueue: [] };
}

// Cells already fired upon — never pick these again.
function firedSet(board: Board): Set<string> {
  return new Set(Object.keys(board.shots));
}

// Checkerboard parity: (r + c) % 2 === ai.parity.
function isParity(r: number, c: number, parity: 0 | 1): boolean {
  return (r + c) % 2 === parity;
}

// All unsunk, unrejected hit cells on the opponent board.
function liveHits(board: Board): string[] {
  const live: string[] = [];
  for (const s of board.ships) {
    if (isShipSunk(s)) continue;
    for (const { r, c } of shipCells(s)) {
      const k = key(r, c);
      if (board.shots[k] === 'hit') live.push(k);
    }
  }
  return live;
}

// Rebuild the target queue from the current live hits.
// If two+ collinear hits exist, extend the line in both directions.
// Otherwise queue the 4 orthogonal neighbours of the single hit.
function rebuildQueue(board: Board, hits: string[]): string[] {
  const fired = firedSet(board);
  const queue: string[] = [];
  const seen = new Set<string>();

  const pushIfNew = (r: number, c: number) => {
    if (!inBounds(r, c)) return;
    const k = key(r, c);
    if (fired.has(k) || seen.has(k)) return;
    seen.add(k);
    queue.push(k);
  };

  if (hits.length === 0) return queue;

  if (hits.length === 1) {
    const [r, c] = parseKey(hits[0]);
    pushIfNew(r - 1, c);
    pushIfNew(r + 1, c);
    pushIfNew(r, c - 1);
    pushIfNew(r, c + 1);
    return queue;
  }

  // Multiple hits: determine if they share a row or a column.
  const coords = hits.map(parseKey);
  const rows = new Set(coords.map(([r]) => r));
  const cols = new Set(coords.map(([, c]) => c));

  if (rows.size === 1) {
    // horizontal line — extend to min and max col on that row.
    const r = coords[0][0];
    const sorted = coords.map(([, c]) => c).sort((a, b) => a - b);
    pushIfNew(r, sorted[0] - 1);
    pushIfNew(r, sorted[sorted.length - 1] + 1);
  } else if (cols.size === 1) {
    // vertical line — extend to min and max row on that col.
    const c = coords[0][1];
    const sorted = coords.map(([r]) => r).sort((a, b) => a - b);
    pushIfNew(sorted[0] - 1, c);
    pushIfNew(sorted[sorted.length - 1] + 1, c);
  } else {
    // hits not collinear (rare, from adjacent ships): queue neighbours of each.
    for (const [r, c] of coords) {
      pushIfNew(r - 1, c);
      pushIfNew(r + 1, c);
      pushIfNew(r, c - 1);
      pushIfNew(r, c + 1);
    }
  }
  return queue;
}

// Decide which cell the AI fires at next. Pure function over (board, state).
export function aiPick(board: Board, ai: AIState): { r: number; c: number } {
  const fired = firedSet(board);

  // Refresh live hits & target queue each call (board may have changed).
  const hits = liveHits(board);
  ai.hits = hits;

  if (hits.length > 0) {
    // Target mode.
    ai.mode = 'target';
    let queue = ai.targetQueue.filter((k) => !fired.has(k));
    if (queue.length === 0) {
      queue = rebuildQueue(board, hits);
      ai.targetQueue = queue;
    }
    if (queue.length > 0) {
      const next = queue.shift()!;
      ai.targetQueue = queue;
      const [r, c] = parseKey(next);
      return { r, c };
    }
    // Queue exhausted but still hits — fall back to rebuild once more.
    const rebuilt = rebuildQueue(board, hits);
    ai.targetQueue = rebuilt;
    if (rebuilt.length > 0) {
      const next = rebuilt.shift()!;
      ai.targetQueue = rebuilt;
      const [r, c] = parseKey(next);
      return { r, c };
    }
  }

  // Hunt mode: checkerboard parity scan.
  ai.mode = 'hunt';
  const candidates: string[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const k = key(r, c);
      if (fired.has(k)) continue;
      if (isParity(r, c, ai.parity)) candidates.push(k);
    }
  }
  // If parity exhausted, fall back to any unfired cell.
  const pool = candidates.length > 0 ? candidates : Array.from(firedSet(board).values());
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const [r, c] = parseKey(pick);
  return { r, c };
}

// After a shot resolves, update AI state. If a ship was sunk, clear hits
// belonging to that ship and reset to hunt mode for remaining (if any).
export function aiUpdate(
  board: Board,
  ai: AIState,
  result: 'hit' | 'miss' | 'sunk',
  sunkShipCells: Array<{ r: number; c: number }>
): void {
  if (result === 'sunk') {
    const sunkKeys = new Set(sunkShipCells.map(({ r, c }) => key(r, c)));
    ai.hits = ai.hits.filter((h) => !sunkKeys.has(h));
    ai.targetQueue = ai.targetQueue.filter((k) => {
      const [r, c] = parseKey(k);
      // drop cells adjacent to the sunk ship (they can't hold this ship)
      return !sunkShipCells.some((sc) => Math.abs(sc.r - r) <= 1 && Math.abs(sc.c - c) <= 1);
    });
    if (ai.hits.length === 0) {
      ai.mode = 'hunt';
      ai.targetQueue = [];
    } else {
      ai.targetQueue = rebuildQueue(board, ai.hits);
    }
  } else if (result === 'hit') {
    ai.mode = 'target';
    ai.targetQueue = rebuildQueue(board, ai.hits);
  }
}

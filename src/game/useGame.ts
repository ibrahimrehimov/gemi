// useGame: the single source of truth for the whole match.
//
// State lives in a ref (InternalState) so AI timeouts and transitions can
// mutate it without stale closures. A lightweight React state mirror is
// bumped on every meaningful change to trigger re-renders.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board, GameMode, InternalState, Orientation, PlayerId, Ship } from '@/types';
import {
  AI_INITIAL_DELAY,
  AI_STEP_DELAY,
  FLEET,
  FLEET_COUNTS,
  PLAYER_NAMES,
} from './constants';
import {
  allSunk,
  canPlace,
  emptyBoard,
  fleetComplete,
  makeShip,
  randomFleet,
  resolveShot,
  shipCells,
  sunkCount,
} from './board';
import { aiPick, aiUpdate, createAIState } from './ai';
import { sound } from './sound';

export interface GameView {
  phase: 'menu' | 'placement' | 'transition' | 'playing' | 'gameover';
  mode: GameMode;
  turn: PlayerId;
  boards: { p1: Board; p2: Board };
  placement: {
    player: PlayerId;
    ships: Ship[];
    selectedDefId: string | null;
    orientation: Orientation;
  };
  winner: PlayerId | null;
  aiThinking: boolean;
  transition: { kind: 'placement' | 'turn'; to: PlayerId } | null;
  lastShot: { board: PlayerId; r: number; c: number; result: 'hit' | 'miss' | 'sunk' } | null;
  stats: { startTime: number; elapsedMs: number };
}

function freshState(mode: GameMode): InternalState {
  return {
    phase: 'menu',
    mode,
    turn: 'p1',
    boards: { p1: emptyBoard(), p2: emptyBoard() },
    ai: createAIState(),
    placement: {
      player: 'p1',
      ships: [],
      selectedDefId: null,
      orientation: 'h',
    },
    stats: { startTime: 0, elapsedMs: 0 },
    winner: null,
    lastShot: null,
    aiThinking: false,
    transition: null,
  };
}

export function useGame() {
  const ref = useRef(freshState('single'));
  const [view, setView] = useState<GameView>(() => snapshot(ref.current));
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(() => setView(snapshot(ref.current)), []);

  // ---- Menu / setup ------------------------------------------------------

  const startGame = useCallback(
    (mode: GameMode) => {
      ref.current = freshState(mode);
      ref.current.phase = 'placement';
      // In single-player, P2 (AI) fleet is placed automatically.
      if (mode === 'single') {
        ref.current.boards.p2.ships = randomFleet();
      }
      ref.current.placement.player = 'p1';
      sync();
    },
    [sync]
  );

  const backToMenu = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    ref.current = freshState('single');
    ref.current.phase = 'menu';
    sync();
  }, [sync]);

  // ---- Placement --------------------------------------------------------

  const setSelectedShip = useCallback(
    (defId: string | null) => {
      ref.current.placement.selectedDefId = defId;
      sync();
    },
    [sync]
  );

  const rotate = useCallback(() => {
    ref.current.placement.orientation =
      ref.current.placement.orientation === 'h' ? 'v' : 'h';
    sound.play('click');
    sync();
  }, [sync]);

  const randomPlace = useCallback(() => {
    ref.current.placement.ships = randomFleet();
    sound.play('place');
    sync();
  }, [sync]);

  const clearPlacement = useCallback(() => {
    ref.current.placement.ships = [];
    sync();
  }, [sync]);

  // Try to place the currently selected ship at (row, col).
  const tryPlace = useCallback(
    (row: number, col: number): boolean => {
      const p = ref.current.placement;
      if (!p.selectedDefId) return false;
      const ship = makeShip(p.selectedDefId, row, col, p.orientation);
      if (!canPlace(p.ships, ship)) return false;
      p.ships.push(ship);
      sound.play('place');
      // auto-advance to next unplaced class if fleet not complete
      if (!fleetComplete(p.ships)) {
        p.selectedDefId = nextUnplacedDef(p.ships);
      } else {
        p.selectedDefId = null;
      }
      sync();
      return true;
    },
    [sync]
  );

  // Remove a placed ship by instance id (for drag-to-move / undo).
  const removeShip = useCallback(
    (id: string) => {
      const p = ref.current.placement;
      p.ships = p.ships.filter((s) => s.id !== id);
      sync();
    },
    [sync]
  );

  // Confirm placement for the current player; advance to next player or play.
  const confirmPlacement = useCallback(() => {
    const s = ref.current;
    const p = s.placement;
    if (!fleetComplete(p.ships)) return;

    // Commit ships to that player's board.
    s.boards[p.player].ships = p.ships.map((ship) => ({
      ...ship,
      hits: new Array(ship.size).fill(false),
    }));

    if (s.mode === 'single') {
      // AI already placed; start playing.
      s.phase = 'playing';
      s.turn = 'p1';
      s.stats.startTime = Date.now();
      s.placement.ships = [];
      sync();
      return;
    }

    // Two-player: hand off to P2 placement, or start if P2 already placed.
    if (p.player === 'p1') {
      s.transition = { kind: 'placement', to: 'p2' };
      s.phase = 'transition';
      sync();
      // After a short pause, reset placement screen for P2.
      aiTimer.current = setTimeout(() => {
        s.transition = null;
        s.phase = 'placement';
        s.placement = {
          player: 'p2',
          ships: [],
          selectedDefId: nextUnplacedDef([]),
          orientation: 'h',
        };
        sync();
      }, 1400);
    } else {
      s.phase = 'playing';
      s.turn = 'p1';
      s.stats.startTime = Date.now();
      s.placement.ships = [];
      sync();
    }
  }, [sync]);

  const skipTransition = useCallback(() => {
    const s = ref.current;
    if (s.transition?.kind === 'placement') {
      const to = s.transition.to;
      if (aiTimer.current) clearTimeout(aiTimer.current);
      s.transition = null;
      s.phase = 'placement';
      s.placement = {
        player: to,
        ships: [],
        selectedDefId: nextUnplacedDef([]),
        orientation: 'h',
      };
      sync();
    }
  }, [sync]);

  // ---- AI step (defined before fire so fire's closure captures it) -------

  // AI takes a shot, then either continues (hit) or hands back to P1 (miss).
  const aiStep = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'playing' || s.mode !== 'single' || s.turn !== 'p2') return;
    const board = s.boards.p1;
    const { r, c } = aiPick(board, s.ai);
    const k = `${r},${c}`;
    if (board.shots[k]) {
      // shouldn't happen, but guard: try again next tick
      aiTimer.current = setTimeout(() => aiStep(), 60);
      return;
    }
    const { result, ship } = resolveShot(board, r, c);
    s.lastShot = { board: 'p1', r, c, result };
    aiUpdate(board, s.ai, result, ship ? shipCells(ship) : []);

    if (result === 'miss') sound.play('splash');
    else if (result === 'hit') sound.play('explosion');
    else sound.play('sunk');

    if (allSunk(board)) {
      s.phase = 'gameover';
      s.winner = 'p2';
      s.stats.elapsedMs = Date.now() - s.stats.startTime;
      s.aiThinking = false;
      sound.play('lose');
      sync();
      return;
    }

    if (result === 'miss') {
      s.turn = 'p1';
      s.aiThinking = false;
      sync();
    } else {
      // hit/sunk: AI keeps firing.
      sync();
      aiTimer.current = setTimeout(() => aiStep(), AI_STEP_DELAY);
    }
  }, [sync]);

  // ---- Firing -----------------------------------------------------------

  const fire = useCallback(
    (attacker: PlayerId, r: number, c: number) => {
      const s = ref.current;
      if (s.phase !== 'playing' || s.turn !== attacker) return;
      const defender: PlayerId = attacker === 'p1' ? 'p2' : 'p1';
      const board = s.boards[defender];
      const k = `${r},${c}`;
      if (board.shots[k]) return; // already fired here

      const { result, ship } = resolveShot(board, r, c);
      s.lastShot = { board: defender, r, c, result };

      if (result === 'miss') {
        sound.play('splash');
      } else if (result === 'hit') {
        sound.play('explosion');
      } else {
        sound.play('sunk');
      }

      // AI brain update (only relevant in single-player).
      if (s.mode === 'single' && attacker === 'p1') {
        aiUpdate(
          board,
          s.ai,
          result,
          ship ? shipCells(ship) : []
        );
      }

      // Win check.
      if (allSunk(board)) {
        s.phase = 'gameover';
        s.winner = attacker;
        s.stats.elapsedMs = Date.now() - s.stats.startTime;
        if (attacker === 'p1') sound.play('win');
        else sound.play('lose');
        sync();
        return;
      }

      // Turn passing: hit/sunk -> same player again; miss -> switch.
      if (result === 'miss') {
        s.turn = defender;
        if (s.mode === 'single' && defender === 'p2') {
          // AI's turn: schedule thinking + shot.
          s.aiThinking = true;
          sync();
          aiTimer.current = setTimeout(() => aiStep(), AI_INITIAL_DELAY);
        } else if (s.mode === 'two') {
          // Pass-the-device transition.
          s.transition = { kind: 'turn', to: defender };
          s.phase = 'transition';
          sync();
        } else {
          sync();
        }
      } else {
        sync();
        // In single-player, if AI just hit and it's still AI's turn, keep going.
        if (s.mode === 'single' && s.turn === 'p2') {
          s.aiThinking = true;
          sync();
          aiTimer.current = setTimeout(() => aiStep(), AI_STEP_DELAY);
        }
      }
    },
    [sync]
  );

  // Two-player: dismiss the pass-the-device screen.
  const resumeTurn = useCallback(() => {
    const s = ref.current;
    if (s.transition?.kind === 'turn') {
      s.transition = null;
      s.phase = 'playing';
      sync();
    }
  }, [sync]);

  const restart = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    const mode = ref.current.mode;
    ref.current = freshState(mode);
    ref.current.phase = 'placement';
    if (mode === 'single') ref.current.boards.p2.ships = randomFleet();
    sync();
  }, [sync]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (aiTimer.current) clearTimeout(aiTimer.current);
    };
  }, []);

  return {
    view,
    startGame,
    backToMenu,
    setSelectedShip,
    rotate,
    randomPlace,
    clearPlacement,
    tryPlace,
    removeShip,
    confirmPlacement,
    skipTransition,
    fire,
    resumeTurn,
    restart,
  };
}

// ---- helpers -------------------------------------------------------------

function snapshot(s: InternalState): GameView {
  return {
    phase: s.phase,
    mode: s.mode,
    turn: s.turn,
    boards: {
      p1: cloneBoard(s.boards.p1),
      p2: cloneBoard(s.boards.p2),
    },
    placement: {
      player: s.placement.player,
      ships: s.placement.ships.map((ship) => ({ ...ship, hits: [...ship.hits] })),
      selectedDefId: s.placement.selectedDefId,
      orientation: s.placement.orientation,
    },
    winner: s.winner,
    aiThinking: s.aiThinking,
    transition: s.transition,
    lastShot: s.lastShot,
    stats: { ...s.stats },
  };
}

function cloneBoard(b: Board): Board {
  return { ships: b.ships.map((s) => ({ ...s, hits: [...s.hits] })), shots: { ...b.shots } };
}

// Pick the next ship class that still has unplaced units.
function nextUnplacedDef(ships: Ship[]): string | null {
  const left: Record<string, number> = { ...FLEET_COUNTS };
  for (const s of ships) left[s.defId] = (left[s.defId] ?? 0) - 1;
  for (const def of FLEET) {
    if ((left[def.id] ?? 0) > 0) return def.id;
  }
  return null;
}

// Exported for UI stat readouts.
export function boardStats(board: Board) {
  const shots = Object.keys(board.shots).length;
  const hits = Object.values(board.shots).filter((v) => v === 'hit').length;
  return { shots, hits, sunk: sunkCount(board) };
}

export { PLAYER_NAMES };

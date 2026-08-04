import type { PlayerId, ShipDef } from '@/types';

// Board dimensions.
export const BOARD_SIZE = 10;

// Column / row labels shown around the grid (columns A-J, rows 1-10).
export const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const ROW_LABELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Ship classes. The fleet is: 1x4, 2x3, 3x2, 4x1 (20 cells total).
export const FLEET: ShipDef[] = [
  { id: 'linkor', name: 'Linkor', shortName: 'LN', size: 4 },
  { id: 'kreyser', name: 'Kreyser', shortName: 'KR', size: 3 },
  { id: 'esmines', name: 'Esmines', shortName: 'ES', size: 2 },
  { id: 'kater', name: 'Kater', shortName: 'KT', size: 1 },
];

// How many of each ship class make up a full fleet.
export const FLEET_COUNTS: Record<string, number> = {
  linkor: 1,
  kreyser: 2,
  esmines: 3,
  kater: 4,
};

// Total ship count (10) used to check placement completion.
export const TOTAL_SHIPS = Object.values(FLEET_COUNTS).reduce((a, b) => a + b, 0);

// Timing for the AI "thinking" steps (ms).
export const AI_STEP_DELAY = 850;
export const AI_INITIAL_DELAY = 700;

// Player display names.
export const PLAYER_NAMES: Record<PlayerId, string> = {
  p1: 'Oyunçu 1',
  p2: 'Oyunçu 2',
};

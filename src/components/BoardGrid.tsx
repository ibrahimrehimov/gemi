// The 10x10 grid with A-J / 1-10 axis labels and optional hover preview
// for ship placement. Handles clicks, hover, and rendering per-cell effects.

import { memo, useMemo, useState } from 'react';
import { BOARD_SIZE, COL_LABELS, ROW_LABELS } from '@/game/constants';
import { shipCells, canPlace } from '@/game/board';
import type { Board, Orientation, Ship } from '@/types';
import { Cell } from './Cell';

interface BoardGridProps {
  board: Board;
  asOwner: boolean; // true = show ships (own board), false = show fog (attack)
  cellStates: string[][];
  onCellClick?: (r: number, c: number) => void;
  disabled?: boolean;
  // placement preview
  previewShip?: Ship | null;
  placedShips?: Ship[];
  // which shot is "fresh" so its effect animates
  freshShot?: { r: number; c: number; result: string; tick: number } | null;
  title?: string;
  highlightLast?: boolean;
  sunkShipCells?: Set<string>;
}

function BoardGridComp({
  board,
  asOwner,
  cellStates,
  onCellClick,
  disabled,
  previewShip,
  placedShips,
  freshShot,
  title,
  highlightLast,
  sunkShipCells,
}: BoardGridProps) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  // Cells covered by the placement preview + validity.
  const previewSet = useMemo(() => {
    if (!previewShip || !placedShips) return { cells: new Set<string>(), valid: false };
    const cells = new Set(shipCells(previewShip).map(({ r, c }) => `${r},${c}`));
    const valid = canPlace(placedShips, previewShip);
    return { cells, valid };
  }, [previewShip, placedShips]);

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 select-none">
      {title && (
        <div className="text-center text-xs sm:text-sm font-display font-semibold tracking-wider text-cyan-200/80 mb-0.5">
          {title}
        </div>
      )}
      <div className="flex gap-1 sm:gap-1.5">
        {/* top-left corner spacer */}
        <div className="w-4 sm:w-5" />
        {/* column labels */}
        <div className="grid grid-cols-10 gap-0.5 sm:gap-1 flex-1">
          {COL_LABELS.map((col) => (
            <Cell
              key={`col-${col}`}
              r={-1}
              c={-1}
              state="fog"
              isLabel
              label={col}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-1 sm:gap-1.5">
        {/* row labels */}
        <div className="flex flex-col gap-0.5 sm:gap-1 w-4 sm:w-5">
          {ROW_LABELS.map((row) => (
            <div
              key={`row-${row}`}
              className="flex items-center justify-center text-[10px] sm:text-xs font-display font-semibold text-cyan-200/60"
              style={{ aspectRatio: '1 / 1' }}
            >
              {row}
            </div>
          ))}
        </div>

        {/* the actual grid */}
        <div className="grid grid-cols-10 gap-0.5 sm:gap-1 flex-1 p-1 sm:p-1.5 rounded-lg glass">
          {cellStates.map((rowArr, r) =>
            rowArr.map((state, c) => {
              const k = `${r},${c}`;
              const isFresh = freshShot && freshShot.r === r && freshShot.c === c;
              const effect =
                isFresh && freshShot!.result === 'miss'
                  ? 'splash'
                  : isFresh && (freshShot!.result === 'hit' || freshShot!.result === 'sunk')
                    ? 'boom'
                    : null;
              const effectKey = isFresh ? `${k}-${freshShot!.tick}` : undefined;

              let placeState: 'valid' | 'invalid' | null = null;
              if (previewSet.cells.has(k)) {
                placeState = previewSet.valid ? 'valid' : 'invalid';
              }

              return (
                <Cell
                  key={k}
                  r={r}
                  c={c}
                  state={state}
                  onClick={
                    onCellClick
                      ? () => {
                          if (previewShip) {
                            // placement handled by parent via preview commit on click
                            onCellClick(r, c);
                          } else {
                            onCellClick(r, c);
                          }
                        }
                      : undefined
                  }
                  onHover={(hr, hc) => setHover({ r: hr, c: hc })}
                  onLeave={() => setHover(null)}
                  disabled={disabled}
                  effect={effect}
                  effectKey={effectKey}
                  placeState={placeState}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export const BoardGrid = memo(BoardGridComp);

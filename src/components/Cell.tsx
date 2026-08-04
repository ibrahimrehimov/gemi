// A single animated cell. Renders the right background class plus any
// transient effect (splash ring, explosion flash, shell streak) for the
// most recent shot that landed here.

import { memo } from 'react';
import type { CellState } from '@/types';

interface CellProps {
  r: number;
  c: number;
  state: CellState | string;
  label?: string;
  isLabel?: boolean;
  // transient effect keyed to a shot id/tick so it replays on each new shot
  effect?: 'splash' | 'boom' | null;
  effectKey?: string;
  onClick?: () => void;
  onHover?: (r: number, c: number) => void;
  onLeave?: () => void;
  disabled?: boolean;
  placeState?: 'valid' | 'invalid' | null;
}

function CellComp({
  r,
  c,
  state,
  label,
  isLabel,
  effect,
  effectKey,
  onClick,
  onHover,
  onLeave,
  disabled,
  placeState,
}: CellProps) {
  if (isLabel) {
    return (
      <div className="flex items-center justify-center text-[10px] sm:text-xs font-display font-semibold text-cyan-200/60 no-select">
        {label}
      </div>
    );
  }

  const base = `cell no-select ${cellClass(state)}`;
  const placeClass =
    placeState === 'valid'
      ? 'cell-place-valid'
      : placeState === 'invalid'
        ? 'cell-place-invalid'
        : '';
  const clickable = !disabled && (state === 'fog' || state === 'empty');

  return (
    <div
      className={`relative ${base} ${placeClass} ${clickable ? 'cursor-pointer' : 'cursor-default'} rounded-[3px] sm:rounded-md`}
      style={{ aspectRatio: '1 / 1' }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={onHover ? () => onHover(r, c) : undefined}
      onMouseLeave={onLeave}
    >
      {/* Sunk segment gets a subtle cross/skull mark */}
      {state === 'sunk' && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-sm font-bold text-red-300/80 no-select">
          ✕
        </span>
      )}
      {/* Ship indicator dot for own board 1-cell ships */}
      {state === 'ship' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-200/40" />
        </span>
      )}

      {/* Transient shot effects */}
      {effect === 'splash' && (
        <span key={effectKey} className="splash-ring" />
      )}
      {effect === 'boom' && (
        <>
          <span key={effectKey} className="boom-flash" />
          <span key={`streak-${effectKey}`} className="shell-streak" />
        </>
      )}
    </div>
  );
}

function cellClass(state: CellState | string): string {
  switch (state) {
    case 'fog':
      return 'cell-fog';
    case 'empty':
      return 'cell-empty';
    case 'ship':
      return 'cell-ship';
    case 'hit':
      return 'cell-hit';
    case 'sunk':
      return 'cell-sunk';
    case 'miss':
      return 'cell-miss';
    default:
      return 'cell-fog';
  }
}

export const Cell = memo(CellComp);

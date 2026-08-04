// Ship placement screen: pick a ship class, click to place, rotate,
// random, clear, and confirm. Includes a live preview that follows the
// cursor and shows valid/invalid cells.

import { useMemo, useState } from 'react';
import { RotateCw, Shuffle, Trash2, Check, ArrowLeft, Ship as ShipIcon } from 'lucide-react';
import type { Orientation, PlayerId, Ship } from '@/types';
import { FLEET, FLEET_COUNTS } from '@/game/constants';
import { buildCellGrid, canPlace, makeShip, shipCells } from '@/game/board';
import { BoardGrid } from './BoardGrid';
import { NeonButton, IconButton, StatBadge } from './ui';
import { sound } from '@/game/sound';
import { PLAYER_NAMES } from '@/game/constants';

interface PlacementProps {
  player: PlayerId;
  ships: Ship[];
  selectedDefId: string | null;
  orientation: Orientation;
  onSelect: (defId: string | null) => void;
  onRotate: () => void;
  onRandom: () => void;
  onClear: () => void;
  onTryPlace: (r: number, c: number) => boolean;
  onRemove: (id: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function Placement({
  player,
  ships,
  selectedDefId,
  orientation,
  onSelect,
  onRotate,
  onRandom,
  onClear,
  onTryPlace,
  onRemove,
  onConfirm,
  onBack,
}: PlacementProps) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const cellGrid = useMemo(() => {
    // render the partial fleet on the board as if it were owned.
    const board = { ships, shots: {} };
    return buildCellGrid(board, true);
  }, [ships]);

  const remaining = useMemo(() => {
    const left: Record<string, number> = { ...FLEET_COUNTS };
    for (const s of ships) left[s.defId] = (left[s.defId] ?? 0) - 1;
    return left;
  }, [ships]);

  const allPlaced = ships.length === Object.values(FLEET_COUNTS).reduce((a, b) => a + b, 0);

  // Preview ship at hover position.
  const previewShip: Ship | null = useMemo(() => {
    if (!selectedDefId || !hover) return null;
    return makeShip(selectedDefId, hover.r, hover.c, orientation);
  }, [selectedDefId, hover, orientation]);

  const previewValid = previewShip ? canPlace(ships, previewShip) : false;

  const handleCellClick = (r: number, c: number) => {
    // If a ship already occupies this cell, remove it (lets you move ships).
    const existing = ships.find((s) =>
      shipCells(s).some((cell) => cell.r === r && cell.c === c)
    );
    if (existing) {
      onRemove(existing.id);
      onSelect(existing.defId);
      return;
    }
    if (selectedDefId) {
      const ok = onTryPlace(r, c);
      if (ok && !allPlaced) {
        // keep same class if more remain
      }
    }
  };

  return (
    <div className="min-h-screen ocean-bg p-4 sm:p-6 fade-in">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <IconButton onClick={onBack} title="Menyuya">
              <ArrowLeft size={18} />
            </IconButton>
            <div>
              <h1 className="font-display font-bold text-xl sm:text-2xl text-white">
                Gəmiləri Yerləşdir
              </h1>
              <p className="text-xs sm:text-sm text-cyan-200/60 font-display tracking-wide">
                {PLAYER_NAMES[player]} · {ships.length}/{Object.values(FLEET_COUNTS).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>
          <NeonButton variant="ghost" size="sm" icon={<RotateCw size={16} />} onClick={onRotate}>
            Fırlat ({orientation === 'h' ? 'Üfüqi' : 'Şaquli'})
          </NeonButton>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* board */}
          <div className="glass-strong rounded-2xl p-4 sm:p-6 flex justify-center fade-up">
            <div className="w-full max-w-[520px]">
              <BoardGrid
                board={{ ships, shots: {} }}
                asOwner
                cellStates={cellGrid}
                onCellClick={handleCellClick}
                previewShip={previewShip}
                placedShips={ships}
              />
              <p className="text-center text-xs text-slate-400 mt-3">
                {selectedDefId
                  ? 'Xanaya kliklə yerləşdir · Gəmiyə kliklə sil'
                  : 'Sağdan gəmi seç və ya təsadüfi yerləşdir'}
              </p>
            </div>
          </div>

          {/* ship picker + actions */}
          <div className="glass-strong rounded-2xl p-4 sm:p-5 fade-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-display font-semibold text-cyan-200 text-sm uppercase tracking-wider mb-3">
              Gəmi Seç
            </h3>
            <div className="space-y-2 mb-5">
              {FLEET.map((def) => {
                const left = remaining[def.id] ?? 0;
                const total = FLEET_COUNTS[def.id];
                const isSelected = selectedDefId === def.id;
                const done = left === 0;
                return (
                  <button
                    key={def.id}
                    disabled={done}
                    onClick={() => {
                      sound.play('click');
                      onSelect(isSelected ? null : def.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                      done
                        ? 'opacity-40 border-white/5 bg-white/5 cursor-not-allowed'
                        : isSelected
                          ? 'border-cyan-300/60 bg-cyan-500/15 shadow-[0_0_16px_rgba(56,225,255,0.25)]'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-300/30'
                    }`}
                  >
                    <ShipIcon size={18} className={isSelected ? 'text-cyan-300' : 'text-slate-300'} />
                    <div className="flex-1 text-left">
                      <div className="font-display text-sm text-white">{def.name}</div>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: def.size }).map((_, i) => (
                          <span
                            key={i}
                            className="h-2 rounded-sm bg-gradient-to-r from-slate-400 to-slate-500"
                            style={{ width: `${100 / def.size}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className={`text-xs font-display ${done ? 'text-emerald-400' : 'text-cyan-300'}`}>
                      {done ? '✓' : `${left}/${total}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <NeonButton variant="ghost" size="sm" icon={<Shuffle size={16} />} onClick={onRandom}>
                Təsadüfi
              </NeonButton>
              <NeonButton variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={onClear}>
                Təmizlə
              </NeonButton>
            </div>

            <NeonButton
              variant={allPlaced ? 'accent' : 'ghost'}
              size="lg"
              className="w-full"
              icon={<Check size={20} />}
              onClick={onConfirm}
              disabled={!allPlaced}
            >
              {allPlaced ? 'Hazırdır!' : `${Object.values(FLEET_COUNTS).reduce((a, b) => a + b, 0) - ships.length} gəmi qalıb`}
            </NeonButton>

            {/* mini stat */}
            <div className="mt-4 flex gap-2">
              <StatBadge
                label="Yerləşdi"
                value={ships.length}
                icon={<ShipIcon size={16} />}
                accent="cyan"
              />
              <StatBadge
                label="Qalıb"
                value={Object.values(FLEET_COUNTS).reduce((a, b) => a + b, 0) - ships.length}
                accent="amber"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

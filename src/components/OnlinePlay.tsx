// OnlinePlay: orchestrates the online game flow. Wraps placement (using
// the existing Placement UI but submitting to the server) and the real-time
// battle screen. Also handles the "waiting for opponent to place" state.

import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  RotateCcw,
  Crosshair,
  Ship as ShipIcon,
  Timer,
  Trophy,
  Skull,
  Loader2,
  Target,
  Globe,
  WifiOff,
  LogOut,
} from 'lucide-react';
import type { RoomRow, ShipJson } from '@/lib/supabase';
import { useOnlineGame } from '@/game/useOnlineGame';
import { PLAYER_NAMES } from '@/game/constants';
import { BoardGrid } from './BoardGrid';
import { NeonButton, IconButton, StatBadge } from './ui';
import { sound } from '@/game/sound';
import { Placement } from './Placement';
import { randomFleet, canPlace, makeShip, fleetComplete } from '@/game/board';
import { FLEET_COUNTS } from '@/game/constants';
import type { Orientation } from '@/types';
import type { Ship as ShipType } from '@/types';

interface OnlinePlayProps {
  room: RoomRow;
  role: 'host' | 'guest';
  onExit: () => void;
}

function formatTime(startIso: string | null): string {
  if (!startIso) return '0:00';
  const total = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  if (total < 0) return '0:00';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function OnlinePlay({ room, role, onExit }: OnlinePlayProps) {
  const { view, submitPlacement, fire, leave } = useOnlineGame({ roomId: room.id, role });
  const [placementShips, setPlacementShips] = useState<ShipType[]>([]);
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('h');
  const [, setTick] = useState(0);

  // Force periodic re-render for the timer.
  useEffect(() => {
    if (view.phase !== 'playing') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [view.phase]);

  const myName = role === 'host' ? view.room?.host_name : view.room?.guest_name;
  const oppName = role === 'host' ? view.room?.guest_name : view.room?.host_name;

  // ---- Placement phase ----
  if (view.phase === 'placing' || view.phase === 'waiting') {
    const iAmReady = role === 'host' ? view.room?.host_ready : view.room?.guest_ready;

    // If already submitted, show waiting screen.
    if (iAmReady) {
      return (
        <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
          <div className="glass-strong rounded-2xl p-8 max-w-md w-full text-center pop-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 mb-4">
              <Target size={32} />
            </div>
            <h2 className="font-display font-bold text-xl text-white mb-2">Rəqib Gözlənilir</h2>
            <p className="text-sm text-slate-300/70 mb-1">
              Siz gəmilərinizi yerləşdirdiniz.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              {oppName || 'Rəqib'} hələ yerləşdirir...
            </p>
            <div className="flex items-center justify-center gap-2 text-cyan-200/60 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Gözləyir...
            </div>
          </div>
        </div>
      );
    }

    // Show placement screen (reuse the existing UI).
    return (
      <Placement
        player={role === 'host' ? 'p1' : 'p2'}
        ships={placementShips}
        selectedDefId={selectedDefId}
        orientation={orientation}
        onSelect={setSelectedDefId}
        onRotate={() => {
          setOrientation((o) => (o === 'h' ? 'v' : 'h'));
          sound.play('click');
        }}
        onRandom={() => {
          setPlacementShips(randomFleet());
          sound.play('place');
        }}
        onClear={() => setPlacementShips([])}
        onTryPlace={(r, c) => {
          if (!selectedDefId) return false;
          const ship = makeShip(selectedDefId, r, c, orientation);
          if (!canPlace(placementShips, ship)) return false;
          setPlacementShips((prev) => [...prev, ship]);
          sound.play('place');
          if (!fleetComplete([...placementShips, ship])) {
            const left: Record<string, number> = { ...FLEET_COUNTS };
            for (const s of [...placementShips, ship]) left[s.defId] = (left[s.defId] ?? 0) - 1;
            const next = Object.keys(left).find((id) => (left[id] ?? 0) > 0);
            setSelectedDefId(next ?? null);
          } else {
            setSelectedDefId(null);
          }
          return true;
        }}
        onRemove={(id) => setPlacementShips((prev) => prev.filter((s) => s.id !== id))}
        onConfirm={() => {
          const shipsJson: ShipJson[] = placementShips.map((s) => ({
            id: s.id,
            defId: s.defId,
            name: s.name,
            size: s.size,
            row: s.row,
            col: s.col,
            orientation: s.orientation,
            hits: [...s.hits],
          }));
          submitPlacement(shipsJson);
        }}
        onBack={onExit}
      />
    );
  }

  // ---- Game over ----
  if (view.phase === 'finished') {
    return (
      <OnlineGameOver
        won={view.iWon}
        myName={myName || 'Oyunçu'}
        shots={Object.keys(view.myShots).length}
        sunk={view.oppShips.filter((s) => s.hits.every(Boolean)).length}
        onRestart={onExit}
        onMenu={onExit}
      />
    );
  }

  // ---- Playing ----
  const freshShot = view.lastShot
    ? {
        r: view.lastShot.r,
        c: view.lastShot.c,
        result: view.lastShot.result,
        tick: view.shots.length,
      }
    : null;

  const myShotCount = Object.keys(view.myShots).length;
  const mySunkCount = view.oppShips.filter((s) => s.hits.every(Boolean)).length;

  return (
    <div className="min-h-screen ocean-bg p-3 sm:p-5 fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <IconButton onClick={onExit} title="Çıxış">
              <Home size={18} />
            </IconButton>
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl text-white">Online Döyüş</h1>
              <p className="text-xs text-cyan-200/60 font-display tracking-wide flex items-center gap-1">
                <Globe size={11} /> {view.room?.code}
              </p>
            </div>
          </div>

          {/* Turn indicator */}
          <div className="flex items-center gap-2 glass rounded-xl px-4 py-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                view.isMyTurn ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-display text-sm text-white">
              {view.isMyTurn ? 'Sizin növbəniz!' : `${oppName || 'Rəqib'} düşünür...`}
            </span>
          </div>

          <IconButton onClick={() => { leave(); onExit(); }} title="Otağı Tərk Et">
            <LogOut size={18} />
          </IconButton>
        </div>

        {/* Connection warning */}
        {!view.connected && (
          <div className="mb-3 flex items-center justify-center gap-2 text-amber-300/80 text-sm bg-amber-500/10 border border-amber-400/20 rounded-xl py-2">
            <WifiOff size={16} /> Bağlantı kəsilib, yenidən qoşulur...
          </div>
        )}

        {view.error && (
          <div className="mb-3 text-center text-rose-400 text-sm bg-rose-500/10 border border-rose-400/20 rounded-xl py-2">
            {view.error}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          <StatBadge label="Atəş" value={myShotCount} icon={<Crosshair size={16} />} accent="cyan" />
          <StatBadge label="Batılan" value={mySunkCount} icon={<ShipIcon size={16} />} accent="rose" />
          <StatBadge
            label="Vaxt"
            value={formatTime(view.room?.updated_at ?? null)}
            icon={<Timer size={16} />}
            accent="amber"
          />
        </div>

        {/* Boards */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* My fleet */}
          <div className="glass-strong rounded-2xl p-3 sm:p-5 fade-up">
            <BoardGrid
              board={view.myBoard}
              asOwner
              cellStates={view.myCellGrid}
              title={`${myName || 'Mən'} · Donanma`}
              freshShot={
                view.lastShot && view.lastShot.attacker !== role
                  ? freshShot
                  : null
              }
              disabled
            />
          </div>

          {/* Attack target */}
          <div className="glass-strong rounded-2xl p-3 sm:p-5 fade-up" style={{ animationDelay: '0.08s' }}>
            <BoardGrid
              board={view.oppBoard}
              asOwner={false}
              cellStates={view.oppCellGrid}
              title={`${oppName || 'Rəqib'} · Hədəf`}
              onCellClick={(r, c) => view.isMyTurn && fire(r, c)}
              disabled={!view.isMyTurn}
              freshShot={
                view.lastShot && view.lastShot.attacker === role
                  ? freshShot
                  : null
              }
            />
            {!view.isMyTurn && (
              <div className="mt-3 flex items-center justify-center gap-2 text-amber-300/80 text-sm font-display">
                <Loader2 size={16} className="animate-spin" />
                Rəqibin növbəsi...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OnlineGameOver({
  won,
  myName,
  shots,
  sunk,
  onRestart,
  onMenu,
}: {
  won: boolean;
  myName: string;
  shots: number;
  sunk: number;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
      <div className="glass-strong rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center pop-in">
        <div
          className={`w-24 h-24 mx-auto rounded-2xl flex items-center justify-center mb-6 ${
            won ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}
        >
          {won ? <Trophy size={48} /> : <Skull size={48} />}
        </div>
        <h1
          className={`font-display font-black text-4xl sm:text-5xl mb-2 ${
            won ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {won ? 'QƏLƏBƏ!' : 'MƏĞLUBİYYƏT'}
        </h1>
        <p className="text-cyan-100/70 mb-6 font-display tracking-wide">
          {won ? `${myName}, rəqib donanmasını batırdı!` : 'Rəqib sizin donanmanı batırdı'}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-7">
          <StatBadge label="Atəş" value={shots} icon={<Crosshair size={16} />} accent="cyan" />
          <StatBadge label="Batılan" value={sunk} icon={<ShipIcon size={16} />} accent="rose" />
        </div>
        <div className="flex gap-3 justify-center">
          <NeonButton variant="accent" size="lg" icon={<RotateCcw size={20} />} onClick={onRestart}>
            Yeni Oyun
          </NeonButton>
          <NeonButton variant="ghost" size="lg" icon={<Home size={20} />} onClick={onMenu}>
            Menyu
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

// Main battle screen: two boards side by side, stats HUD, AI thinking
// indicator, and the pass-the-device transition overlay.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair,
  Ship,
  Target,
  Timer,
  Loader2,
  RotateCcw,
  Home,
  Trophy,
  Skull,
} from 'lucide-react';
import type { GameView } from '@/game/useGame';
import { boardStats } from '@/game/useGame';
import { buildCellGrid } from '@/game/board';
import { PLAYER_NAMES } from '@/game/constants';
import { BoardGrid } from './BoardGrid';
import { NeonButton, IconButton, StatBadge } from './ui';
import { sound } from '@/game/sound';

interface BattleProps {
  view: GameView;
  onFire: (attacker: 'p1' | 'p2', r: number, c: number) => void;
  onRestart: () => void;
  onMenu: () => void;
  onResumeTurn: () => void;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Battle({ view, onFire, onRestart, onMenu, onResumeTurn }: BattleProps) {
  const isSingle = view.mode === 'single';
  const attacker = view.turn;

  // In single-player: P1 attacks P2's board (right), P2 (AI) attacks P1's (left).
  // In two-player: the current attacker attacks the other's board.
  const defender: 'p1' | 'p2' = attacker === 'p1' ? 'p2' : 'p1';

  // Single-player: left = P1 own fleet, right = AI fogged target (always).
  // Two-player: left = current attacker's own fleet, right = defender fogged.
  const ownPlayer: 'p1' | 'p2' = isSingle ? 'p1' : attacker;
  const ownGrid = useMemo(
    () => buildCellGrid(view.boards[ownPlayer], true),
    [view.boards, ownPlayer]
  );
  const attackGrid = useMemo(
    () => buildCellGrid(view.boards[defender], false),
    [view.boards, defender]
  );

  const p1Stats = useMemo(() => boardStats(view.boards.p2), [view.boards.p2]); // P1's shots land on P2
  const p2Stats = useMemo(() => boardStats(view.boards.p1), [view.boards.p1]); // P2's shots land on P1

  // fresh shot effect: use a tick counter from the lastShot reference.
  const tickRef = useRef(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (view.lastShot) {
      tickRef.current += 1;
      setTick(tickRef.current);
    }
  }, [view.lastShot]);

  const freshShot = view.lastShot
    ? { r: view.lastShot.r, c: view.lastShot.c, result: view.lastShot.result, tick }
    : null;

  const canFire = view.phase === 'playing' && !view.aiThinking && (!isSingle || attacker === 'p1');

  // ---- Game over screen ----
  if (view.phase === 'gameover') {
    const won = view.winner === 'p1';
    const isPlayerWin = isSingle ? won : true; // two-player: whoever won, show their name
    return (
      <GameOverScreen
        won={isPlayerWin}
        winnerName={PLAYER_NAMES[view.winner!]}
        shots={isSingle ? p1Stats.shots : (view.winner === 'p1' ? p1Stats.shots : p2Stats.shots)}
        sunk={isSingle ? p1Stats.sunk : (view.winner === 'p1' ? p1Stats.sunk : p2Stats.sunk)}
        time={formatTime(view.stats.elapsedMs)}
        onRestart={onRestart}
        onMenu={onMenu}
      />
    );
  }

  // ---- Pass-the-device transition (two-player) ----
  if (view.phase === 'transition' && view.transition?.kind === 'turn') {
    return (
      <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
        <div className="glass-strong rounded-2xl p-8 sm:p-10 max-w-md w-full text-center pop-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 mb-4">
            <Target size={32} />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">Növbəti Oyunçu</h2>
          <p className="text-cyan-200/70 mb-1">{PLAYER_NAMES[view.transition.to]} növbəsi</p>
          <p className="text-sm text-slate-400 mb-6">Cihazı ötürün və hazırsanız davam edin</p>
          <NeonButton size="lg" onClick={onResumeTurn}>
            Hazıram
          </NeonButton>
        </div>
      </div>
    );
  }

  // ---- Active battle ----
  return (
    <div className="min-h-screen ocean-bg p-3 sm:p-5 fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <IconButton onClick={onMenu} title="Menyu">
              <Home size={18} />
            </IconButton>
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl text-white">Döyüş</h1>
              <p className="text-xs text-cyan-200/60 font-display tracking-wide">
                {isSingle ? 'Tək Oyunçu' : 'İki Oyunçu'}
              </p>
            </div>
          </div>

          {/* turn indicator */}
          <div className="flex items-center gap-2 glass rounded-xl px-4 py-2">
            <span className={`w-2.5 h-2.5 rounded-full ${view.aiThinking ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'}`} />
            <span className="font-display text-sm text-white">
              {view.aiThinking
                ? 'AI düşünür'
                : `${PLAYER_NAMES[attacker]} növbəsi`}
            </span>
            {view.aiThinking && (
              <span className="flex gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 thinking-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 thinking-dot" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 thinking-dot" style={{ animationDelay: '0.4s' }} />
              </span>
            )}
          </div>

          <IconButton onClick={onRestart} title="Yenidən">
            <RotateCcw size={18} />
          </IconButton>
        </div>

        {/* Stats HUD */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          <StatBadge label="Atəş" value={isSingle ? p1Stats.shots : (attacker === 'p1' ? p1Stats.shots : p2Stats.shots)} icon={<Crosshair size={16} />} accent="cyan" />
          <StatBadge label="Vurulan" value={isSingle ? p1Stats.sunk : (attacker === 'p1' ? p1Stats.sunk : p2Stats.sunk)} icon={<Ship size={16} />} accent="rose" />
          <StatBadge label="Vaxt" value={formatTime(view.stats.elapsedMs || (view.stats.startTime ? Date.now() - view.stats.startTime : 0))} icon={<Timer size={16} />} accent="amber" />
        </div>

        {/* Boards */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left: own fleet */}
          <div className="glass-strong rounded-2xl p-3 sm:p-5 fade-up">
            <BoardGrid
              board={view.boards[ownPlayer]}
              asOwner
              cellStates={ownGrid}
              title={`${PLAYER_NAMES[ownPlayer]} · Donanma`}
              freshShot={view.lastShot?.board === ownPlayer ? freshShot : null}
              disabled
            />
          </div>

          {/* Right: attack target */}
          <div className="glass-strong rounded-2xl p-3 sm:p-5 fade-up" style={{ animationDelay: '0.08s' }}>
            <BoardGrid
              board={view.boards[defender]}
              asOwner={false}
              cellStates={attackGrid}
              title={isSingle ? 'Rəqib · Hədəf' : `${PLAYER_NAMES[defender]} · Hədəf`}
              onCellClick={(r, c) => canFire && onFire(attacker, r, c)}
              disabled={!canFire}
              freshShot={view.lastShot?.board === defender ? freshShot : null}
            />
            {view.aiThinking && (
              <div className="mt-3 flex items-center justify-center gap-2 text-amber-300/80 text-sm font-display">
                <Loader2 size={16} className="animate-spin" />
                AI hədəf axtarır...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({
  won,
  winnerName,
  shots,
  sunk,
  time,
  onRestart,
  onMenu,
}: {
  won: boolean;
  winnerName: string;
  shots: number;
  sunk: number;
  time: string;
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
        <h1 className={`font-display font-black text-4xl sm:text-5xl mb-2 ${won ? 'text-emerald-300' : 'text-rose-300'}`}>
          {won ? 'QƏLƏBƏ!' : 'MƏĞLUBİYYƏT'}
        </h1>
        <p className="text-cyan-100/70 mb-6 font-display tracking-wide">
          {won ? `${winnerName} bütün donanmanı batırdı` : `${winnerName} qalib gəldi`}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-7">
          <StatBadge label="Atəş" value={shots} icon={<Crosshair size={16} />} accent="cyan" />
          <StatBadge label="Batılan" value={sunk} icon={<Ship size={16} />} accent="rose" />
          <StatBadge label="Vaxt" value={time} icon={<Timer size={16} />} accent="amber" />
        </div>

        <div className="flex gap-3 justify-center">
          <NeonButton variant="accent" size="lg" icon={<RotateCcw size={20} />} onClick={onRestart}>
            Yenidən Oyna
          </NeonButton>
          <NeonButton variant="ghost" size="lg" icon={<Home size={20} />} onClick={onMenu}>
            Menyu
          </NeonButton>
        </div>
      </div>
    </div>
  );
}

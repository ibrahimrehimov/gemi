// Battleship — top-level app.
// Owns the global sound toggles and routes between Menu / Lobby / Placement /
// Battle (offline) / OnlinePlay (online).

import { useEffect, useState } from 'react';
import { Menu } from '@/components/Menu';
import { Lobby } from '@/components/Lobby';
import { OnlinePlay } from '@/components/OnlinePlay';
import { Placement } from '@/components/Placement';
import { Battle } from '@/components/Battle';
import { useGame } from '@/game/useGame';
import { sound } from '@/game/sound';
import type { RoomRow } from '@/lib/supabase';

type AppScreen = 'menu' | 'lobby' | 'online';

export default function App() {
  const game = useGame();
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [onlineRoom, setOnlineRoom] = useState<RoomRow | null>(null);
  const [onlineRole, setOnlineRole] = useState<'host' | 'guest'>('host');

  // Keep the sound engine in sync with toggles.
  useEffect(() => {
    sound.sfxOn = sfxOn;
  }, [sfxOn]);
  useEffect(() => {
    if (musicOn && !sound.isMusicPlaying) sound.startMusic();
    if (!musicOn && sound.isMusicPlaying) sound.stopMusic();
  }, [musicOn]);

  const { view } = game;

  // ---- Online flow ----
  if (screen === 'lobby') {
    return (
      <Lobby
        onEnterRoom={(room, role) => {
          setOnlineRoom(room);
          setOnlineRole(role);
          setScreen('online');
        }}
        onBack={() => setScreen('menu')}
      />
    );
  }

  if (screen === 'online' && onlineRoom) {
    return (
      <OnlinePlay
        room={onlineRoom}
        role={onlineRole}
        onExit={() => {
          setOnlineRoom(null);
          setScreen('menu');
        }}
      />
    );
  }

  // ---- Offline flow ----
  if (view.phase === 'menu') {
    return (
      <Menu
        sfxOn={sfxOn}
        musicOn={musicOn}
        onToggleSfx={() => setSfxOn((v) => !v)}
        onToggleMusic={() => setMusicOn((v) => !v)}
        onStart={(mode) => game.startGame(mode)}
        onOnline={() => setScreen('lobby')}
      />
    );
  }

  if (view.phase === 'placement') {
    return (
      <Placement
        player={view.placement.player}
        ships={view.placement.ships}
        selectedDefId={view.placement.selectedDefId}
        orientation={view.placement.orientation}
        onSelect={game.setSelectedShip}
        onRotate={game.rotate}
        onRandom={game.randomPlace}
        onClear={game.clearPlacement}
        onTryPlace={game.tryPlace}
        onRemove={game.removeShip}
        onConfirm={game.confirmPlacement}
        onBack={game.backToMenu}
      />
    );
  }

  return (
    <Battle
      view={view}
      onFire={game.fire}
      onRestart={game.restart}
      onMenu={game.backToMenu}
      onResumeTurn={game.resumeTurn}
    />
  );
}

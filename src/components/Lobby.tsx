// Lobby: create or join an online room. After creating/joining, shows
// the room code (shareable) and waits for the opponent to join. Once
// both players are present, transitions to placement.

import { useEffect, useState } from 'react';
import {
  Globe,
  Plus,
  LogIn,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  Users,
  User,
  Share2,
  WifiOff,
} from 'lucide-react';
import { NeonButton, IconButton } from './ui';
import { sound } from '@/game/sound';
import {
  createRoom,
  joinRoom,
  getPlayerName,
  setPlayerName,
  type CreateRoomResult,
} from '@/lib/online';
import type { RoomRow } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

interface LobbyProps {
  onEnterRoom: (room: RoomRow, role: 'host' | 'guest') => void;
  onBack: () => void;
}

type LobbyScreen = 'home' | 'create' | 'join' | 'waiting';

export function Lobby({ onEnterRoom, onBack }: LobbyProps) {
  const [screen, setScreen] = useState<LobbyScreen>('home');
  const [name, setName] = useState(getPlayerName());
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [copied, setCopied] = useState(false);

  // Persist name as the user types.
  useEffect(() => {
    setPlayerName(name);
  }, [name]);

  // When waiting for opponent, subscribe to room changes.
  useEffect(() => {
    if (screen !== 'waiting' || !room) return;
    const channel = supabase
      .channel(`lobby:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as RoomRow;
          setRoom(updated);
          // If both players present and status moved to placing, enter the room.
          if (updated.status === 'placing' && updated.guest_token) {
            sound.play('place');
            onEnterRoom(updated, role);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screen, room, role, onEnterRoom]);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result: CreateRoomResult = await createRoom(name || 'Oyunçu 1');
      setRoom(result.room);
      setRole('host');
      setScreen('waiting');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Otaq yaradıla bilmədi');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (code.trim().length !== 6) {
      setError('Kod 6 simvoldan ibarət olmalıdır.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await joinRoom(code, name || 'Oyunçu 2');
      if (result.error) {
        setError(result.error);
        return;
      }
      // If joining a waiting room (host hasn't started yet), go to waiting.
      if (result.room.status === 'waiting') {
        setRoom(result.room);
        setRole(result.role);
        setScreen('waiting');
      } else {
        // Room already in placing/playing — enter directly.
        onEnterRoom(result.room, result.role);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Otağa qoşulmaq olmadı');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    sound.play('click');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- Home screen: choose create or join ----
  if (screen === 'home') {
    return (
      <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6 fade-up">
            <IconButton onClick={onBack} title="Geri">
              <ArrowLeft size={18} />
            </IconButton>
            <div>
              <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Online Oyun</h1>
              <p className="text-xs text-cyan-200/60 font-display tracking-wide">Dostunla uzaqdan oyna</p>
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-5 sm:p-6 mb-4 fade-up" style={{ animationDelay: '0.05s' }}>
            <label className="block text-xs font-display uppercase tracking-wider text-cyan-200/60 mb-2">
              Adın
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="Adını daxil et"
              className="w-full bg-white/5 border border-cyan-300/20 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-300/50 focus:bg-white/10 transition-colors"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                sound.play('click');
                setScreen('create');
              }}
              className="glass-strong rounded-2xl p-6 text-left group hover:border-cyan-300/50 transition-all hover:-translate-y-1 fade-up"
              style={{ animationDelay: '0.1s' }}
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 mb-3 group-hover:bg-cyan-500/25 transition-colors">
                <Plus size={26} />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-1">Otaq Yarat</h3>
              <p className="text-sm text-slate-300/70">Kod al, dostuna göndər, o qoşulsun.</p>
            </button>

            <button
              onClick={() => {
                sound.play('click');
                setScreen('join');
              }}
              className="glass-strong rounded-2xl p-6 text-left group hover:border-cyan-300/50 transition-all hover:-translate-y-1 fade-up"
              style={{ animationDelay: '0.15s' }}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 mb-3 group-hover:bg-emerald-500/25 transition-colors">
                <LogIn size={26} />
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-1">Otağa Qoşul</h3>
              <p className="text-sm text-slate-300/70">Dostunun kodunu daxil et və oyna.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Create screen ----
  if (screen === 'create') {
    return (
      <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <IconButton onClick={() => setScreen('home')} title="Geri">
              <ArrowLeft size={18} />
            </IconButton>
            <h1 className="font-display font-bold text-xl text-white">Otaq Yarat</h1>
          </div>
          <div className="glass-strong rounded-2xl p-6 fade-up">
            <div className="flex items-center gap-3 mb-5">
              <User size={20} className="text-cyan-300" />
              <span className="text-white font-display">{name || 'Oyunçu 1'}</span>
            </div>
            <p className="text-sm text-slate-300/70 mb-5">
              Otaq yaradılacaq və 6 simvolluq kod alacaqsınız. Bu kodu dostunuzla paylaşın.
            </p>
            {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
            <NeonButton size="lg" className="w-full" icon={<Plus size={20} />} onClick={handleCreate} disabled={loading}>
              {loading ? 'Yaradılır...' : 'Otaq Yarat'}
            </NeonButton>
          </div>
        </div>
      </div>
    );
  }

  // ---- Join screen ----
  if (screen === 'join') {
    return (
      <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <IconButton onClick={() => setScreen('home')} title="Geri">
              <ArrowLeft size={18} />
            </IconButton>
            <h1 className="font-display font-bold text-xl text-white">Otağa Qoşul</h1>
          </div>
          <div className="glass-strong rounded-2xl p-6 fade-up">
            <label className="block text-xs font-display uppercase tracking-wider text-cyan-200/60 mb-2">
              Otaq Kodu
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="A3K7Q2"
              maxLength={6}
              className="w-full bg-white/5 border border-cyan-300/20 rounded-xl px-4 py-3 text-2xl font-display font-bold text-center text-white tracking-[0.3em] placeholder:text-slate-600 focus:outline-none focus:border-cyan-300/50 focus:bg-white/10 transition-colors mb-4"
            />
            {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}
            <NeonButton
              size="lg"
              className="w-full"
              variant="accent"
              icon={<LogIn size={20} />}
              onClick={handleJoin}
              disabled={loading || code.trim().length !== 6}
            >
              {loading ? 'Qoşulur...' : 'Qoşul'}
            </NeonButton>
          </div>
        </div>
      </div>
    );
  }

  // ---- Waiting screen ----
  return (
    <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
      <div className="w-full max-w-md">
        <div className="glass-strong rounded-2xl p-6 sm:p-8 text-center pop-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 mb-5">
            <Users size={32} />
          </div>
          <h2 className="font-display font-bold text-xl text-white mb-2">Rəqib Gözlənilir</h2>
          <p className="text-sm text-slate-300/70 mb-6">
            Bu kodu dostunla paylaş. O qoşulanda oyun avtomatik başlayacaq.
          </p>

          {/* Room code display */}
          <div className="bg-white/5 border border-cyan-300/20 rounded-2xl p-5 mb-5">
            <p className="text-xs font-display uppercase tracking-wider text-cyan-200/50 mb-2">Otaq Kodu</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-display font-black text-3xl sm:text-4xl text-cyan-300 tracking-[0.2em] glow-pulse">
                {room?.code}
              </span>
            </div>
          </div>

          {/* Copy + Share buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <NeonButton variant="ghost" icon={copied ? <Check size={18} /> : <Copy size={18} />} onClick={copyCode}>
              {copied ? 'Kopyalandı!' : 'Kopyala'}
            </NeonButton>
            <NeonButton
              variant="ghost"
              icon={<Share2 size={18} />}
              onClick={() => {
                if (!room) return;
                const shareText = `Gəmi Partlatma! Mənimlə oyna. Otaq kodu: ${room.code}`;
                if (navigator.share) {
                  navigator.share({ title: 'Gəmi Partlatma', text: shareText }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(shareText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              Paylaş
            </NeonButton>
          </div>

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-2 text-cyan-200/60 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Dostun qoşulmasını gözləyir...
          </div>

          {/* Connection status */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <WifiOff size={12} className="hidden" />
            <Globe size={12} />
            <span>Online · Bağlı</span>
          </div>

          <button
            onClick={() => {
              sound.play('click');
              onBack();
            }}
            className="mt-5 text-sm text-slate-400 hover:text-rose-300 transition-colors"
          >
            Ləğv et
          </button>
        </div>
      </div>
    </div>
  );
}

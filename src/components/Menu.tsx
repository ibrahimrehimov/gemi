// Start menu: mode selection, sound toggles, rules dialog.

import { useState } from 'react';
import { Ship, User, Users, Globe, Play, BookOpen, Anchor, Waves } from 'lucide-react';
import type { GameMode } from '@/types';
import { NeonButton, SoundControls } from './ui';
import { sound } from '@/game/sound';

interface MenuProps {
  onStart: (mode: GameMode) => void;
  onOnline: () => void;
  sfxOn: boolean;
  musicOn: boolean;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
}

export function Menu({ onStart, onOnline, sfxOn, musicOn, onToggleSfx, onToggleMusic }: MenuProps) {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="min-h-screen ocean-bg flex items-center justify-center p-4 fade-in">
      <div className="w-full max-w-2xl">
        {/* Hero title */}
        <div className="text-center mb-8 sm:mb-12 fade-up">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl glass-strong mb-5 pop-in">
            <Anchor className="text-cyan-300" size={44} />
          </div>
          <h1 className="font-display font-black text-4xl sm:text-6xl tracking-tight glow-pulse">
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400 bg-clip-text text-transparent">
              GƏMİ PARTLATMA
            </span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-cyan-100/60 font-display tracking-widest uppercase">
            Dəniz Döyüşü · Battleship
          </p>
        </div>

        {/* Mode cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <ModeCard
            icon={<User size={28} />}
            title="Tək Oyunçu"
            subtitle="İstifadəçi vs AI"
            desc="Ağıllı rəqibə qarşı oyna. Hunt &amp; Target strategiyası."
            onClick={() => onStart('single')}
            delay="0.1s"
          />
          <ModeCard
            icon={<Users size={28} />}
            title="İki Oyunçu"
            subtitle="Eyni ekranda"
            desc="Növbə ilə oynayın. Gəmilərinizi gizli yerləşdirin."
            onClick={() => onStart('two')}
            delay="0.2s"
          />
        </div>

        {/* Online mode — full width highlight card */}
        <button
          onClick={() => {
            sound.play('click');
            onOnline();
          }}
          className="w-full glass-strong rounded-2xl p-5 sm:p-6 text-left group hover:border-emerald-300/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(52,245,160,0.25)] fade-up mb-6"
          style={{ animationDelay: '0.25s' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 group-hover:bg-emerald-500/25 transition-colors shrink-0">
              <Globe size={30} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg sm:text-xl text-white">Online Oyun</h3>
                <span className="text-[10px] font-display uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Dostunla oyna
                </span>
              </div>
              <p className="text-sm text-slate-300/70 mt-0.5">Otaq kodu yarat, dostuna göndər, istənilən yerdən oynayın.</p>
            </div>
            <div className="flex items-center gap-2 text-emerald-300 font-display text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Play size={14} /> Başla
            </div>
          </div>
        </button>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-center gap-3 fade-up" style={{ animationDelay: '0.3s' }}>
          <NeonButton variant="ghost" icon={<BookOpen size={18} />} onClick={() => setShowRules(true)}>
            Qaydalar
          </NeonButton>
          <SoundControls
            sfxOn={sfxOn}
            musicOn={musicOn}
            onToggleSfx={onToggleSfx}
            onToggleMusic={onToggleMusic}
          />
        </div>

        {/* decorative wave footer */}
        <div className="mt-10 flex items-center justify-center gap-1 text-cyan-400/20">
          <Waves size={22} />
          <Waves size={22} />
          <Waves size={22} />
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function ModeCard({
  icon,
  title,
  subtitle,
  desc,
  onClick,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  onClick: () => void;
  delay: string;
}) {
  return (
    <button
      onClick={() => {
        sound.play('click');
        onClick();
      }}
      className="glass-strong rounded-2xl p-5 sm:p-6 text-left group hover:border-cyan-300/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(56,225,255,0.25)] fade-up"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 group-hover:bg-cyan-500/25 transition-colors">
          {icon}
        </div>
        <div>
          <h3 className="font-display font-bold text-lg sm:text-xl text-white">{title}</h3>
          <p className="text-xs text-cyan-200/60 font-display tracking-wide uppercase">{subtitle}</p>
        </div>
      </div>
      <p className="text-sm text-slate-300/70 leading-relaxed">{desc}</p>
      <div className="mt-4 flex items-center gap-2 text-cyan-300 font-display text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
        <Play size={14} /> Başla
      </div>
    </button>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const rules = [
    { icon: <Ship size={18} />, title: 'Gəmi Dəsti', text: '1× Linkor (4), 2× Kreyser (3), 3× Esmines (2), 4× Kater (1).' },
    { icon: <Anchor size={18} />, title: 'Yerləşdirmə', text: 'Gəmilər bir-birinə toxuna və lövhədən kənara çıxa bilməz. Fırlat və ya təsadüfi yerləşdir.' },
    { icon: <Play size={18} />, title: 'Atəş', text: 'Növbə ilə xana seç. Dəyərsə yenidən atəş açırsan. Saparsan növbə keçir.' },
    { icon: <Ship size={18} />, title: 'Qələbə', text: 'Rəqibin bütün gəmilərini batıran qalib gəlir.' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
      <div
        className="glass-strong rounded-2xl p-6 sm:p-8 max-w-lg w-full pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display font-bold text-2xl text-cyan-200 mb-5">Oyun Qaydaları</h2>
        <div className="space-y-4">
          {rules.map((r, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-300">
                {r.icon}
              </div>
              <div>
                <h4 className="font-display font-semibold text-white text-sm">{r.title}</h4>
                <p className="text-sm text-slate-300/70 leading-relaxed">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <NeonButton onClick={onClose}>Anladım</NeonButton>
        </div>
      </div>
    </div>
  );
}

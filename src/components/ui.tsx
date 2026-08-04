// Small reusable UI primitives shared across screens.

import { Volume2, VolumeX, Music, Music2, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { sound } from '@/game/sound';

export function NeonButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const sizes = {
    sm: 'px-4 py-2 text-xs sm:text-sm',
    md: 'px-6 py-3 text-sm sm:text-base',
    lg: 'px-8 py-4 text-base sm:text-lg',
  };
  const variants = {
    primary:
      'bg-gradient-to-br from-cyan-500/90 to-blue-600/90 text-white shadow-[0_0_24px_rgba(56,225,255,0.4)] hover:shadow-[0_0_36px_rgba(56,225,255,0.6)] hover:from-cyan-400 hover:to-blue-500',
    accent:
      'bg-gradient-to-br from-emerald-400/90 to-teal-600/90 text-white shadow-[0_0_24px_rgba(52,245,160,0.4)] hover:shadow-[0_0_36px_rgba(52,245,160,0.6)]',
    danger:
      'bg-gradient-to-br from-rose-500/90 to-red-700/90 text-white shadow-[0_0_24px_rgba(255,59,92,0.4)] hover:shadow-[0_0_36px_rgba(255,59,92,0.6)]',
    ghost:
      'bg-white/5 text-cyan-100 border border-cyan-300/20 hover:bg-white/10 hover:border-cyan-300/40',
  };
  return (
    <button
      onClick={() => {
        if (onClick) {
          sound.play('click');
          onClick();
        }
      }}
      disabled={disabled}
      className={`neon-btn ${sizes[size]} ${variants[variant]} ${className} flex items-center justify-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function ToggleButton({
  label,
  iconOn,
  iconOff,
  on,
  onToggle,
}: {
  label: string;
  iconOn: ReactNode;
  iconOff: ReactNode;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={() => {
        sound.play('click');
        onToggle();
      }}
      className={`neon-btn px-4 py-2.5 text-xs sm:text-sm flex items-center gap-2 ${
        on
          ? 'bg-white/10 text-cyan-100 border border-cyan-300/40 shadow-[0_0_18px_rgba(56,225,255,0.3)]'
          : 'bg-white/5 text-slate-400 border border-white/10'
      }`}
      aria-label={label}
      title={label}
    >
      {on ? iconOn : iconOff}
      <span className="font-display tracking-wide">{label}</span>
    </button>
  );
}

export function SoundControls({
  sfxOn,
  musicOn,
  onToggleSfx,
  onToggleMusic,
}: {
  sfxOn: boolean;
  musicOn: boolean;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
}) {
  return (
    <div className="flex gap-2">
      <ToggleButton
        label="Səs"
        on={sfxOn}
        onToggle={onToggleSfx}
        iconOn={<Volume2 size={16} />}
        iconOff={<VolumeX size={16} />}
      />
      <ToggleButton
        label="Musiqi"
        on={musicOn}
        onToggle={onToggleMusic}
        iconOn={<Music size={16} />}
        iconOff={<Music2 size={16} />}
      />
    </div>
  );
}

export function StatBadge({
  label,
  value,
  icon,
  accent = 'cyan',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: 'cyan' | 'amber' | 'rose' | 'emerald';
}) {
  const accents = {
    cyan: 'text-cyan-300 border-cyan-400/30',
    amber: 'text-amber-300 border-amber-400/30',
    rose: 'text-rose-300 border-rose-400/30',
    emerald: 'text-emerald-300 border-emerald-400/30',
  };
  return (
    <div className={`glass rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 flex items-center gap-2 sm:gap-3 border ${accents[accent]}`}>
      {icon && <span className="opacity-80">{icon}</span>}
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-400 font-display">
          {label}
        </span>
        <span className="font-display font-bold text-sm sm:text-lg">{value}</span>
      </div>
    </div>
  );
}

export function IconButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={() => {
        sound.play('click');
        onClick?.();
      }}
      title={title}
      className="w-10 h-10 rounded-xl glass flex items-center justify-center text-cyan-200 hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}

export { RotateCcw };

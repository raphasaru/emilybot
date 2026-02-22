export default function MascotAvatar({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="100 100 200 170" className={className}>
      <defs>
        <linearGradient id="maOrange" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
        <linearGradient id="maVisor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="maCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <pattern id="maDash" patternUnits="userSpaceOnUse" width="6" height="6">
          <rect width="100%" height="3" fill="url(#maCyan)" />
        </pattern>
      </defs>

      <g transform="translate(200, 240) scale(1.6)">
        {/* Ears */}
        <path d="M-25,-55 L-50,-95 Q-55,-95 -55,-85 L-45,-45 Z" fill="url(#maOrange)" />
        <polygon points="-30,-55 -46,-85 -40,-50" fill="#FFEDD5" />
        <path d="M25,-55 L50,-95 Q55,-95 55,-85 L45,-45 Z" fill="url(#maOrange)" />
        <polygon points="30,-55 46,-85 40,-50" fill="#FFEDD5" />

        {/* Head */}
        <path d="M-60,-50 Q-60,-80 0,-80 Q60,-80 60,-50 Q60,-10 0,-10 Q-60,-10 -60,-50 Z" fill="url(#maOrange)" />

        {/* Circuit */}
        <g stroke="#9A3412" strokeWidth="2" fill="none" opacity="0.8">
          <path d="M-20,-65 L-10,-55 L0,-65 L10,-55 L20,-65" />
          <path d="M0,-65 L0,-75" />
          <circle cx="-20" cy="-65" r="1.5" fill="#9A3412" />
          <circle cx="20" cy="-65" r="1.5" fill="#9A3412" />
          <circle cx="0" cy="-75" r="1.5" fill="#9A3412" />
        </g>

        {/* Cheeks */}
        <ellipse cx="-35" cy="-25" rx="15" ry="10" fill="#FFEDD5" opacity="0.6" />
        <ellipse cx="35" cy="-25" rx="15" ry="10" fill="#FFEDD5" opacity="0.6" />

        {/* Visor */}
        <path d="M-50,-50 Q-50,-68 0,-68 Q50,-68 50,-50 Q50,-25 0,-25 Q-50,-25 -50,-50 Z" fill="url(#maVisor)" />

        {/* Whiskers */}
        <g stroke="url(#maCyan)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
          <path d="M-30,-35 L-65,-40" />
          <path d="M-32,-30 L-68,-28" />
          <path d="M-28,-25 L-60,-15" />
          <path d="M30,-35 L65,-40" />
          <path d="M32,-30 L68,-28" />
          <path d="M28,-25 L60,-15" />
        </g>

        {/* Eyes */}
        <path d="M-26,-46 Q-18,-53 -10,-43 Q-15,-33 -23,-36 Q-30,-38 -26,-46 Z" fill="url(#maDash)" />
        <path d="M26,-46 Q18,-53 10,-43 Q15,-33 23,-36 Q30,-38 26,-46 Z" fill="url(#maDash)" />

        {/* Nose */}
        <path d="M-4,-33 Q0,-31 4,-33 L0,-36 Z" fill="#FBCFE8" />
      </g>
    </svg>
  );
}

'use client';

import { useEffect, useId, useRef } from 'react';

export default function Mascot({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pFgRef = useRef<SVGGElement>(null);
  const eyeRef = useRef<SVGGElement>(null);
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      if (pFgRef.current) {
        pFgRef.current.style.transform = `translate(${x * -0.03}px, ${y * -0.03}px)`;
      }
      if (eyeRef.current) {
        const maxX = 6;
        const maxY = 4;
        const eyeX = (x / (rect.width / 2)) * maxX;
        const eyeY = (y / (rect.height / 2)) * maxY;
        eyeRef.current.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
      }
    };

    const handleMouseLeave = () => {
      if (pFgRef.current) pFgRef.current.style.transform = 'translate(0,0)';
      if (eyeRef.current) eyeRef.current.style.transform = 'translate(0,0)';
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Unique IDs to avoid conflicts when multiple instances exist
  const id = (name: string) => `${uid}${name}`;

  return (
    <div ref={containerRef} className={`cursor-crosshair ${className}`}>
      <style jsx>{`
        @keyframes mascot-float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-15px); }
        }
        @keyframes mascot-shadow {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(0.85); opacity: 0.2; }
        }
        @keyframes mascot-blink {
          0%, 94%, 98%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        @keyframes mascot-visor-float {
          0% { transform: translateY(1px); }
          100% { transform: translateY(-3px); }
        }
        @keyframes mascot-ear-left {
          0%, 95%, 100% { transform: rotate(0deg); }
          97% { transform: rotate(-8deg); }
        }
        @keyframes mascot-ear-right {
          0%, 90%, 100% { transform: rotate(0deg); }
          93% { transform: rotate(8deg); }
        }
        .mascot-robot-wrapper {
          animation: mascot-float 3.5s ease-in-out infinite alternate;
        }
        .mascot-shadow-wrapper {
          animation: mascot-shadow 3.5s ease-in-out infinite alternate;
          transform-origin: 200px 280px;
        }
        .mascot-visor-anim {
          animation: mascot-visor-float 2.5s ease-in-out infinite alternate;
        }
        .mascot-ear-left {
          animation: mascot-ear-left 6s infinite;
          transform-origin: -35px -55px;
        }
        .mascot-ear-right {
          animation: mascot-ear-right 7s infinite;
          transform-origin: 35px -55px;
        }
        .mascot-eyes {
          animation: mascot-blink 5s infinite;
          transform-origin: 0px -25px;
        }
        .mascot-parallax-fg {
          transition: transform 0.2s ease-out;
        }
        .mascot-eye-tracking {
          transition: transform 0.1s ease-out;
        }
      `}</style>

      <svg xmlns="http://www.w3.org/2000/svg" viewBox="60 80 280 220" className="w-full h-full">
        <defs>
          <radialGradient id={id('bg')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3F1D0B" stopOpacity="0.15" />
            <stop offset="60%" stopColor="#06060A" stopOpacity="0" />
            <stop offset="100%" stopColor="#06060A" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={id('orange')} x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#FDBA74" />
            <stop offset="50%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>

          <linearGradient id={id('visor')} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id={id('cyan')} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          <filter id={id('dropShadow')} x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0284C7" floodOpacity="0.2" />
          </filter>
          <filter id={id('softShadow')} x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000000" floodOpacity="0.6" />
          </filter>
          <filter id={id('glow')} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <pattern id={id('dash')} patternUnits="userSpaceOnUse" width="6" height="6">
            <rect width="100%" height="3" fill={`url(#${id('cyan')})`} />
          </pattern>
        </defs>

        {/* Background glow */}
        <rect width="400" height="400" fill={`url(#${id('bg')})`} />

        {/* Foreground layer */}
        <g className="mascot-parallax-fg" ref={pFgRef}>

          {/* Ground shadow */}
          <ellipse className="mascot-shadow-wrapper" cx="200" cy="280" rx="60" ry="10" fill="#000000" />

          {/* Cat head */}
          <g className="mascot-robot-wrapper">
            <g transform="translate(200, 240) scale(1.6)">
              <g>

                {/* Left ear */}
                <g className="mascot-ear-left">
                  <path d="M-25,-55 L-50,-95 Q-55,-95 -55,-85 L-45,-45 Z" fill={`url(#${id('orange')})`} filter={`url(#${id('softShadow')})`} />
                  <polygon points="-30,-55 -46,-85 -40,-50" fill="#FFEDD5" />
                </g>

                {/* Right ear */}
                <g className="mascot-ear-right">
                  <path d="M25,-55 L50,-95 Q55,-95 55,-85 L45,-45 Z" fill={`url(#${id('orange')})`} filter={`url(#${id('softShadow')})`} />
                  <polygon points="30,-55 46,-85 40,-50" fill="#FFEDD5" />
                </g>

                {/* Head base */}
                <path d="M-60,-50 Q-60,-80 0,-80 Q60,-80 60,-50 Q60,-10 0,-10 Q-60,-10 -60,-50 Z" fill={`url(#${id('orange')})`} filter={`url(#${id('softShadow')})`} />

                {/* Circuit pattern on forehead */}
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
                <g className="mascot-visor-anim">
                  <path d="M-50,-50 Q-50,-68 0,-68 Q50,-68 50,-50 Q50,-25 0,-25 Q-50,-25 -50,-50 Z" fill={`url(#${id('visor')})`} filter={`url(#${id('dropShadow')})`} />

                  {/* Neon whiskers */}
                  <g stroke={`url(#${id('cyan')})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" filter={`url(#${id('glow')})`}>
                    <path d="M-30,-35 L-65,-40" />
                    <path d="M-32,-30 L-68,-28" />
                    <path d="M-28,-25 L-60,-15" />
                    <path d="M30,-35 L65,-40" />
                    <path d="M32,-30 L68,-28" />
                    <path d="M28,-25 L60,-15" />
                  </g>

                  {/* Eye tracking group */}
                  <g ref={eyeRef} className="mascot-eye-tracking">
                    {/* Digital cat eyes */}
                    <g className="mascot-eyes" filter={`url(#${id('glow')})`}>
                      <path d="M-26,-46 Q-18,-53 -10,-43 Q-15,-33 -23,-36 Q-30,-38 -26,-46 Z" fill={`url(#${id('dash')})`} />
                      <path d="M26,-46 Q18,-53 10,-43 Q15,-33 23,-36 Q30,-38 26,-46 Z" fill={`url(#${id('dash')})`} />
                    </g>

                    {/* Digital nose */}
                    <g filter={`url(#${id('glow')})`}>
                      <path d="M-4,-33 Q0,-31 4,-33 L0,-36 Z" fill="#FBCFE8" />
                    </g>
                  </g>
                </g>

              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

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

  const id = (name: string) => `${uid}${name}`;

  // Inline styles to avoid iOS Safari compositing layer black box bug
  const floatStyle: React.CSSProperties = {
    animation: 'mascot-float 3.5s ease-in-out infinite alternate',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
  };
  const shadowStyle: React.CSSProperties = {
    animation: 'mascot-shadow 3.5s ease-in-out infinite alternate',
    transformOrigin: '200px 280px',
  };
  const visorStyle: React.CSSProperties = {
    animation: 'mascot-visor 2.5s ease-in-out infinite alternate',
  };
  const earLeftStyle: React.CSSProperties = {
    animation: 'mascot-ear-l 6s infinite',
    transformOrigin: '-35px -55px',
  };
  const earRightStyle: React.CSSProperties = {
    animation: 'mascot-ear-r 7s infinite',
    transformOrigin: '35px -55px',
  };
  const blinkStyle: React.CSSProperties = {
    animation: 'mascot-blink 5s infinite',
    transformOrigin: '0px -25px',
  };
  const fgStyle: React.CSSProperties = {
    transition: 'transform 0.2s ease-out',
  };
  const eyeTrackStyle: React.CSSProperties = {
    transition: 'transform 0.1s ease-out',
  };

  return (
    <div ref={containerRef} className={`cursor-crosshair ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="60 80 280 220"
        className="w-full h-auto"
        style={{ overflow: 'visible' }}
      >
        <defs>
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

          <pattern id={id('dash')} patternUnits="userSpaceOnUse" width="6" height="6">
            <rect width="100%" height="3" fill={`url(#${id('cyan')})`} />
          </pattern>
        </defs>

        <g style={fgStyle} ref={pFgRef}>
          <ellipse style={shadowStyle} cx="200" cy="280" rx="60" ry="10" fill="#000000" />

          <g style={floatStyle}>
            <g transform="translate(200, 240) scale(1.6)">
              <g>
                <g style={earLeftStyle}>
                  <path d="M-25,-55 L-50,-95 Q-55,-95 -55,-85 L-45,-45 Z" fill={`url(#${id('orange')})`} />
                  <polygon points="-30,-55 -46,-85 -40,-50" fill="#FFEDD5" />
                </g>

                <g style={earRightStyle}>
                  <path d="M25,-55 L50,-95 Q55,-95 55,-85 L45,-45 Z" fill={`url(#${id('orange')})`} />
                  <polygon points="30,-55 46,-85 40,-50" fill="#FFEDD5" />
                </g>

                <path d="M-60,-50 Q-60,-80 0,-80 Q60,-80 60,-50 Q60,-10 0,-10 Q-60,-10 -60,-50 Z" fill={`url(#${id('orange')})`} />

                <g stroke="#9A3412" strokeWidth="2" fill="none" opacity="0.8">
                  <path d="M-20,-65 L-10,-55 L0,-65 L10,-55 L20,-65" />
                  <path d="M0,-65 L0,-75" />
                  <circle cx="-20" cy="-65" r="1.5" fill="#9A3412" />
                  <circle cx="20" cy="-65" r="1.5" fill="#9A3412" />
                  <circle cx="0" cy="-75" r="1.5" fill="#9A3412" />
                </g>

                <ellipse cx="-35" cy="-25" rx="15" ry="10" fill="#FFEDD5" opacity="0.6" />
                <ellipse cx="35" cy="-25" rx="15" ry="10" fill="#FFEDD5" opacity="0.6" />

                <g style={visorStyle}>
                  <path d="M-50,-50 Q-50,-68 0,-68 Q50,-68 50,-50 Q50,-25 0,-25 Q-50,-25 -50,-50 Z" fill={`url(#${id('visor')})`} />

                  <g stroke={`url(#${id('cyan')})`} strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
                    <path d="M-30,-35 L-65,-40" />
                    <path d="M-32,-30 L-68,-28" />
                    <path d="M-28,-25 L-60,-15" />
                    <path d="M30,-35 L65,-40" />
                    <path d="M32,-30 L68,-28" />
                    <path d="M28,-25 L60,-15" />
                  </g>

                  <g ref={eyeRef} style={eyeTrackStyle}>
                    <g style={blinkStyle}>
                      <path d="M-26,-46 Q-18,-53 -10,-43 Q-15,-33 -23,-36 Q-30,-38 -26,-46 Z" fill={`url(#${id('dash')})`} />
                      <path d="M26,-46 Q18,-53 10,-43 Q15,-33 23,-36 Q30,-38 26,-46 Z" fill={`url(#${id('dash')})`} />
                    </g>
                    <path d="M-4,-33 Q0,-31 4,-33 L0,-36 Z" fill="#FBCFE8" />
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

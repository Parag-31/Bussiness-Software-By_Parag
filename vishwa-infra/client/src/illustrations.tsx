import React from 'react';

/** Brand mark: a truss-style "V" with an amber cross-beam. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="logo-svg">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5b7cff" /><stop offset="100%" stopColor="#1d3ad0" /></linearGradient>
        <linearGradient id="lm-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".28" /><stop offset="60%" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lm-bg)" />
      <rect width="40" height="40" rx="11" fill="url(#lm-sh)" />
      <path d="M10.5 11.5 L20 30 L29.5 11.5" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6 19.5 H25.4" stroke="#ffb020" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="8" r="2" fill="#ffb020" />
    </svg>
  );
}

/** Default empty-state mark: an open document/ledger, in the same line weight
 *  as LogoMark, coloured via currentColor so it inherits `.empty-ico`'s tone. */
export function EmptyMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M8 5.5h13l4 4V26a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 5 26V7A1.5 1.5 0 0 1 6.5 5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M21 5.5V9a1 1 0 0 0 1 1h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10.5 15h11M10.5 19h11M10.5 23h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Stylised infrastructure scene: a tower crane over a rising building, blueprint grid,
 * and a low sun. Pure SVG so it stays crisp at any size and works offline.
 */
export function InfraScene({ className = '', align = 'xMaxYMax' }: { className?: string; align?: string }) {
  const windows = (x: number, y: number, cols: number, rows: number, gx = 12, gy = 14, lit: number[] = []) => {
    const out: React.ReactNode[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = lit.includes(r * cols + c);
      out.push(<rect key={`${x}-${y}-${r}-${c}`} x={x + c * gx} y={y + r * gy} width={6} height={7} rx={1.4} className={on ? 'sc-win on' : 'sc-win'} />);
    }
    return out;
  };
  const lattice: React.ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    const y = 250 - i * 14;
    lattice.push(<path key={i} d={i % 2 ? `M418 ${y} L430 ${y - 14}` : `M430 ${y} L418 ${y - 14}`} className="sc-line" />);
    lattice.push(<line key={`h${i}`} x1={418} x2={430} y1={y} y2={y} className="sc-line faint" />);
  }
  const jib: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const x = 300 + i * 20;
    jib.push(<path key={i} d={i % 2 ? `M${x} 52 L${x + 20} 62` : `M${x} 62 L${x + 20} 52`} className="sc-line faint" />);
  }
  return (
    <svg className={'scene ' + className} viewBox="0 0 640 300" preserveAspectRatio={`${align} meet`} aria-hidden="true">
      <defs>
        <radialGradient id="sc-sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffb020" stopOpacity=".55" /><stop offset="60%" stopColor="#ffb020" stopOpacity=".12" /><stop offset="100%" stopColor="#ffb020" stopOpacity="0" /></radialGradient>
        <linearGradient id="sc-b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".16" /><stop offset="100%" stopColor="#fff" stopOpacity=".03" /></linearGradient>
        <pattern id="sc-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" strokeOpacity=".07" /></pattern>
      </defs>
      <rect width="640" height="300" fill="url(#sc-grid)" />
      <circle cx="520" cy="118" r="120" fill="url(#sc-sun)" />
      <circle cx="520" cy="118" r="34" className="sc-sun" />

      {/* buildings */}
      <g>
        <rect x="46" y="150" width="78" height="100" rx="3" fill="url(#sc-b1)" className="sc-b" />{windows(58, 162, 5, 6, 13, 14, [1, 6, 8, 13, 17, 22, 27])}
        <rect x="136" y="98" width="62" height="152" rx="3" fill="url(#sc-b1)" className="sc-b" />{windows(147, 112, 4, 9, 13, 15, [2, 5, 9, 14, 20, 25, 31])}
        <rect x="210" y="176" width="90" height="74" rx="3" fill="url(#sc-b1)" className="sc-b" />{windows(224, 188, 5, 4, 15, 15, [0, 4, 7, 12, 16])}
        {/* rising tower with rebar */}
        <rect x="336" y="140" width="66" height="110" rx="2" fill="url(#sc-b1)" className="sc-b" />
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={342 + i * 13} x2={342 + i * 13} y1={96} y2={140} className="sc-rebar" />)}
        {[0, 1, 2].map((i) => <line key={i} x1={336} x2={402} y1={140 - i * 15} y2={140 - i * 15} className="sc-line faint" />)}
        {windows(346, 152, 4, 6, 14, 15, [1, 6, 9, 14, 19])}
      </g>

      {/* tower crane */}
      <g>
        <line x1="418" x2="418" y1="250" y2="46" className="sc-line" /><line x1="430" x2="430" y1="250" y2="46" className="sc-line" />
        {lattice}
        <rect x="412" y="40" width="24" height="12" rx="2" className="sc-amber" />
        <path d="M424 40 L424 22 L300 62 M424 22 L560 62" className="sc-line" fill="none" />
        <line x1="300" x2="470" y1="52" y2="52" className="sc-line strong" /><line x1="300" x2="470" y1="62" y2="62" className="sc-line" />
        {jib}
        <rect x="446" y="62" width="26" height="22" rx="3" className="sc-amber dim" />
        <g className="hook">
          <line x1="332" x2="332" y1="62" y2="128" className="sc-cable" />
          <rect x="322" y="128" width="20" height="10" rx="2" className="sc-amber" />
          <path d="M324 138 L332 150 L340 138" className="sc-cable" fill="none" />
          <rect x="316" y="150" width="32" height="8" rx="2" className="sc-load" />
        </g>
      </g>

      {/* ground */}
      <rect x="0" y="250" width="640" height="50" className="sc-ground" />
      <line x1="0" x2="640" y1="250" y2="250" className="sc-line strong sc-horizon" />
      {Array.from({ length: 16 }).map((_, i) => <rect key={i} x={i * 42 + 6} y={272} width={22} height={3} rx={1.5} className="sc-road" />)}
      <g transform="translate(470 240)">
        <g className="truck">
          <rect width="34" height="12" rx="2" className="sc-amber" /><rect x="34" y="4" width="12" height="8" rx="2" className="sc-amber dim" />
          <circle cx="9" cy="13" r="4" className="sc-wheel" /><circle cx="38" cy="13" r="4" className="sc-wheel" />
        </g>
      </g>
    </svg>
  );
}

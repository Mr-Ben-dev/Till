export function PermissionDiagram() {
  return (
    <svg className="perm-svg" viewBox="0 0 720 280" role="img" aria-label="Owner to Till to Policy to Session to Agent. Agent cannot reach the owner wallet, change policy, withdraw, or spend another Till.">
      <defs>
        <linearGradient id="permGlow" x1="0" x2="1">
          <stop offset="0" stopColor="#00BDE9" stopOpacity="0.15" />
          <stop offset="1" stopColor="#00BDE9" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {[
        { x: 20, l: 'OWNER' },
        { x: 160, l: 'TILL' },
        { x: 300, l: 'POLICY' },
        { x: 440, l: 'SESSION' },
        { x: 580, l: 'AGENT' },
      ].map((n, i) => (
        <g key={n.l}>
          {i < 4 ? <path className="perm-flow" d={`M${n.x + 108} 52 H${n.x + 132}`} /> : null}
          <rect x={n.x} y="20" width="108" height="64" rx="4.27" fill="#001a28" stroke="#00BDE9" strokeOpacity="0.45" />
          <text x={n.x + 54} y="58" textAnchor="middle" fill="#F4FAFC" fontSize="13" fontFamily="Roboto Mono, monospace">
            {n.l}
          </text>
        </g>
      ))}
      {[
        { y: 120, t: 'AGENT  -X-  OWNER WALLET' },
        { y: 158, t: 'AGENT  -X-  POLICY CHANGE' },
        { y: 196, t: 'AGENT  -X-  WITHDRAW' },
        { y: 234, t: 'AGENT  -X-  OTHER TILL' },
      ].map((r) => (
        <g key={r.t}>
          <rect x="160" y={r.y} width="400" height="30" rx="4.27" fill="rgba(194,59,59,0.12)" stroke="#c23b3b" strokeOpacity="0.45" />
          <text x="360" y={r.y + 20} textAnchor="middle" fill="#f4c4c4" fontSize="12" fontFamily="Roboto Mono, monospace">
            {r.t}
          </text>
        </g>
      ))}
    </svg>
  )
}

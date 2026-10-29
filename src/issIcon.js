import L from 'leaflet';

// 트러스 양쪽에 태양전지판 날개, 가운데에 거주 모듈이 있는 ISS 모양 아이콘
const ISS_SVG = `
<svg viewBox="0 0 64 64" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <g stroke="#1e293b" stroke-width="0.8">
    <rect x="4" y="30.5" width="56" height="3" rx="1" fill="#cbd5e1"/>
    <rect x="5"  y="12" width="7" height="17" fill="url(#panel)"/>
    <rect x="13" y="12" width="7" height="17" fill="url(#panel)"/>
    <rect x="5"  y="35" width="7" height="17" fill="url(#panel)"/>
    <rect x="13" y="35" width="7" height="17" fill="url(#panel)"/>
    <rect x="44" y="12" width="7" height="17" fill="url(#panel)"/>
    <rect x="52" y="12" width="7" height="17" fill="url(#panel)"/>
    <rect x="44" y="35" width="7" height="17" fill="url(#panel)"/>
    <rect x="52" y="35" width="7" height="17" fill="url(#panel)"/>
    <rect x="28" y="18" width="8" height="28" rx="3" fill="#f8fafc"/>
    <rect x="24" y="28" width="16" height="8" rx="2" fill="#e2e8f0"/>
    <rect x="26" y="40" width="12" height="4" rx="1" fill="#fbbf24"/>
  </g>
  <g stroke="#94a3b8" stroke-width="0.4">
    <line x1="5" y1="17.5" x2="20" y2="17.5"/><line x1="5" y1="23.5" x2="20" y2="23.5"/>
    <line x1="5" y1="40.5" x2="20" y2="40.5"/><line x1="5" y1="46.5" x2="20" y2="46.5"/>
    <line x1="44" y1="17.5" x2="59" y2="17.5"/><line x1="44" y1="23.5" x2="59" y2="23.5"/>
    <line x1="44" y1="40.5" x2="59" y2="40.5"/><line x1="44" y1="46.5" x2="59" y2="46.5"/>
  </g>
</svg>`;

/** heading: 진행 방향(deg). 모듈 축이 진행 방향을 향하도록 회전한다. */
export function issIcon(heading = 0) {
  return L.divIcon({
    className: 'iss-marker',
    html: `<div class="iss-marker-inner" style="transform:rotate(${heading}deg)">${ISS_SVG}</div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

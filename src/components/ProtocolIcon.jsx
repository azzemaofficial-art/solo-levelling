import React from 'react';

const labels = {
  cut: 'Oggi', food: 'Pasti', program: 'Training', mma: 'MMA', progress: 'Progressi',
  football: 'Calcio', recovery: 'Recupero', creatine: 'Creatina',
};

export default function ProtocolIcon({ name, size = 28, className = '' }) {
  const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return <svg className={className} width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={labels[name] || name}>
    <title>{labels[name] || name}</title>
    {name === 'cut' && <g {...base}>
      <path d="M4.5 15.2 16 5.5l11.5 9.7v11.1a2 2 0 0 1-2 2h-19a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity=".12" />
      <path d="M11 27.7v-8.2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8.2" />
      <path d="m14.1 22.3 1.4-2.4-.2 2.1h2.6l-2.8 3.4.4-2.6h-1.4Z" fill="currentColor" stroke="none" />
      <path d="M25.2 6.1v4.1M23.15 8.15h4.1" />
    </g>}
    {name === 'food' && <g {...base}>
      <path d="M4.5 17.4h23c0 6.1-4.5 10.1-11.5 10.1S4.5 23.5 4.5 17.4Z" fill="currentColor" fillOpacity=".14" />
      <path d="M8 27.5h16M8 13.5c3.8-3.3 11.8-3.2 15.6 0M11.5 8.8c-.2-1.8.6-2.8 1.9-4.2M16.7 8.8c-.2-1.8.6-2.8 1.9-4.2" />
      <path d="m24.5 6.2 2.8 7.8M27.1 5.2l2.5 8" />
      <path d="M11 17.4c1.4 2.6 3.5 3.9 5.2 3.9" strokeWidth="1.35" />
    </g>}
    {name === 'program' && <g {...base}>
      <path d="M2.9 13.2h4v5.6h-4zM6.9 10.6h3.7v10.8H6.9zM21.4 10.6h3.7v10.8h-3.7zM25.1 13.2h4v5.6h-4z" fill="currentColor" fillOpacity=".16" />
      <path d="M10.6 16h10.8M13 16l2-3.4-.3 2.9h2.8l-3.6 4.2.6-3.7" />
      <path d="M5 24.8h6M21 24.8h6" strokeWidth="1.2" />
    </g>}
    {name === 'mma' && <g {...base}>
      <path d="M9.5 15.5 8 12.7c-.8-1.6-.1-3 1.2-3.5.9-.4 1.8-.1 2.5.4.1-1.3 1.2-2.2 2.5-2.2 1.1 0 1.7.5 2.1 1.3.8-.7 1.8-.9 2.8-.3 1.3.7 1.5 1.9 1.2 3.1 2.7-1.2 5.8.8 6.3 3.5.3 1.9-.4 3.1-1.9 4.4l-5.2 4.8-6.2-1.1-5-5.8c-1.1-1.3-1.7-2.5-1.3-4.2.4-1.5 1.5-2.6 3.1-2.6 1.4 0 2.5.7 3.1 2Z" fill="currentColor" fillOpacity=".15" />
      <path d="M9.6 15.5 12.9 19M12.2 20.4l7.2 1.2M12.7 26.1l-1.1 3h8.9l1-3.7M8 23.1l-3 1.3M26 8.4l2.6-2.5M25.6 4.2l.3 2.2" />
    </g>}
    {name === 'progress' && <g {...base}>
      <rect x="4" y="5" width="24" height="22" rx="3" fill="currentColor" fillOpacity=".1" />
      <path d="M8 22.5V18M12 22.5v-6M16 22.5v-3.2M20 22.5v-9" strokeWidth="1.3" />
      <path d="m7.5 17 5-3.7 4.3 2.7 7.1-7.3M21.2 8.7h2.7v2.7" />
      <circle cx="12.5" cy="13.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.8" cy="16" r="1" fill="currentColor" stroke="none" />
    </g>}
    {name === 'football' && <g {...base}>
      <circle cx="16" cy="16" r="11" fill="currentColor" fillOpacity=".1" />
      <path d="m16 10.6 5.1 3.7-1.9 5.9h-6.4l-1.9-5.9L16 10.6ZM11 14.3 6.6 12M20.9 14.3l4.5-2.3M12.8 20.2l-2.1 5M19.2 20.2l2.1 5" />
      <path d="M12.1 5.8 16 10.6l3.9-4.8" />
    </g>}
    {name === 'recovery' && <g {...base}>
      <path d="M21.8 5.1a10.8 10.8 0 1 0 5.1 18.5A11.7 11.7 0 0 1 21.8 5.1Z" fill="currentColor" fillOpacity=".13" />
      <path d="M10.1 15.1v4.5M7.9 17.4h4.5M20 19.4v3.1M18.5 21h3" />
      <path d="M10.5 6.2 11 8l1.8.5-1.8.5-.5 1.8L10 9l-1.8-.5L10 8Z" fill="currentColor" stroke="none" />
    </g>}
    {name === 'creatine' && <g {...base}>
      <path d="M11.5 4.5h9M13 4.5v5.2l-6.5 12a3.6 3.6 0 0 0 3.2 5.3h12.6a3.6 3.6 0 0 0 3.2-5.3L19 9.7V4.5" fill="currentColor" fillOpacity=".12" />
      <path d="M9.2 21h13.6M14 16.4l1.1 2.6 2.6-5.2 1.4 2.6" />
      <circle cx="11.5" cy="23.8" r=".7" fill="currentColor" stroke="none" /><circle cx="19.8" cy="23.8" r=".7" fill="currentColor" stroke="none" />
    </g>}
  </svg>;
}

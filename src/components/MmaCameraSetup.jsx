import React from 'react';

// Dove mettere il telefono (visto dall'alto). Le clip vere hanno mostrato che con i colpi
// tirati VERSO il telefono MediaPipe perde il pugno (si muove lungo l'asse della camera,
// copre l'avambraccio, è sfocato) e nelle rotazioni scambia destra e sinistra.
// Con il telefono di lato, a 45–60° dal lato del braccio avanti, il pugno attraversa
// l'immagine e si vede bene.
export default function MmaCameraSetup({ stance = 'orthodox', compact = false }) {
  const southpaw = stance === 'southpaw';
  // per un destro (sinistro avanti) il telefono va avanti a sinistra; per un mancino avanti a destra
  const phoneX = southpaw ? 214 : 46;
  return <figure className={`mma-cam-setup ${compact ? 'compact' : ''}`}>
    <svg viewBox="0 0 260 190" role="img" aria-label="Posizione del telefono: davanti a te ma spostato di lato di circa 45 gradi, dal lato del braccio avanti; colpisci un bersaglio immaginario davanti a te, non il telefono">
      <defs>
        <marker id="mcs-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" className="mcs-arrow-head" /></marker>
      </defs>
      {/* bersaglio immaginario davanti */}
      <circle cx="130" cy="32" r="13" className="mcs-target" />
      <text x="130" y="12" textAnchor="middle" className="mcs-small">bersaglio</text>
      {/* direzione dei colpi */}
      <line x1="130" y1="128" x2="130" y2="48" className="mcs-punch" markerEnd="url(#mcs-arrow)" />
      <text x="138" y="92" className="mcs-small">colpi</text>
      {/* tu, visto dall'alto */}
      <ellipse cx="130" cy="146" rx="26" ry="15" className="mcs-you" />
      <circle cx="130" cy="146" r="9" className="mcs-head" />
      <text x="130" y="178" textAnchor="middle" className="mcs-label">tu, in guardia</text>
      {/* telefono a 45° dal lato del braccio avanti, 2–3 m */}
      <line x1={phoneX} y1="74" x2="130" y2="146" className="mcs-view" />
      <rect x={phoneX - 11} y="56" width="22" height="34" rx="5" className="mcs-phone" />
      <text x={phoneX} y="50" textAnchor="middle" className="mcs-label">telefono</text>
      <text x={(phoneX + 130) / 2 + (southpaw ? 18 : -18)} y="122" textAnchor="middle" className="mcs-small">2–3 m</text>
      <path d={southpaw ? 'M 130 104 A 42 42 0 0 1 160 116' : 'M 130 104 A 42 42 0 0 0 100 116'} className="mcs-angle" />
      <text x={southpaw ? 150 : 110} y="98" textAnchor="middle" className="mcs-small">45°</text>
    </svg>
    {!compact && <figcaption>Telefono <b>davanti ma spostato di lato</b> (circa 45°, dal lato del braccio avanti), all’altezza del petto, a 2–3 metri. <b>Colpisci il bersaglio davanti a te, non il telefono</b>: così il pugno attraversa l’immagine e il coach lo vede.</figcaption>}
  </figure>;
}

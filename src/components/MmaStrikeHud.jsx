import React from 'react';
import { RANKS } from '../../lib/mmaMetrics';
import { THRESH } from '../../lib/mmaComboJudge';
import { MOVES } from '../data/mmaMoves';

// Il pannello in alto sulla camera: la finestra del Sistema con il fotogramma d'impatto di un manga.
// Si aggiorna una volta a colpo (key = istante del colpo: le animazioni ripartono solo lì).
const SCALE = { sacco: 'scala: il tuo sacco', salvata: 'scala: ultima misura col sacco', stima: 'scala stimata: misura col sacco per i km/h veri' };

// sideOn: telefono di lato (al sacco). Solo allora la rotazione bassa si segna come difetto
export default function MmaStrikeHud({ hit, source, sideOn = false }) {
  if (!hit) return <div className="mma-hud idle"><span>Al primo colpo leggi velocità, tempo e rotazione</span><small>{SCALE[source]}</small></div>;
  const weak = sideOn && hit.rear && hit.rotation != null && hit.rotation < THRESH.rotateDeg;
  const name = MOVES[hit.id]?.name || (hit.side ? `Braccio ${hit.side === 'lead' ? 'avanti' : 'dietro'}` : 'Colpo');
  return <div className={`mma-hud rank-${hit.rank}`} role="status" aria-label={`${name}: circa ${hit.kmh} chilometri orari${hit.rank ? `, grado ${hit.rank}` : ''}`}>
    <i key={`b${hit.at}`} className="mma-hud-burst" aria-hidden="true" />
    <div key={`m${hit.at}`} className="mma-hud-main">
      <b>{hit.kmh}</b>
      <small>km/h <br />circa</small>
    </div>
    <div className="mma-hud-side">
      <div className="mma-hud-top"><em>{name}</em>{hit.isBest && hit.n > 1 ? <strong>NUOVO RECORD</strong> : hit.drop >= 10 ? <strong className="drop">calo {hit.drop}%</strong> : null}</div>
      <div className="mma-hud-ladder" aria-hidden="true">{RANKS.map((r) => <i key={r} className={r === hit.rank ? 'on' : r === hit.avgRank ? 'avg' : ''}>{r}</i>)}</div>
      <dl>
        <div><dt>Tempo</dt><dd>{hit.impactMs ?? '—'}<u>ms</u></dd></div>
        <div className={weak ? 'weak' : ''}><dt>Rotazione</dt><dd>{hit.rotation != null ? <>{Math.round(hit.rotation)}<u>°</u></> : <u>di lato</u>}</dd></div>
        <div><dt>Media 5</dt><dd>{hit.avgKmh ?? '—'}</dd></div>
        <div><dt>Record</dt><dd>{hit.bestKmh ?? '—'}</dd></div>
      </dl>
    </div>
  </div>;
}

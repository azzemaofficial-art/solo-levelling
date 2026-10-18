import React, { useMemo, useRef, useState } from 'react';
import { analyzeBag, bagScore, bagTargets, bagZones, createBagContacts, matchContacts, roiFor } from '../../lib/mmaBag';
import { drawBag } from '../../lib/mmaBagDraw';
import { judgeSequence } from '../../lib/mmaComboJudge';

// Modalità «al sacco» del coach con camera: tocchi il sacco sullo schermo, il coach ne trova il
// contorno, ci mette sopra i bersagli della combo (all'altezza del TUO viso/fegato/coscia) e conta
// i colpi che arrivano davvero: pugno che si ferma sul bordo + sacco che si muove (lib/mmaBag.js).

const KEY = 'shadow_monarch_mma_bag';
export const readBagMode = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const saveBagMode = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage */ } };

// posa mediana della calibrazione: un fotogramma storto non sposta i bersagli
function medianPose(list) {
  if (!list.length) return null;
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  return Array.from({ length: list[0].length }, (_, i) => {
    const ps = list.map((p) => p[i]).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!ps.length) return null;
    return { x: med(ps.map((p) => p.x)), y: med(ps.map((p) => p.y)), z: med(ps.map((p) => p.z ?? 0)), visibility: med(ps.map((p) => p.visibility ?? 1)) };
  });
}

// Stato del sacco per MmaComboTrainer. L'oggetto restituito è stabile: si può usare dentro onFrame.
export function useMmaBag({ stance, moves, labels }) {
  const [step, setStep] = useState('tap'); // tap → check → ready
  const [res, setRes] = useState(null);
  const s = useRef(null);
  if (!s.current) s.current = { cam: null, points: null, calib: [], bag: null, zones: null, targets: [], det: null, mode: 'off', phase: '', hits: {}, flashes: [], live: [], usable: false, trace: [] };
  const cfg = useRef({}); cfg.current = { stance, moves, labels };
  const api = useMemo(() => {
    const st = s.current;
    const nextTarget = () => (st.phase === 'go' || st.phase === 'demo' || st.phase === 'countdown'
      ? st.targets.find((tg) => st.hits[tg.i] == null && (st.live[tg.i] || 'missing') === 'missing')?.i ?? -1
      : -1);
    // contatto durante la combo: si accende il bersaglio di adesso (o il prossimo dello stesso braccio)
    const light = (c) => {
      const open = st.targets.filter((tg) => st.hits[tg.i] == null && tg.limb === c.limb);
      const now = nextTarget(), cur = open.find((tg) => tg.i === now);
      const pick = cur && (cur.S === c.S || c.sure === false) ? cur : open.find((tg) => tg.S === c.S && tg.i >= now);
      if (pick) st.hits[pick.i] = performance.now();
    };
    return {
      setCamera: (camera) => { st.cam = camera; },
      reset: () => { st.bag = null; st.det = null; st.mode = 'off'; st.calib = []; st.targets = []; st.hits = {}; st.trace = []; setRes(null); setStep('tap'); st.cam?.setRoi?.(null); },
      // tocco sullo schermo → punto dell'immagine → analisi del fotogramma
      tap: (clientX, clientY) => {
        const p = st.cam?.toImagePoint?.(clientX, clientY);
        if (!p || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
        const r = analyzeBag(st.cam?.grabFrame?.(256), p, { points: st.points });
        setRes(r);
        if (r.reason === 'input' || r.reason === 'person') { st.mode = 'off'; st.bag = null; setStep('tap'); return; }
        st.bag = r; st.mode = 'confirm'; setStep('check');
      },
      accept: () => { st.mode = 'wait'; setStep('ready'); },
      retap: () => { st.mode = 'off'; st.bag = null; setRes(null); setStep('tap'); },
      ready: () => Boolean(st.bag) && st.mode !== 'off' && st.mode !== 'confirm',
      // ogni fotogramma (da onFrame): punti per l'analisi, miniatura della ROI per il movimento
      frame: (points, t, aspect, extra, phase) => {
        if (points?.length) st.points = points;
        st.phase = phase;
        if (!st.det || !points) return;
        const fresh = st.det.push(points, t, { thumb: extra?.roiThumb || null, aspect: aspect || 1 });
        // registro: movimento del sacco di questo fotogramma (t, spostamento, velocità, tremolio, visibile, impulso)
        const mo = st.det.motion?.();
        if (mo && mo.t === t) { st.trace.push([t, mo.pos, mo.vel, mo.e ?? null, mo.usable ? 1 : 0, mo.impulse?.z || 0]); if (st.trace.length > 600) st.trace.shift(); }
        if (phase === 'go' && st.det.state().usable) st.usable = true;
        for (const c of fresh) {
          st.flashes.push({ x: c.x, y: c.y, S: c.S, t: performance.now() });
          if (phase === 'go') light(c);
        }
        if (st.flashes.length > 8) st.flashes.splice(0, st.flashes.length - 8);
      },
      calibPoint: (points) => { if (st.bag && points?.length) { st.calib.push(points); if (st.calib.length > 24) st.calib.shift(); } },
      // fine calibrazione: zone dal tuo corpo, bersagli, ROI per le miniature, rilevatore dei contatti
      arm: (order) => {
        if (!st.bag) return;
        const { stance: stc, moves: ids, labels: lab } = cfg.current;
        const zones = bagZones(st.bag, medianPose(st.calib) || st.points, { stance: stc });
        const roi = roiFor(st.bag, zones);
        st.zones = zones;
        st.targets = bagTargets(st.bag, zones, ids, { labels: lab, stance: stc });
        st.det = createBagContacts({ bag: st.bag, zones, roi, order });
        st.cam?.setRoi?.(roi);
        st.mode = 'live'; st.calib = []; st.trace = [];
      },
      startRep: () => { st.hits = {}; st.live = []; st.usable = false; },
      setLive: (statuses) => { st.live = statuses; },
      liveHit: (i) => st.hits[i] != null,
      // fine ripetizione: colpi del motore ↔ contatti, poi la combo giudicata coi lati corretti
      score: (judge, since) => {
        if (!st.det) return null;
        const contacts = st.det.contacts(since);
        const m = matchContacts(judge.gestures().filter((g) => g.start >= since), contacts, { sideOf: judge.sideOf });
        const result = judgeSequence(cfg.current.moves, m.gestures);
        const sc = bagScore(result, st.targets);
        const now = performance.now(), hits = {};
        sc.hit.forEach((h, i) => { if (h) hits[i] = st.hits[i] ?? now; });
        st.hits = hits;
        // sacco mai visto bene e nessun contatto: non si dice "0 a segno"
        return { result, bag: st.usable || contacts.length ? sc : null, gestures: m.gestures };
      },
      overlay: (ctx, W, H, points, now, info) => {
        if (!st.bag || st.mode === 'off') return;
        st.flashes = st.flashes.filter((f) => now - f.t < 500);
        drawBag(ctx, W, H, {
          bag: st.bag, mode: st.mode === 'confirm' ? 'confirm' : 'live', targets: st.mode === 'live' ? st.targets : [],
          next: nextTarget(), hits: st.hits, flashes: st.flashes, offsetX: st.det?.state().offsetX || 0, mirrored: Boolean(info?.mirrored),
        }, now);
      },
      close: () => { st.cam?.setRoi?.(null); },
      // registro degli allenamenti (solo lettura): sacco, zone, contatti e movimento dal momento since
      snapshot: (since = -Infinity) => (st.bag ? {
        box: st.bag.box, axis: st.bag.axis, width: st.bag.width, zones: st.zones,
        contacts: st.det ? st.det.contacts(since) : [], motion: st.trace.filter((m) => m[0] >= since),
      } : null),
    };
  }, []);
  api.step = step; api.res = res;
  return api;
}

// Passo «tocca il sacco» sopra la camera
export default function MmaBagStep({ bag, onDone, onSkip }) {
  const { step, res } = bag;
  if (step === 'ready') return null;
  return <div className="mma-bag-step" onClick={(e) => e.stopPropagation()}>
    {step === 'tap'
      ? <><strong>{res?.hint || 'Tocca il sacco sullo schermo'}</strong><small>Ne trovo il contorno e ci metto sopra i bersagli della combo.</small></>
      : <><strong>{res?.ok ? 'È questo il sacco?' : res?.hint}</strong><small>Se il contorno è sbagliato tocca un altro punto del sacco.</small></>}
    <div className="mma-bag-actions">
      {step === 'check' && <button className="primary" onClick={() => { bag.accept(); onDone(); }}>{res?.ok ? 'Va bene' : 'Usa comunque'}</button>}
      {step === 'check' && <button onClick={bag.retap}>Ritocca</button>}
      {step === 'tap' && <button onClick={onSkip}>Continua senza sacco</button>}
    </div>
  </div>;
}

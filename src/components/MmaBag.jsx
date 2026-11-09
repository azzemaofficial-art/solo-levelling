import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeBag, bagFromBand, bagScore, bagTargets, bagZones, createBagContacts, findBand, matchContacts, roiFor } from '../../lib/mmaBag';
import { TORSO_CM, readTorso, saveTorso, scaleCheck } from '../../lib/mmaMetrics';
import { drawBag } from '../../lib/mmaBagDraw';
import { judgeSequence } from '../../lib/mmaComboJudge';
import { openBagMic } from '../utils/bagMic';

// Modalità «al sacco» del coach con camera: tocchi il sacco sullo schermo, il coach ne trova il
// contorno, ci mette sopra i bersagli della combo (all'altezza del TUO viso/fegato/coscia) e conta
// i colpi che arrivano davvero: pugno che si ferma sul bordo + sacco che si muove (lib/mmaBag.js),
// e lo schiocco del guanto sentito dal microfono (lib/mmaBagSound.js; l'audio resta sul telefono).

const KEY = 'shadow_monarch_mma_bag';
export const readBagMode = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const saveBagMode = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage */ } };

export const readTorsoInfo = () => { const cm = readTorso(); return cm ? { cm, source: 'salvata' } : { cm: TORSO_CM.fallback, source: 'stima' }; };

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
  if (!s.current) s.current = { cam: null, points: null, calib: [], bag: null, zones: null, targets: [], det: null, mode: 'off', phase: '', hits: {}, flashes: [], live: [], usable: false, trace: [], mic: null };
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
      reset: () => { st.bag = null; st.det = null; st.mode = 'off'; st.calib = []; st.targets = []; st.hits = {}; st.trace = []; setRes(null); setStep('tap'); st.cam?.setRoi?.(null); st.mic?.stop(); st.mic = null; },
      // microfono: solo al sacco, chiamato dentro il tocco di «Avvia la camera» (iOS)
      listen: () => { if (!st.mic) st.mic = openBagMic(); },
      // tocco sullo schermo → punto dell'immagine → analisi del fotogramma
      tap: (clientX, clientY) => {
        const p = st.cam?.toImagePoint?.(clientX, clientY);
        if (!p || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
        // prima la fascia arancione, su un'immagine più grande: un pixel in più o in meno pesa meno sulla scala
        const big = st.cam?.grabFrame?.(640);
        const band = findBand(big, p, { points: st.points });
        const r = band ? bagFromBand(band, big.width / big.height, p) : analyzeBag(st.cam?.grabFrame?.(256), p, { points: st.points });
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
        const pose = medianPose(st.calib) || st.points;
        const zones = bagZones(st.bag, pose, { stance: stc });
        // scala: il busto in cm dal sacco. Se il conto non torna resta la misura salvata (o la stima)
        st.scale = scaleCheck(st.bag, pose, st.bag.imgAspect);
        if (st.scale?.torsoCm) saveTorso(st.scale.torsoCm);
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
        const mic = st.mic?.status === 'on';
        const m = matchContacts(judge.gestures().filter((g) => g.start >= since), contacts, { sideOf: judge.sideOf, sounds: mic ? st.mic.det.hits(since - 200).map((h) => h.t) : null });
        // al sacco il telefono è di lato: solo qui rotazione e distensione si possono giudicare
        const seen = m.gestures.map((g) => ({ ...g, sideOn: true }));
        const result = judgeSequence(cfg.current.moves, seen);
        const sc = bagScore(result, st.targets);
        const now = performance.now(), hits = {};
        sc.hit.forEach((h, i) => { if (h) hits[i] = st.hits[i] ?? now; });
        st.hits = hits;
        // sacco mai visto bene, nessun contatto e niente sentito: non si dice "0 a segno"
        return { result, bag: st.usable || contacts.length || sc.hits ? { ...sc, mic } : null, gestures: seen };
      },
      overlay: (ctx, W, H, points, now, info) => {
        if (!st.bag || st.mode === 'off') return;
        st.flashes = st.flashes.filter((f) => now - f.t < 500);
        drawBag(ctx, W, H, {
          bag: st.bag, mode: st.mode === 'confirm' ? 'confirm' : 'live', targets: st.mode === 'live' ? st.targets : [],
          next: nextTarget(), hits: st.hits, flashes: st.flashes, offsetX: st.det?.state().offsetX || 0, mirrored: Boolean(info?.mirrored),
        }, now);
      },
      close: () => { st.cam?.setRoi?.(null); st.mic?.stop(); st.mic = null; },
      contacts: (since = -Infinity) => (st.det ? st.det.contacts(since) : []),
      usable: () => st.usable,
      // quanti cm è il tuo busto, e da dove viene: serve a passare da busti/s a km/h
      torso: () => (st.scale?.torsoCm ? { cm: st.scale.torsoCm, source: 'sacco' } : readTorsoInfo()),
      // registro degli allenamenti (solo lettura): sacco, zone, contatti e movimento dal momento since
      snapshot: (since = -Infinity) => (st.bag ? {
        box: st.bag.box, axis: st.bag.axis, width: st.bag.width, zones: st.zones, scale: st.scale || null,
        contacts: st.det ? st.det.contacts(since) : [], motion: st.trace.filter((m) => m[0] >= since),
        // microfono: solo tempi e livelli dei colpi sentiti (e dei quasi-colpi), mai l'audio
        mic: st.mic?.status || null, sounds: st.mic ? st.mic.det.all(since - 200) : null,
      } : null),
    };
  }, []);
  useEffect(() => api.close, [api]); // il microfono si spegne anche se il coach si chiude da fuori
  api.step = step; api.res = res;
  return api;
}

// Passo «tocca il sacco» sopra la camera
export default function MmaBagStep({ bag, onDone, onSkip }) {
  const { step, res } = bag;
  if (step === 'ready') return null;
  return <div className="mma-bag-step" onClick={(e) => e.stopPropagation()}>
    {step === 'tap'
      ? <><strong>{res?.hint || 'Tocca la fascia arancione del sacco'}</strong><small>Da lì misuro il sacco (26 × 92 cm) e ci metto sopra i bersagli.</small></>
      : <><strong>{res?.ok ? 'È questo il sacco?' : res?.hint}</strong><small>{res?.realCm ? 'Misurato dalla fascia arancione: questa è anche la scala della velocità.' : 'Fascia arancione non trovata: se il contorno è sbagliato tocca un altro punto. La velocità sarà una stima.'}</small></>}
    <div className="mma-bag-actions">
      {step === 'check' && <button className="primary" onClick={() => { bag.accept(); onDone(); }}>{res?.ok ? 'Va bene' : 'Usa comunque'}</button>}
      {step === 'check' && <button onClick={bag.retap}>Ritocca</button>}
      {step === 'tap' && <button onClick={onSkip}>Continua senza sacco</button>}
    </div>
  </div>;
}

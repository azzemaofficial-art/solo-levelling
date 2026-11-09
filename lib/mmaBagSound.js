// ─────────────────────────────────────────────────────────────────────────────
// Colpi al sacco sentiti dal microfono: logica pura (niente DOM), testabile in Node.
//
// Perché: la camera va a ~30 fps (un fotogramma ogni 33 ms) e da 3 metri non sempre vede il guanto
// che tocca il sacco. Il guanto sul sacco fa un «tac» secco: sale in pochi millisecondi e si spegne
// in poche decine. Il microfono lo sente al millisecondo.
//
// 1. createSoundFeatures(): campioni → energia sopra ~1 kHz ogni 2,5 ms (passa-alto di 2° ordine).
//    Lo schiocco del guanto ha molta energia lassù; voce (anche quella del coach) e passi stanno
//    soprattutto sotto.
// 2. createSoundHits(): un colpo è un picco che (a) sta molto sopra il fondo (mediana + k·MAD
//    dell'ultimo 1,5 s, e almeno levelDb), (b) ha un attacco secco (attackDb sopra il livello di
//    8–18 ms prima: una sillaba sale in 20–50 ms), (c) si spegne presto (decayDb sotto, 30–50 ms
//    dopo: vocali e il «tss» del fiato restano su), (d) arriva almeno 80 ms dopo il colpo prima
//    (catena che vibra, eco), (e) non mentre parla il coach (speechSynthesis) né subito dopo.
//
// Privacy: l'audio resta sul telefono, in memoria per un paio di secondi, e non si salva né si
// invia. Escono solo i tempi dei colpi (con quanto erano forti e secchi, in dB) per ritarare.
//
// Soglie: tutte in SOUND, da prove sintetiche (tests/mmaBagSound.test.js), NON da un sacco vero:
// da tarare alla prima sessione al sacco (11/11/2026) con le clip del registro.
// ─────────────────────────────────────────────────────────────────────────────

export const SOUND = {
  hpHz: 1000,       // passa-alto: sotto ~1 kHz voce, passi, tonfo basso del sacco
  hopMs: 2.5,       // un valore di energia ogni 2,5 ms
  bgMs: 1500,       // fondo: mediana dell'ultimo 1,5 s (i colpi sono brevi, non la spostano)
  levelDb: 18,      // un colpo sta almeno 18 dB (60 volte l'energia) sopra il fondo…
  k: 3,             // …e 3 deviazioni del fondo: mentre parli o con la musica la soglia sale molto
                    // (meglio non sentire un colpo che sentirne uno finto; la camera conta lo stesso)
  attackDb: 12,     // attacco secco: +12 dB rispetto a 8–18 ms prima
  attackMs: 8,
  decayDb: 8,       // si spegne: −8 dB 30–50 ms dopo il picco
  decayMs: 40,
  refractory: 80,   // dopo un colpo 80 ms sordi (vibrazione della catena, eco della stanza)
  speechTail: 400,  // dopo la voce del coach: eco + ritardo del segnale «sta parlando»
  logDb: 10,        // per il registro anche i quasi-colpi da 10 dB in su: dicono se le soglie sono giuste
  // shortcut: ritardo fisso camera → microfono (presentationTime del video contro l'audio), da misurare
  // l'11/11 dalle clip (contatto − suono) e da mettere qui; i telefoni danno 30–100 ms
  camLag: 50,
  winContact: [-100, 100], // suono ↔ contatto della camera (ms, sull'orologio dei fotogrammi)
  winPeak: [-100, 100],    // suono ↔ picco del gesto, quando la camera non ha visto il contatto
  // il suono vicino al picco basta per «a segno» anche senza contatto. Rischio: musica con la batteria
  // vicino a un colpo a vuoto. Se l'11/11 escono colpi finti, false qui (il suono allora conferma e basta)
  alone: true,
};

const median = (arr) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Campioni del microfono → [{ t, e }]: e = energia media sopra hpHz nel passo che inizia a t (ms).
// push(samples, t0): t0 = ora (ms, orologio di performance.now) del primo campione del blocco.
export function createSoundFeatures(sampleRate, { hpHz = SOUND.hpHz, hopMs = SOUND.hopMs } = {}) {
  const a = 1 / (1 + (2 * Math.PI * hpHz) / sampleRate); // RC / (RC + dt)
  const hop = Math.max(16, Math.round((sampleRate * hopMs) / 1000));
  let x1 = 0, y1 = 0, z1 = 0, sum = 0, n = 0, tHop = 0;
  return function push(samples, t0) {
    const out = [];
    for (let i = 0; i < samples.length; i += 1) {
      if (n === 0) tHop = t0 + (i * 1000) / sampleRate;
      const x = samples[i];
      // due passa-alto di 1° ordine in fila: 12 dB per ottava sotto hpHz
      const y = a * (y1 + x - x1), z = a * (z1 + y - y1);
      x1 = x; y1 = y; z1 = z;
      sum += z * z; n += 1;
      if (n === hop) { out.push({ t: tHop, e: sum / hop }); sum = 0; n = 0; }
    }
    return out;
  };
}

// Rilevatore. push(e, t, { speaking }) a ogni passo: restituisce i colpi nuovi { t, db, a, d, ok }
// (t = inizio del colpo; db = sopra il fondo; a = attacco; d = discesa). Ogni passo si giudica
// quando c'è abbastanza futuro (decayMs + 10 ms): i colpi escono con ~50 ms di ritardo.
export function createSoundHits() {
  let h = [], next = 0, last = -Infinity, spkUntil = -Infinity, bg = null, all = [];
  const reset = () => { h = []; next = 0; last = -Infinity; spkUntil = -Infinity; bg = null; all = []; };

  function judge(c) {
    const p = h[c];
    if (p.spk || p.t - last < SOUND.refractory) return null;
    // fondo: ricalcolato ogni 50 ms, solo dal passato (niente del colpo stesso)
    if (!bg || p.t - bg.at >= 50 || p.t < bg.at) {
      const past = [];
      for (const q of h) { if (q.t > p.t - 20) break; if (q.t >= p.t - SOUND.bgMs) past.push(q.db); }
      if (past.length < 40) return null; // meno di 0,1 s di fondo: ancora non si sa cosa è forte
      const m = median(past);
      bg = { at: p.t, m, s: Math.max(1, 1.4826 * median(past.map((v) => Math.abs(v - m)))) };
    }
    const lvl = p.db - bg.m;
    if (lvl < SOUND.logDb) return null;
    // picco locale: nessun passo più forte entro ±attackMs (a parità vale il primo)
    for (let j = c - 1; j >= 0 && h[j].t >= p.t - SOUND.attackMs; j -= 1) if (h[j].db >= p.db) return null;
    for (let j = c + 1; j < h.length && h[j].t <= p.t + SOUND.attackMs; j += 1) if (h[j].db > p.db) return null;
    // inizio del colpo: il primo passo già a 6 dB dal picco; attacco: il più forte di 8–18 ms prima
    let pre = -Infinity, on = p.t;
    for (let j = c - 1; j >= 0 && h[j].t >= p.t - SOUND.attackMs - 10; j -= 1) {
      if (h[j].t < p.t - SOUND.attackMs) pre = Math.max(pre, h[j].db);
      else if (h[j].db >= p.db - 6) on = h[j].t;
    }
    let post = 0, np = 0;
    for (let j = c + 1; j < h.length; j += 1) {
      const dt = h[j].t - p.t;
      if (dt > SOUND.decayMs + 10) break;
      // energia media (non media dei dB): le vocali sono impulsi a ogni periodo della voce, e la
      // media dei dB li farebbe sembrare un suono che si spegne
      if (dt >= SOUND.decayMs - 10) { post += 10 ** (h[j].db / 10); np += 1; }
    }
    if (!np || pre === -Infinity) return null;
    const a = p.db - pre, d = p.db - 10 * Math.log10(post / np);
    const ok = lvl >= Math.max(SOUND.levelDb, SOUND.k * bg.s) && a >= SOUND.attackDb && d >= SOUND.decayDb;
    if (ok) last = p.t;
    return { t: Math.round(on * 10) / 10, db: Math.round(lvl), a: Math.round(a), d: Math.round(d), ok };
  }

  function push(e, t, { speaking = false } = {}) {
    if (!Number.isFinite(e) || !Number.isFinite(t)) return [];
    if (speaking) spkUntil = t + SOUND.speechTail;
    // pavimento a −100 dB: il silenzio digitale (microfono muto) non diventa un fondo infinitamente basso
    h.push({ t, db: 10 * Math.log10(e + 1e-10), spk: t <= spkUntil });
    const fresh = [];
    while (next < h.length && h[next].t <= t - SOUND.decayMs - 10) {
      const ev = judge(next);
      next += 1;
      if (!ev) continue;
      all.push(ev);
      if (all.length > 300) all.shift();
      if (ev.ok) fresh.push(ev);
    }
    // resta solo la storia che serve al fondo del prossimo passo da giudicare
    let cut = 0;
    while (cut < next - 8 && h[cut].t < t - SOUND.bgMs - SOUND.decayMs - 100) cut += 1;
    if (cut > 64) { h.splice(0, cut); next -= cut; }
    return fresh;
  }

  return {
    push, reset,
    hits: (since = -Infinity) => all.filter((ev) => ev.ok && ev.t >= since),
    // anche i quasi-colpi (ok: false): solo per il registro degli allenamenti
    all: (since = -Infinity) => all.filter((ev) => ev.t >= since),
  };
}

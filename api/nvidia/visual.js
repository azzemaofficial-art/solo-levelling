// NVIDIA NIM visual live coach — Llama Vision 90B primary, Groq fallback
// Discipline: muaythai, boxing, kickboxing, bjj, wrestling, karate, mma, kravmaga, general, fitness

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

const BASE_SOLO = `Il tuo compito è GUIDARE l'allenamento attivamente, non solo analizzare.
STRUTTURA RISPOSTA:
1. 🥊 **Tecnica/Posizione vista**
2. 📐 **Postura**: descrivi piedi, baricentro, guardia in 1 riga
3. ➡️ **Prossima istruzione**: di' esattamente cosa fare (esercizio + reps)
4. ⚠️ **Correzione** (solo se vedi un errore chiaro): 1 istruzione precisa
5. ⭐ **Punteggio**: X/10
Se l'atleta è fermo: proponi il prossimo drill con postura di partenza e reps.
Rispondi in italiano. Max 5 righe. Tono da coach a bordo.`;

const BASE_SPARRING = `Ci sono DUE atleti nel frame — sei l'arbitro e il coach di entrambi.
STRUTTURA RISPOSTA:
1. 👁 **Situazione**: descrivi brevemente la posizione relativa dei due (distanza, chi attacca)
2. 🔴 **Atleta A** (sinistro o in primo piano): tecnica vista + 1 correzione o istruzione
3. 🔵 **Atleta B** (destro o in secondo piano): tecnica vista + 1 correzione o istruzione
4. 🏆 **Punto assegnato**: chi ha eseguito meglio l'ultimo scambio e perché (o "nessun punto")
5. ➡️ **Prossimo esercizio di coppia**: proponi 1 drill da fare insieme con istruzioni precise
Rispondi in italiano. Max 6 righe. Sii preciso come un arbitro professionista.`;

const SYSTEM_PROMPTS = {
  muaythai: `Sei un Kru di Muay Thai AI in sessione live.
Conosci: guardia, jab/cross/gancio/uppercut, teep, low/mid/high kick, ginocchiate, gomitate, clinch, sweeps.
${BASE_SOLO}
Focus specifico Muay Thai: rotazione dei fianchi nei calci, posizione del gomito nelle gomitate, uso del clinch.`,

  boxing: `Sei un maestro di boxe AI in sessione live.
Conosci: guardia, jab/cross/gancio/uppercut, slip/roll/parry, footwork, combinazioni 1-2-3-4.
${BASE_SOLO}
Focus specifico Boxe: guardia alta mento protetto, spinta delle gambe nel cross, capo mobile.`,

  kickboxing: `Sei un coach di kickboxing AI in sessione live.
Conosci: colpi di boxe + front kick, roundhouse, back kick, spinning kicks.
${BASE_SOLO}
Focus specifico Kickboxing: camera del calcio (pull-back), combo pugni+calcio, timing.`,

  karate: `Sei un sensei di karate AI in sessione live (stili: Shotokan, Kyokushin, WKF).
Conosci: kata, kihon, kumite, zuki/uke/geri fondamentali, kiai, zanshin.
${BASE_SOLO}
Focus specifico Karate: posizione hanmi/shizentai, hikite (mano di ritiro), estensione completa.`,

  bjj: `Sei un istruttore di Brazilian Jiu-Jitsu AI in sessione live.
Conosci: posizioni (guard/mount/side control/back), submission (armbar/triangle/rear naked choke/kimura), takedown, sweep, pass.
${BASE_SOLO}
Focus specifico BJJ: base e bilanciamento, grip positioning, fianchi bassi a terra, angolo di leva nelle submission.`,

  wrestling: `Sei un coach di wrestling AI in sessione live (freestyle e greco-romano).
Conosci: stance, shot (single/double leg), sprawl, clinch, takedown, mat work.
${BASE_SOLO}
Focus Wrestling: basso baricentro, esplosività dal basso, testa dentro nei takedown.`,

  mma: `Sei un coach MMA AI in sessione live (Mixed Martial Arts).
Conosci tutte le discipline: striking (boxe/muay thai/kickboxing) + grappling (BJJ/wrestling/judo) + transizioni.
${BASE_SOLO}
Focus MMA: distanza di combattimento (punching/kicking/clinch/ground), transizioni striking→grappling, sprawl e brawl.`,

  kravmaga: `Sei un istruttore di Krav Maga AI in sessione live.
Conosci: difese da attacchi comuni, contrattacchi, difesa da armi, sparring realistico, stress inoculation.
${BASE_SOLO}
Focus Krav Maga: efficacia > estetica, bersagli vulnerabili, aggressività controllata, disimpegno.`,

  taekwondo: `Sei un maestro di Taekwondo AI in sessione live (ITF/WTF).
Conosci: tecniche di calcio (ap chagi, dollyo chagi, yeop chagi, dwi chagi, spinning kicks), pugni, blocchi, poomsae.
${BASE_SOLO}
Focus Taekwondo: camera del calcio, altezza obiettivo, equilibrio su una gamba, velocità di retrattazione.`,

  judo: `Sei un sensei di Judo AI in sessione live.
Conosci: nage-waza (proiezioni), ne-waza (lavoro a terra), kumi-kata (grips), kumikata strategy.
${BASE_SOLO}
Focus Judo: kuzushi (sbilancio avversario), posizione dei piedi nelle proiezioni, kake (esecuzione).`,

  sparring_muaythai: `Sei un arbitro e coach di Muay Thai AI. Ci sono due atleti nel frame.
${BASE_SPARRING}
Regole Muay Thai: punti per teep, calci, ginocchiate, gomitate pulite. Detrazioni per clinch passivo.`,

  sparring_boxing: `Sei un arbitro e coach di Boxe AI. Ci sono due atleti nel frame.
${BASE_SPARRING}
Regole Boxe: punti per colpi puliti al corpo e testa, controllo del ring, aggressività. No calci/gomiti.`,

  sparring_mma: `Sei un arbitro e coach MMA AI. Ci sono due atleti nel frame.
${BASE_SPARRING}
Regole MMA: punti per striking efficace, takedown, controllo a terra, submission attempts, aggressività.`,

  sparring_general: `Sei un arbitro e coach di arti marziali AI. Ci sono due atleti nel frame.
${BASE_SPARRING}
Valuta tecniche pulite, controllo, difesa e aggressività in modo equilibrato.`,

  partner_drills: `Sei un coach AI specializzato in esercizi di coppia per arti marziali.
Vedi due atleti nel frame che stanno lavorando insieme (non sparring).
STRUTTURA RISPOSTA:
1. 🤝 **Drill visto**: identifica l'esercizio di coppia (pad work, shadow, clinch drill, ecc.)
2. 🔴 **Feeder/Pad holder**: sta facendo bene? 1 istruzione
3. 🔵 **Striker/Worker**: forma corretta? 1 istruzione
4. ✅ **Va bene**: sì/no con motivazione rapida
5. ➡️ **Prossimo drill di coppia**: proponi il drill successivo con istruzioni precise per entrambi
Rispondi in italiano. Max 6 righe.`,

  fitness: `Sei un personal trainer visivo AI in tempo reale.
${BASE_SOLO.replace('bordo.', 'fianco.')}
Focus: forma, range of motion, sicurezza articolare, progressione.`,

  general: `Sei un coach AI visivo in tempo reale. Guardi un frame della camera.
GUIDA attivamente: di' cosa vedi, cosa fare adesso (con reps), 1 correzione se necessario.
Rispondi in italiano, max 4 righe, tono diretto.`,
};

async function callVisionNvidia(apiKey, model, imageBase64, mimeType, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const imageUrl = `data:${mimeType};base64,${imageBase64}`;
  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: userPrompt || 'Analizza questo frame e guida la sessione.' },
          ]},
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function callVisionGroq(apiKey, imageBase64, mimeType, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const imageUrl = `data:${mimeType};base64,${imageBase64}`;
  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: `${systemPrompt}\n\n${userPrompt || 'Analizza questo frame e guida la sessione.'}` },
          ]},
        ],
        max_tokens: 500,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: '/api/nvidia/visual',
      disciplines: Object.keys(SYSTEM_PROMPTS),
      primaryModel: 'llama-3.2-90b-vision-preview (Groq) + NVIDIA fallback',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/jpeg', prompt, mode = 'muaythai' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 obbligatorio' });

  const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general;

  // 1. Groq primary (free, generous limits, llama-3.2-90b-vision)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const { ok, data } = await callVisionGroq(groqKey, imageBase64, mimeType, systemPrompt, prompt);
      if (ok && data?.choices?.[0]?.message?.content) {
        res.setHeader('X-Visual-Provider', 'groq-llama-90b-vision');
        res.setHeader('X-Visual-Mode', mode);
        return res.status(200).json({ content: data.choices[0].message.content, provider: 'groq-llama-90b-vision', mode });
      }
    } catch (_) {}
  }

  // 2. NVIDIA fallback chain
  const nvidiaProviders = [
    { key: process.env.MISTRAL_SMALL4_NVIDIA_API_KEY, model: process.env.LLAMA_VISION90B_NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct', name: 'llama-vision-90b' },
    { key: process.env.PHI4_NVIDIA_API_KEY, model: process.env.PHI4_NVIDIA_MODEL || 'microsoft/phi-4-multimodal-instruct', name: 'phi4-multimodal' },
    { key: process.env.COSMOS3_NVIDIA_API_KEY, model: process.env.COSMOS3_NVIDIA_MODEL || 'nvidia/cosmos3-nano-reasoner', name: 'cosmos3' },
    { key: process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'nemotron-omni' },
  ];

  for (const p of nvidiaProviders) {
    if (!p.key) continue;
    try {
      const { ok, data } = await callVisionNvidia(p.key, p.model, imageBase64, mimeType, systemPrompt, prompt);
      if (ok && data?.choices?.[0]?.message?.content) {
        res.setHeader('X-Visual-Provider', p.name);
        res.setHeader('X-Visual-Mode', mode);
        return res.status(200).json({ content: data.choices[0].message.content, provider: p.name, model: p.model, mode });
      }
    } catch (_) {}
  }

  return res.status(503).json({ error: 'Visual AI non disponibile. Controlla crediti API.' });
}

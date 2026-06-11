import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Quick prompts per chat generale ──────────────────────────────────────────
const COACH_QUICK = [
  { label: '🥩 Ricetta proteica', text: 'Dammi una ricetta ad alto contenuto proteico (almeno 40g di proteine) veloce da preparare, con macro completi.' },
  { label: '💊 Integratori base', text: 'Quali integratori base consiglia la scienza per un atleta naturale? Dosaggi e timing.' },
  { label: '📊 Macro per bulk', text: 'Come calcolo i macronutrienti per una fase di bulk pulita? Peso 75kg, altezza 178cm, alleno 4x settimana.' },
  { label: '🏋️ Scheda push/pull', text: 'Crea una scheda push/pull/legs 6 giorni per ipertrofia, livello intermedio, palestra.' },
  { label: '🥊 Conditioning MMA', text: 'Crea un piano di conditioning per un praticante di arti marziali miste, 3 sessioni/settimana.' },
  { label: '😴 Recupero e sonno', text: 'Come ottimizzare il recupero muscolare e il sonno per massimizzare i guadagni?' },
];

// ─── Quick prompts per personal trainer ───────────────────────────────────────
const TRAINER_QUICK = [
  { label: '🔥 Piano calorico', text: 'Calcolami il fabbisogno calorico giornaliero e i macro ideali. Peso 75kg, 178cm, 25 anni, maschio, allenamento 4x/settimana, obiettivo massa muscolare.' },
  { label: '🥗 Piano pasti 7gg', text: 'Crea un piano pasti completo per 7 giorni, ~2800 kcal/giorno, alto contenuto proteico (160g+), con ricette e macro per ogni pasto.' },
  { label: '💪 Scheda arti marziali', text: 'Crea una scheda di allenamento per migliorare forza esplosiva, mobilità e resistenza specifica per le arti marziali (3-4x settimana).' },
  { label: '🥊 Migliori esercizi', text: 'Quali sono i 10 esercizi più efficaci per un praticante di arti marziali che vuole migliorare potenza, velocità e resistenza?' },
  { label: '💊 Stack integratori', text: 'Costruisci uno stack di integratori evidence-based per un atleta di arti marziali: cosa prendere, quando, quanto.' },
  { label: '🍳 Ricetta post-workout', text: 'Dammi 3 ricette post-allenamento veloci, almeno 40g di proteine, con macro precisi.' },
];

// ─── Discipline e modalità visual coach ───────────────────────────────────────
const DISCIPLINE_GROUPS = [
  {
    label: '👤 Solo',
    items: [
      { id: 'muaythai',   emoji: '🥊', label: 'Muay Thai',   prompt: 'Guida la mia sessione di Muay Thai. Analizza tecnica, postura e di\' cosa fare.' },
      { id: 'boxing',     emoji: '🥊', label: 'Boxe',        prompt: 'Guida la mia sessione di boxe. Analizza guardia, colpi e footwork.' },
      { id: 'kickboxing', emoji: '🦵', label: 'Kickboxing',  prompt: 'Guida la mia sessione di kickboxing. Analizza pugni e calci.' },
      { id: 'karate',     emoji: '🥋', label: 'Karate',      prompt: 'Guida la mia sessione di karate. Analizza kihon, kata o kumite.' },
      { id: 'taekwondo',  emoji: '🦵', label: 'Taekwondo',   prompt: 'Guida la mia sessione di taekwondo. Analizza calci e poomsae.' },
      { id: 'bjj',        emoji: '🤼', label: 'BJJ',         prompt: 'Guida la mia sessione di BJJ. Analizza posizioni, guard e submission.' },
      { id: 'wrestling',  emoji: '🤼', label: 'Wrestling',   prompt: 'Guida la mia sessione di wrestling. Analizza stance, shot e mat work.' },
      { id: 'judo',       emoji: '🥋', label: 'Judo',        prompt: 'Guida la mia sessione di judo. Analizza kumi-kata e proiezioni.' },
      { id: 'mma',        emoji: '🏆', label: 'MMA',         prompt: 'Guida la mia sessione MMA. Analizza striking, grappling e transizioni.' },
      { id: 'kravmaga',   emoji: '⚔️', label: 'Krav Maga',  prompt: 'Guida la mia sessione di Krav Maga. Analizza efficacia e reattività.' },
    ],
  },
  {
    label: '👥 Con partner',
    items: [
      { id: 'sparring_muaythai', emoji: '🥊', label: 'Sparring MT',   prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. Muay Thai.' },
      { id: 'sparring_boxing',   emoji: '🥊', label: 'Sparring Boxe', prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. Boxe.' },
      { id: 'sparring_mma',      emoji: '🏆', label: 'Sparring MMA',  prompt: 'Siamo in due — arbitraci e dai feedback a entrambi. MMA.' },
      { id: 'partner_drills',    emoji: '🤝', label: 'Drill coppia',  prompt: 'Stiamo facendo drill di coppia — valuta entrambi e proponi il drill successivo.' },
      { id: 'sparring_general',  emoji: '👥', label: 'Sparring free', prompt: 'Siamo in due — arbitraci liberamente e dai consigli a entrambi.' },
    ],
  },
  {
    label: '💪 Altro',
    items: [
      { id: 'fitness', emoji: '🏋️', label: 'Palestra',  prompt: 'Guida il mio allenamento in palestra. Analizza forma ed esercizi.' },
      { id: 'general', emoji: '👁',  label: 'Generale',  prompt: 'Analizza il movimento e guidami. Feedback libero.' },
    ],
  },
];

// ─── Hook chat generica ────────────────────────────────────────────────────────
function useChat(endpoint) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(async (userText, extraBody = {}) => {
    if (!userText.trim() || loading) return;
    setError(null);
    const userMsg = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].slice(-12);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, ...extraBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content, provider: data.provider }]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [messages, loading, endpoint]);

  const clear = useCallback(() => { setMessages([]); setError(null); }, []);
  return { messages, loading, error, send, clear };
}

// ─── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-100 border border-gray-700/60 rounded-bl-sm'}`}>
        {!isUser && msg.provider && (
          <div className="text-xs text-gray-500 mb-1 font-mono">🤖 {msg.provider}</div>
        )}
        {msg.content}
      </div>
    </motion.div>
  );
}

// ─── Input bar ─────────────────────────────────────────────────────────────────
function ChatInput({ value, onChange, onSend, loading, placeholder }) {
  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } };
  return (
    <div className="flex gap-2">
      <textarea value={value} onChange={onChange} onKeyDown={handleKey} placeholder={placeholder}
        rows={2}
        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors" />
      <button onClick={onSend} disabled={loading || !value.trim()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-white font-bold text-sm self-stretch transition-colors">
        ↑
      </button>
    </div>
  );
}

// ─── Tab: Chat generale ────────────────────────────────────────────────────────
function CoachChat() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/coach');

  const handleSend = () => { if (!input.trim()) return; send(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {COACH_QUICK.map((p) => (
            <button key={p.label} onClick={() => send(p.text)}
              className="text-left px-3 py-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-200 transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence>
          {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        </AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                {[0,1,2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 bg-blue-400 rounded-full"
                    animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {error && <div className="text-center text-xs text-red-400 py-2">⚠️ {error}</div>}
        <div ref={endRef} />
      </div>
      {messages.length > 0 && (
        <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-300">🗑 Nuova conversazione</button>
      )}
      <ChatInput value={input} onChange={(e) => setInput(e.target.value)} onSend={handleSend}
        loading={loading} placeholder="Chiedi al coach… (ricette, esercizi, integratori)" />
    </div>
  );
}

// ─── Tab: Personal Trainer (Kimi K2.6) ────────────────────────────────────────
function PersonalTrainer() {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const { messages, loading, error, send, clear } = useChat('/api/nvidia/trainer');

  const handleSend = () => { if (!input.trim()) return; send(input); setInput(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  return (
    <div className="space-y-4">
      {messages.length === 0 && (
        <>
          <div className="px-4 py-3 bg-gradient-to-r from-orange-900/40 to-red-900/30 border border-orange-700/40 rounded-xl">
            <p className="text-xs text-orange-300 font-semibold">🧠 Agente: Kimi K2.6 (NVIDIA NIM)</p>
            <p className="text-xs text-gray-400 mt-0.5">Personal trainer AI specializzato — calorie, macro, ricette, schede, integratori</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TRAINER_QUICK.map((p) => (
              <button key={p.label} onClick={() => send(p.text)}
                className="text-left px-3 py-2.5 bg-gray-800/80 hover:bg-gray-700 border border-orange-800/30 rounded-xl text-xs text-gray-200 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence>
          {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        </AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                {[0,1,2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 bg-orange-400 rounded-full"
                    animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {error && <div className="text-center text-xs text-red-400 py-2">⚠️ {error}</div>}
        <div ref={endRef} />
      </div>
      {messages.length > 0 && (
        <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-300">🗑 Nuova sessione</button>
      )}
      <ChatInput value={input} onChange={(e) => setInput(e.target.value)} onSend={handleSend}
        loading={loading} placeholder="Chiedi al tuo PT… (piano calorico, ricette, scheda)" />
    </div>
  );
}

// ─── Sessioni live salvate in localStorage ────────────────────────────────────
const SESSIONS_KEY = 'shadow_monarch_live_sessions';
const loadSessions = () => { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); } catch { return []; } };
const saveSessions = (sessions) => { try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 10))); } catch {} };

// ─── Tab: Visual Learning Live ─────────────────────────────────────────────────
const ALL_DISCIPLINES = DISCIPLINE_GROUPS.flatMap((g) => g.items);
const isSparring = (id) => id.startsWith('sparring_') || id === 'partner_drills';

function VisualCoach() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState('setup');
  const [sessionContext, setSessionContext] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [mode, setMode] = useState('muaythai');
  const [pastSessions, setPastSessions] = useState(() => loadSessions());
  const autoTimerRef = useRef(null);
  const streamRef = useRef(null);
  const sessionStartRef = useRef(null);

  const currentDisc = ALL_DISCIPLINES.find((d) => d.id === mode) || ALL_DISCIPLINES[0];
  const isPartnerMode = isSparring(mode);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setStreaming(true);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setStreaming(true);
      } catch (err) { alert('Camera non accessibile: ' + err.message); }
    }
  };

  const startSession = async () => {
    sessionStartRef.current = Date.now();
    setStep('live');
    setAnalysis(null);
    await startCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (analysis?.content) {
      const duration = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current) / 60000) : 0;
      const updated = [{ date: new Date().toLocaleDateString('it-IT'), mode, context: sessionContext, keyFeedback: analysis.content.slice(0, 200), duration }, ...pastSessions].slice(0, 10);
      saveSessions(updated);
      setPastSessions(updated);
    }
    setStreaming(false); setAnalysis(null); setAutoMode(false);
    setStep('setup');
    clearInterval(autoTimerRef.current);
  };

  const buildPrompt = useCallback((basePrompt) => {
    let p = basePrompt || '';
    if (sessionContext.trim()) p += `\n\nSESSIONE ATTUALE: ${sessionContext.trim()}`;
    if (pastSessions.length > 0) {
      p += `\n\nSESSIONI PRECEDENTI:\n` + pastSessions.slice(0, 2).map((s) => `- ${s.date} (${s.mode}): ${s.context} → ${s.keyFeedback}`).join('\n');
    }
    return p;
  }, [sessionContext, pastSessions]);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzing) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    setAnalyzing(true);
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, prompt: buildPrompt(currentDisc?.prompt) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore AI');
      setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
    } catch (err) {
      setAnalysis({ content: '⚠️ ' + err.message, provider: null, time: new Date().toLocaleTimeString('it-IT') });
    } finally { setAnalyzing(false); }
  }, [analyzing, mode, buildPrompt, currentDisc]);

  useEffect(() => {
    if (autoMode && streaming) {
      captureAndAnalyze();
      autoTimerRef.current = setInterval(captureAndAnalyze, 6000);
    } else { clearInterval(autoTimerRef.current); }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // ── Setup screen ────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="space-y-4">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-900/40 to-purple-900/30 border border-blue-700/40 rounded-xl">
          <p className="text-xs text-blue-300 font-semibold">📷 Visual Live Coach — Llama Vision 90B</p>
          <p className="text-xs text-gray-400 mt-0.5">Solo, sparring con partner, drill di coppia — 13 discipline</p>
        </div>

        {/* Selector discipline a gruppi */}
        {DISCIPLINE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs text-gray-500 mb-2 font-semibold">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((d) => (
                <button key={d.id} onClick={() => setMode(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    mode === d.id
                      ? 'bg-blue-700 border-blue-500 text-white'
                      : 'bg-gray-800/80 border-gray-700/60 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}>
                  {d.emoji} {d.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Badge sparring */}
        {isPartnerMode && (
          <div className="px-3 py-2 bg-purple-900/30 border border-purple-600/40 rounded-lg">
            <p className="text-xs text-purple-300 font-semibold">👥 Modalità partner attiva</p>
            <p className="text-xs text-gray-400 mt-0.5">Inquadrate entrambi nella camera — l'AI arbitra e dà feedback a entrambi</p>
          </div>
        )}

        {/* Contesto sessione */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Descrivi la sessione <span className="text-gray-600">(opzionale)</span></p>
          <textarea value={sessionContext} onChange={(e) => setSessionContext(e.target.value)} rows={2}
            placeholder={isPartnerMode ? 'Es. Io e mio fratello — round leggero, focus combo...' : `Es. ${currentDisc?.label} – tecnica base, lavoro guardia...`}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors" />
        </div>

        {/* Sessioni recenti */}
        {pastSessions.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Sessioni recenti</p>
            <div className="space-y-1">
              {pastSessions.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => { setMode(s.mode); setSessionContext(s.context); }}
                  className="w-full text-left px-3 py-2 bg-gray-800/50 hover:bg-gray-700/60 border border-gray-700/40 rounded-lg text-xs text-gray-300 transition-colors">
                  <span className="text-gray-500">{s.date} · {s.mode}</span>
                  {s.duration > 0 && <span className="text-gray-600"> · {s.duration}min</span>}
                  <span className="mx-1 text-gray-600">·</span>
                  {s.context.slice(0, 45)}{s.context.length > 45 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={startSession}
          className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-colors ${
            isPartnerMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-blue-600 hover:bg-blue-500'
          }`}>
          {isPartnerMode ? '👥 Inizia Sessione con Partner' : '📷 Inizia Sessione Live'}
        </button>
      </div>
    );
  }

  // ── Live screen ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header sessione */}
      <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${
        isPartnerMode ? 'bg-purple-900/30 border-purple-700/30' : 'bg-blue-900/30 border-blue-700/30'
      }`}>
        <span>{currentDisc?.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">{currentDisc?.label}</p>
          {sessionContext && <p className="text-xs text-gray-400 truncate">{sessionContext}</p>}
        </div>
        {isPartnerMode && <span className="text-xs text-purple-300 font-semibold">👥 PARTNER</span>}
      </div>

      {/* Camera */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-64">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        {streaming && (
          <div className="absolute top-2 right-2 flex gap-1">
            <span className="px-2 py-1 bg-green-600/80 rounded text-xs text-white font-mono">● LIVE</span>
            {autoMode && <span className="px-2 py-1 bg-orange-600/80 rounded text-xs text-white font-mono animate-pulse">AUTO</span>}
          </div>
        )}
        {analyzing && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 rounded-full text-xs text-blue-300 animate-pulse">
            Analisi AI…
          </div>
        )}
      </div>

      {/* Controlli */}
      <div className="flex gap-2">
        <button onClick={captureAndAnalyze} disabled={analyzing}
          className="flex-1 px-4 py-2.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition-colors">
          🔍 Analizza
        </button>
        <button onClick={() => setAutoMode((v) => !v)}
          className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors ${autoMode ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {autoMode ? '⏸ Stop' : '▶ Auto 6s'}
        </button>
        <button onClick={stopCamera}
          className="px-4 py-2.5 bg-red-900 hover:bg-red-800 rounded-lg text-white text-sm font-semibold transition-colors">
          ✕
        </button>
      </div>

      {/* Risultato analisi */}
      <AnimatePresence>
        {analysis && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-800/80 border border-blue-500/30 rounded-xl">
            <p className="text-xs text-blue-400 font-mono mb-2">
              🤖 {analysis.provider || 'AI'} · {currentDisc?.label} · {analysis.time}
            </p>
            <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{analysis.content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'trainer', label: '🏅 PT', full: 'Personal Trainer' },
  { id: 'chat',    label: '💬 Chat', full: 'Coach Chat' },
  { id: 'visual',  label: '📷 Live', full: 'Visual Live' },
];

export default function Coach() {
  const [tab, setTab] = useState('trainer');

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-6">
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-white">🧠 AI Coach</h1>
              <p className="text-xs text-gray-400">Kimi K2.6 · Llama Vision 90B · NVIDIA NIM</p>
            </div>
          </div>
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}>
            {tab === 'trainer' && <PersonalTrainer />}
            {tab === 'chat'    && <CoachChat />}
            {tab === 'visual'  && <VisualCoach />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

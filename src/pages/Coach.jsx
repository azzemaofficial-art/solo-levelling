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

// ─── Modalità visual coach ─────────────────────────────────────────────────────
const VISUAL_MODES = [
  { id: 'martial', label: '🥊 Marziale', desc: 'Analisi tecnica arti marziali', prompt: 'Analizza la tecnica marziale — guardia, colpo, presa o movimento. Dammi feedback preciso.' },
  { id: 'fitness', label: '🏋️ Fitness', desc: 'Forma esercizi palestra', prompt: 'Analizza la forma dell\'esercizio e dai correzioni immediate.' },
  { id: 'general', label: '👁 Generale', desc: 'Analisi generica movimento', prompt: 'Analizza il movimento e il corpo. Descrivi cosa vedi e dai feedback.' },
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

// ─── Tab: Visual Learning Live ─────────────────────────────────────────────────
function VisualCoach() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [mode, setMode] = useState('martial');
  const autoTimerRef = useRef(null);
  const streamRef = useRef(null);

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

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false); setAnalysis(null); setAutoMode(false);
    clearInterval(autoTimerRef.current);
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || analyzing) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    const modeConfig = VISUAL_MODES.find((m) => m.id === mode);

    setAnalyzing(true);
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode, prompt: modeConfig?.prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore visual AI');
      setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
    } catch (err) {
      setAnalysis({ content: '⚠️ ' + err.message, provider: null, time: new Date().toLocaleTimeString('it-IT') });
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, mode]);

  useEffect(() => {
    if (autoMode && streaming) {
      captureAndAnalyze();
      autoTimerRef.current = setInterval(captureAndAnalyze, 6000);
    } else {
      clearInterval(autoTimerRef.current);
    }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const currentMode = VISUAL_MODES.find((m) => m.id === mode);

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {VISUAL_MODES.map((m) => (
          <button key={m.id} onClick={() => { setMode(m.id); setAnalysis(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              mode === m.id ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {currentMode && (
        <p className="text-xs text-gray-500 text-center">{currentMode.desc}</p>
      )}

      {/* Camera */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
            <div className="text-4xl">{currentMode?.label.split(' ')[0]}</div>
            <button onClick={startCamera}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-sm transition-colors">
              📷 Attiva Camera
            </button>
          </div>
        )}
        {streaming && (
          <div className="absolute top-2 right-2 flex gap-1">
            <span className="px-2 py-1 bg-green-600/80 rounded text-xs text-white font-mono">● LIVE</span>
            {autoMode && <span className="px-2 py-1 bg-orange-600/80 rounded text-xs text-white font-mono animate-pulse">AUTO</span>}
          </div>
        )}
        {analyzing && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 rounded-full text-xs text-blue-300 animate-pulse">
            Analisi Cosmos 3…
          </div>
        )}
      </div>

      {streaming && (
        <div className="flex gap-2">
          <button onClick={captureAndAnalyze} disabled={analyzing}
            className="flex-1 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition-colors">
            🔍 Analizza Ora
          </button>
          <button onClick={() => setAutoMode((v) => !v)}
            className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors ${autoMode ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
            {autoMode ? '⏸ Stop Auto' : '▶ Auto 6s'}
          </button>
          <button onClick={stopCamera}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-white text-sm font-semibold transition-colors">
            ✕
          </button>
        </div>
      )}

      <AnimatePresence>
        {analysis && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-800/80 border border-blue-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-blue-400 font-mono">
                🤖 {analysis.provider || 'AI'} · {currentMode?.label} · {analysis.time}
              </span>
            </div>
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
              <p className="text-xs text-gray-400">Kimi K2.6 · Cosmos 3 · NVIDIA NIM</p>
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

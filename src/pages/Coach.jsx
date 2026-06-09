import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const QUICK_PROMPTS = [
  { label: '🥩 Ricetta proteica', text: 'Dammi una ricetta ad alto contenuto proteico (almeno 40g di proteine) veloce da preparare, con macro.' },
  { label: '💊 Integratori base', text: 'Quali integratori base consiglia la scienza per un atleta naturale? Dosaggi e timing.' },
  { label: '📊 Macro per bulk', text: 'Come calcolo i macronutrienti per una fase di bulk pulita? Peso 75kg, altezza 178cm, alleno 4x settimana.' },
  { label: '🏋️ Scheda push/pull', text: 'Crea una scheda push/pull/legs 6 giorni per ipertrofia, livello intermedio, palestra.' },
  { label: '😴 Recupero e sonno', text: 'Come ottimizzare il recupero muscolare e il sonno per massimizzare i guadagni?' },
  { label: '🥗 Pasto pre-workout', text: 'Cosa mangiare 1-2 ore prima dell\'allenamento per massimizzare le performance?' },
];

function useCoachChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(async (userText) => {
    if (!userText.trim() || loading) return;
    setError(null);

    const userMsg = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].slice(-10);
      const res = await fetch('/api/nvidia/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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
  }, [messages, loading]);

  const clear = useCallback(() => { setMessages([]); setError(null); }, []);

  return { messages, loading, error, send, clear };
}

function VisualCoach() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const autoTimerRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        setStreaming(true);
      } catch (err) {
        alert('Camera non accessibile: ' + err.message);
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
    setAnalysis(null);
    clearInterval(autoTimerRef.current);
    setAutoMode(false);
  };

  const captureAndAnalyze = useCallback(async (prompt = '') => {
    if (!videoRef.current || !canvasRef.current || analyzing) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    setAnalyzing(true);
    try {
      const res = await fetch('/api/nvidia/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore visual AI');
      setAnalysis({ content: data.content, provider: data.provider, time: new Date().toLocaleTimeString('it-IT') });
    } catch (err) {
      setAnalysis({ content: '⚠️ ' + err.message, provider: null, time: new Date().toLocaleTimeString('it-IT') });
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  useEffect(() => {
    if (autoMode && streaming) {
      captureAndAnalyze();
      autoTimerRef.current = setInterval(() => captureAndAnalyze(), 6000);
    } else {
      clearInterval(autoTimerRef.current);
    }
    return () => clearInterval(autoTimerRef.current);
  }, [autoMode, streaming]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startCamera}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-sm transition-colors"
            >
              📷 Attiva Camera
            </button>
          </div>
        )}
        {streaming && (
          <div className="absolute top-2 right-2 flex gap-2">
            <span className="px-2 py-1 bg-green-600/80 rounded text-xs text-white font-mono">● LIVE</span>
          </div>
        )}
        {analyzing && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-blue-300 animate-pulse">
            Analisi in corso…
          </div>
        )}
      </div>

      {streaming && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => captureAndAnalyze()}
            disabled={analyzing}
            className="flex-1 min-w-[140px] px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition-colors"
          >
            🔍 Analizza Frame
          </button>
          <button
            onClick={() => setAutoMode((v) => !v)}
            className={`flex-1 min-w-[140px] px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors ${autoMode ? 'bg-orange-600 hover:bg-orange-500' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            {autoMode ? '⏸ Stop Auto' : '▶ Auto (6s)'}
          </button>
          <button
            onClick={stopCamera}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-white text-sm font-semibold transition-colors"
          >
            ✕ Stop
          </button>
        </div>
      )}

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-800/80 border border-blue-500/30 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-blue-400 font-mono">
                🤖 {analysis.provider || 'AI'} · {analysis.time}
              </span>
            </div>
            <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{analysis.content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm'
      }`}>
        {!isUser && msg.provider && (
          <div className="text-xs text-gray-500 mb-1 font-mono">🤖 {msg.provider}</div>
        )}
        {msg.content}
      </div>
    </motion.div>
  );
}

export default function Coach() {
  const [tab, setTab] = useState('chat');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const { messages, loading, error, send, clear } = useCoachChat();

  const handleSend = () => {
    if (!inputText.trim()) return;
    send(inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-white">🧠 AI Coach</h1>
            <p className="text-xs text-gray-400">NVIDIA NIM · Cosmos 3 · Kimi K2.6</p>
          </div>
          <div className="flex gap-1">
            {['chat', 'visual'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {t === 'chat' ? '💬 Chat' : '📷 Visual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {tab === 'visual' ? (
          <VisualCoach />
        ) : (
          <>
            {/* Quick prompts */}
            {messages.length === 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => send(p.text)}
                    className="text-left px-3 py-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-200 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="space-y-3 mb-4 min-h-[120px]">
              <AnimatePresence>
                {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
              </AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div key={i} className="w-2 h-2 bg-blue-400 rounded-full"
                          animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              {error && (
                <div className="text-center text-xs text-red-400 py-2">⚠️ {error}</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Clear button if messages */}
            {messages.length > 0 && (
              <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-300 mb-3 block">
                🗑 Nuova conversazione
              </button>
            )}

            {/* Input */}
            <div className="sticky bottom-4 flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chiedi al coach… (es. ricetta post-workout)"
                rows={2}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={loading || !inputText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-white font-bold text-sm self-stretch transition-colors"
              >
                ↑
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playSfx } from '../utils/sfx';
import { applyXp } from '../utils/xpLogic';

const Quests = ({ playerStats, setPlayerStats, soundEnabled = true, soundTheme = 'solo' }) => {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const todayIso = new Date().toLocaleDateString('en-CA');
  const STORY_CHAIN_KEY = 'shadow_monarch_story_chain_week';
  const CINEMATIC_THEMES = {
    common: { edge: 'border-cyan-300/55', text: 'text-cyan-100', glow: 'shadow-[0_0_40px_rgba(34,211,238,0.26)]', badge: 'COMMON' },
    rare: { edge: 'border-emerald-300/55', text: 'text-emerald-100', glow: 'shadow-[0_0_44px_rgba(74,222,128,0.28)]', badge: 'RARE' },
    epic: { edge: 'border-fuchsia-300/60', text: 'text-fuchsia-100', glow: 'shadow-[0_0_48px_rgba(217,70,239,0.3)]', badge: 'EPIC' },
    legendary: { edge: 'border-amber-300/60', text: 'text-amber-100', glow: 'shadow-[0_0_52px_rgba(251,191,36,0.3)]', badge: 'LEGENDARY' }
  };

  const safeParseIsoDate = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  };

  const getDiffDays = (fromIso, toDate = new Date()) => {
    const from = safeParseIsoDate(fromIso);
    const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
  };

  // Le missioni obbligatorie del Sistema
  const defaultQuests = [
    { id: 1, title: 'Push-ups', target: 180, rewardExp: 20, rewardGold: 10, done: false },
    { id: 2, title: 'Sit-ups', target: 180, rewardExp: 20, rewardGold: 10, done: false },
    { id: 3, title: 'Squats', target: 180, rewardExp: 20, rewardGold: 10, done: false },
    { id: 4, title: 'Running (km)', target: 16, rewardExp: 40, rewardGold: 20, done: false },
  ];

  // Memoria delle Quests giornaliere (si resetta a mezzanotte!)
  const [questData, setQuestData] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_quests');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === today) return parsed.quests;
    }
    return defaultQuests;
  });

  const [storyChainState, setStoryChainState] = useState(() => {
    const saved = localStorage.getItem(STORY_CHAIN_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.chainStart && parsed?.baseline && Array.isArray(parsed?.claimed)) {
          return parsed;
        }
      } catch {
        // fallback sotto
      }
    }
    return {
      chainStart: todayIso,
      claimed: [],
      baseline: {
        level: playerStats.level || 1,
        completedWorkouts: playerStats.completedWorkouts || 0,
        streak: playerStats.streak || 0,
        systemPowerScore: playerStats.systemPowerScore || 0
      }
    };
  });
  const [chapterCinematic, setChapterCinematic] = useState(null);

  useEffect(() => {
    localStorage.setItem('shadow_monarch_quests', JSON.stringify({ date: today, quests: questData }));
  }, [questData, today]);
  useEffect(() => {
    localStorage.setItem(STORY_CHAIN_KEY, JSON.stringify(storyChainState));
  }, [storyChainState]);

  const getRewardTier = (rewards = {}) => {
    const keys = Number(rewards.keys || 0);
    const shield = Number(rewards.shield || 0);
    const token = Number(rewards.titleToken || 0);
    const exp = Number(rewards.exp || 0);
    const gold = Number(rewards.gold || 0);
    const score = exp + (gold * 0.5) + (keys * 130) + (shield * 90) + (token * 260);
    if (token > 0 || score >= 600) return 'legendary';
    if (score >= 360) return 'epic';
    if (score >= 190) return 'rare';
    return 'common';
  };

  const triggerChapterCinematic = (title, subtitle, tier = 'common') => {
    const theme = CINEMATIC_THEMES[tier] || CINEMATIC_THEMES.common;
    setChapterCinematic({ title, subtitle, tier: theme.badge, edge: theme.edge, text: theme.text, glow: theme.glow });
    const sfxByTier = {
      common: 'click',
      rare: 'success',
      epic: 'streak',
      legendary: 'levelup'
    };
    playSfx(sfxByTier[tier] || 'success', soundEnabled, soundTheme);
    window.setTimeout(() => setChapterCinematic(null), 1300);
  };

  // --- MOTORE DI RICOMPENSA ---
  const handleComplete = (quest) => {
    if (quest.done) return;
    const longJourneyQuestFactor = 0.62;
    
    // Aggiorna la missione come "Fatta"
    const updatedQuests = questData.map(q => q.id === quest.id ? { ...q, done: true } : q);
    setQuestData(updatedQuests);

    // Calcola l'EXP e l'Oro
    setPlayerStats((prev) => {
      const gained = Math.round(quest.rewardExp * longJourneyQuestFactor);
      const newGold = (prev.gold || 0) + Math.round(quest.rewardGold * longJourneyQuestFactor);
      const { level: newLevel, exp: newExp, levelsGained } = applyXp(prev, gained);
      if (levelsGained > 0) {
        alert(`🔥 SYSTEM MESSAGE: LEVEL UP! Sei salito al Livello ${newLevel}!`);
      }
      return { ...prev, level: newLevel, exp: newExp, gold: newGold };
    });
  };

  const allDone = questData.every(q => q.done);

  const storyBaseline = storyChainState.baseline || {};
  const storyProgress = {
    workoutsDelta: Math.max(0, (playerStats.completedWorkouts || 0) - (storyBaseline.completedWorkouts || 0)),
    streakDelta: Math.max(0, (playerStats.streak || 0) - (storyBaseline.streak || 0)),
    levelDelta: Math.max(0, (playerStats.level || 1) - (storyBaseline.level || 1)),
    powerNow: playerStats.systemPowerScore || 0
  };
  const chainDayIndex = Math.min(6, getDiffDays(storyChainState.chainStart, new Date()));
  const chainDaysPassed = chainDayIndex + 1;

  const storyChapters = [
    {
      id: 'day1_init',
      title: 'Day 1 • Gate Oath',
      objective: 'Accedi al sistema e avvia la settimana.',
      progress: 1,
      total: 1,
      completed: true,
      rewards: { exp: 40, gold: 30 }
    },
    {
      id: 'day2_dailies',
      title: 'Day 2 • Discipline Signal',
      objective: 'Completa tutte le Daily Quest.',
      progress: questData.filter((q) => q.done).length,
      total: questData.length,
      completed: allDone,
      rewards: { exp: 80, gold: 50 }
    },
    {
      id: 'day3_workout',
      title: 'Day 3 • Iron Pulse',
      objective: 'Completa almeno 2 workout nella chain.',
      progress: Math.min(storyProgress.workoutsDelta, 2),
      total: 2,
      completed: storyProgress.workoutsDelta >= 2,
      rewards: { exp: 110, gold: 70 }
    },
    {
      id: 'day4_streak',
      title: 'Day 4 • Streak Engine',
      objective: 'Aumenta streak di almeno +4.',
      progress: Math.min(storyProgress.streakDelta, 4),
      total: 4,
      completed: storyProgress.streakDelta >= 4,
      rewards: { exp: 130, gold: 90, shield: 1 }
    },
    {
      id: 'day5_level',
      title: 'Day 5 • Hunter Ascent',
      objective: 'Sali di almeno 2 livelli.',
      progress: Math.min(storyProgress.levelDelta, 2),
      total: 2,
      completed: storyProgress.levelDelta >= 2,
      rewards: { exp: 160, gold: 120, keys: 1 }
    },
    {
      id: 'day6_power',
      title: 'Day 6 • System Resonance',
      objective: 'Porta System Power a 82+.',
      progress: Math.min(storyProgress.powerNow, 82),
      total: 82,
      completed: storyProgress.powerNow >= 82,
      rewards: { exp: 200, gold: 140 }
    },
    {
      id: 'day7_monarch',
      title: 'Day 7 • Monarch Week Finale',
      objective: 'Completa Daily Quest + almeno 4 workout nella chain.',
      progress: (allDone ? 1 : 0) + Math.min(storyProgress.workoutsDelta, 4),
      total: 5,
      completed: allDone && storyProgress.workoutsDelta >= 4,
      rewards: { exp: 320, gold: 280, keys: 2, titleToken: 1 }
    }
  ];

  const chainCompletionPct = Math.round((storyChainState.claimed.length / storyChapters.length) * 100);
  const isStoryChainCompleted = storyChainState.claimed.length >= storyChapters.length;

  const claimStoryChapter = (chapter, idx) => {
    const longJourneyChapterFactor = 0.68;
    const alreadyClaimed = storyChainState.claimed.includes(chapter.id);
    const prevClaimed = idx === 0 || storyChainState.claimed.includes(storyChapters[idx - 1].id);
    const dayUnlocked = chainDayIndex >= idx;
    if (alreadyClaimed || !prevClaimed || !dayUnlocked || !chapter.completed) return;

    setPlayerStats((prev) => {
      const { level, exp } = applyXp(prev, Math.round((chapter.rewards.exp || 0) * longJourneyChapterFactor));
      return {
        ...prev,
        level,
        exp,
        gold: (prev.gold || 0) + Math.round((chapter.rewards.gold || 0) * longJourneyChapterFactor),
        keys: (prev.keys || 0) + (chapter.rewards.keys || 0),
        streakShieldTokens: (prev.streakShieldTokens || 0) + (chapter.rewards.shield || 0),
        storyTitleTokens: (prev.storyTitleTokens || 0) + (chapter.rewards.titleToken || 0),
        weeklyStoryWins: chapter.id === 'day7_monarch' ? (prev.weeklyStoryWins || 0) + 1 : (prev.weeklyStoryWins || 0)
      };
    });

    setStoryChainState((prev) => ({
      ...prev,
      claimed: [...prev.claimed, chapter.id]
    }));
    triggerChapterCinematic('STORY CHAIN CLEAR', chapter.title, getRewardTier(chapter.rewards));
  };

  const restartStoryWeek = () => {
    setStoryChainState({
      chainStart: todayIso,
      claimed: [],
      baseline: {
        level: playerStats.level || 1,
        completedWorkouts: playerStats.completedWorkouts || 0,
        streak: playerStats.streak || 0,
        systemPowerScore: playerStats.systemPowerScore || 0
      }
    });
  };
// --- SYSTEM SHOP (Negozio) ---
  const shopItems = [
    { id: 1, name: 'Cheat Meal License', desc: 'Sgarro libero senza sensi di colpa.', cost: 50 },
    { id: 2, name: 'Rest Day Pass', desc: 'Salta l\'allenamento legalmente.', cost: 100 },
    { id: 3, name: 'S-Rank Recovery', desc: 'Comprati un massaggio o una SPA.', cost: 200 }
  ];

  const handleBuy = (item) => {
    if (playerStats.gold >= item.cost) {
      setPlayerStats((prev) => ({ ...prev, gold: (prev.gold || 0) - item.cost }));
      alert(`🛒 SYSTEM MESSAGE: Hai acquistato [${item.name}]! L'oggetto è nel tuo Inventario. Ti restano ${playerStats.gold - item.cost} G.`);
    } else {
      alert(`⚠️ SYSTEM WARNING: Oro insufficiente per [${item.name}]. Hai ${playerStats.gold} G, te ne servono ${item.cost}. Torna a combattere!`);
    }
  };

  const chapterClaims = playerStats.seasonChapterClaims || [];
  const seasonChapters = [
    {
      id: 'awakening',
      title: 'Chapter I • Awakening Arc',
      objective: 'Completa tutte le Daily Quest oggi',
      progress: questData.filter((q) => q.done).length,
      total: questData.length,
      completed: allDone,
      rewards: { exp: 120, gold: 120, keys: 1 }
    },
    {
      id: 'discipline',
      title: 'Chapter II • Discipline Arc',
      objective: 'Raggiungi Streak 7',
      progress: Math.min(playerStats.streak || 0, 7),
      total: 7,
      completed: (playerStats.streak || 0) >= 7,
      rewards: { exp: 180, gold: 100, shield: 1 }
    },
    {
      id: 'hunter',
      title: 'Chapter III • Hunter Arc',
      objective: 'Completa 5 Workout',
      progress: Math.min(playerStats.completedWorkouts || 0, 5),
      total: 5,
      completed: (playerStats.completedWorkouts || 0) >= 5,
      rewards: { exp: 220, gold: 220, keys: 1 }
    },
    {
      id: 'monarch',
      title: 'Chapter IV • Monarch Trial',
      objective: 'Raggiungi Livello 15',
      progress: Math.min(playerStats.level || 1, 15),
      total: 15,
      completed: (playerStats.level || 1) >= 15,
      rewards: { exp: 350, gold: 500, keys: 2 }
    }
  ];

  const claimChapterReward = (chapter, idx) => {
    const longJourneyChapterFactor = 0.68;
    const alreadyClaimed = chapterClaims.includes(chapter.id);
    const unlocked = idx === 0 || chapterClaims.includes(seasonChapters[idx - 1].id);
    if (!unlocked || alreadyClaimed || !chapter.completed) return;

    setPlayerStats((prev) => {
      const { level, exp } = applyXp(prev, Math.round((chapter.rewards.exp || 0) * longJourneyChapterFactor));
      return {
        ...prev,
        level,
        exp,
        gold: (prev.gold || 0) + Math.round((chapter.rewards.gold || 0) * longJourneyChapterFactor),
        keys: (prev.keys || 0) + (chapter.rewards.keys || 0),
        streakShieldTokens: (prev.streakShieldTokens || 0) + (chapter.rewards.shield || 0),
        seasonChapterClaims: [...(prev.seasonChapterClaims || []), chapter.id]
      };
    });
    triggerChapterCinematic('SEASON CHAPTER CLEAR', chapter.title, getRewardTier(chapter.rewards));
  };

  return (
    <div className="p-6 pt-10 pb-24 min-h-full">
      <AnimatePresence>
        {chapterCinematic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[170] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/72" />
            <motion.div
              initial={{ y: 26, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.24 }}
              className={`relative border bg-black/80 px-6 py-5 text-center ${chapterCinematic.edge} ${chapterCinematic.glow}`}
            >
              <p className={`text-[10px] uppercase tracking-[0.4em] font-black ${chapterCinematic.text}`}>System Message • {chapterCinematic.tier}</p>
              <p className="text-2xl mt-1 italic font-black text-white">{chapterCinematic.title}</p>
              <p className={`text-[11px] mt-2 uppercase tracking-[0.18em] ${chapterCinematic.text}`}>{chapterCinematic.subtitle}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HEADER */}
      <div className="mb-8">
        <p className="text-boss-red text-[10px] tracking-[0.3em] font-bold system-font mb-1 uppercase">Warning: Penalty Zone</p>
        <h1 className="text-4xl font-black italic tracking-tighter text-white">DAILY QUEST</h1>
        <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest">
          "The preparation to become powerful."
        </p>
      </div>

      {/* LISTA DELLE MISSIONI */}
      <div className="flex flex-col gap-4">
        {questData.map((quest) => (
          <motion.div 
            key={quest.id} 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className={`p-4 border rounded-sm relative overflow-hidden transition-all ${
              quest.done 
                ? 'bg-system-blue/10 border-system-blue/50 opacity-50' 
                : 'bg-black/40 border-white/10 hover:border-white/30'
            }`}
          >
            {quest.done && <div className="absolute top-0 right-0 w-16 h-16 bg-system-blue/10 blur-3xl rounded-full"></div>}
            
            <div className="flex justify-between items-center">
              <div>
                <h3 className={`font-black italic text-xl ${quest.done ? 'text-system-blue line-through' : 'text-white'}`}>
                  {quest.title}
                </h3>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">
                  Goal: {quest.target} | Reward: +{quest.rewardExp} XP, +{quest.rewardGold} G
                </p>
              </div>
              
              <button 
                onClick={() => handleComplete(quest)}
                disabled={quest.done}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  quest.done 
                    ? 'text-system-blue cursor-not-allowed' 
                    : 'text-boss-red border border-boss-red hover:bg-boss-red hover:text-white'
                }`}
              >
                {quest.done ? 'CLEARED' : 'COMPLETE'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-4 border-b border-indigo-400/30 pb-2">
          <h2 className="text-indigo-300 text-xl font-black italic tracking-tight">SEASON MISSION BOARD</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Capitoli progressivi con ricompense uniche</p>
        </div>
        <div className="space-y-3">
          {seasonChapters.map((chapter, idx) => {
            const claimed = chapterClaims.includes(chapter.id);
            const unlocked = idx === 0 || chapterClaims.includes(seasonChapters[idx - 1].id);
            const progressPct = Math.min((chapter.progress / chapter.total) * 100, 100);
            return (
              <div key={chapter.id} className={`p-4 border rounded-sm ${unlocked ? 'bg-black/40 border-indigo-400/30' : 'bg-black/30 border-white/10 opacity-60'}`}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-white font-black italic text-base">{chapter.title}</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{chapter.objective}</p>
                  </div>
                  <button
                    onClick={() => claimChapterReward(chapter, idx)}
                    disabled={!unlocked || claimed || !chapter.completed}
                    className={`text-[10px] px-3 py-2 font-bold uppercase tracking-widest border ${
                      claimed
                        ? 'border-emerald-400 text-emerald-300'
                        : unlocked && chapter.completed
                          ? 'border-indigo-300 text-indigo-200 hover:bg-indigo-300 hover:text-black'
                          : 'border-gray-700 text-gray-500'
                    }`}
                  >
                    {claimed ? 'CLAIMED' : chapter.completed ? 'CLAIM' : unlocked ? 'IN PROGRESS' : 'LOCKED'}
                  </button>
                </div>
                <div className="w-full bg-white/10 h-2 mt-3 rounded-full overflow-hidden border border-white/10">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} className="h-full bg-indigo-300"></motion.div>
                </div>
                <p className="text-[10px] text-gray-500 uppercase mt-2 tracking-widest">
                  Progress {chapter.progress}/{chapter.total} • Reward +{chapter.rewards.exp} XP, +{chapter.rewards.gold} G{chapter.rewards.keys ? `, +${chapter.rewards.keys} Key` : ''}{chapter.rewards.shield ? `, +${chapter.rewards.shield} Shield` : ''}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 border-b border-cyan-400/30 pb-2 flex items-end justify-between">
          <div>
            <h2 className="text-cyan-300 text-xl font-black italic tracking-tight">STORY CHAIN • 7 DAYS</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Capitoli narrativi giornalieri, sblocco progressivo</p>
          </div>
          <p className="text-[10px] text-cyan-200 uppercase tracking-widest">Day {chainDaysPassed}/7</p>
        </div>
        <div className="mb-3 border border-cyan-400/25 bg-cyan-500/10 p-3 rounded-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-cyan-200 uppercase tracking-widest">Completamento Chain</p>
            <p className="text-[10px] text-cyan-100 font-black">{chainCompletionPct}%</p>
          </div>
          <div className="w-full bg-black/40 h-2 mt-2 rounded-full overflow-hidden border border-cyan-400/25">
            <motion.div initial={{ width: 0 }} animate={{ width: `${chainCompletionPct}%` }} className="h-full bg-cyan-300" />
          </div>
        </div>
        <div className="space-y-3">
          {storyChapters.map((chapter, idx) => {
            const claimed = storyChainState.claimed.includes(chapter.id);
            const unlocked = idx === 0 || storyChainState.claimed.includes(storyChapters[idx - 1].id);
            const dayUnlocked = chainDayIndex >= idx;
            const progressPct = Math.min((chapter.progress / chapter.total) * 100, 100);
            return (
              <div key={chapter.id} className={`p-4 border rounded-sm ${unlocked && dayUnlocked ? 'bg-black/40 border-cyan-400/30' : 'bg-black/30 border-white/10 opacity-60'}`}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-white font-black italic text-base">{chapter.title}</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">{chapter.objective}</p>
                  </div>
                  <button
                    onClick={() => claimStoryChapter(chapter, idx)}
                    disabled={!unlocked || !dayUnlocked || claimed || !chapter.completed}
                    className={`text-[10px] px-3 py-2 font-bold uppercase tracking-widest border ${
                      claimed
                        ? 'border-emerald-400 text-emerald-300'
                        : unlocked && dayUnlocked && chapter.completed
                          ? 'border-cyan-300 text-cyan-200 hover:bg-cyan-300 hover:text-black'
                          : 'border-gray-700 text-gray-500'
                    }`}
                  >
                    {claimed ? 'CLAIMED' : !dayUnlocked ? 'WAIT NEXT DAY' : chapter.completed ? 'CLAIM' : 'IN PROGRESS'}
                  </button>
                </div>
                <div className="w-full bg-white/10 h-2 mt-3 rounded-full overflow-hidden border border-white/10">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} className="h-full bg-cyan-300" />
                </div>
                <p className="text-[10px] text-gray-500 uppercase mt-2 tracking-widest">
                  Progress {chapter.progress}/{chapter.total} • Reward +{chapter.rewards.exp} XP, +{chapter.rewards.gold} G{chapter.rewards.keys ? `, +${chapter.rewards.keys} Key` : ''}{chapter.rewards.shield ? `, +${chapter.rewards.shield} Shield` : ''}{chapter.rewards.titleToken ? `, +${chapter.rewards.titleToken} Title Token` : ''}
                </p>
              </div>
            );
          })}
        </div>
        {isStoryChainCompleted && (
          <div className="mt-4 border border-emerald-400/40 bg-emerald-500/10 p-4 rounded-sm">
            <p className="text-[10px] text-emerald-300 uppercase tracking-widest mb-2">Story Week Completed</p>
            <button
              onClick={restartStoryWeek}
              className="text-[10px] px-3 py-2 font-bold uppercase tracking-widest border border-emerald-300 text-emerald-200 hover:bg-emerald-300 hover:text-black"
            >
              Start New Week
            </button>
          </div>
        )}
      </div>

      {/* MESSAGGIO DI COMPLETAMENTO GLOBALE */}
      {allDone && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 p-4 bg-system-blue/10 border border-system-blue text-center">
          <p className="text-system-blue text-sm font-bold uppercase tracking-widest system-font animate-pulse">
            ALL QUESTS CLEARED
          </p>
          <p className="text-[10px] text-white mt-1 italic">
            You have successfully avoided the Penalty Zone today.
          </p>
        </motion.div>
      )}
{/* SEZIONE SHOP */}
      <div className="mt-12">
        <div className="flex justify-between items-end mb-4 border-b border-white/10 pb-2">
          <h2 className="text-yellow-400 text-lg font-black italic tracking-tighter">SYSTEM SHOP</h2>
          <p className="text-yellow-400 text-xs font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span> {playerStats.gold} G
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {shopItems.map((item) => (
            <div key={item.id} className="bg-white/5 border border-yellow-400/20 p-3 flex justify-between items-center hover:border-yellow-400/50 transition-colors">
              <div>
                <h3 className="text-white font-bold text-sm">{item.name}</h3>
                <p className="text-gray-500 text-[9px] uppercase tracking-widest mt-0.5">{item.desc}</p>
              </div>
              <button 
                onClick={() => handleBuy(item)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  playerStats.gold >= item.cost 
                    ? 'text-yellow-400 border border-yellow-400 hover:bg-yellow-400 hover:text-black' 
                    : 'text-gray-600 border border-gray-600 cursor-not-allowed'
                }`}
              >
                {item.cost} G
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Quests;

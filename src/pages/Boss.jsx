import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSfx, playMonsterGrowl } from '../utils/sfx';
import { speakLine } from '../utils/voice';
import DungeonBoss3D from '../components/DungeonBoss3D';
import { parseModelJson, requestSystemAI } from '../utils/aiClient';
import { applyXp } from '../utils/xpLogic';

const RELIC_LIBRARY = [
  { id: 'monarch_fang', name: 'Monarch Fang', rarity: 'Epic', desc: '+18% danno base', effects: { damagePct: 0.18 } },
  { id: 'void_core', name: 'Void Core', rarity: 'Rare', desc: '+20 HP iniziali', effects: { hpBonus: 20 } },
  { id: 'pulse_orb', name: 'Pulse Orb', rarity: 'Rare', desc: '+6 energia per attacco', effects: { energyOnHit: 6 } },
  { id: 'blood_sigil', name: 'Blood Sigil', rarity: 'Epic', desc: '+12% crit chance', effects: { critBonus: 0.12 } },
  { id: 'iron_will', name: 'Iron Will', rarity: 'Common', desc: '-15% danno subito', effects: { defensePct: 0.15 } },
  { id: 'gate_vial', name: 'Gate Vial', rarity: 'Common', desc: '+1 pozione a inizio run', effects: { extraPotions: 1 } },
  { id: 'black_crown', name: 'Black Crown', rarity: 'Legendary', desc: '+24% danno e +10 HP', effects: { damagePct: 0.24, hpBonus: 10 } }
];

const LOOT_ARCHIVE = [
  { id: 'rusty_iron_dagger', name: 'Rusty Iron Dagger', rarity: 'Common', icon: '/loot/rusty_iron_dagger.png' },
  { id: 'small_health_potion', name: 'Small Health Potion', rarity: 'Common', icon: '/loot/small_health_potion.png' },
  { id: 'mana_shard', name: 'Mana Shard', rarity: 'Common', icon: '/loot/mana_shard.png' },
  { id: 'goblin_tooth', name: 'Goblin Tooth', rarity: 'Common', icon: '/loot/goblin_tooth.png' },
  { id: 'worn_leather_boots', name: 'Worn Leather Boots', rarity: 'Common', icon: '/loot/worn_leather_boots.png' },
  { id: 'simple_cloth_tunic', name: 'Simple Cloth Tunic', rarity: 'Common', icon: '/loot/simple_cloth_tunic.png' },
  { id: 'wooden_shield', name: 'Wooden Shield', rarity: 'Common', icon: '/loot/wooden_shield.png' },
  { id: 'dried_herb', name: 'Dried Herb', rarity: 'Common', icon: '/loot/dried_herb.png' },
  { id: 'empty_vial', name: 'Empty Vial', rarity: 'Common', icon: '/loot/empty_vial.png' },
  { id: 'stone_figurine', name: 'Stone Figurine', rarity: 'Common', icon: '/loot/stone_figurine.png' },
  { id: 'bread_ration', name: 'Bread Ration', rarity: 'Common', icon: '/loot/bread_ration.png' },
  { id: 'torch', name: 'Torch', rarity: 'Common', icon: '/loot/torch.png' },
  { id: 'basic_arrow', name: 'Basic Arrow', rarity: 'Uncommon', icon: '/loot/basic_arrow.png' },
  { id: 'copper_coin_pouch', name: 'Copper Coin Pouch', rarity: 'Uncommon', icon: '/loot/copper_coin_pouch.png' },
  { id: 'cracked_gemstone', name: 'Cracked Gemstone', rarity: 'Uncommon', icon: '/loot/cracked_gemstone.png' },
  { id: 'reinforced_helmet', name: 'Reinforced Helmet', rarity: 'Uncommon', icon: '/loot/reinforced_helmet.png' },
  { id: 'sharp_arrow', name: 'Sharp Arrow x5', rarity: 'Uncommon', icon: '/loot/sharp_arrow.png' },
  { id: 'magic_powder', name: 'Magic Powder', rarity: 'Uncommon', icon: '/loot/magic_powder.png' },
  { id: 'reinforced_leather_helmet', name: 'Reinforced Leather Helmet', rarity: 'Uncommon', icon: '/loot/reinforced_leather_helmet.png' },
  { id: 'silver_ring', name: 'Silver Ring', rarity: 'Uncommon', icon: '/loot/silver_ring.png' },
  { id: 'minor_stamina_elixir', name: 'Minor Stamina Elixir', rarity: 'Uncommon', icon: '/loot/minor_stamina_elixir.png' },
  { id: 'troll_skin', name: 'Troll Skin', rarity: 'Uncommon', icon: '/loot/troll_skin.png' },
  { id: 'iron_gauntlets', name: 'Iron Gauntlets', rarity: 'Uncommon', icon: '/loot/iron_gauntlets.png' },
  { id: 'adventurer_backpack', name: 'Adventurer Backpack', rarity: 'Uncommon', icon: '/loot/adventurer_backpack.png' },
  { id: 'enchanted_mithril_dagger', name: 'Enchanted Mithril Dagger', rarity: 'Rare', icon: '/loot/enchanted_mithril_dagger.png' },
  { id: 'greater_health_potion', name: 'Greater Health Potion', rarity: 'Rare', icon: '/loot/greater_health_potion.png' },
  { id: 'soul_stone_medium', name: 'Soul Stone (Medium)', rarity: 'Rare', icon: '/loot/soul_stone_medium.png' },
  { id: 'sturdy_steel_breastplate', name: 'Sturdy Steel Breastplate', rarity: 'Rare', icon: '/loot/sturdy_steel_breastplate.png' },
  { id: 'golden_coin_pouch', name: 'Golden Coin Pouch', rarity: 'Rare', icon: '/loot/golden_coin_pouch.png' },
  { id: 'radiant_gemstone', name: 'Radiant Gemstone', rarity: 'Rare', icon: '/loot/radiant_gemstone.png' },
  { id: 'refined_mana_elixir', name: 'Refined Mana Elixir', rarity: 'Rare', icon: '/loot/refined_mana_elixir.png' },
  { id: 'knight_greatsword', name: "Knight's Greatsword", rarity: 'Rare', icon: '/loot/knight_greatsword.png' },
  { id: 'arcane_amulet', name: 'Arcane Amulet', rarity: 'Rare', icon: '/loot/arcane_amulet.png' },
  { id: 'shadow_lord_cloak', name: "Shadow Lord's Cloak", rarity: 'Epic', icon: '/loot/shadow_lord_cloak.png' },
  { id: 'elixir_of_supreme_power', name: 'Elixir of Supreme Power', rarity: 'Epic', icon: '/loot/elixir_of_supreme_power.png' },
  { id: 'dragon_scale_shield_a', name: 'Dragon Scale Shield', rarity: 'Epic', icon: '/loot/dragon_scale_shield_a.png' },
  { id: 'dragon_scale_shield_b', name: 'Dragon Scale Shield II', rarity: 'Epic', icon: '/loot/dragon_scale_shield_b.png' },
  { id: 'rune_adamantite_helmet', name: 'Runed Adamantite Helmet', rarity: 'Epic', icon: '/loot/rune_adamantite_helmet.png' },
  { id: 'ring_of_frost_monarch', name: 'Ring of the Frost Monarch', rarity: 'Epic', icon: '/loot/ring_of_frost_monarch.png' },
  { id: 'hero_battleaxe', name: "Hero's Battleaxe", rarity: 'Epic', icon: '/loot/hero_battleaxe.png' },
  { id: 'demon_king_dagger', name: "Demon King's Dagger", rarity: 'Legendary', icon: '/loot/demon_king_dagger.png' },
  { id: 'legendary_elixir_immortality', name: 'Legendary Elixir of Immortality', rarity: 'Legendary', icon: '/loot/legendary_elixir_immortality.png' },
  { id: 'crown_lich_lord', name: 'Crown of the Lich Lord', rarity: 'Legendary', icon: '/loot/crown_lich_lord.png' },
  { id: 'dragonheart_amulet', name: 'Dragonheart Amulet', rarity: 'Legendary', icon: '/loot/dragonheart_amulet.png' },
  { id: 'monarch_shadow_cloak', name: "Monarch's Shadow Cloak", rarity: 'Mythic', icon: '/loot/monarch_shadow_cloak.png' }
];

const LOOT_RARITY_COLORS = {
  Common: 'border-zinc-500/40 text-zinc-200',
  Uncommon: 'border-emerald-500/40 text-emerald-200',
  Rare: 'border-cyan-500/50 text-cyan-200',
  Epic: 'border-fuchsia-500/50 text-fuchsia-200',
  Legendary: 'border-amber-500/50 text-amber-200',
  Mythic: 'border-rose-500/60 text-rose-200'
};

const LOOT_GLYPHS = [
  { re: /(dagger|sword|axe|arrow|claw|tooth)/i, glyph: '⚔️' },
  { re: /(potion|elixir|vial)/i, glyph: '🧪' },
  { re: /(shield|helmet|gauntlet|boots|tunic|cloak|skin|breastplate)/i, glyph: '🛡️' },
  { re: /(gem|stone|shard|powder|ring|amulet|crown)/i, glyph: '💎' },
  { re: /(coin|pouch)/i, glyph: '💰' },
  { re: /(torch|fireball|flame)/i, glyph: '🔥' },
  { re: /(bread|ration|herb)/i, glyph: '🌿' },
  { re: /(figurine|backpack|scroll|book)/i, glyph: '📜' }
];

const getLootGlyph = (item) => {
  const source = `${item?.name || ''} ${item?.id || ''}`;
  const matched = LOOT_GLYPHS.find((entry) => entry.re.test(source));
  return matched?.glyph || '✨';
};

const slugifyLootName = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const getLootIconCandidates = (item) => {
  const bases = [];
  if (item?.icon) {
    const noExt = item.icon.replace(/\.[a-z0-9]+$/i, '');
    bases.push(noExt);
  }
  if (item?.id) bases.push(`/loot/${item.id}`);
  if (item?.name) {
    const fromName = slugifyLootName(item.name);
    const noSuffix = fromName.replace(/_(i|ii|iii|iv|v|x\d+)$/i, '');
    bases.push(`/loot/${fromName}`);
    bases.push(`/loot/${noSuffix}`);
  }
  const uniqueBases = Array.from(new Set(bases.filter(Boolean)));
  const exts = ['.png', '.webp', '.jpg', '.jpeg', '.gif'];
  const candidates = [];
  uniqueBases.forEach((base) => exts.forEach((ext) => candidates.push(`${base}${ext}`)));
  return candidates;
};

const getHunterPowerScore = (stats = {}) => {
  const level = stats.level || 1;
  const str = stats.str || 10;
  const vit = stats.vit || 10;
  const agi = stats.agi || 10;
  const streak = stats.streak || 0;
  const workouts = stats.completedWorkouts || 0;
  const chapters = (stats.seasonChapterClaims || []).length;
  const systemPower = stats.systemPowerScore || 0;
  return Math.round(
    (level * 7.5) +
    (str * 2.8) +
    (vit * 2.6) +
    (agi * 2.4) +
    (systemPower * 0.9) +
    Math.min(70, streak * 1.5) +
    Math.min(140, workouts * 1.1) +
    (chapters * 22)
  );
};

const FLOOR_POWER_REQUIREMENTS = {
  1: 240,
  2: 360,
  3: 520,
  4: 720,
  5: 980,
  6: 1290,
  7: 1660,
  8: 2090,
  9: 2590,
  10: 3160
};

const getFloorPowerRequirement = (floor = 1) => FLOOR_POWER_REQUIREMENTS[Math.max(1, Math.min(10, floor))] || 240;

const getHunterCombatProfile = (stats = {}, lifestyle = { adherence: 0, todayScore: 0 }) => {
  const basePower = getHunterPowerScore(stats);
  const adherence = Math.min(1, Math.max(0, Number(lifestyle?.adherence || 0)));
  const todayLifestyle = Math.min(5, Math.max(0, Number(lifestyle?.todayScore || 0)));
  const systemForceBonus = Number(stats?.systemForceBonus || 0);
  const systemPowerScore = Number(stats?.systemPowerScore || 0);
  const lifestyleAmplifier = 0.72 + (adherence * 0.4) + (todayLifestyle * 0.03);
  const power = Math.max(90, Math.round((basePower * lifestyleAmplifier) + (systemForceBonus * 14) + (systemPowerScore * 0.55)));
  const floorsUnlocked = Math.max(
    1,
    Math.min(10, 1 + Math.floor((power - 120) / 180))
  );
  const tier = Math.max(
    1,
    Math.min(6, 1 + Math.floor((power - 150) / 260))
  );
  return {
    power,
    adherence,
    todayLifestyle,
    floorsUnlocked,
    tier
  };
};

const getFloorBattleBalance = (combatPower = 180, floor = 1) => {
  const req = getFloorPowerRequirement(floor);
  const readiness = Math.max(0.45, Math.min(1.8, combatPower / req));
  return {
    requirement: req,
    readiness,
    hunterDamageMult: Math.max(0.58, Math.min(1.55, 0.62 + (readiness * 0.52))),
    hunterHpMult: Math.max(0.62, Math.min(1.65, 0.65 + (readiness * 0.58))),
    hunterDefenseMult: Math.max(0.72, Math.min(1.45, 0.75 + (readiness * 0.42))),
    enemyDamageMult: Math.max(0.82, Math.min(1.92, 1 + ((1 - readiness) * 0.62))),
    enemyHpMult: Math.max(0.86, Math.min(2.1, 1 + ((1 - readiness) * 0.72)))
  };
};

const getSystemAvatarStage = (level = 1) => Math.min(Math.floor((Math.max(1, level) - 1) / 8) + 1, 8);

const mapAvatarStageToHunterTier = (avatarStage = 1) => {
  if (avatarStage <= 2) return 1;
  if (avatarStage === 3) return 2;
  if (avatarStage === 4) return 3;
  if (avatarStage === 5) return 4;
  if (avatarStage === 6) return 5;
  return 6;
};

const HUNTER_FORMS = {
  1: { code: 'NOVICE_VANGUARD', label: 'Novice Vanguard', passive: 'Guardia d’Acciaio', defensePct: 0.08 },
  2: { code: 'IRON_AWAKENING', label: 'Iron Awakening', passive: 'Ritmo Marziale', attackEnergyBonus: 5 },
  3: { code: 'BLADE_ASCENT', label: 'Blade Ascent', passive: 'Precisione Critica', critBonus: 0.08 },
  4: { code: 'SHADOW_STEP', label: 'Shadow Step', passive: 'Passo Fantasma', evadeChance: 0.12 },
  5: { code: 'ARCANE_OVERDRIVE', label: 'Arcane Overdrive', passive: 'Overdrive Arcano', skillDamageMult: 1.14, skillCostReduction: 4 },
  6: { code: 'DARK_MONARCH', label: 'Dark Monarch', passive: 'Dominio Assoluto', rageDamageMult: 1.2, enemyAtkDown: 0.08 }
};

const getHunterFormByTier = (tier = 1) => HUNTER_FORMS[Math.max(1, Math.min(6, tier))] || HUNTER_FORMS[1];

const HUNTER_SKILL_TREE = [
  { id: 'iron_core', label: 'Iron Core', desc: '+8% riduzione danno e +18 HP', unlock: (ctx) => (ctx.level || 1) >= 12, effects: { defensePct: 0.08, hpBonus: 18 } },
  { id: 'battle_instinct', label: 'Battle Instinct', desc: '+10% danno base', unlock: (ctx) => (ctx.workouts || 0) >= 30, effects: { damagePct: 0.1 } },
  { id: 'flow_state', label: 'Flow State', desc: '+4 energia on-hit e -2 costo skill', unlock: (ctx) => (ctx.streak || 0) >= 7, effects: { energyOnHit: 4, skillCostReduction: 2 } },
  { id: 'monarch_resolve', label: 'Monarch Resolve', desc: '+8% crit e +6% evasione', unlock: (ctx) => (ctx.adherence || 0) >= 0.72 && (ctx.clears || 0) >= 3, effects: { critBonus: 0.08, evadeChance: 0.06 } }
];

const getHunterSkillTreeState = (playerStats = {}, raidMeta = {}, lifestyle = { adherence: 0 }) => {
  const context = {
    level: playerStats.level || 1,
    workouts: playerStats.completedWorkouts || 0,
    streak: playerStats.streak || 0,
    adherence: lifestyle.adherence || 0,
    clears: raidMeta.clears || 0
  };
  const unlocked = HUNTER_SKILL_TREE.filter((node) => node.unlock(context));
  const bonuses = unlocked.reduce((acc, node) => ({
    damagePct: acc.damagePct + (node.effects.damagePct || 0),
    defensePct: acc.defensePct + (node.effects.defensePct || 0),
    critBonus: acc.critBonus + (node.effects.critBonus || 0),
    evadeChance: acc.evadeChance + (node.effects.evadeChance || 0),
    energyOnHit: acc.energyOnHit + (node.effects.energyOnHit || 0),
    skillCostReduction: acc.skillCostReduction + (node.effects.skillCostReduction || 0),
    hpBonus: acc.hpBonus + (node.effects.hpBonus || 0)
  }), {
    damagePct: 0,
    defensePct: 0,
    critBonus: 0,
    evadeChance: 0,
    energyOnHit: 0,
    skillCostReduction: 0,
    hpBonus: 0
  });
  return {
    nodes: HUNTER_SKILL_TREE.map((node) => ({ ...node, unlocked: unlocked.some((u) => u.id === node.id) })),
    unlockedCount: unlocked.length,
    bonuses
  };
};

const FORM_ACTIVE_SKILLS = {
  1: { name: 'Aegis Pulse', label: 'Aegis', energyCost: 24, cooldownMs: 18000 },
  2: { name: 'Iron Rush', label: 'Rush', energyCost: 22, cooldownMs: 17000 },
  3: { name: 'Blade Tempest', label: 'Tempest', energyCost: 28, cooldownMs: 22000 },
  4: { name: 'Shadow Blink', label: 'Blink', energyCost: 26, cooldownMs: 20000 },
  5: { name: 'Arcane Overdrive', label: 'Overdrive', energyCost: 34, cooldownMs: 26000 },
  6: { name: 'Monarch Judgment', label: 'Judgment', energyCost: 40, cooldownMs: 30000 }
};

const getActiveSkillByTier = (tier = 1) => FORM_ACTIVE_SKILLS[Math.max(1, Math.min(6, tier))] || FORM_ACTIVE_SKILLS[1];

const HUNTER_FORM_CUTINS = {
  1: { accent: 'from-zinc-200/35 via-zinc-400/10 to-transparent', edge: 'border-zinc-300/60', text: 'text-zinc-100', title: 'WOODEN AWAKENING', sub: 'Primitive force unleashed' },
  2: { accent: 'from-violet-300/35 via-fuchsia-400/10 to-transparent', edge: 'border-violet-300/60', text: 'text-violet-100', title: 'ARCANE ASCENT', sub: 'Mana circuits overloaded' },
  3: { accent: 'from-cyan-300/35 via-sky-400/10 to-transparent', edge: 'border-cyan-300/60', text: 'text-cyan-100', title: 'NINJA VELOCITY', sub: 'Shadow strike trajectory locked' },
  4: { accent: 'from-blue-300/35 via-indigo-400/10 to-transparent', edge: 'border-blue-300/60', text: 'text-blue-100', title: 'KNIGHT RESOLVE', sub: 'Steel heart, decisive impact' },
  5: { accent: 'from-fuchsia-300/35 via-rose-400/10 to-transparent', edge: 'border-fuchsia-300/60', text: 'text-fuchsia-100', title: 'ABYSSAL KNIGHT', sub: 'Dark pressure overwhelms the gate' },
  6: { accent: 'from-amber-300/35 via-yellow-300/10 to-transparent', edge: 'border-amber-300/60', text: 'text-amber-100', title: 'GOLDEN JUDGMENT', sub: 'Final sovereign execution' }
};

const ELITE_ARCHETYPES = [
  { id: 'berserker', title: 'Abyss Berserker', hpMult: 1.28, atkMult: 1.32, rewardMult: 1.45, relicBonus: 0.2 },
  { id: 'warden', title: 'Void Warden', hpMult: 1.44, atkMult: 1.18, rewardMult: 1.5, relicBonus: 0.18 },
  { id: 'assassin', title: 'Night Assassin', hpMult: 1.18, atkMult: 1.52, rewardMult: 1.55, relicBonus: 0.24 },
  { id: 'monarch', title: 'Monarch Echo', hpMult: 1.62, atkMult: 1.4, rewardMult: 1.85, relicBonus: 0.35 }
];

const RAID_DIRECTIVES = {
  assault: { label: 'Assalto', damageOut: 1.12, damageTaken: 1.08, energyOnHit: 0, skillCostDelta: 0, rewardMult: 1.04 },
  tactical: { label: 'Tattica', damageOut: 1.0, damageTaken: 0.95, energyOnHit: 6, skillCostDelta: 4, rewardMult: 1.0 },
  evade: { label: 'Fuga Ombra', damageOut: 0.9, damageTaken: 0.82, energyOnHit: 2, skillCostDelta: 2, rewardMult: 0.92 }
};

const RAID_BOSS_NAMES = {
  1: 'Ironfang Orc Sentinel',
  2: 'Bladesworn Orc Executor',
  3: 'Bone Marshal Asterion',
  4: 'Venom Widow Matriarch',
  5: 'Shadow Wolf Fenrir',
  6: 'Granite Colossus Golem',
  7: 'Prime Wyrm Skybreaker',
  8: 'Abyss Demon Knight',
  9: 'Demonic Horror Leviathan',
  10: 'Astral Dragon Monarch'
};

const RAID_SEASON_DAYS = 180; // 6 months
const RAID_SEASON_TARGET = 18000;
const PRESTIGE_TITLE_LADDER = [
  { level: 1, title: 'Rookie Monarch' },
  { level: 2, title: 'Gate Reaper' },
  { level: 3, title: 'Shadow Overlord' },
  { level: 5, title: 'Abyss Sovereign' },
  { level: 8, title: 'Celestial Monarch' }
];

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getLifestyleSnapshot = (playerStats = {}) => {
  let logs = [];
  let dailyGoal = 2400;
  let hydrationGoal = 2800;
  let macroGoals = { carbs: 220, protein: 190, fats: 70 };
  try { logs = JSON.parse(localStorage.getItem('shadow_monarch_logs') || '[]'); } catch { logs = []; }
  try { dailyGoal = parseInt(localStorage.getItem('shadow_monarch_goal') || '2400', 10); } catch {}
  try { hydrationGoal = parseInt(localStorage.getItem('shadow_monarch_hydration_goal') || '2800', 10); } catch {}
  try { macroGoals = JSON.parse(localStorage.getItem('shadow_monarch_macros') || '{"carbs":220,"protein":190,"fats":70}'); } catch {}

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const todayLog = logs.find((l) => l?.date === today) || logs[0] || {};
  const recent = logs.slice(0, 7);
  const lifestyleDayScore = (log = {}) => {
    const consumeRatio = toNum(log.consumed) / Math.max(1200, toNum(dailyGoal, 2400));
    const proteinRatio = toNum(log.protein) / Math.max(80, toNum(macroGoals?.protein, 190));
    const hydrationRatio = toNum(log.waterMl) / Math.max(1200, toNum(hydrationGoal, 2800));
    const sleepRatio = toNum(log.sleepHours) / 8;
    const workoutDone = toNum(log.burned) >= 180 || playerStats.lastWorkoutDate === today;
    let score = 0;
    if (consumeRatio >= 0.7) score += 1;
    if (proteinRatio >= 0.65) score += 1;
    if (hydrationRatio >= 0.75) score += 1;
    if (sleepRatio >= 0.85 || toNum(log.recoveryScore) >= 65) score += 1;
    if (workoutDone) score += 1;
    return Math.min(5, score);
  };

  const todayScore = lifestyleDayScore(todayLog);
  const avgRecent = recent.length
    ? recent.reduce((sum, log) => sum + lifestyleDayScore(log), 0) / recent.length
    : 0;
  const adherence = Math.min(1, (todayScore * 0.65 + avgRecent * 0.35) / 5);
  return {
    todayScore,
    avgRecent: Number(avgRecent.toFixed(2)),
    adherence,
    label: adherence >= 0.82 ? 'S-Rank' : adherence >= 0.65 ? 'A-Rank' : adherence >= 0.48 ? 'B-Rank' : adherence >= 0.3 ? 'C-Rank' : 'D-Rank'
  };
};

const Boss = ({ playerStats, setPlayerStats, soundEnabled, soundTheme, voiceEnabled }) => {
  const [arenaMode, setArenaMode] = useState('boss');
  const [boss, setBoss] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_boss');
    return saved ? JSON.parse(saved) : { name: "Goblin Scavenger", hp: 1000, maxHp: 1000, defeated: false, level: 1 };
  });

  useEffect(() => {
    localStorage.setItem('shadow_monarch_boss', JSON.stringify(boss));
  }, [boss]);
  const [raid, setRaid] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_raid');
    const defaults = {
      active: false,
      floor: 1,
      hp: 120,
      maxHp: 120,
      energy: 100,
      potions: 2,
      relics: 0,
      shadowResurgenceUsed: false,
      status: 'idle',
      enemy: null,
      log: [],
      enemyAttackTick: 0,
      formSkillReadyAt: 0,
      formEvadeBoostHits: 0,
      formDefenseBoostHits: 0,
      formEnemyWeakenHits: 0
    };
    if (saved) return { ...defaults, ...JSON.parse(saved) };
    return defaults;
  });
  const [raidMeta, setRaidMeta] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_raid_meta');
    const defaults = { clears: 0, highestFloor: 1, floorClears: 0, totalRuns: 0, lastClearAt: null, eliteSeen: 0, eliteKills: 0, elitePity: 0 };
    if (!saved) return defaults;
    try {
      return { ...defaults, ...JSON.parse(saved) };
    } catch {
      return defaults;
    }
  });
  const [raidSeason, setRaidSeason] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_raid_season');
    const defaults = { startAt: new Date().toISOString(), mastery: 0, masteryToday: 0, totalMasteryEarned: 0, lastMasteryDate: null, prestigeLevel: 0, completedSeasons: 0 };
    if (!saved) return defaults;
    try {
      return { ...defaults, ...JSON.parse(saved) };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem('shadow_monarch_raid', JSON.stringify(raid));
  }, [raid]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_raid_meta', JSON.stringify(raidMeta));
  }, [raidMeta]);
  useEffect(() => {
    localStorage.setItem('shadow_monarch_raid_season', JSON.stringify(raidSeason));
  }, [raidSeason]);
  const [relicInventory, setRelicInventory] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_relic_inventory');
    if (saved) return JSON.parse(saved);
    return {};
  });
  const [equippedRelic, setEquippedRelic] = useState(() => localStorage.getItem('shadow_monarch_equipped_relic') || null);

  useEffect(() => {
    localStorage.setItem('shadow_monarch_relic_inventory', JSON.stringify(relicInventory));
  }, [relicInventory]);

  useEffect(() => {
    if (equippedRelic) localStorage.setItem('shadow_monarch_equipped_relic', equippedRelic);
    else localStorage.removeItem('shadow_monarch_equipped_relic');
  }, [equippedRelic]);

  const equippedRelicData = RELIC_LIBRARY.find((relic) => relic.id === equippedRelic) || null;
  const relicFx = equippedRelicData?.effects || {};
  const lifestyle = getLifestyleSnapshot(playerStats);
  const hunterSkillTree = getHunterSkillTreeState(playerStats, raidMeta, lifestyle);
  const treeFx = hunterSkillTree.bonuses;
  const seasonAgeDays = Math.max(1, Math.floor((Date.now() - new Date(raidSeason.startAt).getTime()) / 86400000) + 1);
  const seasonDaysLeft = Math.max(0, RAID_SEASON_DAYS - seasonAgeDays);
  const seasonProgressPct = Math.min(100, Math.round((raidSeason.mastery / RAID_SEASON_TARGET) * 100));
  const canPrestigeSeason = !raid.active && (raidSeason.mastery || 0) >= RAID_SEASON_TARGET;
  const nextPrestigeReward = PRESTIGE_TITLE_LADDER.find((entry) => (raidSeason.prestigeLevel || 0) + 1 >= entry.level)?.title || 'Monarch Ascendant';

  const grantSeasonMastery = (floor, enemy, directive = 'assault') => {
    const liveLifestyle = getLifestyleSnapshot(playerStats);
    const longJourneyMasteryFactor = 0.58;
    const eliteBonus = enemy?.elite ? 1.35 : 1;
    const directiveBonus = directive === 'tactical' ? 1.08 : directive === 'assault' ? 1.03 : 0.96;
    const gained = Math.max(6, Math.round((12 + floor * 4.4) * (0.72 + liveLifestyle.adherence * 0.92) * eliteBonus * directiveBonus * longJourneyMasteryFactor));
    const today = new Date().toLocaleDateString('en-CA');
    setRaidSeason((prev) => {
      const resetToday = prev.lastMasteryDate === today ? prev.masteryToday : 0;
      return {
        ...prev,
        mastery: Math.min(RAID_SEASON_TARGET, (prev.mastery || 0) + gained),
        masteryToday: resetToday + gained,
        totalMasteryEarned: (prev.totalMasteryEarned || 0) + gained,
        lastMasteryDate: today
      };
    });
    return gained;
  };

  const prestigeSeason = () => {
    if (!canPrestigeSeason) return;
    const nextPrestige = (raidSeason.prestigeLevel || 0) + 1;
    const prestigeGold = 1200 + (nextPrestige * 320);
    const prestigeExp = 900 + (nextPrestige * 260);
    const prestigeKeys = 2 + Math.floor(nextPrestige / 2);
    const unlockedTitle = PRESTIGE_TITLE_LADDER
      .filter((entry) => nextPrestige >= entry.level)
      .map((entry) => entry.title)
      .slice(-1)[0] || 'Monarch Ascendant';
    setPlayerStats((prev) => {
      const { level, exp } = applyXp(prev, prestigeExp);
      return {
        ...prev,
        level,
        exp,
        gold: (prev.gold || 0) + prestigeGold,
        keys: (prev.keys || 0) + prestigeKeys,
        ap: (prev.ap || 0) + 2,
        titlesUnlocked: Array.from(new Set([...(prev.titlesUnlocked || []), unlockedTitle])),
        activeTitle: unlockedTitle
      };
    });
    setRaidSeason((prev) => ({
      ...prev,
      mastery: 0,
      masteryToday: 0,
      lastMasteryDate: null,
      startAt: new Date().toISOString(),
      prestigeLevel: (prev.prestigeLevel || 0) + 1,
      completedSeasons: (prev.completedSeasons || 0) + 1
    }));
    setRaidMeta((prev) => ({ ...prev, elitePity: 0 }));
    triggerRaidCinematic(`SEASON PRESTIGE ${nextPrestige} · ${unlockedTitle}`);
    playSfx('success', soundEnabled, soundTheme);
  };

  const rollEliteEncounter = (floor) => {
    if (floor <= 1) return null;
    const pity = raidMeta.elitePity || 0;
    const baseChance = floor % 3 === 0 ? 0.42 : floor % 2 === 0 ? 0.3 : 0.18;
    const chance = Math.min(0.82, baseChance + (pity * 0.08));
    if (Math.random() > chance) {
      setRaidMeta((prev) => ({ ...prev, elitePity: Math.min(6, (prev.elitePity || 0) + 1) }));
      return null;
    }
    const pool = floor >= 9 ? ELITE_ARCHETYPES : ELITE_ARCHETYPES.filter((el) => el.id !== 'monarch');
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setRaidMeta((prev) => ({ ...prev, eliteSeen: (prev.eliteSeen || 0) + 1, elitePity: 0 }));
    return picked;
  };

  const generateRaidEnemy = (floor, elite = null, floorBalance = null) => {
    const name = RAID_BOSS_NAMES[floor] || `Unknown Warden F${floor}`;
    const hunterPower = getHunterPowerScore(playerStats);
    const balance = floorBalance || getFloorBattleBalance(hunterPower, floor);
    const runPressure = 1 + Math.min(1.4, (raidMeta.clears || 0) * 0.025);
    const seasonStage = 1 + Math.min(1.2, (raidSeason.mastery / RAID_SEASON_TARGET) * 0.9 + Math.max(0, (seasonAgeDays - 28)) * 0.003);
    const floorCurve = Math.pow(1.25, Math.max(0, floor - 1));
    const antiSteamroll = Math.max(0.88, Math.min(1.45, 0.94 + ((1 - balance.readiness) * 0.46)));
    const eliteHp = elite?.hpMult || 1;
    const eliteAtk = elite?.atkMult || 1;
    const maxHp = Math.max(180, Math.round((190 + (floor * 95)) * floorCurve * runPressure * seasonStage * antiSteamroll * eliteHp * balance.enemyHpMult));
    const atk = Math.max(10, Math.round((9 + (floor * 2.8)) * Math.pow(1.08, Math.max(0, floor - 1)) * runPressure * seasonStage * Math.max(0.9, Math.min(1.42, 1 + ((1 - balance.readiness) * 0.5))) * eliteAtk * balance.enemyDamageMult));
    const baseRank = floor >= 10 ? 'SSS' : floor >= 8 ? 'SS' : floor >= 6 ? 'S' : floor >= 4 ? 'A' : floor >= 2 ? 'B' : 'C';
    const rank = elite ? `ELITE ${baseRank}` : baseRank;
    const titlePrefix = elite ? `${elite.title} · ` : '';
    return { name: `${titlePrefix}${name} F${floor}`, hp: maxHp, maxHp, atk, rank, elite: Boolean(elite), eliteId: elite?.id || null, rewardMult: elite?.rewardMult || 1, relicBonus: elite?.relicBonus || 0 };
  };

  const getRaidFloorRewards = (floor, enemyMaxHp, rewardMult = 1, directive = 'assault') => {
    const longJourneyRewardFactor = 0.52;
    const clearPressure = 1 + Math.min(0.9, (raidMeta.clears || 0) * 0.016);
    const baseGold = 24 + (floor * 12) + Math.floor(enemyMaxHp * 0.025);
    const baseExp = 36 + (floor * 16) + Math.floor(enemyMaxHp * 0.03);
    const directiveBonus = RAID_DIRECTIVES[directive]?.rewardMult || 1;
    return {
      gold: Math.round(baseGold * clearPressure * rewardMult * directiveBonus * longJourneyRewardFactor),
      exp: Math.round(baseExp * clearPressure * rewardMult * directiveBonus * longJourneyRewardFactor)
    };
  };

  const rollEliteBonusRelic = (floor) => {
    const guaranteedPool = RELIC_LIBRARY.filter((relic) => {
      if (floor >= 9) return true;
      if (floor >= 7) return relic.rarity !== 'Common';
      if (floor >= 4) return relic.rarity !== 'Legendary';
      return relic.rarity === 'Rare' || relic.rarity === 'Epic';
    });
    return guaranteedPool[Math.floor(Math.random() * guaranteedPool.length)] || null;
  };

  const rollRelicDrop = (floor) => {
    const dropChance = Math.min(0.26 + (floor * 0.03), 0.7);
    if (Math.random() > dropChance) return null;
    const pool = RELIC_LIBRARY.filter((relic) => {
      if (floor >= 9) return true;
      if (floor >= 6) return relic.rarity !== 'Legendary';
      if (floor >= 3) return relic.rarity !== 'Legendary';
      return relic.rarity === 'Common' || relic.rarity === 'Rare';
    });
    return pool[Math.floor(Math.random() * pool.length)] || null;
  };

  const addRelicToInventory = (relicId) => {
    setRelicInventory((prev) => ({ ...prev, [relicId]: (prev[relicId] || 0) + 1 }));
  };

  const equipRelic = (relicId) => {
    if ((relicInventory[relicId] || 0) <= 0) return;
    setEquippedRelic(relicId);
    playSfx('click', soundEnabled, soundTheme);
  };

  const unequipRelic = () => {
    setEquippedRelic(null);
    playSfx('click', soundEnabled, soundTheme);
  };

  const startRaid = () => {
    const hunterProfile = getHunterCombatProfile(playerStats, lifestyle);
    const avatarStage = getSystemAvatarStage(playerStats.level || 1);
    const hunterTier = mapAvatarStageToHunterTier(avatarStage);
    const hunterForm = getHunterFormByTier(hunterTier);
    const floorBalance = getFloorBattleBalance(hunterProfile.power, 1);
    const enemy = generateRaidEnemy(1, null, floorBalance);
    const bonusHp = (relicFx.hpBonus || 0) + (treeFx.hpBonus || 0);
    const seasonHpBonus = Math.floor((raidSeason.mastery / RAID_SEASON_TARGET) * 90);
    const lifestyleHpBonus = Math.floor(lifestyle.adherence * 36);
    const hunterBonusHp = Math.max(0, Math.floor(((playerStats.vit || 10) - 10) * 3) + Math.floor(((playerStats.level || 1) - 1) * 2) + Math.floor((playerStats.completedWorkouts || 0) / 3) + seasonHpBonus + lifestyleHpBonus);
    const energyCap = 100 + Math.max(0, Math.floor(((playerStats.agi || 10) - 10) * 1.2)) + (relicFx.energyCapBonus || 0) + (treeFx.energyOnHit || 0);
    const startingPotions = 2 + (relicFx.extraPotions || 0);
    const baseMaxHp = 120 + bonusHp + hunterBonusHp;
    const tunedMaxHp = Math.max(95, Math.round(baseMaxHp * floorBalance.hunterHpMult));
    const lowReadinessWarning = floorBalance.readiness < 0.85
      ? `Warning: potenza bassa (${hunterProfile.power}/${floorBalance.requirement}).`
      : `Potenza stabile (${hunterProfile.power}/${floorBalance.requirement}).`;
    setRaid({
      active: true,
      floor: 1,
      hp: tunedMaxHp,
      maxHp: tunedMaxHp,
      energy: energyCap,
      potions: startingPotions,
      relics: 0,
      shadowResurgenceUsed: false,
      status: 'combat',
      enemy,
      hunterPower: hunterProfile.power,
      hunterTier,
      hunterAvatarStage: avatarStage,
      hunterFormCode: hunterForm.code,
      hunterFormName: hunterForm.label,
      hunterFormPassive: hunterForm.passive,
      floorReadiness: floorBalance.readiness,
      floorPowerRequirement: floorBalance.requirement,
      hunterDamageMult: floorBalance.hunterDamageMult,
      hunterDefenseMult: floorBalance.hunterDefenseMult,
      enemyDamageMult: floorBalance.enemyDamageMult,
      enemyHpMult: floorBalance.enemyHpMult,
      formSkillReadyAt: 0,
      formEvadeBoostHits: 0,
      formDefenseBoostHits: 0,
      formEnemyWeakenHits: 0,
      enemyAttackTick: 0,
      directive: 'assault',
      hunterSkillPower: hunterSkillTree.unlockedCount || 0,
      log: [`Forma attiva: ${hunterForm.label} · ${hunterForm.passive}`, `Skill Tree: ${hunterSkillTree.unlockedCount}/${HUNTER_SKILL_TREE.length}`, lowReadinessWarning, `Ingresso dungeon: ${enemy.name}`]
    });
    setRaidDirectivePrompt(false);
    setRaidRewardRoom(null);
    setRaidMeta((prev) => ({ ...prev, totalRuns: (prev.totalRuns || 0) + 1 }));
    setRaidRpgLevel(playerStats.level || 7);
    triggerRaidCinematic('Entering the dungeon...');
    playSfx('nav', soundEnabled, soundTheme);
    speakLine("Shadow Dungeon aperto. Inizia il raid.", voiceEnabled);
  };

  const selectRaidDirective = (directive) => {
    const valid = RAID_DIRECTIVES[directive] ? directive : 'assault';
    setRaid((prev) => {
      if (!prev.active) return prev;
      return { ...prev, directive: valid, log: [`Direttiva: ${RAID_DIRECTIVES[valid].label}`, ...prev.log].slice(0, 12) };
    });
    setRaidDirectivePrompt(false);
    playSfx('click', soundEnabled, soundTheme);
  };

  const applyEnemyStrike = (state, moveType = 'basic', fromAi = false) => {
    if (!state.enemy || state.enemy.hp <= 0) return state;
    const directiveFx = RAID_DIRECTIVES[state.directive || 'assault'] || RAID_DIRECTIVES.assault;
    const hunterForm = getHunterFormByTier(state.hunterTier || 1);
    const moveMultiplier = moveType === 'dash' ? 1.18 : moveType === 'roar' ? 1.08 : moveType === 'guard' ? 0.88 : 1;
    const mitigatedByVit = Math.max(4, Math.floor((state.enemy.atk * moveMultiplier) - Math.floor((playerStats.vit || 10) / 5)));
    const defenseFactor = Math.max(0.7, Math.min(1.22, 1 / (state.hunterDefenseMult || 1)));
    const evadeChance = Math.max(0, Math.min(0.55, (hunterForm.evadeChance || 0) + (treeFx.evadeChance || 0) + ((state.formEvadeBoostHits || 0) > 0 ? 0.34 : 0)));
    const evaded = Math.random() < evadeChance;
    const enemyAtkDown = Math.max(0, Math.min(0.25, hunterForm.enemyAtkDown || 0));
    const weakenBonus = (state.formEnemyWeakenHits || 0) > 0 ? 0.14 : 0;
    const defenseBonus = Math.max(0, Math.min(0.52, (hunterForm.defensePct || 0) + (treeFx.defensePct || 0) + ((state.formDefenseBoostHits || 0) > 0 ? 0.22 : 0)));
    const reduced = evaded
      ? 0
      : Math.max(3, Math.floor(mitigatedByVit * (1 - (relicFx.defensePct || 0)) * (1 - defenseBonus) * (1 - enemyAtkDown) * (1 - weakenBonus) * directiveFx.damageTaken * (state.enemyDamageMult || 1) * defenseFactor));
    const newHp = Math.max(0, state.hp - reduced);
    const hitLine = fromAi
      ? `[AI] ${state.enemy.name} usa ${moveType.toUpperCase()}: ${evaded ? 'MISS' : `-${reduced} HP`}`
      : `${state.enemy.name} ti colpisce: ${evaded ? 'MISS' : `-${reduced} HP`}`;
    const afterHit = {
      ...state,
      hp: newHp,
      enemyAttackTick: (state.enemyAttackTick || 0) + 1,
      formEvadeBoostHits: Math.max(0, (state.formEvadeBoostHits || 0) - 1),
      formDefenseBoostHits: Math.max(0, (state.formDefenseBoostHits || 0) - 1),
      formEnemyWeakenHits: Math.max(0, (state.formEnemyWeakenHits || 0) - 1),
      log: [hitLine, ...state.log].slice(0, 12)
    };
    if (newHp > 0) return afterHit;
    if (!afterHit.shadowResurgenceUsed) {
      return {
        ...afterHit,
        hp: 60,
        shadowResurgenceUsed: true,
        log: ["ARISE! Resurrezione ombra attivata (+60 HP).", ...afterHit.log].slice(0, 12)
      };
    }
    return { ...afterHit, status: 'down', log: ["Sei caduto nel dungeon.", ...afterHit.log].slice(0, 12) };
  };

  const enemyTurn = (nextState) => {
    if (!nextState.enemy || nextState.enemy.hp <= 0) return nextState;
    setRaidDamagePulse((tick) => tick + 1);
    return applyEnemyStrike(nextState, 'basic', false);
  };

  const raidAttack = () => {
    playAttackAudio();
    setRaid((prev) => {
      if (!prev.active || prev.status !== 'combat' || !prev.enemy) return prev;
      const directiveFx = RAID_DIRECTIVES[prev.directive || 'assault'] || RAID_DIRECTIVES.assault;
      const hunterForm = getHunterFormByTier(prev.hunterTier || 1);
      const forceBonus = playerStats.systemForceBonus || 0;
      const progressionBonus = Math.max(0, Math.floor(((playerStats.level || 1) - 1) * 2.1) + Math.floor((playerStats.completedWorkouts || 0) / 2) + Math.floor((raidSeason.mastery / RAID_SEASON_TARGET) * 52) + Math.floor(lifestyle.adherence * 18) + (forceBonus * 2));
      const base = 16 + Math.floor(((playerStats.str || 10) + forceBonus) * 1.2) + Math.floor((playerStats.agi || 10) * 0.5) + progressionBonus;
      const critChance = Math.min(0.16 + (relicFx.critBonus || 0) + (treeFx.critBonus || 0), 0.6);
      const formCritBonus = Math.max(0, Math.min(0.25, hunterForm.critBonus || 0));
      const totalCritChance = Math.min(0.62, critChance + formCritBonus);
      const crit = Math.random() < totalCritChance;
      const modifiedBase = Math.floor(base * (1 + (relicFx.damagePct || 0) + (treeFx.damagePct || 0))) + (relicFx.damageFlat || 0);
      const rageDamage = prev.enemy.hp / prev.enemy.maxHp <= 0.35 ? (hunterForm.rageDamageMult || 1) : 1;
      const dmg = Math.max(8, modifiedBase + Math.floor(Math.random() * 9) - 4) * (crit ? 1.5 : 1) * directiveFx.damageOut * (prev.hunterDamageMult || 1) * rageDamage;
      const energyCap = 100 + Math.max(0, Math.floor(((playerStats.agi || 10) - 10) * 1.2)) + (relicFx.energyCapBonus || 0) + (treeFx.energyOnHit || 0);
      const enemyHp = Math.max(0, prev.enemy.hp - Math.floor(dmg));
      setRaidHitTick((tick) => tick + 1);
      const formEnergy = Math.max(0, Math.min(12, hunterForm.attackEnergyBonus || 0));
      let next = {
        ...prev,
        enemy: { ...prev.enemy, hp: enemyHp },
        energy: Math.min(energyCap, prev.energy + 8 + formEnergy + (relicFx.energyOnHit || 0) + (treeFx.energyOnHit || 0) + (directiveFx.energyOnHit || 0)),
        log: [`Colpo ${crit ? 'CRITICO ' : ''}-${Math.floor(dmg)} a ${prev.enemy.name}`, ...prev.log].slice(0, 12)
      };
      if (enemyHp === 0) {
        triggerFormFinisher(prev.hunterTier || 1, prev.hunterFormName || hunterForm.label);
        const floorRewards = getRaidFloorRewards(prev.floor, prev.enemy.maxHp, prev.enemy.rewardMult || 1, prev.directive || 'assault');
        const floorClearGold = floorRewards.gold;
        const floorClearExp = floorRewards.exp;
        const masteryGain = grantSeasonMastery(prev.floor, prev.enemy, prev.directive || 'assault');
        const floorRelics = prev.relics + 1;
        let droppedRelic = rollRelicDrop(prev.floor);
        if (prev.enemy.elite && !droppedRelic && Math.random() < (0.55 + (prev.enemy.relicBonus || 0))) {
          droppedRelic = rollEliteBonusRelic(prev.floor);
        }
        if (droppedRelic) {
          addRelicToInventory(droppedRelic.id);
          next = { ...next, log: [`Drop Reliquia: ${droppedRelic.name}`, ...next.log].slice(0, 12) };
          speakLine(`Reliquia trovata: ${droppedRelic.name}`, voiceEnabled);
        }
        setPlayerStats((ps) => ({ ...ps, gold: (ps.gold || 0) + floorClearGold, exp: (ps.exp || 0) + floorClearExp + Math.round(masteryGain * 0.9) }));
        setRaidMeta((meta) => ({
          ...meta,
          floorClears: (meta.floorClears || 0) + 1,
          highestFloor: Math.max(meta.highestFloor || 1, prev.floor),
          eliteKills: (meta.eliteKills || 0) + (prev.enemy.elite ? 1 : 0)
        }));
        openRewardRoom({
          floor: prev.floor,
          gold: floorClearGold,
          exp: floorClearExp,
          mastery: masteryGain,
          relic: droppedRelic,
          status: prev.floor >= 10 ? 'victory' : 'clear',
          finisher: true
        });
        playSfx('success', soundEnabled, soundTheme);
        speakLine(`Piano ${prev.floor} ripulito.`, voiceEnabled);
        if (prev.floor >= 10) {
          const eliteFinalBonus = prev.enemy.elite ? 1.2 : 1;
          const clearGold = Math.round((480 + Math.floor((raidMeta.clears || 0) * 20)) * eliteFinalBonus);
          const clearExp = Math.round((620 + Math.floor((raidMeta.clears || 0) * 30)) * eliteFinalBonus);
          setPlayerStats((ps) => ({ ...ps, gold: (ps.gold || 0) + clearGold, exp: (ps.exp || 0) + clearExp, keys: (ps.keys || 0) + 2 }));
          setRaidMeta((meta) => ({
            ...meta,
            clears: (meta.clears || 0) + 1,
            highestFloor: Math.max(meta.highestFloor || 1, 10),
            lastClearAt: new Date().toISOString()
          }));
          return { ...next, relics: floorRelics, status: 'victory', log: [`DUNGEON CLEAR! +${clearGold}G +${clearExp}EXP +2 Key`, ...next.log].slice(0, 12) };
        }
        return { ...next, relics: floorRelics, status: 'clear', log: [`Piano ${prev.floor} completato · +${masteryGain} Mastery`, ...next.log].slice(0, 12) };
      }
      playSfx('click', soundEnabled, soundTheme);
      return enemyTurn(next);
    });
  };

  const raidSkill = () => {
    playAttackAudio();
    setRaid((prev) => {
      const directiveFx = RAID_DIRECTIVES[prev.directive || 'assault'] || RAID_DIRECTIVES.assault;
      const hunterForm = getHunterFormByTier(prev.hunterTier || 1);
      const formSkillCostReduction = Math.max(0, Math.min(8, hunterForm.skillCostReduction || 0));
      const skillCost = Math.max(8, 25 - (relicFx.skillCostReduction || 0) - (treeFx.skillCostReduction || 0) - (directiveFx.skillCostDelta || 0) - formSkillCostReduction);
      if (!prev.active || prev.status !== 'combat' || !prev.enemy || prev.energy < skillCost) return prev;
      const forceBonus = playerStats.systemForceBonus || 0;
      const progressionBonus = Math.max(0, Math.floor(((playerStats.level || 1) - 1) * 2.6) + Math.floor((playerStats.completedWorkouts || 0) / 2) + Math.floor((raidSeason.mastery / RAID_SEASON_TARGET) * 60) + Math.floor(lifestyle.adherence * 20) + (forceBonus * 2));
      const formSkillDamage = Math.max(1, Math.min(1.35, hunterForm.skillDamageMult || 1));
      const rageDamage = prev.enemy.hp / prev.enemy.maxHp <= 0.35 ? (hunterForm.rageDamageMult || 1) : 1;
      const dmg = Math.floor((28 + Math.floor(((playerStats.str || 10) + forceBonus) * 1.6) + progressionBonus) * (1 + (relicFx.damagePct || 0) + (treeFx.damagePct || 0)) * directiveFx.damageOut * (prev.hunterDamageMult || 1) * formSkillDamage * rageDamage);
      const enemyHp = Math.max(0, prev.enemy.hp - dmg);
      setRaidHitTick((tick) => tick + 1);
      const energyCap = 100 + Math.max(0, Math.floor(((playerStats.agi || 10) - 10) * 1.2)) + (relicFx.energyCapBonus || 0) + (treeFx.energyOnHit || 0);
      let next = {
        ...prev,
        energy: Math.min(energyCap, prev.energy - skillCost + (directiveFx.energyOnHit || 0) + (treeFx.energyOnHit || 0)),
        hp: Math.min(prev.maxHp, prev.hp + 10),
        enemy: { ...prev.enemy, hp: enemyHp },
        log: [`Skill Ombra: -${dmg}, +10 HP`, ...prev.log].slice(0, 12)
      };
      if (enemyHp === 0) {
        const floorRewards = getRaidFloorRewards(prev.floor, prev.enemy.maxHp, prev.enemy.rewardMult || 1, prev.directive || 'assault');
        const floorClearGold = floorRewards.gold;
        const floorClearExp = floorRewards.exp;
        const masteryGain = grantSeasonMastery(prev.floor, prev.enemy, prev.directive || 'assault');
        let droppedRelic = rollRelicDrop(prev.floor);
        if (prev.enemy.elite && !droppedRelic && Math.random() < (0.55 + (prev.enemy.relicBonus || 0))) {
          droppedRelic = rollEliteBonusRelic(prev.floor);
        }
        if (droppedRelic) {
          addRelicToInventory(droppedRelic.id);
          next = { ...next, log: [`Drop Reliquia: ${droppedRelic.name}`, ...next.log].slice(0, 12) };
          speakLine(`Reliquia trovata: ${droppedRelic.name}`, voiceEnabled);
        }
        setPlayerStats((ps) => ({ ...ps, gold: (ps.gold || 0) + floorClearGold, exp: (ps.exp || 0) + floorClearExp + Math.round(masteryGain * 0.9) }));
        setRaidMeta((meta) => ({
          ...meta,
          floorClears: (meta.floorClears || 0) + 1,
          highestFloor: Math.max(meta.highestFloor || 1, prev.floor),
          eliteKills: (meta.eliteKills || 0) + (prev.enemy.elite ? 1 : 0)
        }));
        openRewardRoom({
          floor: prev.floor,
          gold: floorClearGold,
          exp: floorClearExp,
          mastery: masteryGain,
          relic: droppedRelic,
          status: prev.floor >= 10 ? 'victory' : 'clear',
          finisher: false
        });
        playSfx('success', soundEnabled, soundTheme);
        if (prev.floor >= 10) {
          const eliteFinalBonus = prev.enemy.elite ? 1.2 : 1;
          const clearGold = Math.round((480 + Math.floor((raidMeta.clears || 0) * 20)) * eliteFinalBonus);
          const clearExp = Math.round((620 + Math.floor((raidMeta.clears || 0) * 30)) * eliteFinalBonus);
          setPlayerStats((ps) => ({ ...ps, gold: (ps.gold || 0) + clearGold, exp: (ps.exp || 0) + clearExp, keys: (ps.keys || 0) + 2 }));
          setRaidMeta((meta) => ({
            ...meta,
            clears: (meta.clears || 0) + 1,
            highestFloor: Math.max(meta.highestFloor || 1, 10),
            lastClearAt: new Date().toISOString()
          }));
          return { ...next, relics: prev.relics + 1, status: 'victory', log: [`DUNGEON CLEAR! +${clearGold}G +${clearExp}EXP +2 Key`, ...next.log].slice(0, 12) };
        }
        return { ...next, relics: prev.relics + 1, status: 'clear', log: [`Piano ${prev.floor} completato · +${masteryGain} Mastery`, ...next.log].slice(0, 12) };
      }
      playSfx('click', soundEnabled, soundTheme);
      return enemyTurn(next);
    });
  };

  const useFormSkill = () => {
    playAttackAudio();
    setRaid((prev) => {
      if (!prev.active || prev.status !== 'combat' || !prev.enemy) return prev;
      const activeSkill = getActiveSkillByTier(prev.hunterTier || 1);
      const now = Date.now();
      if (now < (prev.formSkillReadyAt || 0)) return prev;
      if (prev.energy < activeSkill.energyCost) return prev;

      const forceBonus = playerStats.systemForceBonus || 0;
      const hunterForm = getHunterFormByTier(prev.hunterTier || 1);
      const progressionBonus = Math.max(0, Math.floor(((playerStats.level || 1) - 1) * 2.5) + Math.floor((playerStats.completedWorkouts || 0) / 2) + Math.floor((raidSeason.mastery / RAID_SEASON_TARGET) * 56) + Math.floor(lifestyle.adherence * 19) + (forceBonus * 2));
      const baseBurst = 24 + Math.floor(((playerStats.str || 10) + forceBonus) * 1.45) + progressionBonus;
      let burst = baseBurst;
      let nextEnergy = prev.energy - activeSkill.energyCost;
      let heal = 0;
      let evadeBoost = 0;
      let defenseBoost = 0;
      let enemyWeaken = 0;
      let extraLog = '';

      switch (prev.hunterTier || 1) {
        case 1:
          heal = 28;
          defenseBoost = 2;
          burst = Math.floor(baseBurst * 0.95);
          extraLog = 'Aegis attivo: guardia rinforzata';
          break;
        case 2:
          nextEnergy = Math.min(120, nextEnergy + 20);
          burst = Math.floor(baseBurst * 1.08);
          extraLog = 'Rush attivo: energia rigenerata';
          break;
        case 3: {
          const critRoll = Math.random() < 0.62;
          burst = Math.floor(baseBurst * (critRoll ? 1.9 : 1.22));
          extraLog = critRoll ? 'Tempest CRIT assoluto' : 'Tempest colpo multiplo';
          break;
        }
        case 4:
          evadeBoost = 2;
          burst = Math.floor(baseBurst * 1.05);
          extraLog = 'Blink attivo: evasione potenziata';
          break;
        case 5:
          enemyWeaken = 2;
          burst = Math.floor(baseBurst * 1.36);
          extraLog = 'Overdrive: boss indebolito';
          break;
        case 6:
        default:
          heal = 24;
          enemyWeaken = 2;
          evadeBoost = 1;
          burst = Math.floor(baseBurst * 1.56);
          extraLog = 'Judgment: dominio del monarca';
          break;
      }

      const directiveFx = RAID_DIRECTIVES[prev.directive || 'assault'] || RAID_DIRECTIVES.assault;
      const rageDamage = prev.enemy.hp / prev.enemy.maxHp <= 0.35 ? (hunterForm.rageDamageMult || 1) : 1;
      const totalDmg = Math.max(10, Math.floor(burst * directiveFx.damageOut * (prev.hunterDamageMult || 1) * rageDamage));
      const enemyHp = Math.max(0, prev.enemy.hp - totalDmg);
      triggerFormCutin(prev.hunterTier || 1, prev.hunterFormName || hunterForm.label);
      setRaidHitTick((tick) => tick + 1);
      setFormSkillTick((tick) => tick + 1);

      let next = {
        ...prev,
        energy: nextEnergy,
        hp: Math.min(prev.maxHp, prev.hp + heal),
        enemy: { ...prev.enemy, hp: enemyHp },
        formEvadeBoostHits: Math.max(prev.formEvadeBoostHits || 0, evadeBoost),
        formDefenseBoostHits: Math.max(prev.formDefenseBoostHits || 0, defenseBoost),
        formEnemyWeakenHits: Math.max(prev.formEnemyWeakenHits || 0, enemyWeaken),
        formSkillReadyAt: now + activeSkill.cooldownMs,
        log: [`${activeSkill.name}: -${totalDmg}${heal > 0 ? `, +${heal} HP` : ''}`, extraLog, ...prev.log].slice(0, 12)
      };

      if (enemyHp === 0) {
        const floorRewards = getRaidFloorRewards(prev.floor, prev.enemy.maxHp, prev.enemy.rewardMult || 1, prev.directive || 'assault');
        const floorClearGold = floorRewards.gold;
        const floorClearExp = floorRewards.exp;
        const masteryGain = grantSeasonMastery(prev.floor, prev.enemy, prev.directive || 'assault');
        let droppedRelic = rollRelicDrop(prev.floor);
        if (prev.enemy.elite && !droppedRelic && Math.random() < (0.55 + (prev.enemy.relicBonus || 0))) {
          droppedRelic = rollEliteBonusRelic(prev.floor);
        }
        if (droppedRelic) {
          addRelicToInventory(droppedRelic.id);
          next = { ...next, log: [`Drop Reliquia: ${droppedRelic.name}`, ...next.log].slice(0, 12) };
          speakLine(`Reliquia trovata: ${droppedRelic.name}`, voiceEnabled);
        }
        setPlayerStats((ps) => ({ ...ps, gold: (ps.gold || 0) + floorClearGold, exp: (ps.exp || 0) + floorClearExp + Math.round(masteryGain * 0.9) }));
        setRaidMeta((meta) => ({
          ...meta,
          floorClears: (meta.floorClears || 0) + 1,
          highestFloor: Math.max(meta.highestFloor || 1, prev.floor),
          eliteKills: (meta.eliteKills || 0) + (prev.enemy.elite ? 1 : 0)
        }));
        openRewardRoom({
          floor: prev.floor,
          gold: floorClearGold,
          exp: floorClearExp,
          mastery: masteryGain,
          relic: droppedRelic,
          status: prev.floor >= 10 ? 'victory' : 'clear',
          finisher: true
        });
        playSfx('success', soundEnabled, soundTheme);
        if (prev.floor >= 10) {
          const eliteFinalBonus = prev.enemy.elite ? 1.2 : 1;
          const clearGold = Math.round((480 + Math.floor((raidMeta.clears || 0) * 20)) * eliteFinalBonus);
          const clearExp = Math.round((620 + Math.floor((raidMeta.clears || 0) * 30)) * eliteFinalBonus);
          setPlayerStats((ps) => ({ ...ps, gold: (ps.gold || 0) + clearGold, exp: (ps.exp || 0) + clearExp, keys: (ps.keys || 0) + 2 }));
          setRaidMeta((meta) => ({
            ...meta,
            clears: (meta.clears || 0) + 1,
            highestFloor: Math.max(meta.highestFloor || 1, 10),
            lastClearAt: new Date().toISOString()
          }));
          return { ...next, relics: prev.relics + 1, status: 'victory', log: [`DUNGEON CLEAR! +${clearGold}G +${clearExp}EXP +2 Key`, ...next.log].slice(0, 12) };
        }
        return { ...next, relics: prev.relics + 1, status: 'clear', log: [`Piano ${prev.floor} completato · +${masteryGain} Mastery`, ...next.log].slice(0, 12) };
      }

      playSfx('success', soundEnabled, soundTheme);
      return enemyTurn(next);
    });
  };

  const usePotion = () => {
    setRaid((prev) => {
      if (!prev.active || prev.potions <= 0 || prev.status === 'down') return prev;
      playSfx('click', soundEnabled, soundTheme);
      return { ...prev, potions: prev.potions - 1, hp: Math.min(prev.maxHp, prev.hp + 45), log: ["Pozione usata: +45 HP", ...prev.log].slice(0, 12) };
    });
  };

  const nextFloor = () => {
    setRaid((prev) => {
      if (prev.status !== 'clear') return prev;
      setRaidRewardRoom(null);
      const floor = prev.floor + 1;
      const elite = rollEliteEncounter(floor);
      const hunterProfile = getHunterCombatProfile(playerStats, getLifestyleSnapshot(playerStats));
      const avatarStage = getSystemAvatarStage(playerStats.level || 1);
      const hunterTier = mapAvatarStageToHunterTier(avatarStage);
      const hunterForm = getHunterFormByTier(hunterTier);
      const floorBalance = getFloorBattleBalance(hunterProfile.power, floor);
      const enemy = generateRaidEnemy(floor, elite, floorBalance);
      const energyCap = 100 + Math.max(0, Math.floor(((playerStats.agi || 10) - 10) * 1.2)) + (relicFx.energyCapBonus || 0) + (treeFx.energyOnHit || 0);
      if (floor % 2 === 0) {
        setRaidRpgLevel((lvl) => lvl + 1);
        setLevelUpTick((tick) => tick + 1);
        playLevelupAudio();
        triggerRaidCinematic('LEVEL UP');
      } else {
        triggerRaidCinematic(`Entering floor ${floor}...`);
      }
      if (elite) {
        setRaidDirectivePrompt(true);
        triggerRaidCinematic(`ELITE ENCOUNTER · ${elite.title}`);
        playSfx('warning', soundEnabled, soundTheme);
      } else {
        setRaidDirectivePrompt(false);
      }
      playSfx('nav', soundEnabled, soundTheme);
      const hpBuffer = Math.max(80, Math.round(prev.maxHp * (0.9 + (floorBalance.hunterHpMult - 1) * 0.25)));
      const entryLog = floorBalance.readiness < 0.82
        ? `Piano ${floor} sopra il tuo range (${hunterProfile.power}/${floorBalance.requirement})`
        : `Piano ${floor} dentro range (${hunterProfile.power}/${floorBalance.requirement})`;
      return {
        ...prev,
        floor,
        status: 'combat',
        enemy,
        hp: Math.min(hpBuffer, prev.hp + 18),
        maxHp: hpBuffer,
        hunterPower: hunterProfile.power,
        hunterTier,
        hunterAvatarStage: avatarStage,
        hunterFormCode: hunterForm.code,
        hunterFormName: hunterForm.label,
        hunterFormPassive: hunterForm.passive,
        hunterSkillPower: hunterSkillTree.unlockedCount || 0,
        floorReadiness: floorBalance.readiness,
        floorPowerRequirement: floorBalance.requirement,
        hunterDamageMult: floorBalance.hunterDamageMult,
        hunterDefenseMult: floorBalance.hunterDefenseMult,
        enemyDamageMult: floorBalance.enemyDamageMult,
        enemyHpMult: floorBalance.enemyHpMult,
        formEvadeBoostHits: 0,
        formDefenseBoostHits: 0,
        formEnemyWeakenHits: 0,
        energy: Math.min(energyCap, prev.energy + 15),
        log: [`Forma attiva: ${hunterForm.label} · ${hunterForm.passive}`, `Skill Tree: ${hunterSkillTree.unlockedCount}/${HUNTER_SKILL_TREE.length}`, entryLog, `Ingresso piano ${floor}: ${enemy.name}${elite ? ' [ELITE]' : ''}`, ...prev.log].slice(0, 12)
      };
    });
  };

  const retreatRaid = () => {
    setRaid((prev) => ({ ...prev, active: false, status: 'idle' }));
    setRaidDirectivePrompt(false);
    setRaidRewardRoom(null);
    playSfx('warning', soundEnabled, soundTheme);
    speakLine("Ritirata completata. Dungeon chiuso.", voiceEnabled);
  };

  const performMonsterAiMove = (moveType, state) => {
    setMonsterMove((prev) => ({ tick: prev.tick + 1, type: moveType }));
    const enemyHpPct = state?.enemy ? state.enemy.hp / state.enemy.maxHp : 1;
    const now = Date.now();
    const minGap = moveType === 'dash' ? 320 : 520;
    if (now - monsterVoiceCooldownRef.current >= minGap) {
      playMonsterGrowl({
        move: moveType,
        intensity: Math.min(1, 1 - enemyHpPct + 0.2),
        enabled: !raidAudioMuted
      });
      monsterVoiceCooldownRef.current = now;
    }
  };

  const [isAttacking, setIsAttacking] = useState(false);
  const [damageText, setDamageText] = useState(null);
  const [isCritHit, setIsCritHit] = useState(false);
  const [raidHitTick, setRaidHitTick] = useState(0);
  const [formSkillTick, setFormSkillTick] = useState(0);
  const [formFinisherTick, setFormFinisherTick] = useState(0);
  const [raidImmersive, setRaidImmersive] = useState(true);
  const [monsterMove, setMonsterMove] = useState({ tick: 0, type: 'idle' });
  const [levelUpTick, setLevelUpTick] = useState(0);
  const [raidRpgLevel, setRaidRpgLevel] = useState(playerStats.level || 7);
  const [raidCinematic, setRaidCinematic] = useState('');
  const [raidFormCutin, setRaidFormCutin] = useState(null);
  const [raidFinisherBanner, setRaidFinisherBanner] = useState(null);
  const [raidRewardRoom, setRaidRewardRoom] = useState(null);
  const [raidUiClock, setRaidUiClock] = useState(0);
  const [raidAudioMuted, setRaidAudioMuted] = useState(false);
  const [monsterAiEnabled, setMonsterAiEnabled] = useState(() => {
    const saved = localStorage.getItem('shadow_monarch_monster_ai');
    return saved ? saved === '1' : true;
  });
  const [raidFullscreen, setRaidFullscreen] = useState(false);
  const [raidDirectivePrompt, setRaidDirectivePrompt] = useState(false);
  const [raidDamagePulse, setRaidDamagePulse] = useState(0);
  const raidRef = useRef(raid);
  const aiQueueRef = useRef([]);
  const aiBusyRef = useRef(false);
  const aiAttackBiasRef = useRef(0.62);
  const monsterVoiceCooldownRef = useRef(0);
  const raidShellRef = useRef(null);
  const ambientRef = useRef(null);
  const attackRef = useRef(null);
  const levelupRef = useRef(null);

  useEffect(() => {
    raidRef.current = raid;
  }, [raid]);

  useEffect(() => {
    if (!raid.active) return;
    const timer = window.setInterval(() => setRaidUiClock((v) => v + 1), 500);
    return () => window.clearInterval(timer);
  }, [raid.active]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setRaidFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);
  
  // 🔥 IL MOTORE DI SPAWN
  const [isSpawning, setIsSpawning] = useState(true);

  useEffect(() => {
    setIsSpawning(true);
    const timer = setTimeout(() => {
      setIsSpawning(false); 
    }, 1200);
    return () => clearTimeout(timer);
  }, [boss.level]);

  const triggerRaidCinematic = (text) => {
    setRaidCinematic(text);
    window.setTimeout(() => setRaidCinematic(''), 800);
  };

  const triggerFormCutin = (tier = 1, formName = 'Hunter Form') => {
    const theme = HUNTER_FORM_CUTINS[Math.max(1, Math.min(6, tier))] || HUNTER_FORM_CUTINS[1];
    setRaidFormCutin({ ...theme, formName });
    window.setTimeout(() => setRaidFormCutin(null), 900);
  };

  const triggerFormFinisher = (tier = 1, formName = 'Hunter Form') => {
    const theme = HUNTER_FORM_CUTINS[Math.max(1, Math.min(6, tier))] || HUNTER_FORM_CUTINS[1];
    setRaidFinisherBanner({ ...theme, formName });
    setFormFinisherTick((tick) => tick + 1);
    window.setTimeout(() => setRaidFinisherBanner(null), 1200);
  };

  const openRewardRoom = ({ floor = 1, gold = 0, exp = 0, mastery = 0, relic = null, status = 'clear', finisher = false }) => {
    setRaidRewardRoom({
      floor,
      gold,
      exp,
      mastery,
      relic,
      status,
      finisher
    });
  };

  useEffect(() => {
    ambientRef.current = new Audio('/ambient.mp3');
    ambientRef.current.loop = true;
    ambientRef.current.volume = 0.28;
    attackRef.current = new Audio('/attack.mp3');
    attackRef.current.volume = 0.48;
    levelupRef.current = new Audio('/levelup.mp3');
    levelupRef.current.volume = 0.62;
    return () => {
      if (ambientRef.current) ambientRef.current.pause();
    };
  }, []);

  useEffect(() => {
    if (!ambientRef.current) return;
    if (!raid.active || arenaMode !== 'raid' || raidAudioMuted) {
      ambientRef.current.pause();
      return;
    }
    ambientRef.current.play().catch(() => {});
  }, [raid.active, arenaMode, raidAudioMuted]);

  useEffect(() => {
    localStorage.setItem('shadow_monarch_monster_ai', monsterAiEnabled ? '1' : '0');
  }, [monsterAiEnabled]);

  const playAttackAudio = () => {
    if (raidAudioMuted || !attackRef.current) return;
    attackRef.current.currentTime = 0;
    attackRef.current.play().catch(() => {});
  };

  const playLevelupAudio = () => {
    if (raidAudioMuted || !levelupRef.current) return;
    levelupRef.current.currentTime = 0;
    levelupRef.current.play().catch(() => {});
  };

  const toggleRaidFullscreen = async () => {
    try {
      if (!document.fullscreenElement && raidShellRef.current?.requestFullscreen) {
        await raidShellRef.current.requestFullscreen();
        triggerRaidCinematic('Immersion mode engaged');
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        triggerRaidCinematic('Returning to tactical view');
      }
    } catch (_) {
      // Ignore unsupported/fullscreen gesture failures on some mobile browsers.
    }
  };

  const chooseMonsterAiMove = (state) => {
    const enemyHpPct = state.enemy ? state.enemy.hp / state.enemy.maxHp : 1;
    const hunterHpPct = state.maxHp > 0 ? state.hp / state.maxHp : 1;
    const energyPct = Math.min(1, (state.energy || 0) / 100);

    let weights = { roar: 0.34, dash: 0.36, guard: 0.3 };

    // Berserk phase when enemy is low HP: attack-heavy behavior.
    if (enemyHpPct <= 0.3) {
      weights = { roar: 0.18, dash: 0.62, guard: 0.2 };
    }
    // Punish weak hunter: more dashes and roars.
    if (hunterHpPct <= 0.35) {
      weights.dash += 0.12;
      weights.roar += 0.08;
      weights.guard -= 0.2;
    }
    // If hunter is strong and healthy, monster guards/counters more.
    if (hunterHpPct >= 0.75 && enemyHpPct >= 0.55) {
      weights.guard += 0.16;
      weights.dash -= 0.08;
      weights.roar -= 0.08;
    }
    // Resource-aware tweak.
    if (energyPct < 0.25) {
      weights.guard += 0.1;
      weights.roar += 0.06;
      weights.dash -= 0.16;
    } else if (energyPct > 0.7) {
      weights.dash += 0.12;
      weights.guard -= 0.06;
      weights.roar -= 0.06;
    }

    const normalized = {
      roar: Math.max(0.05, weights.roar),
      dash: Math.max(0.05, weights.dash),
      guard: Math.max(0.05, weights.guard)
    };
    const total = normalized.roar + normalized.dash + normalized.guard;
    const roll = Math.random() * total;
    if (roll < normalized.roar) return 'roar';
    if (roll < normalized.roar + normalized.dash) return 'dash';
    return 'guard';
  };

  const requestAnthropicMonsterPlan = async (state) => {
    const context = {
      floor: state.floor,
      enemyHp: state.enemy?.hp || 0,
      enemyMaxHp: state.enemy?.maxHp || 0,
      hunterHp: state.hp || 0,
      hunterMaxHp: state.maxHp || 0,
      energy: state.energy || 0,
      log: (state.log || []).slice(0, 6)
    };

    const data = await requestSystemAI({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Sei l\'IA tattica di un boss dungeon. Devi scegliere mosse imprevedibili ma coerenti. Rispondi SOLO JSON valido: {"moves":["roar|dash|guard", ... max 4], "mood":"string", "attackBias":numero_da_0_a_1}.'
        },
        {
          role: 'user',
          content: `Contesto combattimento: ${JSON.stringify(context)}`
        }
      ]
    });

    const parsed = parseModelJson(data, { schema: 'boss_plan' });
    const moves = parsed.moves || [];
    const mood = parsed.mood || 'adaptive';
    const attackBias = parsed.attackBias ?? 0.62;
    return { moves, mood, attackBias };
  };

  useEffect(() => {
    if (!monsterAiEnabled || !raid.active || raid.status !== 'combat' || !raid.enemy) return;
    let timeoutId;
    const runAiLoop = () => {
      timeoutId = window.setTimeout(() => {
        const state = raidRef.current;
        if (!state?.active || state.status !== 'combat' || !state.enemy) {
          runAiLoop();
          return;
        }

        if (aiQueueRef.current.length < 2 && !aiBusyRef.current) {
          aiBusyRef.current = true;
          requestAnthropicMonsterPlan(state)
            .then((plan) => {
              if (plan.moves.length > 0) aiQueueRef.current = [...aiQueueRef.current, ...plan.moves].slice(0, 6);
              aiAttackBiasRef.current = plan.attackBias;
              if (plan.mood) {
                setRaid((prev) => {
                  if (!prev.active || prev.status !== 'combat') return prev;
                  return { ...prev, log: [`[AI Mood] ${plan.mood}`, ...prev.log].slice(0, 12) };
                });
              }
            })
            .catch(() => {})
            .finally(() => {
              aiBusyRef.current = false;
            });
        }

        const moveType = aiQueueRef.current.shift() || chooseMonsterAiMove(state);
        performMonsterAiMove(moveType, state);

        const enemyHpPct = state.enemy ? state.enemy.hp / state.enemy.maxHp : 1;
        const desperation = enemyHpPct < 0.35;
        if (Math.random() < (desperation ? 0.46 : 0.18)) {
          aiQueueRef.current.unshift(chooseMonsterAiMove(state));
        }
        const baseChance = desperation ? 0.78 : moveType === 'dash' ? 0.74 : moveType === 'roar' ? 0.66 : 0.56;
        const biasMult = 0.78 + (aiAttackBiasRef.current * 0.46);
        const attackChance = Math.min(0.92, Math.max(0.35, baseChance * biasMult));
        if (Math.random() < attackChance) {
          setRaidDamagePulse((tick) => tick + 1);
          setRaid((prev) => {
            if (!prev.active || prev.status !== 'combat' || !prev.enemy) return prev;
            return applyEnemyStrike(prev, moveType, true);
          });
        }
        runAiLoop();
      }, 760 + Math.floor(Math.random() * 980));
    };
    runAiLoop();
    return () => window.clearTimeout(timeoutId);
  }, [monsterAiEnabled, raid.active, raid.status, raid.floor, raidAudioMuted]);

  const currentKeys = playerStats.keys || 0;
  const currentGold = playerStats.gold || 0;

  const forgeKey = () => {
    if (currentGold >= 50) {
      setPlayerStats({ ...playerStats, gold: currentGold - 50, keys: currentKeys + 1 });
    } else {
      alert("⚠️ ORO INSUFFICIENTE! Vai a completare le Quests o ad allenarti per accumulare G.");
    }
  };

  const handleAttack = () => {
    if (boss.defeated || currentKeys <= 0 || isSpawning) return;

    const str = playerStats.str || 10;
    const streak = playerStats.streak || 0;
    
    const baseDamage = 30 + (str * 5); 
    const streakBonus = streak * 15;   
    const randomVariance = Math.floor(Math.random() * 30) - 10; 
    
    let totalDamage = baseDamage + streakBonus + randomVariance;

    const critChance = Math.random();
    let crit = false;
    if (critChance > 0.8) {
      totalDamage = Math.floor(totalDamage * 1.5); 
      crit = true;
    }

    setIsCritHit(crit);
    setIsAttacking(true);
    setDamageText(totalDamage);
    
    setTimeout(() => {
      setIsAttacking(false);
      setDamageText(null);
      setIsCritHit(false);
    }, 500);

    const newHp = Math.max(0, boss.hp - totalDamage);
    let updatedStats = { ...playerStats, keys: currentKeys - 1 };
    
    if (newHp === 0) {
      setBoss({ ...boss, hp: 0, defeated: true });
      
      const expReward = 300 * boss.level;
      const goldReward = 150 * boss.level;
      // Modello sottrattivo condiviso: gestisce anche level-up multipli in un
      // colpo (expReward può superare più soglie level*100).
      const { level: newLevel, exp: newExp, levelsGained } = applyXp(updatedStats, expReward);
      let newAp = updatedStats.ap || 0;

      if (levelsGained > 0) {
        newAp += 3;
        alert(`☠️ IL BOSS È STATO POLVERIZZATO! LEVEL UP! Sei al Livello ${newLevel}!`);
      } else {
        alert(`☠️ IL BOSS È CROLLATO! +${expReward} EXP e +${goldReward} G!`);
      }

      setPlayerStats({ ...updatedStats, level: newLevel, exp: newExp, gold: updatedStats.gold + goldReward, ap: newAp });
    } else {
      setBoss({ ...boss, hp: newHp });
      setPlayerStats(updatedStats);
    }
  };

  const spawnNextBoss = () => {
    const nextLevel = boss.level + 1;
    const newMaxHp = 1000 * nextLevel;
    const bossNames = [
      "Goblin Scavenger", "Lycan Alpha", "Shadow Knight", "Venomous Beast", 
      "Skeleton Warlord", "Demon Brute", "Cerberus Hound", "Abyssal Dragon", "Shadow Monarch"
    ];
    const nameIndex = (nextLevel - 1) % 9;
    
    setBoss({ 
      name: `${bossNames[nameIndex]} Lv.${nextLevel}`, 
      hp: newMaxHp, maxHp: newMaxHp, defeated: false, level: nextLevel 
    });
  };

  const hpPercent = (boss.hp / boss.maxHp) * 100;
  const bossFloor = Math.max(1, Math.min(10, ((boss.level - 1) % 10) + 1));

  const particles = Array.from({ length: 25 }).map((_, i) => ({
    id: i, x: Math.random() * 300 - 150, duration: Math.random() * 4 + 3, delay: Math.random() * 3, size: Math.random() * 2 + 1
  }));

  if (arenaMode === 'raid') {
    const enemyHpPct = raid.enemy ? (raid.enemy.hp / raid.enemy.maxHp) * 100 : 0;
    const hunterHpPct = (raid.hp / raid.maxHp) * 100;
    const directiveFx = RAID_DIRECTIVES[raid.directive || 'assault'] || RAID_DIRECTIVES.assault;
    const activeHunterForm = getHunterFormByTier(raid.hunterTier || mapAvatarStageToHunterTier(getSystemAvatarStage(playerStats.level || 1)));
    const activeFormSkill = getActiveSkillByTier(raid.hunterTier || mapAvatarStageToHunterTier(getSystemAvatarStage(playerStats.level || 1)));
    const skillCost = Math.max(8, 25 - (relicFx.skillCostReduction || 0) - (treeFx.skillCostReduction || 0) - (directiveFx.skillCostDelta || 0) - (activeHunterForm.skillCostReduction || 0));
    const formSkillRemainingSec = Math.max(0, Math.ceil(((raid.formSkillReadyAt || 0) - Date.now()) / 1000));
    const formSkillReady = formSkillRemainingSec <= 0;
    void raidUiClock;
    const raidExpPct = Math.min(100, Math.max(0, ((raid.floor - 1) * 10) + (raid.enemy ? (1 - (raid.enemy.hp / raid.enemy.maxHp)) * 10 : 0)));
    const hunterProfile = getHunterCombatProfile(playerStats, lifestyle);
    const hunterPowerScore = raid.active ? (raid.hunterPower || hunterProfile.power) : hunterProfile.power;
    const activeReadiness = raid.active ? (raid.floorReadiness || 1) : getFloorBattleBalance(hunterPowerScore, 1).readiness;
    const currentLevel = playerStats?.level || 1;
    const currentAvatarStage = getSystemAvatarStage(currentLevel);
    const currentHunterTier = mapAvatarStageToHunterTier(currentAvatarStage);
    const nextAvatarStage = Math.min(8, currentAvatarStage + 1);
    const nextHunterTier = mapAvatarStageToHunterTier(nextAvatarStage);
    const nextStageLevel = Math.min(40, (currentAvatarStage * 5) + 1);
    const levelToNextStage = Math.max(0, nextStageLevel - currentLevel);
    const canTierUpByLevel = nextHunterTier > currentHunterTier;
    const nextFloor = Math.min(10, (hunterProfile.floorsUnlocked || 1) + 1);
    const nextFloorPowerReq = getFloorPowerRequirement(nextFloor);
    const powerGapToNextFloor = Math.max(0, nextFloorPowerReq - hunterPowerScore);
    const lootByRarity = {
      Common: LOOT_ARCHIVE.filter((item) => item.rarity === 'Common'),
      Uncommon: LOOT_ARCHIVE.filter((item) => item.rarity === 'Uncommon'),
      Rare: LOOT_ARCHIVE.filter((item) => item.rarity === 'Rare'),
      Epic: LOOT_ARCHIVE.filter((item) => item.rarity === 'Epic'),
      Legendary: LOOT_ARCHIVE.filter((item) => item.rarity === 'Legendary'),
      Mythic: LOOT_ARCHIVE.filter((item) => item.rarity === 'Mythic')
    };
    return (
      <div
        ref={raidShellRef}
        className={`absolute inset-0 z-[80] bg-void-black overflow-y-auto ${raidFullscreen ? 'z-[210]' : ''}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.10),transparent_35%),radial-gradient(circle_at_50%_75%,rgba(239,68,68,0.16),transparent_45%)]" />
        <AnimatePresence>
          {raidDamagePulse > 0 && (
            <motion.div
              key={`raid-hit-${raidDamagePulse}`}
              initial={{ opacity: 0.34 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 z-[108] bg-[radial-gradient(circle_at_50%_60%,rgba(239,68,68,0.28),rgba(127,29,29,0.16),transparent_72%)]"
            />
          )}
        </AnimatePresence>
        <div className={`relative mx-auto min-h-full w-full px-3 pt-5 md:px-4 ${raidFullscreen ? 'max-w-none' : 'max-w-[390px]'}`}>
        <div className="mb-6 border-b border-purple-900/50 pb-4 relative z-10 flex justify-between items-start">
          <div>
            <p className="text-purple-500 text-[10px] tracking-[0.35em] font-bold system-font mb-1 uppercase animate-pulse">Shadow Dungeon</p>
            <h1 className="text-3xl font-black italic tracking-tighter text-white">RAID PROTOCOL</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRaidImmersive((prev) => !prev)}
              className="text-[10px] border border-cyan-500 text-cyan-300 px-3 py-1 uppercase tracking-widest hover:bg-cyan-500 hover:text-black"
            >
              {raidImmersive ? 'UI Lite' : 'Immersive'}
            </button>
            <button
              onClick={toggleRaidFullscreen}
              className="text-[10px] border border-indigo-400 text-indigo-300 px-3 py-1 uppercase tracking-widest hover:bg-indigo-500 hover:text-white"
            >
              {raidFullscreen ? 'Exit Full' : 'Full'}
            </button>
            <button
              onClick={() => setRaidAudioMuted((m) => !m)}
              className={`text-[10px] border px-3 py-1 uppercase tracking-widest ${raidAudioMuted ? 'border-gray-500 text-gray-300' : 'border-yellow-400 text-yellow-300'}`}
            >
              {raidAudioMuted ? 'Sound Off' : 'Sound On'}
            </button>
            <button
              onClick={() => setMonsterAiEnabled((prev) => !prev)}
              className={`text-[10px] border px-3 py-1 uppercase tracking-widest ${monsterAiEnabled ? 'border-emerald-400 text-emerald-300' : 'border-gray-500 text-gray-300'}`}
            >
              {monsterAiEnabled ? 'AI On' : 'AI Off'}
            </button>
            <button onClick={() => setArenaMode('boss')} className="text-[10px] border border-red-500 text-red-400 px-3 py-1 uppercase tracking-widest hover:bg-red-500 hover:text-white">
              Boss Arena
            </button>
          </div>
        </div>

        <AnimatePresence>
          {raidCinematic && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="pointer-events-none absolute inset-0 z-[110] flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/75" />
              <p className="relative text-white uppercase tracking-[0.35em] text-sm font-black">
                {raidCinematic}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {raidFormCutin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute inset-0 z-[116] overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${raidFormCutin.accent}`} />
              <motion.div
                initial={{ x: '-120%', skewX: -20 }}
                animate={{ x: '135%', skewX: -20 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-[-10%] w-[48%] bg-white/18 blur-xl"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,rgba(255,255,255,0.2),transparent_30%),radial-gradient(circle_at_25%_70%,rgba(255,255,255,0.12),transparent_35%)]" />
              <div className="absolute inset-x-3 top-[12%]">
                <div className={`inline-flex flex-col border bg-black/55 backdrop-blur-md px-4 py-3 ${raidFormCutin.edge}`}>
                  <p className={`text-[10px] uppercase tracking-[0.38em] font-black ${raidFormCutin.text}`}>Form Skill</p>
                  <p className={`text-2xl font-black italic tracking-tight ${raidFormCutin.text}`}>{raidFormCutin.title}</p>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/80 mt-1">{raidFormCutin.formName}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-1">{raidFormCutin.sub}</p>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.85, x: 40 }}
                animate={{ opacity: 0.95, scale: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26 }}
                className="absolute right-[-6%] top-[18%] h-[56%] w-[58%] rounded-full bg-white/8 blur-3xl"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {raidFinisherBanner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute inset-0 z-[118] flex items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-black/72" />
              <div className={`absolute inset-0 bg-gradient-to-br ${raidFinisherBanner.accent}`} />
              <motion.div
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.24 }}
                className={`relative border px-6 py-5 bg-black/65 backdrop-blur-md text-center ${raidFinisherBanner.edge}`}
              >
                <p className="text-[10px] uppercase tracking-[0.45em] text-white/70 font-black">Finisher</p>
                <p className={`text-3xl font-black italic tracking-tight ${raidFinisherBanner.text}`}>MONARCH EXECUTION</p>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white mt-2">{raidFinisherBanner.formName}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!raid.active ? (
          <div className="space-y-4">
            <div className="bg-black/50 border border-purple-500/40 p-5 rounded-sm">
              <p className="text-gray-300 text-xs mb-3">Roguelite run: 10 piani, nemici random, reward crescenti e resurrezione ombra singola.</p>
              <p className="text-[10px] text-purple-300 uppercase tracking-widest mb-2">Relic Equip</p>
              <div className="mb-3 p-2 border border-white/10 bg-white/5">
                <p className="text-[10px] text-gray-400 uppercase">Equip attivo</p>
                {equippedRelicData ? (
                  <>
                    <p className="text-sm text-white font-bold">{equippedRelicData.name} <span className="text-[10px] text-purple-300 uppercase">({equippedRelicData.rarity})</span></p>
                    <p className="text-[10px] text-gray-300">{equippedRelicData.desc}</p>
                    <button onClick={unequipRelic} className="mt-2 text-[9px] px-2 py-1 border border-gray-500 text-gray-300 uppercase tracking-widest hover:bg-gray-600 hover:text-white">
                      Unequip
                    </button>
                  </>
                ) : <p className="text-xs text-gray-500">Nessuna reliquia equipaggiata</p>}
              </div>
              <div className="grid grid-cols-1 gap-2 mb-3">
                {RELIC_LIBRARY.filter((relic) => (relicInventory[relic.id] || 0) > 0).length === 0 ? (
                  <p className="text-xs text-gray-500">Inventario reliquie vuoto. Completa piani per droppare oggetti.</p>
                ) : RELIC_LIBRARY.filter((relic) => (relicInventory[relic.id] || 0) > 0).map((relic) => (
                  <button key={relic.id} onClick={() => equipRelic(relic.id)} className={`text-left p-2 border ${equippedRelic === relic.id ? 'border-purple-300 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:border-purple-400'} transition-all`}>
                    <p className="text-xs text-white font-bold">{relic.name} x{relicInventory[relic.id]}</p>
                    <p className="text-[10px] text-gray-300">{relic.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-black/50 border border-cyan-500/35 p-4 rounded-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-cyan-300 uppercase tracking-widest">Loot Archive</p>
                <p className="text-[10px] text-gray-400">{LOOT_ARCHIVE.length} oggetti</p>
              </div>
              <div className="space-y-3 max-h-[42svh] overflow-y-auto pr-1 no-scrollbar">
                {Object.entries(lootByRarity).map(([rarity, items]) => (
                  <div key={rarity} className={`border rounded-sm p-2 bg-black/35 ${LOOT_RARITY_COLORS[rarity]}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-2">{rarity} · {items.length}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {items.map((item) => (
                        <div key={item.id} className="border border-white/10 bg-black/45 rounded-sm p-1.5">
                          {(() => {
                            const iconCandidates = getLootIconCandidates(item);
                            return (
                          <div className="relative h-16 rounded-sm bg-gradient-to-b from-white/10 to-transparent border border-white/10 overflow-hidden">
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
                              <span className="text-2xl drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]">{getLootGlyph(item)}</span>
                              <span className="text-[8px] font-black text-white/45 uppercase px-1 text-center leading-tight mt-0.5">
                                {item.name.split(' ').slice(0, 2).join(' ')}
                              </span>
                            </div>
                            <img
                              src={iconCandidates[0] || item.icon}
                              alt={item.name}
                              loading="lazy"
                              className="relative z-10 h-full w-full object-contain p-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                              onError={(e) => {
                                const el = e.currentTarget;
                                const currentIdx = Number(el.dataset.iconIdx || '0');
                                const nextIdx = currentIdx + 1;
                                if (nextIdx < iconCandidates.length) {
                                  el.dataset.iconIdx = String(nextIdx);
                                  el.src = iconCandidates[nextIdx];
                                } else {
                                  el.style.display = 'none';
                                }
                              }}
                            />
                          </div>
                            );
                          })()}
                          <p className="mt-1 text-[9px] text-gray-200 leading-tight line-clamp-2 min-h-[22px]">{item.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-gray-500">
                Se un file icona manca, ora vedi sempre il simbolo item. Se aggiungi le PNG in <code className="text-gray-400">public/loot/</code>, verranno mostrate automaticamente.
              </p>
            </div>

            <div className="bg-black/50 border border-purple-500/40 p-5 rounded-sm">
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="border border-yellow-400/40 bg-black/50 p-2 rounded-sm">
                  <p className="text-[9px] text-yellow-300 uppercase tracking-widest">Power Score</p>
                  <p className="text-xl text-yellow-100 font-black">{hunterPowerScore}</p>
                  <p className="text-[9px] text-yellow-200/80 mt-0.5">Tier {raid.hunterTier || hunterProfile.tier} · Unlocked F{hunterProfile.floorsUnlocked}</p>
                </div>
                <div className="border border-indigo-400/40 bg-black/50 p-2 rounded-sm">
                  <p className="text-[9px] text-indigo-300 uppercase tracking-widest">Campaign</p>
                  <p className="text-[11px] text-indigo-100 font-black">
                    Clear {raidMeta.clears} · Max F{raidMeta.highestFloor || 1}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Elite visti {raidMeta.eliteSeen || 0} · Elite abbattuti {raidMeta.eliteKills || 0}</p>
                </div>
              </div>
              <div className="mb-4 border border-cyan-400/35 bg-black/55 p-2 rounded-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-cyan-300 uppercase tracking-widest">Season 6M</p>
                  <p className="text-[9px] text-cyan-200 font-black">{seasonProgressPct}%</p>
                </div>
                <div className="h-2 mt-1 border border-cyan-900/50 bg-black/70 overflow-hidden rounded-sm">
                  <motion.div animate={{ width: `${seasonProgressPct}%` }} className="h-full bg-cyan-400" />
                </div>
                <p className="text-[9px] text-gray-400 mt-1">
                  Mastery {raidSeason.mastery}/{RAID_SEASON_TARGET} · Giorno {seasonAgeDays}/{RAID_SEASON_DAYS}
                </p>
                <p className="text-[9px] text-cyan-200 mt-0.5">
                  Fine season tra {seasonDaysLeft} giorni · Prossimo titolo: {nextPrestigeReward}
                </p>
                <p className="text-[9px] text-emerald-300 mt-0.5">
                  Lifestyle {lifestyle.label} · Today {lifestyle.todayScore}/5 · 7d {lifestyle.avgRecent}/5
                </p>
                <p className="text-[9px] text-fuchsia-200 mt-0.5">
                  Forma: {raid.hunterFormName || activeHunterForm.label} · {raid.hunterFormPassive || activeHunterForm.passive}
                </p>
                <div className="mt-2 border border-purple-400/35 bg-purple-500/10 p-2 rounded-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-purple-200 uppercase tracking-widest">Hunter Skill Tree</p>
                    <p className="text-[9px] text-purple-100 font-black">{hunterSkillTree.unlockedCount}/{HUNTER_SKILL_TREE.length}</p>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-1">
                    {hunterSkillTree.nodes.map((node) => (
                      <div key={node.id} className={`text-[9px] px-2 py-1 border ${node.unlocked ? 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10' : 'border-white/10 text-gray-500 bg-black/30'}`}>
                        {node.label} · {node.desc}
                      </div>
                    ))}
                  </div>
                </div>
                <p className={`text-[9px] mt-0.5 ${(activeReadiness < 0.85) ? 'text-red-300' : activeReadiness < 1 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  Combat Readiness {Math.round(activeReadiness * 100)}%
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[9px] text-amber-300 uppercase tracking-widest">Prestige {raidSeason.prestigeLevel || 0}</p>
                  <button onClick={prestigeSeason} disabled={!canPrestigeSeason} className={`text-[9px] px-2 py-1 border uppercase tracking-widest ${canPrestigeSeason ? 'border-amber-300 text-amber-200 hover:bg-amber-300 hover:text-black' : 'border-gray-700 text-gray-500'}`}>
                    Prestige Season
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {PRESTIGE_TITLE_LADDER.map((entry) => {
                    const unlocked = (raidSeason.prestigeLevel || 0) >= entry.level;
                    return (
                      <div key={entry.level} className={`text-[9px] px-2 py-1 border ${unlocked ? 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10' : 'border-white/10 text-gray-500 bg-black/30'}`}>
                        P{entry.level} · {entry.title}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mb-4 border border-emerald-400/35 bg-emerald-500/10 p-2 rounded-sm">
                <p className="text-[9px] text-emerald-200 uppercase tracking-widest">Next Evolution Target</p>
                <p className="text-[10px] text-white mt-1">
                  Forma attuale: <span className="font-black">{activeHunterForm.label}</span> (Tier {currentHunterTier})
                </p>
                {canTierUpByLevel ? (
                  <p className="text-[10px] text-emerald-200 mt-1">
                    Prossimo tier: <span className="font-black">Tier {nextHunterTier}</span> al level {nextStageLevel}
                    {levelToNextStage > 0 ? ` · manca ${levelToNextStage} lvl` : ' · pronto allo sblocco'}
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-200 mt-1">Tier massimo raggiunto via progressione level.</p>
                )}
                {nextFloor > (hunterProfile.floorsUnlocked || 1) ? (
                  <p className="text-[10px] text-cyan-200 mt-1">
                    Next floor target: <span className="font-black">F{nextFloor}</span> richiede Power {nextFloorPowerReq}
                    {powerGapToNextFloor > 0 ? ` · manca ${powerGapToNextFloor}` : ' · requisito raggiunto'}
                  </p>
                ) : (
                  <p className="text-[10px] text-cyan-200 mt-1">Hai già unlock completo fino a F10.</p>
                )}
              </div>
              <button onClick={startRaid} className="w-full bg-purple-500/20 border border-purple-400 text-purple-300 py-3 font-black uppercase tracking-widest hover:bg-purple-500 hover:text-white">
                Inizia Raid
              </button>
            </div>
          </div>
        ) : (
          <div
            className="space-y-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 236px)' }}
          >
            {!raidImmersive && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white/5 border border-white/10 p-2"><p className="text-white font-black">{raid.floor}</p><p className="text-[8px] text-gray-500 uppercase">Piano</p></div>
              <div className="bg-white/5 border border-white/10 p-2"><p className="text-cyan-300 font-black">{raid.energy}</p><p className="text-[8px] text-gray-500 uppercase">Energy</p></div>
              <div className="bg-white/5 border border-white/10 p-2"><p className="text-emerald-300 font-black">{raid.potions}</p><p className="text-[8px] text-gray-500 uppercase">Potion</p></div>
              <div className="bg-white/5 border border-white/10 p-2"><p className="text-yellow-300 font-black">{raid.relics}</p><p className="text-[8px] text-gray-500 uppercase">Relics</p></div>
            </div>
            )}

            {raidImmersive && (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-black/60 border border-yellow-500/40 p-2 rounded-sm">
                  <p className="text-[9px] text-yellow-300 uppercase tracking-widest">LVL</p>
                  <p className="text-2xl text-yellow-200 font-black leading-none">{raidRpgLevel}</p>
                </div>
                <div className="bg-black/60 border border-red-500/40 p-2 rounded-sm">
                  <p className="text-[9px] text-red-300 uppercase tracking-widest">HP</p>
                  <div className="h-2 border border-red-900/40 bg-black/70 overflow-hidden mt-1">
                    <motion.div animate={{ width: `${hunterHpPct}%` }} className="h-full bg-red-700" />
                  </div>
                </div>
                <div className="bg-black/60 border border-yellow-500/40 p-2 rounded-sm">
                  <p className="text-[9px] text-yellow-300 uppercase tracking-widest">EXP</p>
                  <div className="h-2 border border-yellow-900/40 bg-black/70 overflow-hidden mt-1">
                    <motion.div animate={{ width: `${raidExpPct}%` }} className="h-full bg-yellow-400" />
                  </div>
                </div>
                <div className="bg-black/60 border border-fuchsia-500/40 p-2 rounded-sm">
                  <p className="text-[9px] text-fuchsia-300 uppercase tracking-widest">Sync</p>
                  <p className={`text-lg font-black leading-none ${(raid.floorReadiness || 1) < 0.85 ? 'text-red-300' : (raid.floorReadiness || 1) < 1 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {Math.round((raid.floorReadiness || 1) * 100)}%
                  </p>
                </div>
              </div>
            )}

            {raidDirectivePrompt && raid.enemy?.elite && (
              <div className="bg-black/80 border border-rose-400/60 p-3 rounded-sm">
                <p className="text-[10px] text-rose-300 uppercase tracking-widest mb-1">Elite Encounter</p>
                <p className="text-xs text-gray-200 mb-2">Scegli la direttiva prima dello scontro.</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => selectRaidDirective('assault')} className="text-[10px] py-2 border border-red-400 text-red-300 font-black uppercase tracking-widest hover:bg-red-500 hover:text-white">Attacco</button>
                  <button onClick={() => selectRaidDirective('tactical')} className="text-[10px] py-2 border border-cyan-400 text-cyan-300 font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black">Tattica</button>
                  <button onClick={() => selectRaidDirective('evade')} className="text-[10px] py-2 border border-emerald-400 text-emerald-300 font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black">Fuga Ombra</button>
                </div>
              </div>
            )}

            {!raidImmersive && equippedRelicData && (
              <div className="bg-black/40 border border-purple-400/30 p-3 rounded-sm">
                <p className="text-[10px] text-purple-300 uppercase tracking-widest">Relic Attiva: {equippedRelicData.name}</p>
                <p className="text-[10px] text-gray-300 mt-1">{equippedRelicData.desc}</p>
              </div>
            )}

            <div className="bg-black/50 border border-cyan-400/30 p-4 rounded-sm">
              <p className="text-cyan-300 text-[10px] uppercase tracking-widest mb-1">Hunter HP</p>
              <div className="w-full bg-black/80 border border-cyan-900/40 h-2 rounded-sm overflow-hidden">
                <motion.div animate={{ width: `${hunterHpPct}%` }} className="h-full bg-cyan-300"></motion.div>
              </div>
              <p className="text-right text-[10px] text-gray-400 mt-1">{raid.hp}/{raid.maxHp}</p>
            </div>

            {raid.enemy && (
              <div className="bg-black/50 border border-red-500/40 p-4 rounded-sm">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <p className="text-red-300 font-black">{raid.enemy.name}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Direttiva: {RAID_DIRECTIVES[raid.directive || 'assault']?.label || 'Assalto'}</p>
                    <p className="text-[10px] text-cyan-300 uppercase tracking-widest">Season {seasonProgressPct}% · Lifestyle {lifestyle.label}</p>
                    <p className={`text-[10px] uppercase tracking-widest ${(raid.floorReadiness || 1) < 0.85 ? 'text-red-300' : (raid.floorReadiness || 1) < 1 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      Hunter Power {raid.hunterPower || hunterPowerScore} / Req F{raid.floor}: {raid.floorPowerRequirement || getFloorPowerRequirement(raid.floor)}
                    </p>
                  </div>
                  <div className="text-right">
                    {raid.enemy.elite && <p className="text-[10px] text-rose-300 uppercase font-black tracking-widest">Elite</p>}
                    <p className="text-[10px] text-red-400 uppercase">Rank {raid.enemy.rank}</p>
                  </div>
                </div>
                <div className="w-full bg-black/80 border border-red-900/40 h-2 rounded-sm overflow-hidden">
                  <motion.div animate={{ width: `${enemyHpPct}%` }} className="h-full bg-red-500"></motion.div>
                </div>
                <p className="text-right text-[10px] text-gray-400 mt-1">{raid.enemy.hp}/{raid.enemy.maxHp}</p>
              </div>
            )}
            {raid.enemy && (
              <DungeonBoss3D
                floor={raid.floor}
                rage={1 - (raid.enemy.hp / raid.enemy.maxHp)}
                hitTick={raidHitTick}
                formSkillTick={formSkillTick}
                formFinisherTick={formFinisherTick}
                enemyAttackTick={raid.enemyAttackTick || 0}
                manualMoveTick={monsterMove.tick}
                manualMoveType={monsterMove.type}
                levelUpTick={levelUpTick}
                hunterTier={raid.hunterTier || hunterProfile.tier}
                hunterAvatarStage={raid.hunterAvatarStage || getSystemAvatarStage(playerStats.level || 1)}
                hunterLevel={playerStats.level || 1}
                hunterSkillPower={raid.hunterSkillPower || hunterSkillTree.unlockedCount || 0}
                freeExplore={raidImmersive || raidFullscreen}
                enemyKey={`${raid.floor}-${raid.enemy.name}`}
                isDefeated={raid.enemy.hp <= 0 || raid.status === 'clear' || raid.status === 'victory'}
                className={`${(raidImmersive || raidFullscreen) ? 'h-[58svh] min-h-[340px] sm:h-[66svh] sm:min-h-[420px]' : 'h-[34vh] min-h-[260px]'} shadow-[0_0_30px_rgba(239,68,68,0.25)]`}
              />
            )}

            {raidRewardRoom && (raid.status === 'clear' || raid.status === 'victory') && (
              <div className="border border-amber-300/55 bg-black/70 backdrop-blur-md p-4 rounded-sm shadow-[0_0_24px_rgba(251,191,36,0.18)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-amber-300 uppercase tracking-[0.35em] font-black">Reward Room</p>
                    <p className="text-xl font-black italic text-white">
                      {raidRewardRoom.status === 'victory' ? 'Monarch Vault' : `Altare Piano ${raidRewardRoom.floor}`}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 mt-1">
                      {raidRewardRoom.finisher ? 'Finisher reward claimed' : 'Dungeon spoils secured'}
                    </p>
                  </div>
                  {raidRewardRoom.relic ? (
                    <div className="border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-2 text-right rounded-sm">
                      <p className="text-[9px] text-fuchsia-300 uppercase tracking-widest">Relic Drop</p>
                      <p className="text-sm font-black text-fuchsia-100">{raidRewardRoom.relic.name}</p>
                    </div>
                  ) : (
                    <div className="border border-white/10 bg-white/5 px-3 py-2 text-right rounded-sm">
                      <p className="text-[9px] text-gray-400 uppercase tracking-widest">Drop</p>
                      <p className="text-sm font-black text-gray-200">Essence secured</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="border border-yellow-400/35 bg-black/50 p-2 rounded-sm text-center">
                    <p className="text-[9px] text-yellow-300 uppercase tracking-widest">Gold</p>
                    <p className="text-lg font-black text-yellow-100">+{raidRewardRoom.gold}</p>
                  </div>
                  <div className="border border-cyan-400/35 bg-black/50 p-2 rounded-sm text-center">
                    <p className="text-[9px] text-cyan-300 uppercase tracking-widest">Exp</p>
                    <p className="text-lg font-black text-cyan-100">+{raidRewardRoom.exp}</p>
                  </div>
                  <div className="border border-emerald-400/35 bg-black/50 p-2 rounded-sm text-center">
                    <p className="text-[9px] text-emerald-300 uppercase tracking-widest">Mastery</p>
                    <p className="text-lg font-black text-emerald-100">+{raidRewardRoom.mastery}</p>
                  </div>
                </div>
              </div>
            )}

            {raid.status === 'clear' && (
              <button onClick={nextFloor} className="w-full py-3 border border-yellow-400 text-yellow-300 font-black uppercase tracking-widest hover:bg-yellow-400 hover:text-black">
                Vai al piano {raid.floor + 1}
              </button>
            )}
            {raid.status === 'victory' && <div className="text-center text-yellow-300 font-black uppercase tracking-widest py-2 border border-yellow-400/60 bg-yellow-500/10">Dungeon Clear</div>}
            {raid.status === 'down' && <div className="text-center text-red-300 font-black uppercase tracking-widest py-2 border border-red-400/60 bg-red-500/10">Sei stato sconfitto</div>}

            {!raidImmersive && (
            <div className="bg-black/40 border border-white/10 p-3 rounded-sm">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Raid Log</p>
              <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                {raid.log.map((line, idx) => <p key={`${line}-${idx}`} className="text-[10px] text-gray-200">{line}</p>)}
              </div>
            </div>
            )}

            <div
              className="fixed inset-x-0 z-[300] px-2 sm:px-3 pt-2 bg-gradient-to-t from-black via-black/90 to-transparent"
              style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 68px)',
                paddingBottom: '10px',
                paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 8px)',
                paddingRight: 'calc(env(safe-area-inset-right, 0px) + 8px)'
              }}
            >
              <div className={`mx-auto w-full rounded-sm border border-white/20 bg-black/88 backdrop-blur-md p-2 ${raidFullscreen ? 'max-w-[820px]' : 'max-w-[384px]'}`}>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={raidAttack} disabled={raid.status !== 'combat' || (raidDirectivePrompt && raid.enemy?.elite)} className={`min-h-12 py-3 border text-xs font-black uppercase tracking-widest ${(raid.status === 'combat' && !(raidDirectivePrompt && raid.enemy?.elite)) ? 'border-red-400 text-red-300 hover:bg-red-500 hover:text-white' : 'border-gray-700 text-gray-500'}`}>Attacco</button>
                  <button onClick={raidSkill} disabled={raid.status !== 'combat' || raid.energy < skillCost || (raidDirectivePrompt && raid.enemy?.elite)} className={`min-h-12 py-3 border text-xs font-black uppercase tracking-widest ${(raid.status === 'combat' && raid.energy >= skillCost && !(raidDirectivePrompt && raid.enemy?.elite)) ? 'border-purple-400 text-purple-300 hover:bg-purple-500 hover:text-white' : 'border-gray-700 text-gray-500'}`}>Skill ({skillCost} EN)</button>
                  <button
                    onClick={useFormSkill}
                    disabled={raid.status !== 'combat' || raid.energy < activeFormSkill.energyCost || !formSkillReady || (raidDirectivePrompt && raid.enemy?.elite)}
                    className={`col-span-2 min-h-12 py-3 border text-xs font-black uppercase tracking-widest ${(raid.status === 'combat' && raid.energy >= activeFormSkill.energyCost && formSkillReady && !(raidDirectivePrompt && raid.enemy?.elite)) ? 'border-fuchsia-400 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-black' : 'border-gray-700 text-gray-500'}`}
                  >
                    {formSkillReady ? `${activeFormSkill.label} (${activeFormSkill.energyCost} EN)` : `${activeFormSkill.label} CD ${formSkillRemainingSec}s`}
                  </button>
                  <button onClick={usePotion} disabled={raid.potions <= 0 || raid.status === 'down'} className={`min-h-12 py-3 border text-xs font-black uppercase tracking-widest ${(raid.potions > 0 && raid.status !== 'down') ? 'border-emerald-400 text-emerald-300 hover:bg-emerald-500 hover:text-black' : 'border-gray-700 text-gray-500'}`}>Pozione</button>
                  <button onClick={retreatRaid} className="min-h-12 py-3 border border-gray-500 text-gray-300 text-xs font-black uppercase tracking-widest hover:bg-gray-700 hover:text-white">Ritirata</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    );
  }

  return (
    <motion.div 
      animate={isAttacking ? { x: [-5, 5, -5, 5, 0], y: [-3, 3, -3, 3, 0], backgroundColor: "rgba(69, 10, 10, 0.4)" } : { backgroundColor: "rgba(0, 0, 0, 0)" }}
      transition={{ duration: 0.3 }}
      className="p-6 pt-10 pb-24 min-h-full bg-void-black overflow-hidden relative"
      style={{ boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9)' }}
    >
      
      {/* HEADER RED GATE & RISORSE */}
      <div className="mb-6 border-b border-red-900/50 pb-4 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-red-600 text-[10px] tracking-[0.4em] font-bold system-font mb-1 uppercase animate-pulse">Red Gate</p>
          <h1 className="text-3xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">ARENA</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="bg-black/50 border border-yellow-500/30 px-3 py-1 rounded-sm text-xs font-bold text-yellow-500 flex items-center gap-2"><span>{currentGold} G</span></div>
          <div className="bg-black/50 border border-purple-500/30 px-3 py-1 rounded-sm text-xs font-bold text-purple-400 flex items-center gap-2"><span>{currentKeys} 🗝️</span></div>
          <button onClick={() => setArenaMode('raid')} className="text-[9px] border border-purple-500 text-purple-400 px-2 py-1 uppercase tracking-widest hover:bg-purple-500 hover:text-white">
            Dungeon
          </button>
        </div>
      </div>

      {/* L'ARENA */}
      <div className="flex flex-col items-center justify-center mt-8 relative w-full h-[320px]">
        
        {/* Aura Oscura Dietro il Mostro */}
        {!boss.defeated && (
          <motion.div 
            animate={isSpawning ? { scale: 0.5, opacity: 0 } : { scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={isSpawning ? { duration: 1.2 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-t from-red-800/50 to-transparent blur-3xl rounded-full pointer-events-none"
          />
        )}

        {!boss.defeated && particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 150, x: p.x }}
            animate={{ opacity: [0, 1, 0], y: -250, x: p.x + (Math.random() * 50 - 25) }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444] pointer-events-none"
            style={{ width: `${p.size}px`, height: `${p.size}px` }}
          />
        ))}

        {/* CONTENITORE DEL MOSTRO E DELL'OMBRA A TERRA */}
        <div className="relative w-72 h-72 flex flex-col items-center justify-center z-20">
          
          <DungeonBoss3D
            floor={bossFloor}
            rage={1 - (boss.hp / boss.maxHp)}
            hitTick={isAttacking ? boss.hp + boss.level : 0}
            enemyKey={`${boss.name}-${boss.level}`}
            isDefeated={boss.defeated}
            freeExplore={false}
            className="h-full min-h-0 w-full border-red-500/40"
          />

          {/* OMBRA DINAMICA A TERRA CON SPAWN */}
          {!boss.defeated && (
            <motion.div 
              initial={{ opacity: 0, scale: 0 }}
              animate={
                isSpawning 
                  ? { opacity: 0.6, scale: 1 } 
                  : { scale: [1, 0.7, 1], opacity: [0.6, 0.2, 0.6] }
              }
              transition={
                isSpawning 
                  ? { duration: 1.2, ease: "easeOut" } 
                  : { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }
              className="absolute -bottom-4 w-40 h-6 bg-black rounded-[100%] blur-md z-10 pointer-events-none"
            />
          )}

          {boss.defeated && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="absolute inset-0 flex items-center justify-center z-30">
              <span className="text-9xl drop-shadow-[0_0_30px_#ef4444]">💀</span>
            </motion.div>
          )}

          {damageText && (
            <motion.div 
              initial={{ opacity: 1, y: 0, scale: 0.5, rotate: isCritHit ? -15 : -5 }} 
              animate={{ opacity: 0, y: -120, scale: isCritHit ? 2.5 : 1.8, rotate: isCritHit ? 15 : 5 }} 
              transition={{ duration: 0.7, ease: "easeOut" }} 
              className={`absolute font-black italic z-40 pointer-events-none ${isCritHit ? 'text-yellow-400 text-7xl drop-shadow-[0_0_30px_#eab308]' : 'text-white text-6xl drop-shadow-[0_0_20px_#ef4444]'}`}
            >
              {isCritHit ? `CRIT! -${damageText}` : `-${damageText}`}
            </motion.div>
          )}
        </div>
      </div>

      <div className="w-full mt-6 z-20 relative">
        <div className="flex justify-between items-end mb-2">
          <h2 className={`font-black italic text-xl tracking-wide ${boss.defeated ? 'text-gray-700 line-through' : 'text-gray-200 drop-shadow-md'}`}>{boss.name}</h2>
          <p className="text-red-500 text-xs font-bold font-mono tracking-widest">{Math.ceil(boss.hp)} <span className="text-gray-600">/ {boss.maxHp} HP</span></p>
        </div>
        <div className="w-full bg-black/80 border border-red-900/50 h-3 rounded-sm overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.8)]">
          <motion.div initial={{ width: "100%" }} animate={{ width: `${hpPercent}%` }} className="bg-gradient-to-r from-red-800 to-red-500 h-full shadow-[0_0_10px_#ef4444]"></motion.div>
        </div>
      </div>

      <div className="mt-8 w-full z-20 relative flex flex-col gap-3">
        {!boss.defeated ? (
          <>
            {currentKeys > 0 ? (
              <button 
                onClick={handleAttack} 
                disabled={isSpawning}
                className={`w-full font-black italic text-xl py-5 rounded-sm uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(220,38,38,0.3)] border border-red-500 ${isSpawning ? 'bg-red-900 text-gray-500 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600 text-black hover:scale-[1.02] active:scale-[0.98]'}`}>
                SFERRA ATTACCO (1 🗝️)
              </button>
            ) : (
              <button onClick={forgeKey} className="w-full bg-black border border-purple-500 text-purple-400 hover:bg-purple-900/40 font-black italic text-sm py-5 rounded-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                FORGIA CHIAVE (50 G)
              </button>
            )}
          </>
        ) : (
          <button onClick={spawnNextBoss} className="w-full bg-purple-900/30 border border-purple-500 text-purple-400 hover:bg-purple-800 hover:text-white font-black italic text-sm py-5 rounded-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            SPAWNA BOSS LIVELLO {boss.level + 1} 🌀
          </button>
        )}
        <p className="text-center text-[10px] text-gray-500 mt-2 uppercase tracking-[0.2em] bg-black/50 py-2 rounded-sm border border-white/5">
          Danni: <span className="text-red-500 font-bold">STR ({playerStats.str || 10})</span> + <span className="text-orange-500 font-bold">STREAK ({playerStats.streak || 0}🔥)</span>
        </p>
      </div>

    </motion.div>
  );
};

export default Boss;

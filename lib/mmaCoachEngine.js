// Conservative 2D movement observations, not a technique grade.
// All time values are monotonic milliseconds; image x coordinates need aspect correction.
export const MMA_ENGINE_VERSION = 2;
export const MMA_CUES = {
  framing: 'Inquadra testa, mani e piedi. Resta a circa 45° rispetto alla camera.',
  guard: 'Riporta la mano libera vicino al viso.',
  lean: 'Ritrova il busto sopra il bacino, senza inclinarti lateralmente.',
  return: 'Richiama la mano prima del colpo successivo.',
  ready: 'Guardia pronta. Muoviti lentamente e respira.',
};
const UPPER = [0, 11, 12, 13, 14, 15, 16, 23, 24];
const FEET = [25, 26, 27, 28];
const usable = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 0) >= .65 && p.x > .025 && p.x < .975 && p.y > .025 && p.y < .975;
const angle = (a, b, c, aspect) => {
  const u = [(a.x - b.x) * aspect, a.y - b.y], v = [(c.x - b.x) * aspect, c.y - b.y];
  const d = Math.hypot(...u) * Math.hypot(...v);
  return d < .00001 ? null : Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / d))) * 180 / Math.PI;
};
export function observeMmaPose(points, aspect = 1) {
  if (!Array.isArray(points) || !UPPER.every(i => usable(points[i]))) return { visible: false, full: false };
  const mid = (a, b) => ({ x: (points[a].x + points[b].x) / 2, y: (points[a].y + points[b].y) / 2 });
  const shoulder = mid(11, 12), hip = mid(23, 24);
  const torso = Math.hypot((shoulder.x - hip.x) * aspect, shoulder.y - hip.y);
  if (torso < .08 || shoulder.y >= hip.y) return { visible: false, full: false };
  const arms = {};
  for (const [side, s, e, w] of [['L', 11, 13, 15], ['R', 12, 14, 16]]) {
    const a = angle(points[s], points[e], points[w], aspect);
    const high = points[w].y < shoulder.y + torso * .12;
    const near = Math.hypot((points[w].x - points[s].x) * aspect, points[w].y - points[s].y) < torso * .9;
    arms[side] = { angle: a, guard: a != null && a < 125 && high && near, high, extended: a != null && a > 150 };
  }
  return { visible: true, full: FEET.every(i => usable(points[i])), arms,
    lean: Math.atan2(Math.abs(shoulder.x - hip.x) * aspect, Math.abs(hip.y - shoulder.y)) * 180 / Math.PI,
    torso, center: shoulder, bothGuard: arms.L.guard && arms.R.guard };
}
// external: true → posa e colpi arrivano da fuori (giudice 3D): update(..., { pose }) e recordPunch().
export function createMmaObserver({ lessonId = 'stance', lead = 'L', external = false } = {}) {
  let previous = null, stableSince = null, calibrated = false, lastValid = null, pendingCue = '', cueSince = 0;
  let arms = {}, comboLead = null;
  const stats = { observedMs: 0, activeMs: 0, guardMs: 0, guardEligibleMs: 0, jab: 0, cross: 0, combos: 0, attempts: 0, returns: 0, errors: {} };
  const punchLesson = ['jab', 'cross', 'one-two', 'defense', 'tactics'].includes(lessonId);
  const guardLesson = !['kick', 'sprawl', 'clinch'].includes(lessonId);
  const resetGesture = () => { arms = { L: { phase: 'idle' }, R: { phase: 'idle' } }; comboLead = null; pendingCue = ''; cueSince = 0; };
  resetGesture();
  return {
    resetGesture,
    snapshot() { return JSON.parse(JSON.stringify(stats)); },
    setCalibrated() { calibrated = true; },
    // colpo riconosciuto dal giudice 3D: kind 'jab' | 'cross'
    recordPunch(kind, now) {
      stats[kind]++; stats.returns++; stats.attempts++;
      if (kind === 'jab') comboLead = now;
      else if (comboLead != null && now - comboLead >= 120 && now - comboLead <= 2200) { stats.combos++; comboLead = null; }
      else comboLead = null;
    },
    update(points, now, { aspect = 1, active = false, calibrate = false, pose: given } = {}) {
      const pose = given || observeMmaPose(points, aspect);
      const gap = previous == null ? 0 : now - previous;
      const dt = Math.max(0, Math.min(150, gap));
      previous = now;
      if (active) stats.activeMs += dt;
      if (!pose.visible || gap > 450) {
        stableSince = null; pendingCue = ''; resetGesture();
        return { pose, calibrated, calibration: 0, cue: 'framing', lostFor: lastValid == null ? Infinity : now - lastValid, stats: this.snapshot() };
      }
      lastValid = now;
      if (calibrate && !calibrated) {
        if (pose.full && pose.bothGuard && pose.lean < 20) {
          stableSince ??= now;
          if (now - stableSince >= 2000) calibrated = true;
        } else stableSince = null;
      }
      const calibration = calibrated ? 1 : stableSince == null ? 0 : Math.min(1, (now - stableSince) / 2000);
      let rawCue = 'ready', event = null;
      if (active && calibrated) {
        stats.observedMs += dt;
        if (punchLesson && !external) {
          for (const side of ['L', 'R']) {
            const a = arms[side], value = pose.arms[side];
            if (a.phase === 'idle' && value.guard) { a.phase = 'guard'; a.since = now; }
            else if (a.phase === 'guard') {
              if (value.extended && now - a.since >= 100) { a.phase = 'extending'; a.at = now; }
              else if (!value.guard && !value.extended && now - a.since > 3000) a.phase = 'idle';
            } else if (a.phase === 'extending') {
              if (value.extended && now - a.at >= 80) { a.phase = 'extended'; a.returnAt = null; stats.attempts++; }
              else if (!value.extended) { a.phase = value.guard ? 'guard' : 'idle'; a.since = now; }
            } else if (a.phase === 'extended') {
              if (now - a.at > 2500) { a.phase = 'idle'; comboLead = null; }
              else if (value.guard) {
                a.returnAt ??= now;
                if (now - a.returnAt >= 100 && now - a.at >= 180) {
                  const kind = side === lead ? 'jab' : 'cross';
                  stats[kind]++; stats.returns++;
                  if (kind === 'jab') comboLead = now;
                  else if (comboLead != null && now - comboLead >= 160 && now - comboLead <= 2200) { stats.combos++; comboLead = null; }
                  else comboLead = null;
                  event = kind; a.phase = 'guard'; a.since = now;
                }
              } else { a.returnAt = null; if (now - a.at > 1100) rawCue = 'return'; }
            }
          }
        }
        if (guardLesson) {
          const resting = ['L', 'R'].filter(side => arms[side].phase !== 'extended' && !pose.arms[side].extended);
          if (resting.length) {
            stats.guardEligibleMs += dt;
            if (resting.every(side => pose.arms[side].high)) stats.guardMs += dt;
            else rawCue = 'guard';
          }
          if (pose.lean > 28) rawCue = 'lean';
        }
        if (rawCue !== pendingCue) { pendingCue = rawCue; cueSince = now; }
        if (rawCue !== 'ready' && now - cueSince >= 650) stats.errors[rawCue] = (stats.errors[rawCue] || 0) + dt;
      } else if (!external) resetGesture();
      const cue = rawCue === 'ready' || now - cueSince < 650 ? 'ready' : rawCue;
      return { pose, calibrated, calibration, cue, event, lostFor: 0, stats: this.snapshot() };
    },
  };
}
export function initialMmaClock() { return { phase: 'countdown', round: 1, remaining: 5000, completed: 0 }; }
export function advanceMmaClock(clock, elapsed, { rounds, workMs, restMs }) {
  let next = { ...clock }, left = Math.max(0, elapsed);
  while (next.phase !== 'done' && left >= next.remaining) {
    left -= next.remaining;
    if (next.phase === 'warmup') next = { ...next, phase: 'countdown', remaining: 5000 };
    else if (next.phase === 'countdown' || next.phase === 'rest') next = { ...next, phase: 'work', remaining: workMs };
    else if (next.round >= rounds) next = { phase: 'done', round: next.round, completed: next.round, remaining: 0 };
    else next = { phase: 'rest', round: next.round + 1, completed: next.round, remaining: restMs };
  }
  if (next.phase !== 'done') next.remaining -= left;
  return next;
}
export function summarizeMmaSession(stats, { lessonId, rounds, completed, mode, activeMs, stance, dose, roundLog = [] }) {
  const observed = stats.observedMs || 0;
  const coverage = activeMs > 0 ? Math.min(100, Math.round(observed / activeMs * 100)) : 0;
  const enough = mode === 'camera' && observed >= 15000 && coverage >= 50;
  const priority = Object.entries(stats.errors || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  const focus = mode === 'guided' ? 'Ripeti con calma il passaggio più difficile della lezione.' : !enough ? 'Migliora l’inquadratura prima di confrontare i movimenti.' : priority ? MMA_CUES[priority] : 'Ripeti la stessa lezione mantenendo il controllo anche nell’ultimo round.';
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, version: MMA_ENGINE_VERSION, date: new Date().toISOString(), lessonId, rounds, completed, mode, stance, dose, activeMs: Math.round(activeMs), observedMs: Math.round(observed), coverage, enough,
    guard: enough && stats.guardEligibleMs > 5000 ? Math.round(stats.guardMs / stats.guardEligibleMs * 100) : null,
    jab: stats.jab || 0, cross: stats.cross || 0, combinations: stats.combos || 0, focus, priority: priority || null, roundLog,
    practiced: completed > 0 && activeMs >= 30000 && (mode === 'guided' || enough) };
}

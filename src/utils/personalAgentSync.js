/**
 * Reads personal_logs from the main project's API (Supabase-backed)
 * and converts them to systemLog patches for the solo levelling Dashboard.
 */

const BASE_URL = import.meta.env.VITE_PERSONAL_AGENT_API ?? "https://levelling-brain.netlify.app";

function isoToDdMm(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function parseParsedField(parsed) {
  if (!parsed) return {};
  if (typeof parsed === "object") return parsed;
  try { return JSON.parse(parsed); } catch { return {}; }
}

/**
 * Convert an array of LogRow entries into a systemLog-compatible patch.
 * Only fills fields that have non-zero values.
 */
function logsToSystemLogPatch(logs) {
  const patch = {};
  for (const log of logs) {
    const p = parseParsedField(log.parsed);
    if (log.type === "meal") {
      patch.consumed  = (patch.consumed  ?? 0) + Number(p.calories_estimate ?? p.kcal ?? 0);
      patch.protein   = (patch.protein   ?? 0) + Number(p.protein_g ?? p.P ?? 0);
      patch.carbs     = (patch.carbs     ?? 0) + Number(p.carbs_g   ?? p.C ?? 0);
      patch.fatMacros = (patch.fatMacros ?? 0) + Number(p.fat_g     ?? p.G ?? 0);
    }
    if (log.type === "workout") {
      const dur  = p.duration_min ?? 30;
      const rate = p.intensity === "high" ? 9 : p.intensity === "medium" ? 6 : 4;
      patch.burned   = (patch.burned ?? 0) + Math.round(dur * rate);
      if (p.strength_kg) patch.strength = Math.max(patch.strength ?? 0, p.strength_kg);
    }
    if (log.type === "weight") {
      if (p.weight_kg)      patch.weight = p.weight_kg;
      if (p.body_fat_pct)   patch.fat    = p.body_fat_pct;
    }
    if (log.type === "sleep") {
      if (p.hours)   patch.sleepHours   = p.hours;
      if (p.quality) patch.sleepQuality = p.quality === "good" ? 8 : p.quality === "ok" ? 5 : 3;
    }
  }
  return patch;
}

/**
 * Fetch logs for the last N days and return a map of { "DD/MM": patch }
 * @param {number} days - how many days back to fetch (default: 7)
 */
export async function fetchTelegramLogs(days = 7) {
  try {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }

    // Use range=week endpoint for the most recent date
    const url = `${BASE_URL}/api/personal-agent/logs?date=${dates[0]}&range=week`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-cache",
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      console.warn("[personalAgentSync] API returned", res.status);
      return {};
    }
    const data = await res.json();
    const logs = data.logs ?? [];

    // Group by DD/MM
    const byDate = {};
    for (const log of logs) {
      const ddMm = isoToDdMm(log.date);
      if (!byDate[ddMm]) byDate[ddMm] = [];
      byDate[ddMm].push(log);
    }

    // Convert each date group to a systemLog patch
    const result = {};
    for (const [ddMm, dateLogs] of Object.entries(byDate)) {
      const patch = logsToSystemLogPatch(dateLogs);
      if (Object.keys(patch).length > 0) {
        result[ddMm] = { date: ddMm, ...patch, _telegramSynced: true };
      }
    }
    console.log("[personalAgentSync] patches:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn("[personalAgentSync] fetch failed:", err?.message ?? err);
    return {};
  }
}

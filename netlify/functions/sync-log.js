import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// Convert YYYY-MM-DD → DD/MM (solo levelling date format)
function toSoloDate(iso) {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

// Convert Personal Agent entries → systemLog patch
function entriesToPatch(entries) {
  const patch = {};
  for (const e of entries) {
    if (e.type === "meal") {
      patch.consumed = (patch.consumed ?? 0) + (e.calories_estimate ?? 0);
      patch.protein  = (patch.protein  ?? 0) + (e.protein_g ?? 0);
      patch.carbs    = (patch.carbs    ?? 0) + (e.carbs_g   ?? 0);
      patch.fatMacros= (patch.fatMacros?? 0) + (e.fat_g     ?? 0);
    }
    if (e.type === "workout") {
      const dur = e.duration_min ?? 30;
      const burnRate = e.intensity === "high" ? 9 : e.intensity === "medium" ? 6 : 4;
      patch.burned   = (patch.burned   ?? 0) + Math.round(dur * burnRate);
      patch.strength = (patch.strength ?? 0) + (e.intensity === "high" ? 3 : e.intensity === "medium" ? 2 : 1);
    }
    if (e.type === "sleep") {
      if (e.hours) patch.sleepHours = e.hours;
      if (e.quality) patch.sleepQuality = e.quality === "good" ? 8 : e.quality === "ok" ? 5 : 3;
    }
  }
  return patch;
}

export const handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  const store = getStore({
    name: "personal-agent-logs",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN,
  });

  // GET — return synced logs for the solo levelling site
  if (event.httpMethod === "GET") {
    const params = new URLSearchParams(event.rawQuery ?? "");
    const all = params.get("all") === "1";
    const dateParam = params.get("date"); // YYYY-MM-DD or DD/MM

    if (all) {
      // Return all stored logs as array
      const { blobs } = await store.list();
      const logs = await Promise.all(
        blobs.map(async ({ key }) => {
          const data = await store.get(key, { type: "json" });
          return data;
        })
      );
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ ok: true, logs: logs.filter(Boolean) }),
      };
    }

    const key = dateParam ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
    const data = await store.get(key, { type: "json" });
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, log: data ?? null, date: key }),
    };
  }

  // POST — receive Personal Agent data and store it
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "invalid JSON" }) };
    }

    const { entries, date } = body;
    if (!Array.isArray(entries) || !entries.length) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "entries required" }) };
    }

    // Convert ISO date to DD/MM for solo levelling
    const soloDate = toSoloDate(date) ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });

    // Fetch existing log for this date and merge
    const existing = (await store.get(soloDate, { type: "json" })) ?? { date: soloDate };
    const patch = entriesToPatch(entries);

    // Accumulate (add to existing values)
    const merged = { ...existing, date: soloDate };
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === "number" && typeof merged[k] === "number") {
        merged[k] = merged[k] + v;
      } else {
        merged[k] = v;
      }
    }

    await store.set(soloDate, JSON.stringify(merged));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, date: soloDate, patch }),
    };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "method not allowed" }) };
};

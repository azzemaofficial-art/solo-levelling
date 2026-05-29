import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

function toSoloDate(iso) {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function entriesToPatch(entries) {
  const patch = {};
  for (const e of entries) {
    if (e.type === 'meal') {
      patch.consumed = (patch.consumed ?? 0) + (e.calories_estimate ?? 0);
      patch.protein = (patch.protein ?? 0) + (e.protein_g ?? 0);
      patch.carbs = (patch.carbs ?? 0) + (e.carbs_g ?? 0);
      patch.fatMacros = (patch.fatMacros ?? 0) + (e.fat_g ?? 0);
    }
    if (e.type === 'workout') {
      const dur = e.duration_min ?? 30;
      const burnRate = e.intensity === 'high' ? 9 : e.intensity === 'medium' ? 6 : 4;
      patch.burned = (patch.burned ?? 0) + Math.round(dur * burnRate);
      patch.strength = (patch.strength ?? 0) + (e.intensity === 'high' ? 3 : e.intensity === 'medium' ? 2 : 1);
    }
    if (e.type === 'sleep') {
      if (e.hours) patch.sleepHours = e.hours;
      if (e.quality) patch.sleepQuality = e.quality === 'good' ? 8 : e.quality === 'ok' ? 5 : 3;
    }
  }
  return patch;
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  if (req.method === 'GET') {
    const { all, date: dateParam } = req.query;

    if (all === '1') {
      const { data, error } = await supabase
        .from('personal_agent_logs')
        .select('data');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, logs: data.map((r) => r.data) });
    }

    const key = dateParam ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    const { data, error } = await supabase
      .from('personal_agent_logs')
      .select('data')
      .eq('date', key)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, log: data?.data ?? null, date: key });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { entries, date } = body;
    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ error: 'entries required' });
    }

    const soloDate = toSoloDate(date) ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

    const { data: existing } = await supabase
      .from('personal_agent_logs')
      .select('data')
      .eq('date', soloDate)
      .maybeSingle();

    const patch = entriesToPatch(entries);
    const prev = existing?.data ?? { date: soloDate };
    const merged = { ...prev, date: soloDate };
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === 'number' && typeof merged[k] === 'number') {
        merged[k] = merged[k] + v;
      } else {
        merged[k] = v;
      }
    }

    const { error } = await supabase
      .from('personal_agent_logs')
      .upsert({ date: soloDate, data: merged, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, date: soloDate, patch });
  }

  return res.status(405).json({ error: 'method not allowed' });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Valida i JSON prodotti da tools/extract-secrets.mjs (committati, il test non
// rilancia l'estrazione). Schema atteso per file:
//   { "discipline": <key>, "secrets": [{ id, n, text, categoria, livello, lore, tags, errore }] }

const SECRETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'knowledge', 'secrets');

const files = fs.readdirSync(SECRETS_DIR).filter((f) => f.endsWith('.json')).sort();
const docs = files.map((f) => ({
  file: f,
  json: JSON.parse(fs.readFileSync(path.join(SECRETS_DIR, f), 'utf8')),
}));

const CATEGORIE = new Set(['tecnica', 'tattica', 'mente', 'condizionamento', 'storia']);

test('almeno 20 discipline presenti', () => {
  assert.ok(docs.length >= 20, `attese >=20 discipline, trovate ${docs.length}`);
});

test('ogni JSON ha secrets non vuoti con i campi obbligatori', () => {
  for (const { file, json } of docs) {
    assert.equal(typeof json.discipline, 'string', `${file}: discipline mancante`);
    assert.equal(json.discipline, file.replace(/\.json$/, ''), `${file}: discipline != nome file`);
    assert.ok(Array.isArray(json.secrets) && json.secrets.length > 0, `${file}: secrets vuoto`);
    for (const s of json.secrets) {
      assert.ok(Number.isInteger(s.n) && s.n > 0, `${file}: n non valido`);
      assert.ok(typeof s.id === 'string' && s.id, `${file}: id mancante`);
      assert.ok(typeof s.text === 'string', `${file}: text non stringa`);
      assert.ok(CATEGORIE.has(s.categoria), `${file}: categoria '${s.categoria}' non valida`);
      assert.ok(Number.isInteger(s.livello) && s.livello >= 1 && s.livello <= 5, `${file}: livello fuori range`);
      assert.equal(typeof s.lore, 'boolean', `${file}: lore non booleano`);
      assert.ok(Array.isArray(s.tags) && s.tags.length >= 1 && s.tags.length <= 3, `${file}: tags deve avere 1-3 elementi`);
      for (const t of s.tags) {
        assert.ok(typeof t === 'string' && t.length > 0, `${file}: tag vuoto`);
        assert.equal(t, t.toLowerCase(), `${file}: tag '${t}' non minuscolo`);
      }
      assert.equal(typeof s.errore, 'string', `${file}: errore deve essere una stringa (il segno visivo che attiva il segreto)`);
    }
  }
});

test('conteggio totale dei segreti >= 600', () => {
  const total = docs.reduce((acc, { json }) => acc + json.secrets.length, 0);
  assert.ok(total >= 600, `attesi >=600 segreti, trovati ${total}`);
});

test('nessun text vuoto o duplicato dentro la stessa disciplina', () => {
  for (const { file, json } of docs) {
    const seen = new Set();
    for (const s of json.secrets) {
      assert.ok(s.text.trim().length > 0, `${file}: text vuoto al n=${s.n}`);
      assert.ok(!seen.has(s.text), `${file}: text duplicato al n=${s.n}`);
      seen.add(s.text);
    }
  }
});

test('id nel formato <disciplina>-NNN coerente con n (zero-padding a 3 cifre)', () => {
  for (const { file, json } of docs) {
    for (const s of json.secrets) {
      const expected = `${json.discipline}-${String(s.n).padStart(3, '0')}`;
      assert.equal(s.id, expected, `${file}: id '${s.id}' != atteso '${expected}'`);
      assert.match(s.id, /^[a-z0-9]+-\d{3}$/, `${file}: id '${s.id}' fuori formato`);
    }
  }
});

# Deploy Cloud Sync API

## Prerequisiti
- Backend già presente in `server/index.js`
- Endpoint disponibili:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /sync/push`
  - `GET /sync/pull`
  - `GET /health`

---

## Opzione 1: Render (consigliata, veloce)

1. Push del repo su GitHub.
2. In Render: `New` -> `Blueprint`.
3. Seleziona il repo: Render userà `render.yaml`.
4. Controlla variabili:
   - `SYNC_JWT_SECRET` (auto-generata)
   - `SYNC_CORS_ORIGIN` (metti il tuo dominio frontend in produzione)
5. Deploy.
6. Copia URL servizio (es. `https://shadow-sync-api.onrender.com`).
7. Nel frontend imposta `VITE_SYNC_API_BASE` a quell'URL.

Nota: il file DB viene salvato su disco persistente montato in `/var/data`.

---

## Opzione 2: Fly.io

1. Installa Fly CLI e fai login:
```bash
fly auth login
```
2. Crea volume persistente:
```bash
fly volumes create shadow_sync_data --size 1 --region fra
```
3. Crea app (se non esiste):
```bash
fly apps create shadow-sync-api
```
4. Imposta segreto:
```bash
fly secrets set SYNC_JWT_SECRET="metti-un-segreto-lungo-e-random"
```
5. Deploy:
```bash
fly deploy
```
6. Ottieni URL e impostalo nel frontend come `VITE_SYNC_API_BASE`.

---

## Frontend config

Nel frontend (build/deploy), usa:
```env
VITE_SYNC_API_BASE=https://tuo-sync-api-dominio
```

Nel pannello `Help` dell’app:
- `Register` o `Login`
- `Push Cloud` per backup remoto
- `Pull Cloud` per restore da remoto

---

## Hardening consigliato prima della produzione

- Imposta `SYNC_CORS_ORIGIN` al solo dominio frontend (no `*`).
- Ruota periodicamente `SYNC_JWT_SECRET`.
- Considera limite richieste/rate-limit davanti all’API.
- Valuta encryption-at-rest del file DB se gestisci dati sensibili.

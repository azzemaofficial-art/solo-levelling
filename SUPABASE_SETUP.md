# Supabase Setup (Login + Cloud Sync)

## 1) Crea progetto Supabase
- Vai su Supabase e crea un nuovo project.

## 2) Prendi le chiavi
- `Project Settings` -> `API`
- Copia:
  - `Project URL` -> `VITE_SUPABASE_URL`
  - `anon public` key -> `VITE_SUPABASE_ANON_KEY`

Mettile nel tuo `.env`:
```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Poi riavvia:
```bash
npm run dev
```

## 3) Crea tabella backup + RLS
Apri `SQL Editor` e incolla tutto:

```sql
create table if not exists public.user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  backup_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

drop policy if exists "user_backups_select_own" on public.user_backups;
create policy "user_backups_select_own"
on public.user_backups
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_backups_insert_own" on public.user_backups;
create policy "user_backups_insert_own"
on public.user_backups
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_backups_update_own" on public.user_backups;
create policy "user_backups_update_own"
on public.user_backups
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 4) Auth settings
- `Authentication` -> `Providers` -> `Email` attivo.
- Per flusso più semplice in app:
  - disattiva `Confirm email` (oppure lascia attivo e poi conferma mail prima del login).

## 5) Test in app
- Vai su `Help` -> `Auth + Cloud Sync`
- `Register` o `Login`
- `Push Cloud`
- `Pull Cloud`

Se tutto è corretto, `Push/Pull` funziona cross-device con lo stesso account.

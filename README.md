# CreatorCRM

Gestionale per content creator: collaborazioni con i brand (kanban e scheda deal), contenuti e calendario,
anagrafica aziende, finanze (YouTube + sponsor + movimenti manuali), ricevute per prestazione occasionale
e inbox delle email di collaborazione catalogate dall'AI.

Stack: Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Auth, Postgres con RLS, Storage),
OpenRouter per l'AI, YouTube Data/Analytics API, IMAP iCloud.

## Sviluppo

```bash
npm install
cp .env.local.example .env.local   # e compila i valori
npm run dev
```

## Variabili d'ambiente

| Variabile | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server: cron e scritture amministrative |
| `ADMIN_USER_ID` | Utente amministratore (inbox, interruttore registrazioni, job schedulati). Fallback: `INBOX_ALLOWED_USER_ID` |
| `AUTH_ALLOW_SIGNUP` | `true` per permettere registrazioni (default chiuse) |
| `APP_URL` | URL pubblico (redirect OAuth Google e intestazioni OpenRouter). Opzionale: di default l'origine della richiesta |
| `CRON_SECRET` | Segreto condiviso con i job pg_cron (`Authorization: Bearer …`) |
| `OPENROUTER_API_KEY` | AI (classificazione inbox, analisi brief, assistente) |
| `AI_MODEL_FAST`, `AI_MODEL_SMART` | Modelli OpenRouter (default `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-5`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth Google (client di tipo "Applicazione web") |
| `GOOGLE_REFRESH_TOKEN` | Legacy: fallback finché non si collega Google dalla dashboard |
| `YOUTUBE_CHANNEL_ID`, `YOUTUBE_REVENUE_CURRENCY` | Opzionali (canale specifico, valuta ricavi; default EUR) |
| `ICLOUD_EMAIL`, `ICLOUD_APP_PASSWORD` | Casella IMAP (password specifica per app di Apple) |
| `COLLAB_EMAIL_ADDRESS` | Indirizzo delle collaborazioni (filtro lato server IMAP) |
| `INBOX_BACKFILL_DAYS` | Storico importato al primo avvio (default 365) |

## Database

Le migration sono in `supabase/migrations`. Con la CLI collegata al progetto: `supabase db push`.
I job schedulati (inbox ogni 15 minuti, YouTube ogni giorno) si configurano una volta con `supabase/cron-setup.sql`.

## Google / YouTube

Nella Google Cloud Console la schermata di consenso deve essere **In production** (in "Testing" i refresh token
scadono dopo 7 giorni). Il client OAuth deve avere come redirect URI `<APP_URL>/api/google/callback`
(e `http://localhost:3000/api/google/callback` per lo sviluppo). Poi, dalla dashboard: **Collega Google**.

## Inbox

- Sync incrementale IMAP (ultimo UID per cartella): Posta in arrivo filtrata per `COLLAB_EMAIL_ADDRESS` + Inviati.
- Thread ricostruiti da Message-ID/References; stato automatico (risposta inviata → "in attesa del brand",
  nuova risposta del brand → "da rispondere").
- Brand associato per regole (email dei referenti, domini del brand), poi AI; le associazioni manuali
  insegnano i domini al brand.
- L'AI (modello fast) assegna categoria, riassunto, dati del deal, flag qualità/urgenza/agenzia.

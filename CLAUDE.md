# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Toolkit Pmi 360°" — a multi-tenant (multi-azienda) risk management and corporate governance web app for Italian SMEs, built with Create React App and Supabase (Postgres + Auth + Storage + Edge Functions). All UI copy, code comments, and domain terminology are in Italian.

## Commands

```bash
npm start     # dev server (react-scripts start)
npm run build # production build to ./build
npm run deploy # gh-pages -d build (manual deploy; normally CI handles this)
```

Tests exist only for the finance module's pure calculation libraries (`src/finanza/lib/**/*.test.js`, Jest via CRA): run `CI=true npm test -- --watchAll=false src/finanza`. There is no lint script. Deploy is automatic via `.github/workflows/deploy.yml` on every push to `main`: the same build goes to Cloudflare Pages (project `pmi360-portale`, served at https://app.pmi360.it, the official portal URL; secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`) and to GitHub Pages, whose old `github.io/toolkit-pmi-360` URL now only redirects to app.pmi360.it (script in `public/index.html`, keeping query and hash so invite and login links still work). `homepage` is `.` so assets load with relative paths on both hosts. Pushing changes to `.github/workflows/` is refused for the local git token (no `workflow` scope): the user edits that file on github.com. Email links in the Edge Functions use `APP_URL = 'https://app.pmi360.it'`. AI calls (extract-visura, fin-estrai-documento, fin-genera-narrativa) go through `supabase/functions/_shared/claude.ts`: with the `BEDROCK_*` secrets set they use Amazon Bedrock in the EU (eu-central-1, `eu.` inference profiles, IAM keys with SigV4; models in `BEDROCK_MODELLO_PRINCIPALE`/`BEDROCK_MODELLO_VELOCE`) and never fall back to the US Anthropic API; the Claude 5 family is not yet enabled on that AWS account (Sonnet 4.6 / Haiku 4.5 are). The institutional site pmi360.it lives in the separate repo `../pmi360-sito` (Cloudflare Pages project `pmi360-sito`).

Supabase Edge Functions live under `supabase/functions/*/index.ts` (Deno runtime, `invia-email`, `invia-invito`, `reminder-scadenze`). There's no local Supabase project scaffolding in this repo beyond `supabase/.temp/linked-project.json`; treat the linked project as the single source of truth for schema/RLS — this repo has no migrations directory.

## Architecture

**Single-page app, no router.** `src/App.js` is the root: it owns all top-level state (session, current company, current "page" string, current "modulo") and renders one of the page components by string key from a `pages` lookup object — there is no `react-router` route tree despite the `react-router-dom` dependency being installed. Navigation is done by calling `setPage('xyz')` from the shared `AppContext`.

**AppContext (`useApp()`)** is the app-wide dependency-injection point. Every page/component reads `azienda`, `profilo`, `session`, `page`/`setPage`, `modulo`/`entraModulo`/`tornaHome`, and cross-cutting actions (`apriDetermina`, `apriAdunanza`, `switchAzienda`, `reload`, `logout`) from it via `import { useApp } from '../App'`. When adding a new page, wire it into the `pages` map in `App.js` and, if it belongs to a module, into `MODULI` in `src/components/Layout.js`.

**Two top-level UI shells based on role**, chosen in `App.js`:
- `profilo.ruolo === 'membro'` → `LayoutMembro` + `IMieiTask` (a stripped-down "my tasks" view for operational staff who accepted an invite).
- Everyone else (`ruolo === 'consulente'`) → `Layout` (full sidebar with module switcher) wrapping the page from the `pages` map.

**Modules ("moduli").** The consulente UI is organized into four modules defined in `Layout.js`'s `MODULI` object: `rischi` (risk register/dashboard/action plan/tickets), `procedure` (procedure catalog/tracking), `governance` (administrative body management, determine/delibere, verbali, meeting minutes), `finanza` ("Finanza e Controllo", ported from EasyPMI into `src/finanza/`: pages keep EasyPMI's original table names and go through the adapter `src/finanza/lib/supabase.js`, which maps them to the `fin_*` tables, the `fin-documenti` bucket and the `fin-*` Edge Functions; styles are scoped under `.mod-finanza` in `src/finanza/finanza.css`; pages are lazy-loaded). `entraModulo(m)` switches modules and jumps to that module's default page. Adding a page to a module means adding both a `pages` entry in `App.js` and a `voci` entry in the module's `MODULI[...]` definition.

**Multi-tenancy ("multiaziendale").** Every business table is scoped by `azienda_id`. A user can belong to multiple companies via the `utente_aziende` join table; `azienda` in context is "whichever company is currently active," persisted in `localStorage` under `azienda_attiva` and switched via `switchAzienda()`. Never query business tables without filtering by `azienda.id` — Row Level Security in Supabase is the backstop, but page code consistently filters explicitly too. Row-level access control (who sees what) is enforced by Supabase RLS policies, not in the client — this repo has no migration files, so policy behavior must be inferred from query patterns in the pages or confirmed with the user.

**Invite flow.** Company members are invited by email (Edge Function `invia-invito`, using Brevo for delivery); the invite token flows through the URL (`?invito=<token>`) into `localStorage` so it survives the OAuth/magic-link redirect, and `accettaInvito()` in `App.js` links the user's new profile to the inviting company on next auth-state-change. When touching invite/onboarding logic, `App.js`'s `accettaInvito`/`loadDati` and `Setup.js` are the relevant files together.

**Governance / determine domain.** `src/lib/fascicoli.js` defines the fixed catalog of "fascicolo" types (contratto, operazione_finanziaria, assunzione, ecc.) used by the determina/delibera wizard (`NuovaDetermina.js`) to show required supporting-document checklists per act type — this is reference/domain data, not something to regenerate or restructure casually. `DettaglioAdunanza.js` implements a many-to-many link between adunanze (meetings) and delibere prepared/discussed in them.

**Procedure catalog.** `src/lib/constants.js`'s `CATALOGO_PROCEDURE` (94 entries) and `AREE_PROCEDURE`/`MAPPA_SIGLE` in the same file are the master reference list of operational procedures grouped by area and mapped to organizational roles (`funzioni`, matching `ruoli` sigle from the organigramma). `src/lib/generaProcedura.js` and `src/lib/procedure.js` build/dedupe procedure records from this catalog against a company's actual organigramma roles — when deduplicating by `codice`, specific-sector matches take priority over generic ones (see recent commit history for this exact rule).

**Styling.** No CSS-in-JS/Tailwind — a single global stylesheet (`src/index.css`) with utility classes (`btn`, `btn-primary`, `modal`, `form-control`, `badge`, `alert`, etc.) plus heavy use of inline `style={{}}` objects directly in JSX for one-off layout. Follow the existing inline-style convention for small tweaks rather than introducing a new styling approach.

**Supabase client.** `src/lib/supabase.js` exports a single configured client using the anon key (safe to expose client-side; access control is via RLS). Edge functions use the service-role key server-side only, read from `Deno.env`.

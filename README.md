# DailyAble — Every day, a little better

A deployable interactive prototype for the 2026 Presidential Hackathon International Track.

DailyAble turns a short daily check-in into:

- one manageable, non-clinical next step;
- a participant-controlled supporter option;
- an actionable supporter queue with observable reasons and consent scope;
- a clear explanation of the boundaries between deterministic rules, AI assistance, and human judgement.

## Routes

### Public competition pages

- `/` — short gateway with separate participant and supporter entrances.
- `/about` — evidence, impact model, proposed pilot metrics, international adaptation, and roadmap.
- `/how-it-works` — bilingual decision path, evidence model, responsibility boundaries, and data minimization.

### Participant app

- `/app` — participant home.
- `/app/check-in` — one-question-at-a-time daily check-in and actionable result.
- `/app/insights` — personal demo trend and recent entries.
- `/app/support` — participant-controlled support options and official resources.
- `/app/privacy` — data purpose, sharing scope, and permission summary.
- `/app/connections` — create short-lived supporter invitations, confirm access, and revoke connections.

### Supporter workspace

- `/supporter` — operational overview.
- `/supporter/queue` — prioritized follow-up queue.
- `/supporter/people/:id` — individual detail with observable reasons, context, decision basis, and functional support view.
- `/supporter/plans/:id` — support plan, evaluation signals, outside-support conditions, and follow-up actions.
- `/supporter/follow-up` — follow-up record.
- `/supporter/method` — supporter decision and authority method.
- `/supporter/connections` — claim participant invitations and leave connections.
- `/session` — minimal prototype session onboarding (not verified production identity).

Each operating shell contains its own navigation and exactly one cross-role switch. The participant app does not embed supporter records, and the supporter workspace does not embed the participant check-in flow.

Legacy `/check-in` remains available for existing demo links. `/api/ping` is the deployment health endpoint.

The sample supporter queue remains simulated and labelled as demo data. Authenticated participant check-ins, sessions, pairing, consent, plans, and authorized follow-ups use PostgreSQL outside explicit demo mode. This prototype does not reproduce BSRS-5 or AD8 items, diagnose a condition, prescribe treatment, or autonomously contact a supporter.

## Run locally

Requires Node.js 20 or newer.

For the non-persistent competition demo only:

```bash
DAILYABLE_DEMO_MODE=true npm start
```

For persistent local or deployed use, set `DATABASE_URL` to a PostgreSQL connection string. Startup takes a PostgreSQL advisory lock before bootstrap DDL, then applies pending versioned migrations transactionally. `npm run migrate` can also be used as an explicit release step.

Open <http://localhost:3000>.

## Verify

```bash
npm test
npm run check
```

## Deploy on Zeabur

1. Add a Zeabur PostgreSQL service in the same project.
2. In the DailyAble service, set `DATABASE_URL` to the PostgreSQL service's private connection string. Also set `PAIRING_SECRET` to a long random secret (for example, generate one with `openssl rand -base64 48`). Store it only as a Zeabur environment variable; never place it in Git or documentation. Do not set `DAILYABLE_DEMO_MODE` in a persistent deployment.
3. Build command: `npm install`; start command: `npm start`. The process runs all unapplied files in `migrations/` in filename order and records them in `schema_migrations`; a migration failure prevents startup.
4. No mounted web volume is used or required. All durable application state is in PostgreSQL.
5. After the deployment reports Ready, open the actual domain configured under **Networking**.
7. Verify:
   - `https://<domain>/api/ping` returns `{"ok":true,"service":"dailyable","version":"0.1.0"}`;
   - `/app/check-in` reaches a next-step result;
   - “Ask Jordan to check in” requires participant confirmation;
   - `/supporter/queue` opens `/supporter/people/alex-01`, then its separate support-plan page;
   - “Record contact” updates the demo status on `/supporter/plans/alex-01`;
   - the participant and supporter shells each expose one cross-role switch;
   - `/how-it-works` and `/supporter/method` load the public and operational safety boundaries.

## Persistence and pairing boundaries

`DAILYABLE_DEMO_MODE=true` explicitly selects an in-memory store. It is not persistent and resets on restart. Tests also inject an in-memory store. In every other mode `DATABASE_URL` is mandatory; the service fails closed when it is missing.

Self-selected participant/supporter sessions are enabled automatically only in demo mode. Persistent mode refuses `/api/session` account creation until verified LINE/email identity is integrated. `DAILYABLE_PROTOTYPE_AUTH=true` can temporarily reopen prototype account creation against PostgreSQL for a controlled staging test, but it must not be enabled on a public production service.

A participant creates a random 15-minute code. Only a keyed HMAC of the code is stored, using `PAIRING_SECRET`, so a database snapshot cannot be used to cheaply enumerate short codes. A supporter claims the code, then the participant must confirm before the relationship becomes active. Participants and supporters can have multiple relationships, list only their own relationships, and either side can revoke or leave. A revoked pair can reconnect only through a fresh invitation. There is deliberately no name or email directory. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` behind HTTPS; browser state-changing requests require a matching origin or the session-bound token from `GET /api/csrf` supplied as `X-CSRF-Token`, and only session-token hashes are stored. Forwarded host/protocol headers are trusted only when `DAILYABLE_TRUST_PROXY=true` is explicitly configured for a known reverse proxy.

The `/session` screen is minimal prototype onboarding. Pairing-claim throttling is bounded and keyed by authenticated supporter account plus a normalized code digest, so spoofed forwarding headers do not reset it; it remains process-local prototype protection. Verified LINE or verified email identity, account recovery, distributed abuse controls, and re-authentication for sensitive consent changes remain production gates.

Authenticated participant check-ins are persisted. Anonymous check-ins preserve the competition demo and are not stored. The existing `alex-01` supporter queue and its actions remain clearly labelled demo data; persistent follow-up writes require an active authorized relationship.

## Backup, restore, and release gates

Before production, configure automated encrypted PostgreSQL backups with retention appropriate to the pilot, point-in-time recovery where available, restore drills into an isolated environment, restricted operator access, deletion/retention procedures, and monitoring for failed backups and migrations. Take a verified backup before schema releases and test both forward migration and restore procedures in staging. The pg-mem suite explicitly disables the PostgreSQL-only advisory-lock call and is local SQL/logic evidence only; it does not prove migration concurrency. Advisory locking, migration, transaction, index, backup, and restore behavior against the exact Zeabur PostgreSQL version remains a staging verification gate.

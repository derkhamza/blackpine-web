# Blackpine — Deploy & rollback runbook

**Deployment is manual and gated.** Do not push straight to production. First
pass the gate in [TESTING.md](./TESTING.md) (automated tests green + manual
score = GO), then deploy deliberately, then keep the previous version one click
away in case of trouble.

Two apps:

| App | Repo / branch | Vercel project |
|-----|---------------|----------------|
| Web PWA (`blackpine-web`) | `master` | Blackpine web |
| Backend API (`blackpine-backend`) | `main` | `blackpine-backend` |

---

## Release checklist

1. `npm test` → exit 0, and `npm run build` → success (web).
2. Run the manual checklist (TESTING.md) on a **preview** build → decision = GO.
3. Note the **current live deployment URL** (Vercel → project → Deployments →
   the one marked *Production*). This is your rollback target.
4. Promote the new build to Production (see below).
5. Smoke-test production: login, open a consultation, emit a facture.
6. If anything is wrong → **roll back immediately** (next section), then
   investigate off-production.

## Deploying (choose one)

- **Preview → Promote (safest):** open the preview deployment in Vercel and
  click **Promote to Production**. No rebuild, instant.
- **Git push:** push the release commit to the production branch (`master` /
  `main`). *(If Vercel auto-deploy on push is enabled, that is the "automatic
  deploy" we want to avoid doing blindly — only push once the gate is GO. To
  fully disable auto-deploy, turn off the project's Git production branch
  deploys in Vercel → Settings → Git, and rely on Promote instead.)*
- **CLI:** `vercel --prod` from the project directory.

---

## Rollback — reverting to a previous version

Vercel keeps every past deployment immutable, so rollback is instant and does
**not** rebuild.

**Dashboard (recommended):**
1. Vercel → the project → **Deployments**.
2. Find the last known-good deployment (the one that was Production before this
   release — you noted its URL in step 3 above).
3. **⋯ menu → Promote to Production** (a.k.a. *Instant Rollback*). Confirm.
4. Production serves the old build within seconds. Verify with a smoke test.

**CLI alternative:**
```bash
vercel rollback <deployment-url>     # e.g. blackpine-xxxx.vercel.app
# or list first:
vercel ls blackpine-web
```

**Notes**
- The web app is a PWA: after a rollback, clients may hold the newer cached
  shell until they reload. A hard refresh (Ctrl/Cmd+Shift+R) forces the old
  shell; the service worker updates on next launch.
- **Backend + database:** rolling back code does **not** roll back data. If a
  release ran a schema migration, ensure the old code still reads the new
  schema (all Blackpine migrations are additive), otherwise restore data from a
  Turso backup before rolling code back.
- Always roll back **first**, diagnose **second**. Production stability wins.

---

## Version

The app version lives in `blackpine-web/package.json` → `"version"`. Bump it
with each release (`x.y.z`) so testers and the admin screen can tell which build
they are on. The Admin dashboard (owner-only) surfaces the current version and a
short version of this rollback procedure.

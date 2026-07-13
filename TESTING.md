# Blackpine — Testing & release gate

This project **no longer deploys automatically**. Every release is gated behind
(1) automated tests and (2) a scored manual test pass. Only after both are green
does a human decide to deploy. See [DEPLOY.md](./DEPLOY.md) for the deploy +
rollback runbook.

---

## 1. Automated tests

Fast, deterministic unit tests over the pure logic libraries (money math,
eGFR, growth reference, document layout, appointment-type registry).

```bash
cd blackpine-web
npm install      # first time only (installs vitest)
npm test         # runs the suite once, prints pass/fail
npm run test:watch   # re-runs on change while developing
```

**Current status:** `5 files · 31 tests · all passing` (run `npm test` to refresh).

Covered:

| File | What it locks down |
|------|--------------------|
| `src/lib/billing.test.ts` | per-act remise (MAD & %), clamps, subtotal/net, payment status, outstanding total |
| `src/lib/ckdEpi.test.ts` | CKD-EPI 2021 eGFR, sex correction, mg/L→mg/dL, invalid-input guards |
| `src/lib/growthReference.test.ts` | Tanner mid-parental height, WHO percentile bands present, age-at |
| `src/lib/docDesign.test.ts` | margin resolution, block width/height/position style, legacy-fallback |
| `src/lib/apptTypes.test.ts` | built-in labels, overrides (rename/recolour), custom types, secondary labels |

**Gate:** `npm test` must exit 0. Also run `npm run build` (it runs `tsc` +
Vite build) — it must succeed with no type errors.

> Adding a feature with real logic? Add a `*.test.ts` next to the lib. UI-only
> changes are covered by the manual pass below.

---

## 2. Manual test checklist (for testers)

Run on a **staging / preview** build, on desktop **and** a phone (PWA). Mark each
row **PASS (2)**, **PARTIAL (1)** or **FAIL (0)**. Items marked 🔴 are
**blocking** — any FAIL there is an automatic NO-GO regardless of the score.

### A. Authentication & sync
- 🔴 A1 — Log in (doctor) succeeds in < 2s. `___`
- 🔴 A2 — Secretary login + PIN exit works. `___`
- 🔴 A3 — Edit on doctor appears on secretary within ~15s, and vice-versa. `___`
- A4 — Language switch on the login screen (fr/en/ar) re-renders correctly. `___`
- 🔴 A5 — **Account isolation:** log in as A (with finances), log out, log in as B
  (ideally a fresh account with no finances) → B shows **no** finances/comptabilité,
  invoices, or doctor identity from A. Repeat A→B via secretary area too. `___`

### B. Agenda & appointment types
- B1 — Create/edit/delete an appointment; recurring series. `___`
- 🔴 B2 — Settings → add a **custom consultation type**, rename & recolour a
  built-in, hide one → all reflected in the agenda + new-appointment form. `___`
- B3 — Assign a **secondary label** to an appointment; badge shows on the card
  and in the legend. `___`
- B4 — Deleting a patient keeps their appointments. `___`

### C. Consultation screen
- C1 — Top card shows **all** consultation-type buttons; reclassify works. `___`
- C2 — Vital signs entry is compact; BMI auto-computes from weight+height. `___`
- 🔴 C3 — Enter serum creatinine → **eGFR auto-fills and is locked**; enter
  VEMS + CVF → **ratio auto-fills**. `___`
- 🔴 C4 — History tab shows past visits with **all** notes, every measure, and
  **attached documents** (openable), each linked to its appointment. `___`
- C5 — Attach a file to a consultation; it appears under that visit in history. `___`

### D. Billing & documents
- 🔴 D1 — Bill an act with a per-act **remise on the same line** (MAD and %);
  totals correct; facture line-items small, TOTAL emphasised. `___`
- 🔴 D2 — Personalise a document (background/logo/margins) in the **page
  designer by dragging edges**; the emitted facture/ordonnance matches. `___`
- D3 — Emit + reprint a facture and a receipt; invoice number persists. `___`

### E. Patient dossier
- E1 — Identification card: **"patient depuis"** shows the earliest real date
  (first visit or record), never blank/wrong. `___`
- E2 — Growth curve renders WHO bands for a child. `___`

### F. Cross-cutting
- F1 — Dark mode + RTL (Arabic) render without broken layout. `___`
- F2 — No console errors during a normal session. `___`

---

## 3. Scoring & go/no-go

```
score      = Σ(points) / (2 × number_of_rows) × 100%
blocking   = every 🔴 row is PASS (2)
```

| Result | Decision |
|--------|----------|
| blocking = false | **NO-GO** — fix the blocking failure, re-test |
| blocking true & score ≥ 90% | **GO** — deploy (see DEPLOY.md) |
| blocking true & 75–89% | **CONDITIONAL** — deploy only if the failing items are cosmetic and logged as follow-ups |
| score < 75% | **NO-GO** |

Record the run: date, tester, build/commit, score, decision, and any waived
items. Keep the last few runs in `test-runs/` (or paste into the deploy PR).

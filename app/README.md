# Portfolio 2026 — motion redesign

React + Vite + Tailwind v4 + Motion, shadcn-style components. Built from the Figma file
"Bruno — Portfolio 2026" (section "Direction B — Manuscript", as edited by Bruno).

```bash
cd app
npm install
npm run dev   # http://localhost:4185
```

- `src/data.ts` — story copy, cards, other work, career (story copy and card lines are placeholders).
- `src/components/story.tsx` — typed intro over the space scene; scrolling fast-forwards it.
- `src/components/space-backdrop.tsx` + `galaxy.tsx` — the page-long space background, twinkling stars and comets.
- `src/components/fx/*` — hover effects: letter roll, magnetic pull, arrow swap; glare lives in `ui/button.tsx`.
- Palette and tokens at the top of `src/index.css`.
- **Picking this up?** Read `HANDOFF.md` first.

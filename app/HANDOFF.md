# Handoff — portfolio motion redesign (updated 2026-11-26, evening)

Current state: **Option D** (dot astronaut) on `claude/motion-redesign` (draft PR stayh1gh/bruno-portfolio#1),
also saved as the snapshot branch `claude/portfolio-option-d`.
Everything is committed and pushed. Never merge to `main` without Bruno.

## Where things are

| What | Where |
| --- | --- |
| Working branch | `claude/motion-redesign` → draft PR #1 |
| Snapshot: before the astronaut ("Option A") | branch `claude/portfolio-option-a` (`a086d89`) |
| Snapshot: first astronaut version ("Option B") | branch `claude/portfolio-option-b` (`12455aa`) |
| Snapshot: illustrated astronaut + astronaut avatar + simple timeline ("Option C") | branch `claude/portfolio-option-c` (`629275a`) |
| Snapshot: dot astronaut on a grainy background ("Option D", current) | branch `claude/portfolio-option-d` |
| App | `app/` (React 19 + Vite + Tailwind v4 + Motion + Lenis + three.js) |
| Design | Figma "Bruno — Portfolio 2026" (`Pzut3K1Rp04QZwguSdJLUK`), Direction B, cards at node `9:297` |
| Local worktree (Bruno's Mac) | `personal/portfolio-worktrees/motion-redesign`; the root portfolio checkout is on another branch with uncommitted work, don't touch it |

Run it:

```bash
cd app
npm install
npm run dev -- --port 4185
```

## What the page is now (Option D)

1. **Intro (story)** — `src/components/story.tsx`, copy in `src/data.ts` (`STORY`).
   - Text: one paragraph, pure white `#FFFFFF`, sans only; bold on "Bruno Paradas", "design, build, and ship", "Buzzfeed". Typed at an even pace (23 letters/s, no pauses, no caret), starting shortly after the dots begin to arrive. Left on desktop (max 54% width), centred on phones. Pinned for 150svh; scrolling fast-forwards the typing. Scroll hint: a floating mouse icon only.
   - **Dot astronaut** — `src/components/dot-astronaut.tsx` (three.js Points + shader, one draw call, screen-pixel space):
     - Intro: the dots blow in from off-screen left as one thin ray of sand, flying together and undulating like a slow wave (same wave for every dot), then the ray opens up into the figure (~3.8s). No loading ring any more.
     - Dots are scattered at random inside `public/images/story/astronaut-body.webp` (1304×2311, transparent). Most sit on the drawing's contours (edge detection on its line work, shadow edges and silhouette), which read as bright dotted lines like the reference; a dim fill lies between them (`FILL` / `EDGE`), densest on the helmet (`SPOTS` / `detailWeight`). `SPACING` (4.9px) sets the overall amount. Most dots tiny, ~6% bigger ones that twinkle.
     - Visor: the face in the drawing is masked out (`VISOR` outline, source px) → dark glass with a bright rim, a few dim dots and one soft reflection. Bruno asked for no face in the helmet.
     - Gloomy low-key light, baked per dot: lit from the upper left, right/under sides in shadow, legs fading into the dark; a slow shadow drifts across the figure (shader).
     - Glow: premultiplied additive blending (soft core + small halo). Colour `#e6ebd8`.
     - Fake depth (distance from the silhouette edge): gentle turn toward the cursor + idle sway, soft perspective.
     - No cursor light/push any more (removed at Bruno's request).
     - On scroll out of the intro: the figure rises, turns and its dots fly off to the left.
   - Earlier experiments Bruno rejected: a sparse "silhouette only" version, an empty visor, and a version with a filled plain visor. He preferred the stipple that follows the illustration, now with variable density.
2. **Background** — `src/components/space-backdrop.tsx`: plain very dark olive-black `#12140f` (taken from the reference video) behind the whole page, with a fixed SVG film grain (`@keyframes grain` in `index.css`, 7% opacity). The space painting, stars and comets were removed (and `galaxy.tsx` deleted).
3. **Work** — `src/components/work.tsx`: cards match Figma `9:297`; they slide in from the left in sequence; image zooms slowly with scroll. Heading "What I've **built**" white sans.
4. **Footer** — astronaut avatar with Bruno's moustache and goatee (`public/images/avatar.webp`), floating; "Want to build something? **Let's talk**". Credit line "Space illustrations: Magnific".
5. **Overlays** — About and Other work, white sans. About's timeline: a straight line with a glowing point that travels down as you scroll.
6. **Global** — custom cursor (frosted-glass ring, "View"/"Soon" disc on cards); Lenis smooth scroll; container up to 2200px with 96px side padding on desktop.
7. **Music** — `src/lib/music.ts`: quiet loop (8% volume, starts at 0:23) from the first click; volume icon button bottom-left.

Reference for the dot look: motionsites.ai `?prompt=dot-portrait` (preview video
`https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/noa-made-of-dots.mp4`).

## Not in git (on purpose)

- `app/public/audio/background.mp3` — "Dearly Beloved" (Kingdom Hearts II), copyrighted, gitignored. Without it the music is silent. Replace with a licensed/royalty-free track at the same path before going live.

## Images (Magnific, free plan)

- Astronaut: stock "Anime style character in space" (id 122494274) → full-body version generated; background removed locally.
- Avatar (Option C onward): the astronaut character with a moustache and goatee, generated from the astronaut stock image only.
- Magnific MCP works in this account (Free plan: 20 images/day, no credits; 3D needs credits, so the dot astronaut uses fake depth).

## Ideas not done yet

- Real 3D for the dot astronaut (Magnific image-to-3D, 580–1,190 credits per run) → sample its surface with `MeshSurfaceSampler`.
- Phone check of the dot astronaut + grain background.

## Open items

- Real copy for card one-liners and job summaries; videos for the cards.
- "Other work" filter list: Figma says "Mobile", site says "Interaction" (kept on purpose for now).
- Vercel build setup before this can replace the live static site.
- Long story copy (`STORY_LONG`) is saved for the About overlay, not used yet.

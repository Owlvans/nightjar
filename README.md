# nightjar

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/owlvans/nightjar/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/owlvans/nightjar/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Nightjar — a tiny game of shadows and keycards. An original top-down stealth game that plays offline in a desktop browser from its own files. Slip past patrolling guards, stay out of their vision cones, take the keycard, and reach the exit unseen — across three buildings: the Lobby, the Archive, and the Vault.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

## Play

- **WASD / arrow keys** — move
- **Shift** — sneak: slower, quieter, and guards notice you later
- **Aim with the mouse, then Space** — throw a coin; guards investigate the clink
- **P / Esc** — pause · **M** — sound on/off · **Enter** — confirm / retry

Guards patrol waypoints and see through a vision cone that walls and crates genuinely block
(every cone is raycast against the level, so what you see is exactly what they can see).
Being seen fills a suspicion meter: at full, the guard chases, and a touch ends the run.
Running is loud — nearby guards come to look. Score comes from gems, clear bonuses, time
under par, and a ghost bonus for finishing a level never fully spotted.

## Layout

- `main.ts` — the entry program (Node 22, standard library only): copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json` with the vendored library.
- `vendor/makefun-game.ts` — the make.fun library, copied from the kit unchanged.
- `game/` — the game itself: `index.html` plus ES modules under `game/src/`
  (`config` tuning and levels, `world` simulation and guard AI, `render` canvas drawing,
  `input`, `audio` synthesised Web Audio sounds, `shots` deterministic screenshot scenes,
  `main` boot and screens). No libraries, no network requests, no asset files.
- `screenshots/` — real renders of the game, taken from its `?shot=` scenes
  (`shots.json` lists them).

MIT licensed — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kh59vrea&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

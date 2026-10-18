# Bounty Hunter

A minimal multiplayer 3D top-down shooter. The server simulates movement, shots, hits, and respawns. Each client sends inputs and draws the latest snapshots.

## Requirements

- [Bun](https://bun.com) 1.3 or newer

## Install

```bash
bun install
```

## Run

From the repo root:

```bash
bun run dev
```

- Game client: [http://localhost:5173](http://localhost:5173)
- Game server: `ws://localhost:3001`

## Test with two players

1. Open [http://localhost:5173](http://localhost:5173) in two browser tabs.
2. Type a username in each tab and click **Play**.
3. Use WASD or the arrow keys to move, move the mouse to aim, and left-click to loose an arrow. Hunters start empty-handed. Longbows, shortbows, and recurve bows are scattered on the ground, along with stacks of special arrows. A shortbow shoots ahead. Its power sets the speed and how far the arrow drops. A recurve aims at the click and bends once around a wall or tree when that line is blocked. A longbow lofts onto any spot you click. Q shoots normal arrows, which never run out. Walk over a stack, then press 1 to ricochet, 2 to explode, 3 to punch through, or 4 for a flare that lights a circle until it lands. The bow square counts down until the next shot. Straw dummies stand around the arena and along the walls. They can be shot. You only see players, arrows, bows, stacks, and dummies ahead of you. Walls and trees block that view. Hold E and aim the mouse to pick a nearby bow, or to drop the one in your hand. Picking a bow while you hold one drops the old bow. Release inside the ring to cancel.
4. Open a third tab and click **Play**. It should say **Arena full**.

A player who reaches 0 HP respawns at their spawn point after a short delay.

## Scripts

| Script              | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `bun run dev`       | Starts the Bun server and the Vite client together                |
| `bun run build`     | Typechecks shared code, bundles the server, and builds the client |
| `bun run typecheck` | Runs `tsc --noEmit` in each package                               |
| `bun run lint`      | Runs ESLint                                                       |

To run the production build:

```bash
bun run build
bun run --filter @bounty/server start
bun run --filter @bounty/client preview
```

## Layout

- `shared/` — constants, message types, and parsers used by both sides
- `server/` — WebSocket entry, fixed tick loop, players, projectiles, and collision helpers
- `client/` — join screen, Three.js scene, input, snapshot interpolation, and nameplates
- `docs/class-map.md` — class diagram, updated when classes or fields change

Tunable numbers (speed, damage, HP, fire rate, arena size, tick rate, and the rest) live in `shared/src/constants.ts`.

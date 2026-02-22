# Coldline Vol. 2

A browser‑based Cold War hotline game built in TypeScript using a hand‑rolled engine.  The player interacts with a telephone interface to defuse geopolitical crises before time runs out.

---

## Features

* Interactive map and missile animation
* Phone‑graph dialog system with keycode puzzles
* Tutorial and game state management
* Audio effects for ambiance and feedback
* Built using Bun/TypeScript with minimal dependencies

## Getting started

### Requirements

* [Bun](https://bun.sh) (used in the repo for building and running)
* A modern browser (tested in Chrome)

### Installation

```bash
cd /path/to/Coldline2
bun install         # install dependencies (mostly type defs)
```

### Development

Run the dev process and open `http://localhost:3000/` in the browser.

```bash
bun run dev
```
### Production build

```bash
bun run build
```

## Project structure

```
/ts                # TypeScript source code
  AudioManager.ts
  GameEngine.ts
  PhoneGraph.ts
  entry.ts          # app entry point
/images            # assets
  MapChart_Map.svg
  telephone.png
  sounds/...
/style             # stylesheets
index.html         # game page
package.json
```

## Notes

* Keyboard controls: number keys (0‑9) plus space to confirm codes.
* The game is time‑limited (5 minutes) with audio drama cues.

## License
The sound were made by creators on Pixabay

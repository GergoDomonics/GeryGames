# GeryGames

A collection of Gery's own games, played with friends. A static website (GitHub Pages): the page is a 3D multiplayer **hub** on a floating island where everyone walks around as a cute customizable chibi character, walks into a portal, forms a party and launches a game.

## Layout
```
index.html            entry page: import map, canvas, UI overlays
style.css             UI tokens and styles
main.js               boot, render loop, hub <-> game switching
hub/                  world.js (island), portals.js, party.js, ui.js (title/customizer/HUD)
shared/               net.js, character.js, player.js, input.js, remotes.js, profile.js, sfx.js
games/registry.js     list of games (one portal each)
games/<slug>/         one folder per game: index.js (module contract), DESIGN.md, assets
assets/audio|models|textures/   used assets; assets/_incoming/ = raw downloads (untrusted, never run)
tests/*.test.js       node assert self-checks (`node tests/x.test.js`)
CREDITS.md            every third-party asset: title, author, licence, URL
```

## Platform
- Static hosting (GitHub Pages). No server, no bundler, no npm at runtime. ES modules + import map with exact pinned CDN versions: three@0.187.0, trystero@0.26.0 (jsdelivr `+esm`).
- Multiplayer = Trystero (WebRTC P2P, Nostr signaling), wrapped by `shared/net.js`. Full mesh: keep rooms <= 12 peers.
- Hub room `hub`; each game party joins its own room `<slug>-<code>`.
- Profile (name + look) lives in localStorage on each device.
- Everything must work solo when nobody else connects.
- Local preview: `.claude/launch.json` -> `python -m http.server 8080`. Open `/#dev` to get `window.gg` (`gg.player.pos.set(...)` teleports, `gg.enterGame(slug, code, members)`). Automated browser panes throttle frames when hidden; test multiplayer with two tabs, the acting one in front.
- Tests: `node tests/<name>.test.js` (package.json only sets `"type": "module"`).

## Agents (.claude/agents)
game-designer -> DESIGN.md · 3d-artist -> models/cosmetics · ui-designer -> menus/HUD · audio-designer -> music/SFX · game-engineer -> code. Checks: `ui-check`, `test-runner`.

## Rules
- Ponytail: smallest complete change; no speculative features.
- Original games and characters only; assets CC0 or credited CC-BY.
- Every game implements the module contract in `.claude/agents/game-engineer.md`.

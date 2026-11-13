# Contractor Legends — Rise of the Master Builder

An HD-2D open-world trades RPG: hand-authored pixel-art characters and textures living in a
real 3D coastal town, with cinematic lighting, depth of field and weather.

You inherit your uncle Walt's failing shop in **Harbor's End, Maryland** — a waterfront town
that stopped believing in builders after three development projects collapsed in one winter.
Rebuild it job by job, earn the town's trust, and find out what really happened.

Inspired by the craftsmanship and entrepreneurship of Don Howard Painting and Don Howard Construction.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Production build: `npm run build` (output in `dist/`, fully static — serve it from anywhere).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (drive, when in a vehicle) |
| Shift | Sprint |
| E | Talk · use · enter/exit vehicle |
| 1–6 | Tools: hands, hammer, roller, sledge, saw, pressure washer |
| C | Paint colour |
| Mouse | Aim at the work; click or hold to use the equipped tool |
| Wheel | Zoom |
| Tab / Esc | Menu (Journal, Skills, Gear, Map, Company, System) |
| J · M · K · B | Journal · Map · Skills · Company |
| Space · H | Brake · horn |
| F5 | Quick save (the game also autosaves) |

## What's in the first chapter

- **A dense town district**: wharf, pier, boardwalk, lumberyard, hardware store, town hall,
  neighbourhoods, a condemned hotel and cannery, a lighthouse, and a forest with a hidden cabin.
- **Ten named residents** with daily schedules, portraits, relationships, lessons and barks.
- **A nine-part main story** with multiple approaches (demolition, negotiation, engineering,
  exploration) and three endings, followed by post-story free play.
- **Six side jobs**, repeatable **contracts**, hireable **crew** who work beside you,
  buyable **property** to renovate, and five company tiers up to Master Builder.
- **Hands-on trade work** — every wall is rolled stroke by stroke onto real texture pixels,
  grime is pressure-washed off, boards are set and nailed, rot is smashed into physics debris,
  logs are sawn, and structures are designed on an engineer's drafting board.
- **Seven skills** whose levels unlock tools, techniques, dialogue options and business perks.
- A drivable pickup that hauls your materials, plus a skid steer for clearing rubble.
- Day/night cycle, weather, procedural ambient audio and music, save/load.

## Tech

Three.js · TypeScript · Vite · Rapier physics. Every texture, sprite, icon and sound is
generated procedurally at load — there are no downloaded art or audio assets.

| Path | What lives there |
| --- | --- |
| `src/art` | Pixel-art texture toolkit and the character sprite pipeline |
| `src/engine` | Render pipeline (MSAA → depth of field → bloom → grade), input, physics, audio, particles |
| `src/world` | Construction kit, town layout, sky / weather / water |
| `src/game` | Game loop, player, vehicles, NPCs, trade work, quests, dialogue, business |
| `src/ui` | HUD, dialogue, menus, shops, bench minigames |

# Marlow Tower

A browser air traffic control game. You run Delivery, Ground and Tower at the fictional Marlow International (EGMW), with a 3D tower view, a radar-style map, real radiotelephony phraseology, and optional Gemini AI voices for the pilots.

## Play

Open `dist/marlow-tower.html` in Chrome or Edge (no server needed). Needs internet for three.js (CDN) and, optionally, Gemini voices.

- **Gemini voices:** paste a Google AI Studio API key on the start screen or in Settings. The key stays in your browser's localStorage. Voices only work when the file is opened locally (or served from your own origin). Without a key the game uses browser voices.
- **Controls:** `Tab` next request · `1` accept · `2` deny · `3` wait · `M` manual · hold `Space` to talk · `P` pause · `/` focus command bar.
- A first-run tutorial explains the screen; replay it with the **Tutorial** button.
- The **Manual** has every phrase with search, and can be docked beside the game.

## Features

- Departures, arrivals, emergencies (PAN-PAN, MAYDAY, NORDO, bird strike, low fuel), runway inspections, wake turbulence, read-back errors, runway changes, fog, day/dusk/night.
- Accept / Deny / Wait replies generate the real phraseology; you can also type or speak your own.
- Career mode (a collision ends the shift) and Training mode.

## Develop

```
node build.js        # writes dist/marlow-tower.html (+ artifact variant)
```

Sources are in `src/`, concatenated in this order: `data.js` (phraseology, airlines, aircraft), `sim1.js` (world and aircraft state machine), `sim2.js` (command parser and handlers), `audio.js` (Gemini TTS, mic), `r3d.js` + `gfx.js` (three.js scene and realism layer), `map.js` (radar), `ui.js`, `tutorial.js`; `page.html` holds the markup and CSS. `tools/` has headless simulation scripts.

## License

MIT

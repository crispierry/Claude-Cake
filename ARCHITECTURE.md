# Architecture

## Overview

The entire application lives in a single `index.html` file (~3,000 lines). There is no build step, no framework, and no bundler. Three.js is loaded via CDN import map. This was a deliberate choice for simplicity and easy deployment.

## Code Organization

The file is organized in roughly this order:

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| HTML head & styles | 1–186 | Viewport, CSS for buttons/overlays, import map |
| UI elements | 134–150 | Buttons, instruction text, overlays, audio toggle |
| Scene setup | 197–276 | Three.js scene, camera, renderer, lighting, fog |
| Cake geometry | 277–1,470 | Platter, cake layers, candle, flame, frosting, decorations |
| Tray decorations | 331–463 | Graduation caps, diploma scrolls, champagne flutes |
| School config | 916–1,050 | School list with names, colors, sizes, logo loading |
| Shaders | 1,051–1,370 | GLSL burn shader, reveal shader, wick burn shader |
| Audio management | 1,316–1,441 | Fire crackling, fight song loading, explosion boom |
| Phase 1 logic | 1,443–2,300 | `startBurn()`, candle burning, confetti launch |
| Phase 2 logic | 2,300–2,888 | `enterPhase2()`, wick burn, explosion, celebration |
| Animation loop | 2,890–3,050 | Main `animate()` with delta time handling |
| Event handlers | (distributed) | Pointer events, window resize, audio controls |

## Key Systems

### Rendering Pipeline
- **WebGL renderer** with soft shadow mapping and ACES Filmic tone mapping
- **Lighting**: ambient + directional (warm) + fill (cool blue) + flame light (dynamic) + spotlight (Phase 2 reveal)
- **Fog**: exponential with density 0.008 for depth
- **Camera**: perspective with responsive FOV — 50 on phone, 36 on desktop — adjusted via `window.innerWidth / window.innerHeight`

### Shader System
Three custom `ShaderMaterial` instances:

1. **Burn Shader** — Applied to logo textures on cake top. Uses a `burnProgress` uniform (0→1) to discard fragments via noise-based threshold, creating a fire-edge burn effect.
2. **Reveal Shader** — Applied to celebration logos underneath. Uses `blurAmount` uniform to transition from blurred to sharp as the burn progresses (blur-to-focus reveal).
3. **Wick Burn Shader** — Applied to the TNT fuse. Uses `burnProgress` to change fuse color from dark to glowing orange at the burn front, with a spark spawn point.

### State Machine (Phase 2)
Phase 2 uses a linear state progression:

```
wickReady → wickBurning → slowMo → exploding → blackout → revealing → celebrating
```

Each state has its own timing and visual behavior in the animation loop.

### Audio System
- **Fire crackling**: Generated procedurally via Web Audio API oscillators and noise, multi-instance for layering
- **Fight songs**: Michigan loads from Internet Archive (public domain), Maryland from local `maryland-fight.mp3`
- **Explosion boom**: Generated via Web Audio API (low-frequency oscillator + noise burst)
- Audio context created on first user gesture to comply with autoplay policies

### Particle Systems
- **Confetti** (Phase 1 & 2): 400 box geometries with gravity, bounce, and wind. Reused across phases.
- **Sparks** (Phase 2 wick): Small emissive particles spawned at fuse burn front
- **Explosion debris** (Phase 2): Particles flying outward from blast center
- **Balloons** (Phase 2 celebration): Floating upward with wind sway, school-colored

### Logo Loading
- 12 school logos loaded as textures from `logos/` directory
- Canvas-based fallback: if image fails to load, renders school initials on colored background
- Michigan and Maryland are scaled larger (1.725x and 1.32x respectively) and positioned at 3 o'clock and 9 o'clock

## Deployment

- Hosted on **Netlify** (config in `.netlify/` directory)
- No build command needed — Netlify serves static files directly
- The `maryland-fight.mp3` and `logos/` directory are served as static assets alongside `index.html`

## Known Considerations

- **Single-file size**: At ~102KB, the file is large but manageable. A future refactor could split into modules, but the single-file approach keeps deployment trivial.
- **Delta time clamping**: `Math.min(deltaTime, 0.05)` prevents animation jumps when the tab loses focus and regains it with a large frame gap.
- **Mobile pixel ratio**: Capped at 2x (`Math.min(window.devicePixelRatio, 2)`) to prevent GPU overload on high-DPI mobile screens.
- **Audio fallbacks**: Fight songs load asynchronously and the app works without audio if loading fails (graceful degradation).

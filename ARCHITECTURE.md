# Architecture

## Overview

The app is now a small static web project with a thin HTML shell, shared CSS, and JavaScript modules. There is still no build step, but the runtime is easier to maintain because browser bootstrapping, shared UI behavior, and the Three.js experience are separated.

## Code Organization

| File | Purpose |
|------|---------|
| `index.html` | App shell, accessible controls, live regions, and browser fallback markup |
| `styles.css` | Shared layout, overlay styling, responsive control placement, reduced-motion CSS |
| `app/bootstrap.js` | Capability checks, safe startup, and fallback/error handling |
| `app/shared-ui.js` | Control binding, visible status banner, school picker, congrats layout helpers |
| `app/site-config.js` | Shared event copy, school metadata, and local asset references |
| `app/cake-experience.js` | Three.js scene graph, shaders, audio, animation loop, and phase state machine |
| `scripts/verify.mjs` | Publish-time validation for syntax, assets, and external runtime URLs |
| `vendor/three/` | Local Three.js runtime modules so production does not depend on third-party CDNs |

## Key Systems

### Boot Pipeline
- `bootstrap.js` initializes the accessible shell first.
- The browser is checked for WebGL support before the heavy experience module loads.
- If startup fails, the user gets a visible retryable fallback instead of dead controls.

### Rendering Pipeline
- **WebGL renderer** with soft shadow mapping and ACES Filmic tone mapping
- **Lighting**: ambient + directional (warm) + fill (cool blue) + flame light (dynamic) + spotlight (Phase 2 reveal)
- **Camera**: perspective with responsive FOV tuned for desktop and mobile aspect ratios
- **Reduced-motion mode** lowers particle counts and disables screen shake

### Interaction Model
- Pointer/touch input still drives the 3D scene directly.
- Primary actions are also exposed as regular HTML buttons so the experience remains easy to use on mobile web.
- School selection has both in-scene hit targets and an explicit button-based picker.
- Event-specific names, dates, logos, and fight-song assets come from `app/site-config.js` instead of being scattered across the shell and scene code.

### Audio System
- **Fire crackling**: Generated procedurally via Web Audio API oscillators and noise
- **Fight songs**: Served from local static assets (`michigan-fight.mp3`, `maryland-fight.mp3`)
- **Explosion boom**: Generated via Web Audio API
- Audio contexts are still created from user gestures to respect autoplay restrictions

## Deployment

- The app remains deployable as plain static files.
- Three.js is vendored locally, so deployment no longer depends on external CDNs being reachable at runtime.
- The experience degrades to an explicit fallback panel if browser support is missing.
- `netlify.toml` is versioned at the repo root and runs `npm run verify` before publish.

## Known Considerations

- `app/cake-experience.js` is still the largest file in the project and remains the next refactor target if the feature set expands further.
- The runtime is optimized for modern browsers with WebGL support; unsupported browsers now fail gracefully rather than silently.
- There is still no automated browser/device test suite, so final release confidence should come from manual checks on desktop and mobile hardware.

# CLAUDE.md

## Project Summary

Interactive 3D celebration cake for Tati's college decision. Single-file Three.js app (`index.html`) with two phases: cake burn reveal and TNT explosion celebration. Deployed on Netlify.

## Quick Reference

- **Source**: Everything is in `index.html` (~3,000 lines)
- **Assets**: `logos/` (12 school PNGs), `maryland-fight.mp3`
- **No build step**: Serve with any static file server
- **Three.js v0.163.0**: Loaded via CDN import map in `<script type="importmap">`

## Code Layout

The file follows this order: HTML/CSS → scene setup → cake geometry → school config → shaders → audio → Phase 1 logic → Phase 2 logic → animation loop → event handlers. See ARCHITECTURE.md for line ranges.

## Key Patterns

- **Shaders**: Three custom GLSL `ShaderMaterial` instances (burn, reveal, wick). Uniforms are updated in the animation loop.
- **State machine**: Phase 2 uses states: `wickReady → wickBurning → slowMo → exploding → blackout → revealing → celebrating`
- **Audio**: Web Audio API for procedural sounds (fire, explosion). Fight songs loaded as audio elements. Audio context initializes on first user gesture.
- **Responsive**: Camera FOV and position adapt based on aspect ratio. Mobile gets 50 FOV, desktop gets 36.

## Schools

Michigan and Maryland are the two selectable schools. Michigan uses an Endover Cube monument; Maryland uses a 3D "M". Each has unique colors, fight song, and cheer text. The other 10 schools are decorative logos on the cake sides.

## Common Tasks

- **Add/change a school logo**: Add PNG to `logos/`, update the `schools` array in the school config section
- **Adjust burn timing**: Modify `burnDuration` (currently ~8 seconds) in the Phase 1 logic
- **Change celebration text**: Update the congratulations overlay creation in `enterPhase2()`
- **Audio issues**: Fight song URLs and loading are in the audio management section. Michigan streams from Internet Archive; Maryland uses local file.

## Testing

Open in browser and click through both phases. Test on mobile viewport too — camera and layout adapt. Audio requires a click to initialize (browser autoplay policy).

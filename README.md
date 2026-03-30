# Claude Cake

An interactive 3D celebration web app built for Tati's college decision reveal. Features a decorated graduation cake that burns away to reveal school logos, followed by an explosive TNT celebration sequence with fight songs, confetti, and a spinning monument.

**Live site:** Deployed on Netlify

## How It Works

The experience has two phases:

### Phase 1: Cake Burning
- A 3D graduation cake displays 12 school logos on its surface
- Click the candle to light it — the flame progressively burns away the cake surface
- School logos are revealed underneath through a blur-to-focus shader effect
- 3D confetti launches as the burn completes
- Click either the **Michigan** or **Maryland** logo to choose a school and advance

### Phase 2: TNT Explosion & Celebration
- A TNT fuse ignites (auto-lights after 10 seconds if not clicked)
- Explosion with screen shake, flash, and boom sound effect
- Lights dim for a dramatic blackout
- A spinning monument rises (Michigan Endover Cube or Maryland 3D "M")
- School fight song plays with balloons and confetti in school colors
- Congratulations overlay appears with Tati's name

## Tech Stack

- **Three.js** (v0.163.0) — 3D rendering, lighting, materials, OrbitControls
- **Custom GLSL Shaders** — Progressive burn, blur-to-focus reveal, wick burn
- **Web Audio API** — Fire crackling, fight songs, explosion boom
- **Pure HTML/CSS/JS** — Single-file architecture, no build step
- **Netlify** — Hosting and deployment

## Project Structure

```
├── index.html              # Entire application (3,000+ lines)
├── maryland-fight.mp3       # Maryland fight song audio
├── logos/                   # School logo PNGs (12 schools)
│   ├── michigan.png
│   ├── maryland.png
│   ├── penn state.png
│   ├── rutgers.png
│   ├── uconn.png
│   ├── syracuse.png
│   ├── umass.png
│   ├── boston.png
│   ├── loyola.png
│   ├── delaware.png
│   ├── vermont.png
│   ├── hawaii.png
│   └── placeholder.png
├── .gitignore
└── .netlify/                # Netlify deployment config
```

## Running Locally

No build step required. Just serve the files:

```bash
# Any static file server works
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser. Audio requires a user gesture (click) to initialize.

## Schools Featured

| School | Position | Special |
|--------|----------|---------|
| Michigan | 3 o'clock (prominent) | Fight song, Endover Cube monument, blue/gold theme |
| Maryland | 9 o'clock (prominent) | Fight song, 3D "M" monument, red/gold theme |
| Penn State, Rutgers, UConn, Syracuse, UMass, Boston, Loyola, Delaware, Vermont, Hawaii | Around cake sides | Decorative logos |

## Browser Support

- Desktop Chrome, Firefox, Safari, Edge (WebGL required)
- Mobile Safari and Chrome (responsive camera, touch controls, safe-area-inset support)
- Pixel ratio capped at 2x for performance on high-DPI screens

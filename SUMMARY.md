# SGRail — Project Summary

## What This Is

SGRail is a full-stack Singapore MRT Companion web app. It lets commuters find nearby stations via GPS, plan routes with multiple preference modes, view crowd levels, report and browse community incidents, and chat with an MRT-focused AI assistant. The app works fully in demo mode — no API keys required.

---

## Architecture

```
┌───────────────────────────────────────────────────┐
│              React + TypeScript + Vite             │
│  (Map, Route, Community, AI, Profile pages)       │
│  State: Zustand + TanStack Query                  │
│  API calls: Axios → /api/v1/*                     │
└──────────────────────┬────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼────────────────────────────┐
│              Flask Backend (/api/v1)               │
│  Routes → Services → Integration Adapters         │
│  Data: SQLAlchemy + SQLite (dev) / PostgreSQL     │
│  Adapters: OneMap, LTA DataMall, AI Provider      │
│  Fallback: MockAdapter for every integration      │
└──────────────────────┬────────────────────────────┘
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
    OneMap API    LTA DataMall    AI Provider
   (optional)     (optional)     (optional)
```

The frontend never calls credentialed external APIs directly. All third-party requests are proxied through the Flask backend, which manages tokens and falls back to mock data on failure.

---

## Features Implemented

### 1. Map Page
- Interactive MRT system map (base image + SVG interaction overlay)
- Pinch/scroll zoom, pan, reset, keyboard navigation
- Click/tap station hit targets → opens info panel
- Station search by name or code with auto-centre
- Crowd heatmap toggle (green/yellow/orange/red glow markers)
- GPS-based nearest station detection with distance
- Journey tracking with transfer/alighting reminders
- Development-only calibration mode for adjusting station coordinates

### 2. Route Page
- Start/destination station selection (or "use my location")
- 6 route preferences: Fastest, Least Crowded, Fewest Transfers, Least Walking, Wheelchair Accessible, Last-Train Safe
- Avoid specific stations or lines
- Step-by-step instructions with line-colour indicators
- Last-train warnings per station/direction/line/day-type
- Alternative route suggestions
- Saved routes for quick access

### 3. Community Page
- Incident feed with filters (station, line, category, recency)
- 9 incident categories (delay, overcrowding, lift/escalator breakdown, etc.)
- Submit reports with optional photo and anonymous mode
- Like, dislike, confirm, resolve, report-abusive actions
- Duplicate interaction prevention (409 on repeated actions)
- Reporter reliability score and badges (Regular → Trusted Commuter → Super Reporter)

### 4. AI Assistant Page
- Chat interface with suggestion chips
- 8 recognised intents: Route, Last Train, Crowd, Transfer, Accessibility, Facility, Incident, Out-of-Scope
- Structured UI actions: highlight stations/routes on map, open panels
- Rule-based fallback (works without any AI API key)
- Optional LLM routing (OpenAI / Gemini / Anthropic) when configured

### 5. Profile Page
- Reliability score and badge display
- Report/confirm counts and recent activity
- Saved routes management
- Accessibility settings (text scale, high contrast, colour-blind labels, reduced motion)
- Language selector (English, 中文, Bahasa Melayu, தமிழ்)
- Privacy controls for location tracking

---

## Tech Stack

### Frontend
| Library | Version |
|---------|---------|
| React | 18.3 |
| TypeScript | ~5.5 |
| Vite | 6.3 |
| Tailwind CSS | 4.1 |
| Zustand | ~4.5 |
| TanStack Query | ~5.51 |
| React Router | ~6.23 |
| react-zoom-pan-pinch | ~3.6 |
| i18next | ~23.11 |
| Zod | ~3.23 |
| Radix UI | various |
| Vitest + fast-check | ~4.1 / ~3.19 |

### Backend
| Library | Version |
|---------|---------|
| Python | 3.11+ |
| Flask | ≥3.0 |
| Flask-SQLAlchemy | ≥3.1 |
| SQLAlchemy | ≥2.0 |
| Marshmallow | ≥3.20 |
| Flask-CORS | ≥4.0 |
| Flask-Limiter | ≥3.5 |
| Pillow | ≥10.0 |
| Pytest + Hypothesis | ≥7.4 / ≥6.0 |

---

## Mock vs Live

| Feature | Currently | With API Key |
|---------|-----------|--------------|
| Station data | Local JSON seed | Same (static reference data) |
| Arrivals/timings | Mock (labelled "Demo") | Could use LTA real-time feeds |
| Crowd levels | Simulated + community | LTA passenger volume data |
| Walking routes | Straight-line estimate | OneMap real walking directions |
| Service alerts | Mock alerts | LTA DataMall live alerts |
| AI responses | Rule-based intent matching | OpenAI/Gemini/Anthropic LLM |
| Geocoding | Haversine nearest station | OneMap search + reverse geocode |

All mock data is labelled with its source ("Demo", "Estimated", "Simulated") — the app never claims mock data is "Live".

---

## Design Decisions and Trade-offs

### SVG Overlay Approach
The map uses a static MRT diagram image with a transparent SVG layer on top for interaction. This avoids the complexity of rendering vector map tiles while preserving familiar map visuals. Trade-off: station positions must be manually calibrated to the image coordinates.

### Dijkstra Route Engine
Graph nodes are `(station_id, line_code)` tuples — each platform at an interchange is a separate node. Edge weights are computed dynamically based on the selected preference (crowd penalty, transfer penalty, etc.). This supports all 6 route modes without multiple algorithms.

### Rule-Based AI Fallback
The AI assistant works without any API key using keyword-based intent classification and templated responses drawn from actual station/timing data. This ensures the demo is always functional. When an LLM is configured, the backend routes to it instead.

### Moderation Pipeline (Backend-Only)
All content moderation (profanity, spam, duplicates, injection, image validation) runs server-side. Frontend validation is supplementary only — the backend is the single source of truth for acceptance.

### Privacy-First GPS
No raw location history is stored. Journey tracking combines GPS with route order, elapsed time, and user confirmation signals — important for underground MRT segments where GPS is unreliable.

---

## How to Extend

### Add New Stations
1. Add station entries to `frontend/src/data/stations.ts` (x, y, lat, lng, codes, lines)
2. Add matching entries to `backend/app/data/stations.json`
3. Add edges to `backend/app/data/graph.json` connecting to adjacent stations
4. Add train timings to `backend/app/data/timings.json`
5. Re-seed the backend database

### Add New MRT Lines
1. Add all stations for the new line in both frontend and backend data files
2. Add line colour constant in the frontend route display components
3. Add graph edges for the entire line (RIDE edges + TRANSFER edges at interchanges)
4. Add first/last train timings per station per direction

### Add New Integration Providers
1. Create a new client in `backend/app/integrations/` implementing the relevant Protocol (CrowdProvider, LocationProvider, RailDataProvider, or AIProvider)
2. Register it in the factory function (`get_crowd_provider()`, etc.) with an env var toggle
3. The mock fallback remains in place — your new provider just wraps with try/except

---

## What API Keys Would Improve

| Key | Env Variable | Improvement |
|-----|-------------|-------------|
| OneMap | `ONEMAP_EMAIL` + `ONEMAP_PASSWORD` | Real walking routes, address search, barrier-free routing |
| LTA DataMall | `LTA_ACCOUNT_KEY` | Live service alerts, real passenger volume, official station data |
| AI Provider | `AI_API_KEY` + `AI_PROVIDER` | Smarter conversational responses, better intent understanding |

All are optional. The app runs fully without any of them.

---

## Testing Coverage

### Frontend (Vitest + fast-check)
- **Property-based tests** (9 files):
  - Station dataset integrity (coordinates, interchange consistency, hit radius)
  - Map transform clamping (viewport overlap guarantee)
  - Station search correctness (name/code matching)
  - Haversine distance (non-negative, sorted nearest stations)
  - Journey confidence model (bounded 0.0–1.0 output)
  - Journey proximity reminders (transfer/alighting triggers)
  - Data source honesty (non-official → never labelled "Live")
  - i18n fallback (missing key → English, never undefined)
  - Incident category validity (all categories in allowed set)
- **Unit tests** (component tests covering selection, search, GPS states, responsive layout)

### Backend (Pytest + Hypothesis)
- **Property-based tests** (11 files):
  - Route preference influence (FEWEST_TRANSFERS ≤ FASTEST transfers)
  - Last-train validation (per-station, per-direction, per-day-type)
  - Crowd reading validity, anti-spam, aggregation
  - Moderation pipeline (fields, text, images)
  - Duplicate interaction prevention
  - Reliability scoring (bounded, badge thresholds, likes-only rule)
  - AI intent handling and response format
  - Mock schema conformance
- **Integration tests** (end-to-end incident flow, adapter fallback, rate limiting, CORS)
- **Station endpoint tests** (health, station list, nearby, 404 handling)

---

## Known Limitations

1. **MRT map image is a placeholder** — needs replacement with an official or custom-drawn system map for production use. Include an `attribution.txt` for any licensed image.

2. **Station coordinates need calibration** — the x/y viewBox positions are approximate. Use the built-in calibration mode (`npm run dev`, click the calibration toggle) to drag stations to their correct positions on your actual map image.

3. **Underground GPS is unreliable** — the journey tracker uses confidence scoring and route-order heuristics, but underground segments will always have location uncertainty. The app shows this honestly.

4. **Some TypeScript test type issues** — a few property tests may show TS type warnings related to fast-check generator inference. These don't affect runtime correctness.

5. **Single-user demo mode** — user identity is simplified (no real auth). For production, add proper authentication (OAuth/JWT) and connect the user model.

6. **Train timings are static** — first/last train times come from seeded JSON, not a live feed. They reflect typical schedules but don't account for special service days.

7. **Fare calculation is estimated** — the route engine uses a simple distance-based formula, not the actual EZ-Link fare table.

---

## Quick Start

```bash
# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev          # → http://localhost:5173

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
python run.py        # → http://localhost:5000

# Run tests
cd frontend && npm test
cd backend && pytest
```

See the root `README.md` for full setup instructions including HTTPS for GPS, environment variables, and production deployment.

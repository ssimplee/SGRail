# SGRail — Singapore MRT Companion

A full-stack Singapore MRT Companion web application that helps commuters locate nearby stations, navigate the MRT system map, plan customised journeys, check train timings and crowd levels, report incidents, and get MRT-focused AI guidance.

Built with a **React + TypeScript + Vite** frontend and a **Python Flask** REST backend.

---

## Features

- **Interactive MRT Map** — Zoomable/pannable map with SVG overlay for station selection, crowd markers, and route highlights
- **GPS Nearest Station** — Detect current location and find the closest MRT stations with walking distance
- **Journey Tracking** — Real-time progress tracking along a route with transfer and alighting reminders
- **Multi-Preference Route Planning** — Dijkstra-based engine supporting fastest, least crowded, fewest transfers, least walking, wheelchair-accessible, and last-train-safe modes
- **Crowd Heatmap** — Colour-coded station crowd levels from official, historical, and community sources
- **Community Incident Reporting** — Report and interact with MRT incidents; moderation pipeline filters spam and abuse
- **Reporter Reliability Scoring** — Trust badges based on reporting history
- **AI Assistant** — MRT-focused chat with grounded responses and UI actions (rule-based fallback when no AI key is configured)
- **Multi-Language** — English, 中文, Bahasa Melayu, தமிழ்
- **Accessibility** — Keyboard navigation, screen-reader labels, high-contrast mode, colour-blind labels, scalable text
- **Responsive Layout** — Mobile-first bottom-sheet UI; side-panel layout on desktop

---

## Architecture Summary

```
Browser (React + Vite)
  └── API Client (Axios) ──► Flask Backend (/api/v1)
                                  ├── Services (Route Engine, Crowd, Incidents, AI, etc.)
                                  ├── Integrations (OneMap, LTA DataMall, AI Provider)
                                  ├── Mock Adapter (demo fallback for all providers)
                                  └── Data Layer (SQLAlchemy + SQLite)
```

External APIs are never called directly from the frontend. The backend wraps each integration behind a provider interface with automatic mock fallback so the app is fully functional without any API keys.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Frontend toolchain |
| npm | 9+ | Comes with Node.js |
| Python | 3.11+ | Backend runtime |
| pip | Latest | Python package manager |
| Git | 2.x | Version control |

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd SGRail
```

---

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start the development server
npm run dev
```

The frontend dev server runs at **http://localhost:5173**.

### Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:5000/api/v1` | Base URL for the Flask backend API |
| `VITE_ENABLE_MOCK_FALLBACK` | `true` | Enable client-side mock data fallback when backend is unavailable |

---

## Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Seed the database with station data
python seed.py

# Run the development server
python run.py
```

The backend server runs at **http://localhost:5000**.
API base: **http://localhost:5000/api/v1**

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | Flask environment mode |
| `SECRET_KEY` | *(replace)* | Flask secret key for sessions — generate a random value |
| `DATABASE_URL` | `sqlite:///mrt_app.db` | Database connection string |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for the frontend |
| `DATA_PROVIDER` | `mock` | Data provider mode: `mock` or `live` |
| `ONEMAP_EMAIL` | *(empty)* | OneMap API registered email |
| `ONEMAP_PASSWORD` | *(empty)* | OneMap API password |
| `LTA_ACCOUNT_KEY` | *(empty)* | LTA DataMall API account key |
| `AI_PROVIDER` | `rule_based` | AI provider: `rule_based`, `openai`, `gemini`, `anthropic`, or `groq` |
| `AI_API_KEY` | *(empty)* | API key for the configured AI provider |
| `UPLOAD_PROVIDER` | `local` | File upload destination: `local` |
| `UPLOAD_MAX_MB` | `5` | Maximum upload file size in MB |
| `RATE_LIMIT_INCIDENTS` | `10/hour` | Rate limit for incident submission |
| `RATE_LIMIT_AI` | `30/hour` | Rate limit for AI chat requests |
| `AI_DAILY_CALL_CAP` | `1500` | Max paid LLM calls per day before falling back to the free rule-based assistant |
| `AI_CACHE_TTL_SECONDS` | `900` | How long a cached LLM response is reused for an identical message |

---

## Mock Mode

By default, the backend runs with `DATA_PROVIDER=mock`. In this mode:

- All external API calls (OneMap, LTA DataMall, AI) return realistic demo data from the Mock Adapter
- No API keys or internet connection are required
- The app is fully functional for development, demos, and testing
- Data is labelled as "Demo" or "Estimated" in the UI so users know it's not live

To switch to live external APIs, set `DATA_PROVIDER=live` and provide the relevant API credentials.

If a live provider fails at runtime, the system automatically falls back to mock data with a visible indicator rather than crashing.

---

## External API Setup

### OneMap (Location, Search, Walking Routes)

1. Register for a free account at [https://www.onemap.gov.sg](https://www.onemap.gov.sg)
2. Set `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` in `.env`
3. Token management is handled automatically by the backend

### LTA DataMall (Service Alerts, Passenger Volume)

1. Request an API key at [https://datamall.lta.gov.sg](https://datamall.lta.gov.sg)
2. Set `LTA_ACCOUNT_KEY` in `.env`

### AI Provider (Optional)

1. Obtain an API key from OpenAI, Google Gemini, Anthropic, or Groq (Groq
   offers a free tier for open-weight models — see [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   or [console.groq.com/keys](https://console.groq.com/keys))
2. Set `AI_PROVIDER` to `openai`, `gemini`, `anthropic`, or `groq`
3. Set `AI_API_KEY` to your key

Without an AI key, the assistant uses a built-in rule-based engine that handles common intents (routes, last trains, crowd, transfers, accessibility, facilities, incidents).

---

## Running Tests

### Frontend

```bash
cd frontend
npm test
```

Uses Vitest as the test runner.

### Backend

```bash
cd backend

# Activate venv first
pytest
```

---

## Production Build

```bash
cd frontend
npm run build
```

The production bundle is output to `frontend/dist/`. Serve it with any static file host and point it to the backend API.

---

## GPS HTTPS Requirement

The Browser Geolocation API (`navigator.geolocation`) requires a **secure context** (HTTPS) in deployed environments. This means:

- **localhost** works without HTTPS during development
- **Deployed environments** must serve the frontend over HTTPS for GPS features (nearest station, journey tracking) to function
- If the site is served over plain HTTP in production, the browser will block geolocation requests silently

Ensure your production deployment uses HTTPS (e.g., via a reverse proxy with TLS, or a hosting platform that provides it automatically).

---

## MRT Map Asset & Attribution

The MRT map image is stored locally in `frontend/public/mrt/`. The application does **not** hotlink external map images.

- Replace `singapore-mrt-map.webp` with your own MRT map asset
- Update `frontend/public/mrt/attribution.txt` with the appropriate licence or attribution for the map image you use
- Ensure the image is optimised for web delivery (WebP recommended, compressed)
- The SVG overlay coordinates in the Station Coordinate Dataset are calibrated to the specific map image — if you replace the map, you must recalibrate

---

## Overlay Coordinate Calibration

The SVG interaction overlay uses a viewBox coordinate system (0–1600 × 0–1000) mapped to the base MRT map image. When the map image changes, station hit areas need recalibration.

### Dev-Only Calibration Mode

A calibration tool is available in development builds (`src/components/map/CalibrationMode.tsx`). To use it:

1. Start the frontend dev server (`npm run dev`)
2. Enable calibration mode via the dev tools or a feature flag
3. Click on station positions on the map to record new (x, y) coordinates
4. Export the updated coordinate dataset
5. Replace the station coordinate data in `src/data/stations.ts`

This tool is excluded from production builds.

---

## Troubleshooting

### CORS Errors

**Symptom:** Browser console shows `Access-Control-Allow-Origin` errors.

**Fix:**
- Ensure the backend is running on port 5000
- Check that `FRONTEND_ORIGIN` in the backend `.env` matches your frontend URL exactly (default: `http://localhost:5173`)
- Do not include a trailing slash in the origin URL

### Port Conflicts

**Symptom:** "Port already in use" when starting the dev server.

**Fix:**
- Frontend: Vite will auto-increment the port (5174, 5175, etc.) — update `VITE_API_BASE_URL` if you change the backend port
- Backend: Kill the existing process on port 5000, or change the port in `run.py` and update `FRONTEND_ORIGIN` accordingly

### GPS Not Working

**Symptom:** Location features don't work in deployed environments.

**Fix:**
- Ensure the frontend is served over **HTTPS** (required for Geolocation API outside localhost)
- Check browser permissions — the user must explicitly grant location access
- On mobile, ensure location services are enabled at the OS level
- Underground/indoor locations may have degraded GPS accuracy — the app falls back to route-based estimation

### Build Failures

**Symptom:** `npm run build` fails with TypeScript errors.

**Fix:**
- Run `npm install` to ensure all dependencies are up to date
- Check for TypeScript errors with `npx tsc --noEmit`
- Ensure your Node.js version is 20+

### Backend Won't Start

**Symptom:** `python run.py` throws import errors.

**Fix:**
- Ensure the virtual environment is activated
- Run `pip install -r requirements.txt` again
- Check your Python version is 3.11+

---

## Ports Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend (Vite dev) | http://localhost:5173 | React development server with HMR |
| Backend (Flask) | http://localhost:5000 | REST API server |
| API Base | http://localhost:5000/api/v1 | All API endpoints are prefixed here |

---

## License

See individual asset attribution files for third-party resources.

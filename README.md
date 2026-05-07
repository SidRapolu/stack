# Stack — System Design Studio

Canvas-based architecture tool where LLM inference runs continuously against system topology — detecting conflicts, predicting structural gaps, and modeling failure cascades without interrupting the design process.

## Setup

### Prerequisites
```bash
brew install go        # Go 1.22+
brew install node      # Node 18+ (likely already installed)
brew install awscli    # for infra later
```

### 1. Clone and install frontend
```bash
cd client
npm install
```

### 2. Set up server env
```bash
cd server
cp .env.example .env
# add your ANTHROPIC_API_KEY to .env
```

### 3. Run (two terminals)

**Terminal 1 — Go server**
```bash
cd server
go run ./cmd/api
```

**Terminal 2 — Vite dev server**
```bash
cd client
npm run dev
```

App runs at `http://localhost:5173`  
API runs at `http://localhost:8080`  
Vite proxies `/api/*` → Go server automatically.

## Project Structure

```
stack/
├── client/                  # React + TypeScript + React Flow
│   └── src/
│       ├── components/
│       │   ├── canvas/      # React Flow canvas, nodes, edges
│       │   ├── ai/          # AI panel, signal indicators
│       │   └── ui/          # sidebar, topbar, shared
│       ├── store/           # Zustand global state
│       ├── hooks/           # custom React hooks
│       ├── lib/
│       │   ├── ai.ts        # signal bus — all AI inference
│       │   └── services.ts  # service block definitions
│       └── types/           # shared TypeScript types
└── server/                  # Go API
    ├── cmd/api/             # entry point
    └── internal/
        ├── handlers/        # HTTP handlers
        ├── models/          # DB models (coming)
        └── db/              # DB connection (coming)
```

## Architecture

The AI layer works as a **signal bus** — every canvas action fires async inference that normalizes into typed `AISignal` objects before touching the UI. Signal types: `suggestion`, `completion`, `conflict`, `failure_mode`, `pattern`, `cost_shape`.

The Go server proxies all Anthropic API calls so the key never lives in the client.

# Stack

Canvas-based architecture tool where LLM inference runs continuously against system topology — detecting conflicts, predicting structural gaps, and modeling failure potential without interrupting the design process.

## Setup

### Prerequisites

```bash
brew install go        # Go 1.22+
brew install node      # Node 18+
brew install awscli
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

## Architecture

The AI layer works as a **signal bus** — every canvas action fires async inference that normalizes into typed `AISignal` objects before touching the UI. Signal types: `suggestion`, `completion`, `conflict`, `failure_mode`, `pattern`, `cost_shape`.

The Go server proxies all Anthropic API calls so the key never lives in the client.

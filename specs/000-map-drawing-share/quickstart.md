# Quickstart: 地図お絵かき共有サービス

## Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Cloudflare account (for D1/R2/Workers)
- Wrangler CLI (`npm install -g wrangler`)

## Project Setup

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd oekaki-map

# Install dependencies
pnpm install
```

### 2. Cloudflare Setup

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create oekaki-map-db
# Copy the database_id to wrangler.toml

# Create R2 bucket
wrangler r2 bucket create oekaki-map-tiles

# Apply database migrations
wrangler d1 execute oekaki-map-db --file=./backend/src/db/schema.sql
```

### 3. Local Development

```bash
# Start backend (Cloudflare Workers dev server)
cd backend
pnpm dev
# API available at http://localhost:8787

# Start frontend (Vite dev server) - in another terminal
cd frontend
pnpm dev
# App available at http://localhost:5173
```

## Project Structure

```
oekaki-map/
├── frontend/           # React + Vite frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── hooks/      # React hooks
│   │   └── services/   # API client
│   └── package.json
├── backend/            # Hono API on Cloudflare Workers
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # Business logic
│   │   └── db/         # D1 schema
│   ├── wrangler.toml   # Cloudflare config
│   └── package.json
├── tests/              # Shared test directory
└── specs/              # Feature specifications
```

## Key Commands

| Command | Location | Description |
|---------|----------|-------------|
| `pnpm dev` | frontend/ | Start Vite dev server |
| `pnpm dev` | backend/ | Start Workers dev server |
| `pnpm build` | frontend/ | Build for production |
| `pnpm deploy` | backend/ | Deploy to Cloudflare |
| `pnpm test` | root | Run all tests |
| `pnpm test:unit` | root | Run unit tests only |
| `pnpm test:e2e` | root | Run E2E tests |

## Configuration

### Backend (wrangler.toml)

```toml
name = "oekaki-map-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "oekaki-map-db"
database_id = "<your-database-id>"

[[r2_buckets]]
binding = "TILES"
bucket_name = "oekaki-map-tiles"
```

### Frontend Environment

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8787
```

```bash
# frontend/.env.production
VITE_API_URL=https://api.oekaki-map.example.com
```

## Development Workflow

### 1. Create a New Feature

```bash
# Create feature branch
git checkout -b feature/your-feature

# Write tests first (TDD per constitution)
pnpm test:watch
```

### 2. Run Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests (requires backend running)
pnpm test:integration

# E2E tests (requires both frontend and backend)
pnpm test:e2e
```

### 3. Deploy

```bash
# Deploy backend
cd backend && pnpm deploy

# Deploy frontend (Cloudflare Pages)
cd frontend && pnpm build
# Then deploy via Cloudflare Pages dashboard or CLI
```

## API Usage Examples

### Create Canvas

```bash
curl -X POST http://localhost:8787/canvas \
  -H "Content-Type: application/json" \
  -d '{"centerLat": 35.6812, "centerLng": 139.7671, "zoom": 14}'
```

### Get Canvas

```bash
curl http://localhost:8787/canvas/V1StGXR8_Z5jdHi6B-myT
```

### Get Tile Image

```bash
curl http://localhost:8787/tiles/V1StGXR8_Z5jdHi6B-myT/14/14354/6451.webp \
  --output tile.webp
```

## Troubleshooting

### Common Issues

1. **D1 database not found**
   - Ensure database_id in wrangler.toml matches created database
   - Run `wrangler d1 list` to verify

2. **R2 bucket access denied**
   - Check bucket exists: `wrangler r2 bucket list`
   - Verify binding name in wrangler.toml

3. **CORS errors in development**
   - Backend includes CORS headers for localhost:5173
   - Check browser console for specific origin issues

4. **Map tiles not loading**
   - Verify OpenStreetMap tile server is accessible
   - Check network tab for blocked requests

## Next Steps

After setup:
1. Run `/speckit.tasks` to generate implementation tasks
2. Follow TDD workflow: write failing tests → implement → refactor
3. Use `pnpm test:watch` during development

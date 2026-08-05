# joseo_save

A small full-stack app for saving links and notes.

- **Client** — Vite + React + TypeScript (`client/`), served on port `5173`.
- **Server** — Express JSON API with file-backed persistence (`server/`), served on port `3001`.

The two packages are managed with npm workspaces.

## Prerequisites

- Node.js 20+ (developed on Node 22) and npm 10+.

## Getting started

```bash
npm install     # install all workspace dependencies
npm run dev     # run the API (3001) and web client (5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` to the
Express server on port `3001`.

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API + web client together. |
| `npm run dev:api` | Run only the Express API (port 3001). |
| `npm run dev:web` | Run only the Vite web client (port 5173). |
| `npm test` | Run the server API tests (`node --test`). |
| `npm run lint` | Type-check the client and syntax-check the server. |
| `npm run build` | Type-check and build the client for production. |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. |
| `GET` | `/api/items` | List saved items (newest first). |
| `POST` | `/api/items` | Create an item (`{ "title": string, "url"?: string }`). |
| `DELETE` | `/api/items/:id` | Delete an item. |

Saved items are persisted to `server/data/items.json` (gitignored).

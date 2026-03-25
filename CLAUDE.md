# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode (nodemon auto-reload)
npm start            # Production mode (node server.js)
```

No test framework or linter is configured.

## Environment Configuration

Copy `.env.example` to `.env` and fill in values. `dotenv` is loaded in `server.js` before config is read. For Vercel, set env vars via the Vercel dashboard.

- `DIFY_API_KEY` — Required for Dify API
- `DIFY_API_BASE_URL` — Defaults to `https://api.dify.ai/v1`
- `PORT` — Server port (default: 3000)

## Architecture

Node.js/Express chat application that proxies requests to the Dify API with a Claude-style UI. The entire frontend is vanilla JS (no framework, no build step).

### Dual Deployment: Traditional vs Vercel

**Traditional** (`server.js`): Monolithic Express server using CommonJS (`require`) and `axios` for HTTP requests to Dify. Serves static files from `public/`.

**Vercel** (`api/` directory): Separate serverless function handlers using ES modules (`import`) and native `fetch`. Each endpoint is its own file mirroring the Vercel file-based routing convention (`api/chat-messages/[taskId]/stop.js` for dynamic routes).

`config.js` uses both `export default` and `module.exports` to support both module systems.

`index.js` is a minimal Express SPA router used as Vercel's entry point for non-API routes.

### API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming chat via SSE (proxies Dify `/chat-messages`) |
| `/api/files/upload` | POST | Image upload (10MB limit; png/jpg/jpeg/webp/gif) |
| `/api/conversations` | GET | List conversations |
| `/api/conversations/:id` | DELETE | Delete conversation |
| `/api/messages` | GET | Message history for a conversation |
| `/api/chat-messages/:taskId/stop` | POST | Stop an ongoing response |

### Frontend (`public/`)

- `app.js` — All client logic: state management (`appState` object), SSE stream parsing, conversation sidebar, file upload, mobile responsive sidebar toggle
- `index.html` — SPA shell, loads `marked` from CDN for Markdown rendering
- `styles.css` — Claude-style UI

State is client-side only. User ID is `'user-' + Date.now()` generated on page load — no persistence across sessions.

### Key Patterns

- **SSE streaming**: Backend pipes Dify's streaming response directly to the client. Frontend reads with `ReadableStream` API, parses `data:` lines, and incrementally renders Markdown via `marked.parse()`.
- **Conversation lifecycle**: First message creates a conversation (Dify assigns `conversation_id`). Sidebar history is populated on load via `/api/conversations` and synced from server.
- **File upload divergence**: `server.js` uses `multer` + `form-data` to proxy uploads to Dify. The Vercel `api/files/upload.js` has a simplified mock — production Vercel deployment would need external storage.


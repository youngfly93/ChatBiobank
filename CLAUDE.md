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

- `MOONSHOT_API_KEY` — Required for Kimi K2.5 API
- `MOONSHOT_API_BASE_URL` — Defaults to `https://api.moonshot.cn/v1`
- `MOONSHOT_MODEL` — Defaults to `kimi-k2.5`
- `PORT` — Server port (default: 3000)

## Architecture

Node.js/Express chat application powered by Kimi K2.5 with built-in RAG (Retrieval-Augmented Generation) over the 3M Framework knowledge base. The entire frontend is vanilla JS (no framework, no build step).

### Dual Deployment: Traditional vs Vercel

**Traditional** (`server.js`): Monolithic Express server using CommonJS (`require`). Uses `curl` subprocess for Kimi API streaming (to bypass WSL2 DNS issues). RAG engine in `lib/rag.js` reads HTML files from `public/3m/` and builds a knowledge base. Conversation history stored in-memory via `lib/conversations.js`.

**Vercel** (`api/` directory): Separate serverless function handlers using CommonJS (`module.exports`) and native `fetch`. Each endpoint is its own file following Vercel's file-based routing convention. `api/chat.js` has its own embedded RAG logic (reads `public/3m/*.html` at runtime). Conversations are stateless (no server-side history).

`vercel.json` configures `rewrites` for SPA fallback and `includeFiles` to bundle `public/3m/**` into the chat serverless function.

### API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat` | POST | Streaming chat via SSE (calls Kimi K2.5 `/chat/completions`) |
| `/api/files/upload` | POST | Image upload (mock in Vercel) |
| `/api/conversations` | GET | List conversations |
| `/api/conversations/:id` | DELETE | Delete conversation |
| `/api/messages` | GET | Message history for a conversation |
| `/api/chat-messages/:taskId/stop` | POST | Stop an ongoing response |

### Frontend (`public/`)

- `app.js` — All client logic: state management (`appState` object), SSE stream parsing, conversation sidebar, file upload, mobile responsive sidebar toggle
- `index.html` — SPA shell, loads `marked` from CDN for Markdown rendering
- `styles.css` — Claude-style UI
- `3m/*.html` — 3M Framework knowledge base pages (also served as static browsable content)

State is client-side only. User ID is `'user-' + Date.now()` generated on page load — no persistence across sessions.

### Key Patterns

- **SSE streaming**: Backend calls Kimi K2.5 API with `stream: true`, parses OpenAI-compatible SSE chunks, and re-emits them in Dify-compatible format for the frontend. Frontend reads with `ReadableStream` API and incrementally renders Markdown via `marked.parse()`.
- **RAG**: On startup (traditional) or first request (Vercel), all `public/3m/*.html` files are parsed with `cheerio`, converted to structured Markdown with source links, and injected into the system prompt as a complete knowledge base.
- **Conversation lifecycle**: First message creates a conversation. Sidebar history is populated on load via `/api/conversations` and synced from server.

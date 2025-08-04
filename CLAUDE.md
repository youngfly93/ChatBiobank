# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
- **Development mode**: `npm run dev` (uses nodemon for auto-reload)
- **Production mode**: `npm start` (starts server.js directly)
- **Install dependencies**: `npm install`

### Environment Configuration
- Configure API key in `config.js` or set `DIFY_API_KEY` environment variable
- Server runs on port 3000 by default (configurable via `PORT` env var)

## Architecture Overview

This is a Node.js/Express AI chat application that proxies requests to the Dify API with a Claude-style UI.

### Key Components

**Backend Architecture:**
- `server.js` - Main Express server with all API routes (monolithic structure)
- `api/` directory - Contains Vercel serverless function versions of endpoints
- `config.js` - Centralized configuration with environment variable support

**API Endpoints Structure:**
- `/api/chat` - Streaming chat messages via Server-Sent Events (SSE)
- `/api/files/upload` - File upload with 10MB limit (images only)
- `/api/conversations` - CRUD operations for conversation management
- `/api/messages` - Message history retrieval
- `/api/chat-messages/:taskId/stop` - Stop ongoing chat responses

**Frontend:**
- `public/` - Static files served by Express
- `public/app.js` - Vanilla JavaScript client with state management
- `public/index.html` - Single-page application
- `public/styles.css` - Claude-style UI styling

### Dual Deployment Architecture

The project supports both traditional Node.js hosting and Vercel serverless deployment:

- **Traditional**: Uses `server.js` as monolithic Express server
- **Vercel**: Uses separate API route handlers in `api/` directory
- Vercel configuration in `vercel.json` sets function timeouts

### Key Technical Details

**Streaming Implementation:**
- Uses Server-Sent Events (SSE) for real-time chat streaming
- Proxies streaming responses from Dify API directly to client
- Error handling includes stream error recovery

**File Upload System:**
- Server.js uses multer with memory storage for traditional deployment
- Vercel version has simplified mock implementation (production would need external storage)
- Supports png, jpg, jpeg, webp, gif formats

**State Management:**
- Frontend uses simple object-based state management
- Conversation history stored client-side
- User identification via timestamp-based IDs

### Configuration Management

Environment variables are read with fallbacks:
- `DIFY_API_KEY` - Required for Dify API integration
- `DIFY_API_BASE_URL` - Defaults to https://api.dify.ai/v1
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Controls server startup behavior

### Important Notes

- No test framework currently implemented
- Chinese language comments and documentation throughout
- File upload functionality differs between server.js and Vercel implementations
- SPA routing handled via catch-all route serving index.html
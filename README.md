# Karakeep Semantic Search

> 🔍 Add powerful semantic/vector search to your [Karakeep](https://github.com/karakeep-app/karakeep) bookmarks

Karakeep is great for hoarding bookmarks, but its search is keyword-based. This sidecar service adds **semantic search** - find bookmarks by meaning, not just exact words.

## What it does

- **Semantic search**: Find "that article about getting things done" even if it never mentions those exact words
- **Vector embeddings**: Converts your bookmark content into searchable vectors
- **Auto-sync**: Watches Karakeep for new bookmarks and indexes them automatically
- **Simple API**: Query via REST or integrate with tools like Clawdis

## Quick Start

```bash
# Clone the repo
git clone https://github.com/jamesbrooksco/karakeep-semantic-search.git
cd karakeep-semantic-search

# Copy the example env file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start everything
docker compose up -d
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KARAKEEP_URL` | Yes | - | Your Karakeep instance URL (e.g., `http://karakeep:3000`) |
| `KARAKEEP_API_KEY` | Yes | - | API key from Karakeep settings |
| `OPENAI_API_KEY` | Yes* | - | OpenAI API key for embeddings |
| `OLLAMA_URL` | No | - | Ollama URL if using local embeddings instead |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Model for generating embeddings |
| `SYNC_INTERVAL_MINUTES` | No | `5` | How often to check for new bookmarks |
| `QDRANT_URL` | No | `http://qdrant:6333` | Qdrant vector DB URL |

*Either `OPENAI_API_KEY` or `OLLAMA_URL` is required.

## API

### Search bookmarks
```bash
GET /search?q=productivity+techniques&limit=10
```

Response:
```json
{
  "results": [
    {
      "bookmarkId": "abc123",
      "score": 0.89,
      "title": "The GTD Method Explained",
      "url": "https://example.com/gtd"
    }
  ],
  "query": "productivity techniques",
  "took_ms": 45
}
```

### Trigger sync
```bash
POST /sync
```

### Health check
```bash
GET /health
```

## Architecture

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐
│  Karakeep   │────▶│  Semantic Search    │────▶│   Qdrant    │
│             │     │     (this app)      │     │ (vector DB) │
└─────────────┘     └─────────────────────┘     └─────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ OpenAI / Ollama │
                    │  (embeddings)   │
                    └─────────────────┘
```

## Adding to Unraid / Docker

**Single container** - Qdrant is bundled inside, no separate database needed!

```yaml
services:
  karakeep-semantic:
    image: ghcr.io/jamesbrooksco/karakeep-semantic-search:latest
    environment:
      - KARAKEEP_URL=http://your-karakeep-ip:3000
      - KARAKEEP_API_KEY=your-api-key
      - OPENAI_API_KEY=sk-your-key
    ports:
      - "3001:3000"
    volumes:
      - karakeep_semantic_data:/qdrant/storage

volumes:
  karakeep_semantic_data:
```

### Unraid Setup

1. Add container from Docker Hub / ghcr.io
2. **Repository:** `ghcr.io/jamesbrooksco/karakeep-semantic-search:latest`
3. **Port:** 3001 → 3000
4. **Path:** `/qdrant/storage` → `/mnt/user/appdata/karakeep-semantic`
5. **Variables:**
   - `KARAKEEP_URL` = your Karakeep URL
   - `KARAKEEP_API_KEY` = from Karakeep settings
   - `OPENAI_API_KEY` = your OpenAI key

## Local Development

```bash
# Install dependencies
pnpm install

# Run in dev mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

## Clawdis Integration

A ready-to-use skill is included in the [`skill/`](./skill/) folder. Copy `skill/SKILL.md` to your Clawdis skills directory and update the URL.

## Getting Your Karakeep API Key

1. Open your Karakeep instance
2. Go to **Settings** → **API Keys**
3. Create a new API key
4. Copy it to your `KARAKEEP_API_KEY` environment variable

## Roadmap

- [x] Basic semantic search
- [x] Auto-sync from Karakeep
- [x] Clawdis skill
- [ ] Webhook support for instant indexing
- [ ] Hybrid search (semantic + keyword)
- [ ] "Find similar" bookmarks
- [ ] Tag/date/domain filtering

## License

MIT

## Credits

- [Karakeep](https://github.com/karakeep-app/karakeep) - The bookmark manager this extends
- [Qdrant](https://qdrant.tech/) - Vector database
- [OpenAI](https://openai.com/) - Embeddings API

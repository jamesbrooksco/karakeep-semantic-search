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

## Adding to existing Karakeep docker-compose

```yaml
services:
  # ... your existing karakeep services ...

  karakeep-semantic:
    image: ghcr.io/jamesbrooksco/karakeep-semantic-search:latest
    environment:
      - KARAKEEP_URL=http://karakeep:3000
      - KARAKEEP_API_KEY=${KARAKEEP_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - karakeep
      - qdrant
    ports:
      - "3001:3000"

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "6333:6333"

volumes:
  qdrant_data:
```

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

## Roadmap

- [x] Basic semantic search
- [x] Auto-sync from Karakeep
- [ ] Webhook support for instant indexing
- [ ] Hybrid search (semantic + keyword)
- [ ] "Find similar" bookmarks
- [ ] Tag/date/domain filtering
- [ ] Clawdis skill integration

## License

MIT

## Credits

- [Karakeep](https://github.com/karakeep-app/karakeep) - The bookmark manager this extends
- [Qdrant](https://qdrant.tech/) - Vector database
- [OpenAI](https://openai.com/) - Embeddings API

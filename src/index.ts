import { Hono } from "hono";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { vectordb } from "./vectordb.js";
import { syncAll, syncIncremental, syncBookmark, deleteBookmark } from "./sync.js";

const app = new Hono();

// Health check
app.get("/health", async (c) => {
  try {
    const count = await vectordb.count();
    return c.json({ 
      status: "ok", 
      vectorCount: count,
      karakeepUrl: config.KARAKEEP_URL,
    });
  } catch (error) {
    return c.json({ status: "error", error: String(error) }, 500);
  }
});

// Semantic search
app.get("/search", async (c) => {
  const query = c.req.query("q");
  const limit = parseInt(c.req.query("limit") || "10", 10);

  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  const start = Date.now();
  
  try {
    const results = await vectordb.search(query, limit);
    
    return c.json({
      results,
      query,
      limit,
      took_ms: Date.now() - start,
    });
  } catch (error) {
    logger.error(`Search error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Full sync
app.post("/sync", async (c) => {
  try {
    const result = await syncAll();
    return c.json(result);
  } catch (error) {
    logger.error(`Sync error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Incremental sync
app.post("/sync/incremental", async (c) => {
  try {
    const result = await syncIncremental();
    return c.json(result);
  } catch (error) {
    logger.error(`Incremental sync error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Sync single bookmark (for webhooks)
app.post("/sync/bookmark/:id", async (c) => {
  const id = c.req.param("id");
  
  try {
    await syncBookmark(id);
    return c.json({ success: true, bookmarkId: id });
  } catch (error) {
    logger.error(`Bookmark sync error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete bookmark from index
app.delete("/bookmark/:id", async (c) => {
  const id = c.req.param("id");
  
  try {
    await deleteBookmark(id);
    return c.json({ success: true, bookmarkId: id });
  } catch (error) {
    logger.error(`Bookmark delete error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Clear all vectors (dangerous!)
app.post("/clear", async (c) => {
  try {
    await vectordb.clear();
    return c.json({ success: true });
  } catch (error) {
    logger.error(`Clear error: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Stats
app.get("/stats", async (c) => {
  try {
    const count = await vectordb.count();
    return c.json({
      vectorCount: count,
      syncInterval: config.SYNC_INTERVAL_MINUTES,
    });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Start background sync
let syncInterval: ReturnType<typeof setInterval> | null = null;

async function startBackgroundSync(): Promise<void> {
  logger.info(`Starting background sync every ${config.SYNC_INTERVAL_MINUTES} minutes`);
  
  // Initial sync
  try {
    await syncAll();
  } catch (error) {
    logger.error(`Initial sync failed: ${error}`);
  }

  // Periodic sync
  syncInterval = setInterval(
    async () => {
      try {
        await syncIncremental();
      } catch (error) {
        logger.error(`Background sync failed: ${error}`);
      }
    },
    config.SYNC_INTERVAL_MINUTES * 60 * 1000
  );
}

// Main
async function main(): Promise<void> {
  logger.info("🔍 Karakeep Semantic Search starting...");
  logger.info(`Karakeep URL: ${config.KARAKEEP_URL}`);
  logger.info(`Qdrant URL: ${config.QDRANT_URL}`);

  // Start background sync
  startBackgroundSync();

  // Start server
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: config.PORT, hostname: "0.0.0.0" });

  logger.info(`🚀 Server running on port ${config.PORT}`);
}

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Shutting down...");
  if (syncInterval) clearInterval(syncInterval);
  process.exit(0);
});

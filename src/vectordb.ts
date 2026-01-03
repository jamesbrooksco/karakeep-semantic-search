import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { embeddingProvider } from "./embeddings.js";

// Convert string ID to UUID format for Qdrant
function stringToUuid(str: string): string {
  const hash = createHash("md5").update(str).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export interface BookmarkVector {
  id: string;
  title?: string;
  url?: string;
  tags: string[];
  createdAt: string;
}

export interface SearchResult {
  bookmarkId: string;
  score: number;
  title?: string;
  url?: string;
  tags: string[];
}

class VectorDB {
  private client: QdrantClient;
  private collection: string;
  private initialized = false;

  constructor() {
    this.client = new QdrantClient({ url: config.QDRANT_URL, checkCompatibility: false });
    this.collection = config.QDRANT_COLLECTION;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === this.collection);

    if (!exists) {
      logger.info(`Creating Qdrant collection: ${this.collection}`);
      await this.client.createCollection(this.collection, {
        vectors: {
          size: embeddingProvider.dimensions,
          distance: "Cosine",
        },
      });
    }

    this.initialized = true;
    logger.info(`Qdrant collection ready: ${this.collection}`);
  }

  async upsert(bookmarks: { id: string; text: string; metadata: BookmarkVector }[]): Promise<void> {
    if (bookmarks.length === 0) return;

    await this.init();

    // Generate embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize);
      const texts = batch.map((b) => b.text);
      
      logger.debug(`Generating embeddings for batch ${i / batchSize + 1}`);
      const embeddings = await embeddingProvider.embed(texts);

      const points = batch.map((bookmark, idx) => ({
        id: stringToUuid(bookmark.id),
        vector: embeddings[idx],
        payload: { ...bookmark.metadata, bookmarkId: bookmark.id },
      }));

      await this.client.upsert(this.collection, {
        wait: true,
        points,
      });

      logger.debug(`Upserted ${points.length} vectors`);
    }

    logger.info(`Upserted ${bookmarks.length} bookmarks to vector DB`);
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.init();

    await this.client.delete(this.collection, {
      wait: true,
      points: ids.map(stringToUuid),
    });

    logger.info(`Deleted ${ids.length} vectors`);
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    await this.init();

    const [embedding] = await embeddingProvider.embed([query]);

    const results = await this.client.search(this.collection, {
      vector: embedding,
      limit,
      with_payload: true,
    });

    return results.map((r) => ({
      bookmarkId: r.id as string,
      score: r.score,
      title: r.payload?.title as string | undefined,
      url: r.payload?.url as string | undefined,
      tags: (r.payload?.tags as string[]) || [],
    }));
  }

  async count(): Promise<number> {
    await this.init();
    const info = await this.client.getCollection(this.collection);
    return info.points_count || 0;
  }

  async clear(): Promise<void> {
    await this.init();
    await this.client.deleteCollection(this.collection);
    this.initialized = false;
    await this.init();
    logger.info("Cleared vector DB");
  }
}

export const vectordb = new VectorDB();

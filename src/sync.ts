import { karakeep, KarakeepBookmark } from "./karakeep.js";
import { vectordb, BookmarkVector } from "./vectordb.js";
import { logger } from "./logger.js";

// Convert a bookmark to searchable text
function bookmarkToText(bookmark: KarakeepBookmark): string {
  const parts: string[] = [];

  // Title
  if (bookmark.title) parts.push(bookmark.title);
  if (bookmark.content?.title) parts.push(bookmark.content.title);

  // Description
  if (bookmark.content?.description) parts.push(bookmark.content.description);

  // Content (prefer plain text over HTML)
  if (bookmark.content?.content) {
    parts.push(bookmark.content.content);
  } else if (bookmark.content?.htmlContent) {
    // Strip HTML tags for embedding
    parts.push(bookmark.content.htmlContent.replace(/<[^>]*>/g, " "));
  }

  // Note
  if (bookmark.note) parts.push(bookmark.note);

  // Summary
  if (bookmark.summary) parts.push(bookmark.summary);

  // Tags
  if (bookmark.tags.length > 0) {
    parts.push(`Tags: ${bookmark.tags.map((t) => t.name).join(", ")}`);
  }

  // URL (can help with domain-based searches)
  if (bookmark.content?.url) parts.push(bookmark.content.url);

  const text = parts.join("\n\n").trim();
  
  // Truncate very long texts (embedding models have limits)
  const maxLength = 8000;
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...";
  }

  return text;
}

function bookmarkToMetadata(bookmark: KarakeepBookmark): BookmarkVector {
  return {
    id: bookmark.id,
    title: bookmark.title || bookmark.content?.title,
    url: bookmark.content?.url,
    tags: bookmark.tags.map((t) => t.name),
    createdAt: bookmark.createdAt,
  };
}

export interface SyncResult {
  total: number;
  indexed: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export async function syncAll(): Promise<SyncResult> {
  const start = Date.now();
  logger.info("Starting full sync...");

  const bookmarks = await karakeep.getAllBookmarks();
  
  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  const toIndex: { id: string; text: string; metadata: BookmarkVector }[] = [];

  for (const bookmark of bookmarks) {
    try {
      const text = bookmarkToText(bookmark);
      
      // Skip bookmarks with no meaningful content
      if (text.length < 10) {
        skipped++;
        continue;
      }

      toIndex.push({
        id: bookmark.id,
        text,
        metadata: bookmarkToMetadata(bookmark),
      });
      indexed++;
    } catch (error) {
      logger.error(`Error processing bookmark ${bookmark.id}: ${error}`);
      errors++;
    }
  }

  // Batch upsert to vector DB
  await vectordb.upsert(toIndex);

  const durationMs = Date.now() - start;
  
  const result: SyncResult = {
    total: bookmarks.length,
    indexed,
    skipped,
    errors,
    durationMs,
  };

  logger.info(`Sync complete: ${indexed} indexed, ${skipped} skipped, ${errors} errors in ${durationMs}ms`);
  
  return result;
}

// Sync a single bookmark (for webhook updates)
export async function syncBookmark(bookmarkId: string): Promise<void> {
  logger.info(`Syncing bookmark: ${bookmarkId}`);
  
  const bookmark = await karakeep.getBookmark(bookmarkId);
  const text = bookmarkToText(bookmark);

  if (text.length < 10) {
    logger.info(`Bookmark ${bookmarkId} has no content, skipping`);
    return;
  }

  await vectordb.upsert([{
    id: bookmark.id,
    text,
    metadata: bookmarkToMetadata(bookmark),
  }]);

  logger.info(`Bookmark ${bookmarkId} synced`);
}

// Delete a bookmark from the index
export async function deleteBookmark(bookmarkId: string): Promise<void> {
  logger.info(`Deleting bookmark from index: ${bookmarkId}`);
  await vectordb.delete([bookmarkId]);
}

// Track last sync time for incremental syncs
let lastSyncTime: Date | null = null;

export async function syncIncremental(): Promise<SyncResult> {
  if (!lastSyncTime) {
    // First run, do full sync
    const result = await syncAll();
    lastSyncTime = new Date();
    return result;
  }

  const start = Date.now();
  logger.info(`Incremental sync since ${lastSyncTime.toISOString()}`);

  const bookmarks = await karakeep.getBookmarksSince(lastSyncTime);
  lastSyncTime = new Date();

  if (bookmarks.length === 0) {
    logger.info("No new bookmarks to sync");
    return { total: 0, indexed: 0, skipped: 0, errors: 0, durationMs: Date.now() - start };
  }

  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  const toIndex: { id: string; text: string; metadata: BookmarkVector }[] = [];

  for (const bookmark of bookmarks) {
    try {
      const text = bookmarkToText(bookmark);
      
      if (text.length < 10) {
        skipped++;
        continue;
      }

      toIndex.push({
        id: bookmark.id,
        text,
        metadata: bookmarkToMetadata(bookmark),
      });
      indexed++;
    } catch (error) {
      logger.error(`Error processing bookmark ${bookmark.id}: ${error}`);
      errors++;
    }
  }

  await vectordb.upsert(toIndex);

  const durationMs = Date.now() - start;
  
  logger.info(`Incremental sync: ${indexed} indexed, ${skipped} skipped in ${durationMs}ms`);
  
  return { total: bookmarks.length, indexed, skipped, errors, durationMs };
}

import { config } from "./config.js";
import { logger } from "./logger.js";

export interface KarakeepBookmark {
  id: string;
  createdAt: string;
  modifiedAt?: string;
  title?: string;
  archived: boolean;
  favourited: boolean;
  tags: { id: string; name: string }[];
  note?: string;
  summary?: string;
  content?: {
    type: "link" | "text" | "asset";
    url?: string;
    title?: string;
    description?: string;
    content?: string;
    htmlContent?: string;
    fileName?: string;
  };
}

export interface KarakeepListResponse {
  bookmarks: KarakeepBookmark[];
  nextCursor?: string;
}

export class KarakeepClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.KARAKEEP_URL.replace(/\/$/, "");
    this.apiKey = config.KARAKEEP_API_KEY;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Karakeep API error: ${response.status} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listBookmarks(cursor?: string, limit = 100): Promise<KarakeepListResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);

    return this.fetch<KarakeepListResponse>(`/bookmarks?${params}`);
  }

  async getAllBookmarks(): Promise<KarakeepBookmark[]> {
    const allBookmarks: KarakeepBookmark[] = [];
    let cursor: string | undefined;

    do {
      logger.debug(`Fetching bookmarks, cursor: ${cursor || "start"}`);
      const response = await this.listBookmarks(cursor);
      allBookmarks.push(...response.bookmarks);
      cursor = response.nextCursor;
    } while (cursor);

    logger.info(`Fetched ${allBookmarks.length} bookmarks from Karakeep`);
    return allBookmarks;
  }

  async getBookmark(id: string): Promise<KarakeepBookmark> {
    return this.fetch<KarakeepBookmark>(`/bookmarks/${id}`);
  }

  // Get bookmarks modified since a given date
  async getBookmarksSince(since: Date): Promise<KarakeepBookmark[]> {
    // Karakeep doesn't have a "since" filter, so we fetch all and filter
    // This could be optimized with a PR to Karakeep
    const all = await this.getAllBookmarks();
    return all.filter((b) => {
      const modifiedAt = b.modifiedAt ? new Date(b.modifiedAt) : new Date(b.createdAt);
      return modifiedAt > since;
    });
  }
}

export const karakeep = new KarakeepClient();

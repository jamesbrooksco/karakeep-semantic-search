import OpenAI from "openai";
import { Ollama } from "ollama";
import { config } from "./config.js";
import { logger } from "./logger.js";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: string;
  dimensions: number;

  constructor() {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    this.model = config.EMBEDDING_MODEL;
    // text-embedding-3-small = 1536, text-embedding-3-large = 3072
    this.dimensions = this.model.includes("large") ? 3072 : 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    logger.debug(`Generating embeddings for ${texts.length} texts via OpenAI`);
    
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }
}

class OllamaEmbeddingProvider implements EmbeddingProvider {
  private client: Ollama;
  private model: string;
  dimensions: number;

  constructor() {
    this.client = new Ollama({ host: config.OLLAMA_URL });
    this.model = config.EMBEDDING_MODEL;
    // nomic-embed-text = 768, mxbai-embed-large = 1024
    this.dimensions = this.model.includes("large") ? 1024 : 768;
  }

  async embed(texts: string[]): Promise<number[][]> {
    logger.debug(`Generating embeddings for ${texts.length} texts via Ollama`);
    
    const embeddings: number[][] = [];
    
    // Ollama doesn't support batch embedding well, so we do one at a time
    for (const text of texts) {
      const response = await this.client.embed({
        model: this.model,
        input: text,
      });
      embeddings.push(response.embeddings[0]);
    }

    return embeddings;
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  if (config.OPENAI_API_KEY) {
    logger.info(`Using OpenAI embeddings with model: ${config.EMBEDDING_MODEL}`);
    return new OpenAIEmbeddingProvider();
  }
  
  if (config.OLLAMA_URL) {
    logger.info(`Using Ollama embeddings with model: ${config.EMBEDDING_MODEL}`);
    return new OllamaEmbeddingProvider();
  }

  throw new Error("No embedding provider configured");
}

export const embeddingProvider = createEmbeddingProvider();

export const runtime = "nodejs";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import * as jwt from "jsonwebtoken";

// ==========================
// CONFIG & CONNECTION POOLING
// ==========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embedder = genAI.getGenerativeModel({ model: "text-embedding-004" });
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Pinecone Connection
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET!;

// ==========================
// PINECONE INDEX INITIALIZATION
// ==========================
async function ensurePineconeIndex(): Promise<void> {
  const pinecone = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME!;

  try {
    // Check if index exists
    const indexList = await pinecone.listIndexes();
    const indexExists = indexList.indexes?.some(index => index.name === indexName);

    if (!indexExists) {
      console.log(`Creating Pinecone index: ${indexName}`);

      // Create index with proper configuration for text-embedding-004 (768 dimensions)
      await pinecone.createIndex({
        name: indexName,
        dimension: 768,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      // Wait for index to be ready (can take a few minutes)
      console.log(`Waiting for index ${indexName} to be ready...`);
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait

      while (!isReady && attempts < maxAttempts) {
        try {
          const index = pinecone.index(indexName);
          await index.describeIndexStats();
          isReady = true;
          console.log(`Index ${indexName} is ready!`);
        } catch (error) {
          attempts++;
          console.log(`Index not ready yet, attempt ${attempts}/${maxAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        }
      }

      if (!isReady) {
        throw new Error(`Index ${indexName} failed to become ready within timeout`);
      }
    } else {
      console.log(`Pinecone index ${indexName} already exists`);
    }
  } catch (error) {
    console.error(`Failed to ensure Pinecone index:`, error);
    throw error;
  }
}

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const SEARCH_RATE_LIMIT = { windowMs: 60000, maxRequests: 30 }; // 30 searches per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + SEARCH_RATE_LIMIT.windowMs });
    return true;
  }

  if (userLimit.count >= SEARCH_RATE_LIMIT.maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Verify JWT token with caching
const tokenCache = new Map<string, { payload: any; expires: number }>();

function verifyToken(token: string) {
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.expires) {
    return cached.payload;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    tokenCache.set(token, { payload: decoded, expires: Date.now() + 300000 }); // 5 min cache
    return decoded;
  } catch (error) {
    return null;
  }
}

// Input validation
function validateSearchInput(query: string, caseName: string) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error("Query is required and must be a non-empty string");
  }

  if (!caseName || typeof caseName !== 'string' || caseName.trim().length === 0) {
    throw new Error("Case name is required and must be a non-empty string");
  }

  if (query.length > 1000) {
    throw new Error("Query must be less than 1000 characters");
  }

  if (caseName.length > 100) {
    throw new Error("Case name must be less than 100 characters");
  }
}

// ==========================
// MAIN SEARCH ENDPOINT
// ==========================
export async function POST(req: Request) {
  const startTime = Date.now();
  let namespace = "unknown";
  try {
    // Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    // Rate limiting
    if (!checkRateLimit(user.userId)) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Parse and validate input
    const { query, caseName: rawCaseName } = await req.json();

    try {
      validateSearchInput(query, rawCaseName);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    // Normalize case name → Pinecone namespace-safe
    namespace = rawCaseName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

    console.log(`[${user.userId}] Searching namespace: ${namespace}, query: "${query.substring(0, 50)}..."`);

    // Ensure Pinecone index exists
    await ensurePineconeIndex();

    const pinecone = getPineconeClient();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    // Embed the user question with retry
    let qEmb: number[];
    try {
      qEmb = await embedder.embedContent(query).then(r => r.embedding.values);
    } catch (embedError) {
      console.error(`[${user.userId}] Embedding failed:`, embedError);
      throw new Error("Failed to process search query");
    }

    // Search in Pinecone
    const queryResponse = await index.namespace(namespace).query({
      vector: qEmb,
      topK: 5,
      includeMetadata: true,
      includeValues: false, // Don't return the full vectors to save bandwidth
    });

    const matches = queryResponse.matches || [];

    if (matches.length === 0) {
      const processingTime = Date.now() - startTime;
      console.log(`[${user.userId}] No results found in namespace ${namespace} in ${processingTime}ms`);

      return Response.json({
        answer: "The provided case documents do not contain this information.",
        used_case: namespace,
        retrieved_chunks: 0,
        processingTimeMs: processingTime
      });
    }

    // Extract context from matches
    const context = matches
      .map(match => match.metadata?.content as string || "")
      .filter(content => content && typeof content === 'string' && content.length > 0)
      .join("\n\n");

    // Generate answer grounded ONLY in retrieved text
    const prompt = `You are a legal reasoning assistant. Answer ONLY using the context below. If the answer is not in the context, say: "The provided case documents do not contain this information."

Context:
${context}

Question: ${query}`;

    const response = await chatModel.generateContent(prompt);
    const answer = response.response.text();

    const processingTime = Date.now() - startTime;
    console.log(`[${user.userId}] Search completed in namespace ${namespace} in ${processingTime}ms, found ${matches.length} chunks`);

    return Response.json({
      answer,
      used_case: namespace,
      retrieved_chunks: matches.length,
      processingTimeMs: processingTime,
      // Optional: return match scores for debugging
      match_scores: matches.map(match => ({
        score: match.score,
        content_preview: typeof match.metadata?.content === 'string' ?
          match.metadata.content.substring(0, 100) + "..." : "N/A"
      }))
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    // Handle specific Pinecone errors
    if (error.message?.includes("namespace") && error.message?.includes("not found")) {
      console.warn(`[${namespace}] Namespace not found in Pinecone`);
      return Response.json({
        error: "Case not found. Please check the case name and ensure documents have been uploaded.",
        used_case: namespace,
        processingTimeMs: processingTime
      }, { status: 404 });
    }

    console.error(`[Search Error] ${error.message}`, {
      namespace: namespace,
      processingTimeMs: processingTime,
      error: error.stack
    });

    return Response.json({
      error: error.message || "Search failed",
      used_case: namespace,
      processingTimeMs: processingTime
    }, { status: 500 });
  }
}
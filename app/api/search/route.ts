export const runtime = "nodejs";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import * as jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";

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

    // Search in Pinecone for chunks
    const queryResponse = await index.namespace(namespace).query({
      vector: qEmb,
      topK: 20, // Get more chunks to group by documents
      includeMetadata: true,
      includeValues: false,
    });

    const matches = queryResponse.matches || [];

    if (matches.length === 0) {
      const processingTime = Date.now() - startTime;
      console.log(`[${user.userId}] No results found in namespace ${namespace} in ${processingTime}ms`);

      return Response.json({
        documents: [],
        totalResults: 0,
        used_case: namespace,
        processingTimeMs: processingTime
      });
    }

    // Group chunks by document and calculate document-level relevance
    const docScores = new Map<string, { score: number; chunks: any[]; count: number }>();

    for (const match of matches) {
      const docId = match.metadata?.docId as string;
      if (!docId) continue;

      const existing = docScores.get(docId) || { score: 0, chunks: [], count: 0 };
      existing.score += match.score || 0;
      existing.chunks.push(match);
      existing.count += 1;
      docScores.set(docId, existing);
    }

    // Sort documents by average relevance score
    const sortedDocs = Array.from(docScores.entries())
      .map(([docId, data]) => ({
        docId,
        relevanceScore: data.score / data.chunks.length, // Average score
        chunkCount: data.count,
        bestChunk: data.chunks[0], // Use first chunk for preview
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10); // Top 10 documents

    // Fetch document metadata from MongoDB
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db('clauseiq');

    const docIds = sortedDocs.map(d => d.docId);
    const documents = await db.collection('documents').find({
      docId: { $in: docIds },
      uploadedBy: user.userId // Only return user's own documents
    }).toArray();

    await client.close();

    // Create document results with metadata
    const results = sortedDocs.map(docData => {
      const mongoDoc = documents.find(d => d.docId === docData.docId);
      if (!mongoDoc) return null;

      return {
        docId: docData.docId,
        fileName: mongoDoc.fileName,
        fileType: mongoDoc.fileType,
        fileUrl: mongoDoc.fileUrl,
        uploadedAt: mongoDoc.uploadedAt,
        totalChunks: mongoDoc.totalChunks,
        totalCharacters: mongoDoc.totalCharacters,
        metadata: mongoDoc.metadata,
        relevanceScore: docData.relevanceScore,
        chunkCount: docData.chunkCount,
        previewText: docData.bestChunk.metadata?.content?.substring(0, 300) + "..." || "",
        labels: mongoDoc.labels || [], // For user labeling
      };
    }).filter(Boolean);

    const processingTime = Date.now() - startTime;
    console.log(`[${user.userId}] Search completed in namespace ${namespace} in ${processingTime}ms, found ${results.length} documents`);

    return Response.json({
      documents: results,
      totalResults: results.length,
      used_case: namespace,
      processingTimeMs: processingTime,
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
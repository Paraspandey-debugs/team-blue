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
const QA_RATE_LIMIT = { windowMs: 60000, maxRequests: 20 }; // 20 QA requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + QA_RATE_LIMIT.windowMs });
    return true;
  }

  if (userLimit.count >= QA_RATE_LIMIT.maxRequests) {
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
function validateQAInput(question: string, collectionName: string) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error("Question is required and must be a non-empty string");
  }

  if (!collectionName || typeof collectionName !== 'string' || collectionName.trim().length === 0) {
    throw new Error("Collection name is required and must be a non-empty string");
  }

  if (question.length > 1000) {
    throw new Error("Question must be less than 1000 characters");
  }

  if (collectionName.length > 100) {
    throw new Error("Collection name must be less than 100 characters");
  }
}

// ==========================
// MAIN QA ENDPOINT
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
    const { question, collectionName: rawCollectionName } = await req.json();

    try {
      validateQAInput(question, rawCollectionName);
    } catch (validationError: any) {
      return Response.json({ error: validationError.message }, { status: 400 });
    }

    // Normalize collection name → Pinecone namespace-safe
    namespace = rawCollectionName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

    console.log(`[${user.userId}] QA for namespace: ${namespace}, question: "${question.substring(0, 50)}..."`);

    // Ensure Pinecone index exists
    await ensurePineconeIndex();

    const pinecone = getPineconeClient();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    // Embed the user question with retry
    let qEmb: number[];
    try {
      qEmb = await embedder.embedContent(question).then(r => r.embedding.values);
    } catch (embedError) {
      console.error(`[${user.userId}] Embedding failed:`, embedError);
      throw new Error("Failed to process question");
    }

    // Search in Pinecone for relevant chunks
    const queryResponse = await index.namespace(namespace).query({
      vector: qEmb,
      topK: 15, // Get more chunks for better context
      includeMetadata: true,
      includeValues: false,
    });

    const matches = queryResponse.matches || [];

    if (matches.length === 0) {
      const processingTime = Date.now() - startTime;
      console.log(`[${user.userId}] No relevant content found in namespace ${namespace} in ${processingTime}ms`);

      return Response.json({
        answer: "I couldn't find any relevant information in your documents to answer this question. Please try rephrasing your question or check if you've uploaded the relevant documents.",
        used_collection: namespace,
        processingTimeMs: processingTime,
        sources: []
      });
    }

    // Extract relevant content from chunks
    const relevantContent = matches
      .filter(match => match.metadata?.content)
      .map(match => ({
        content: match.metadata!.content as string,
        score: match.score || 0,
        docId: match.metadata!.docId as string,
        chunkIndex: match.metadata!.chunkIndex as number
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 most relevant chunks

    // Combine content for LLM context
    const contextText = relevantContent
      .map(chunk => `[Document: ${chunk.docId}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    // Generate answer using LLM
    const prompt = `You are a helpful legal assistant. Answer the user's question based on the provided document content. Be accurate, concise, and cite specific information from the documents when relevant.

Question: ${question}

Relevant Document Content:
${contextText}

Instructions:
- Answer based only on the provided content
- If the content doesn't contain enough information to fully answer, say so clearly
- Be professional and precise
- Keep answers focused and actionable
- Cite document references when possible

Answer:`;

    let answer: string;
    try {
      const result = await chatModel.generateContent(prompt);
      answer = result.response.text().trim();
    } catch (llmError) {
      console.error(`[${user.userId}] LLM generation failed:`, llmError);
      answer = "I encountered an error while generating the answer. Please try again.";
    }

    // Get source information
    const sources = relevantContent.map(chunk => ({
      docId: chunk.docId,
      relevanceScore: chunk.score,
      preview: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : '')
    }));

    const processingTime = Date.now() - startTime;
    console.log(`[${user.userId}] QA completed in namespace ${namespace} in ${processingTime}ms`);

    return Response.json({
      answer,
      used_collection: namespace,
      processingTimeMs: processingTime,
      sources
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    // Handle specific Pinecone errors
    if (error.message?.includes("namespace") && error.message?.includes("not found")) {
      console.warn(`[${namespace}] Namespace not found in Pinecone`);
      return Response.json({
        error: "Collection not found. Please check the collection name and ensure documents have been uploaded.",
        used_collection: namespace,
        processingTimeMs: processingTime
      }, { status: 404 });
    }

    console.error(`[QA Error] ${error.message}`, {
      namespace: namespace,
      processingTimeMs: processingTime,
      error: error.stack
    });

    return Response.json({
      error: error.message || "Question answering failed",
      used_collection: namespace,
      processingTimeMs: processingTime
    }, { status: 500 });
  }
}
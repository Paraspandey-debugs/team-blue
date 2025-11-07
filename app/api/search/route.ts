import { GoogleGenerativeAI } from "@google/generative-ai";
import { MongoClient } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// ==========================
// CONFIG & CLIENTS
// ==========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const mongoClient = new MongoClient(process.env.MONGODB_URI!);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

async function getDatabase() {
  await mongoClient.connect();
  return mongoClient.db("clauseiq");
}

// Verify JWT token
function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as { userId: string; email: string };
  } catch (error) {
    return null;
  }
}

// Cosine similarity function
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: NextRequest) {
  try {
    // Verify JWT token from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const { userId } = user;

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Generate embedding for the query
    const queryEmbeddingResult = await embeddingModel.embedContent(query);
    const queryEmbedding = queryEmbeddingResult.embedding.values;

    // Search in MongoDB
    const db = await getDatabase();
    const chunksCollection = db.collection("chunks");

    // Get all chunks (in production, you'd want to use vector search or indexing)
    const allChunks = await chunksCollection.find({
      "metadata.uploaded_by": userId
    }).toArray();

    // Calculate similarities
    const similarities = allChunks.map((chunk: any) => ({
      ...chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort by similarity and take top results
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, 10);

    // Get unique documents
    const documentIds = [...new Set(topResults.map(r => r.docId))];
    const documentsCollection = db.collection("documents");
    const documents = await documentsCollection.find({
      docId: { $in: documentIds }
    }).toArray();

    const docMap = new Map(documents.map(doc => [doc.docId, doc]));

    // Format results
    const results = topResults.map(result => {
      const doc = docMap.get(result.docId);
      return {
        id: result._id.toString(),
        docId: result.docId,
        title: doc?.fileName || "Unknown Document",
        snippet: result.content.length > 200 ? result.content.substring(0, 200) + "..." : result.content,
        relevance: result.similarity,
        fileUrl: doc?.fileUrl,
        fileType: doc?.fileType,
        uploadedAt: doc?.uploadedAt,
      };
    });

    return NextResponse.json({
      success: true,
      results,
      totalResults: results.length,
    });
  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
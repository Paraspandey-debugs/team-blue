export const runtime = "nodejs";

import { Pinecone } from "@pinecone-database/pinecone";
import * as jwt from "jsonwebtoken";

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

// Verify JWT token
function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function GET(req: Request) {
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

    const pinecone = getPineconeClient();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    // Get index stats
    const stats = await index.describeIndexStats();

    const namespacesData = [];

    if (stats.namespaces) {
      for (const [namespace, namespaceStats] of Object.entries(stats.namespaces)) {
        try {
          // Get a sample of vectors from this namespace
          const queryResponse = await index.namespace(namespace).query({
            vector: new Array(768).fill(0), // Dummy vector for sampling
            topK: 3,
            includeMetadata: true,
            includeValues: false,
          });

          const sampleVectors = queryResponse.matches?.map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata
          })) || [];

          namespacesData.push({
            name: namespace,
            vectorCount: namespaceStats.recordCount || 0,
            sampleVectors: sampleVectors
          });
        } catch (error: any) {
          namespacesData.push({
            name: namespace,
            vectorCount: namespaceStats.recordCount || 0,
            error: error.message,
          });
        }
      }
    }

    return Response.json({
      success: true,
      indexName: process.env.PINECONE_INDEX_NAME,
      totalVectors: stats.totalRecordCount || 0,
      namespaces: namespacesData,
      indexStats: stats
    });

  } catch (error: any) {
    console.error("Pinecone inspection error:", error);
    return Response.json({
      error: error.message || "Failed to inspect Pinecone",
      details: error.stack
    }, { status: 500 });
  }
}

// POST endpoint to inspect a specific namespace in detail
export async function POST(req: Request) {
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

    const { namespace: requestedNamespace, limit = 10 } = await req.json();
    namespace = requestedNamespace;

    if (!namespace) {
      return Response.json({ error: "namespace is required" }, { status: 400 });
    }

    const pinecone = getPineconeClient();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    // Get namespace stats
    const stats = await index.describeIndexStats();
    const namespaceStats = stats.namespaces?.[namespace];

    // Get sample vectors
    const queryResponse = await index.namespace(namespace).query({
      vector: new Array(768).fill(0), // Dummy vector for sampling
      topK: Math.min(limit, namespaceStats?.recordCount || 10),
      includeMetadata: true,
      includeValues: false,
    });

    const vectors = queryResponse.matches?.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    })) || [];

    return Response.json({
      success: true,
      namespace: namespace,
      totalVectors: namespaceStats?.recordCount || 0,
      retrievedVectors: vectors.length,
      vectors: vectors
    });

  } catch (error: any) {
    console.error("Namespace inspection error:", error);
    return Response.json({
      error: error.message || "Failed to inspect namespace",
      namespace: namespace
    }, { status: 500 });
  }
}
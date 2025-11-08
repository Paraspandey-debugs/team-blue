import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET!;

// MongoDB Connection Pool
let mongoClient: MongoClient | null = null;
let dbConnection: any = null;

async function getDatabase() {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI!, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }

  if (!dbConnection) {
    await mongoClient.connect();
    dbConnection = mongoClient.db("clauseiq");
  }

  return dbConnection;
}

// Verify JWT token
function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    return null;
  }
}

// GET /api/documents/labels - Get all labels for user's documents
export async function GET(req: NextRequest) {
  try {
    // Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const db = await getDatabase();

    // Get all unique labels from user's documents
    const documents = await db.collection("documents").find(
      { uploadedBy: user.userId },
      { projection: { labels: 1 } }
    ).toArray();

    const allLabels = new Set<string>();
    documents.forEach((doc: any) => {
      if (doc.labels && Array.isArray(doc.labels)) {
        doc.labels.forEach((label: string) => allLabels.add(label));
      }
    });

    return NextResponse.json({
      labels: Array.from(allLabels).sort()
    });

  } catch (error: any) {
    console.error("[Labels GET Error]", error);
    return NextResponse.json({
      error: error.message || "Failed to fetch labels"
    }, { status: 500 });
  }
}

// POST /api/documents/labels - Add or remove labels from a document
export async function POST(req: NextRequest) {
  try {
    // Authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { docId, labels, action } = await req.json();

    if (!docId || !Array.isArray(labels)) {
      return NextResponse.json({
        error: "docId and labels array are required"
      }, { status: 400 });
    }

    const db = await getDatabase();

    // Verify document ownership
    const document = await db.collection("documents").findOne({
      docId,
      uploadedBy: user.userId
    });

    if (!document) {
      return NextResponse.json({
        error: "Document not found or access denied"
      }, { status: 404 });
    }

    let updateOperation;
    if (action === "add") {
      // Add labels to existing labels
      updateOperation = {
        $addToSet: { labels: { $each: labels } }
      };
    } else if (action === "remove") {
      // Remove specific labels
      updateOperation = {
        $pull: { labels: { $in: labels } }
      };
    } else if (action === "set") {
      // Replace all labels
      updateOperation = {
        $set: { labels: labels }
      };
    } else {
      return NextResponse.json({
        error: "Invalid action. Use 'add', 'remove', or 'set'"
      }, { status: 400 });
    }

    const result = await db.collection("documents").updateOne(
      { docId, uploadedBy: user.userId },
      updateOperation
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        error: "No changes made"
      }, { status: 400 });
    }

    // Get updated document
    const updatedDoc = await db.collection("documents").findOne(
      { docId, uploadedBy: user.userId },
      { projection: { labels: 1, fileName: 1 } }
    );

    return NextResponse.json({
      success: true,
      docId,
      fileName: updatedDoc?.fileName,
      labels: updatedDoc?.labels || []
    });

  } catch (error: any) {
    console.error("[Labels POST Error]", error);
    return NextResponse.json({
      error: error.message || "Failed to update labels"
    }, { status: 500 });
  }
}
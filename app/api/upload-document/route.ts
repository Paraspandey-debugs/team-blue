import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { MongoClient } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
// import { getAuth } from "@clerk/nextjs/server";
import jwt from "jsonwebtoken";
import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from 'cloudinary';

// ==========================
// 1. CONFIG & CLIENTS
// ==========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
const mongoClient = new MongoClient(process.env.MONGODB_URI!);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// JWT Secret - in production, use a strong secret
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

// ==========================
// 2. INPUT SCHEMA (FormData)
// ==========================
const uploadSchema = z.object({
  file: z.instanceof(File),
  metadata: z.string().optional(), // JSON string
});

// ==========================
// 3. TEXT EXTRACTION (PDF, DOCX, TXT)
// ==========================
async function extractTextFromBuffer(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.warn("PDF parsing failed, will use OCR:", error);
      return ""; // Will trigger OCR
    }
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }
  return "";
}

// ==========================
// 4. OCR WITH GEMINI (Scanned PDFs / Images)
// ==========================
async function ocrWithGemini(localPath: string, mimeType: string): Promise<string> {
  try {
    // Upload file to Gemini
    const uploadResult = await fileManager.uploadFile(localPath, {
      mimeType,
      displayName: path.basename(localPath),
    });

    // Wait for processing to complete
    let file = await fileManager.getFile(uploadResult.file.name);
    while (file.state === FileState.PROCESSING) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadResult.file.name);
    }

    if (file.state !== FileState.ACTIVE) {
      throw new Error(`File processing failed: ${file.state}`);
    }

    // Generate content with the uploaded file
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
      {
        text: "Extract all text exactly as it appears. Preserve formatting, lists, tables (as markdown), headings, and line breaks. Do NOT summarize or skip anything."
      },
    ]);

    // Clean up the uploaded file
    await fileManager.deleteFile(uploadResult.file.name);

    return result.response.text();
  } catch (error) {
    console.error("OCR processing error:", error);
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ==========================
// 5. GENERAL SEMANTIC CHUNKER (Recursive + Overlap)
// ==========================
interface Chunk {
  content: string;
  metadata: Record<string, any>;
  chunk_id: number;
  start_char: number;
}

function chunkText(
  text: string,
  baseMetadata: Record<string, any>,
  docId: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let chunkId = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    // Try to end at sentence/paragraph boundary
    if (end < text.length) {
      const slice = text.slice(end - 100, end + 100);
      const sentenceEnd = slice.match(/[.!?]\s/);
      const paraEnd = slice.indexOf("\n\n");
      if (sentenceEnd && sentenceEnd.index !== undefined && sentenceEnd.index < 100) {
        end = end - 100 + sentenceEnd.index + 1;
      } else if (paraEnd !== -1 && paraEnd < 100) {
        end = end - 100 + paraEnd;
      }
    }
    const content = text.slice(start, end).trim();
    if (content.length === 0) break;
    chunks.push({
      content,
      metadata: { ...baseMetadata, doc_id: docId },
      chunk_id: chunkId++,
      start_char: start,
    });
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

// ==========================
// 6. MAIN PIPELINE
// ==========================
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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const metadataStr = formData.get("metadata") as string;
    const metadata = metadataStr ? JSON.parse(metadataStr) : {};

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileName = file.name;
    const fileType = file.type || "application/octet-stream";
    const buffer = Buffer.from(await file.arrayBuffer());
    const docId = uuidv4();

    // Step 1: Upload to Cloudinary
    const cloudinaryResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: `documents/${docId}/${fileName}`,
          folder: 'clauseiq-documents',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const fileUrl = (cloudinaryResult as any).secure_url;

    // Step 2: Try direct extraction
    let fullText = await extractTextFromBuffer(buffer, fileType, fileName);

    // Step 3: Fallback to OCR if empty or image-based
    if (!fullText || fullText.trim().length < 100) {
      const tempPath = `/tmp/${docId}-${fileName}`;
      fs.writeFileSync(tempPath, buffer);
      fullText = await ocrWithGemini(tempPath, fileType);
      fs.unlinkSync(tempPath);
    }

    if (!fullText?.trim()) {
      return NextResponse.json({ error: "Failed to extract any text" }, { status: 500 });
    }

    // Step 4: Chunk
    const chunks = chunkText(fullText, { ...metadata, source: fileName, file_url: fileUrl }, docId);

    // Step 5: Embed with Gemini
    const embedResults = await Promise.all(
      chunks.map(chunk => embeddingModel.embedContent(chunk.content))
    );
    const embeddings = embedResults.map((r: any) => r.embedding.values);

    // Step 6: Store in MongoDB
    const db = await getDatabase();
    const documentsCollection = db.collection("documents");
    const chunksCollection = db.collection("chunks");

    // Store document metadata
    await documentsCollection.insertOne({
      docId,
      fileName,
      fileType,
      fileUrl,
      uploadedBy: userId,
      uploadedAt: new Date(),
      totalChunks: chunks.length,
      totalCharacters: fullText.length,
      metadata: metadata,
    });

    // Store chunks with embeddings
    const chunkDocuments = chunks.map((chunk, i) => ({
      docId,
      chunkId: i,
      content: chunk.content,
      embedding: embeddings[i],
      metadata: {
        ...chunk.metadata,
        chunk_id: chunk.chunk_id,
        start_char: chunk.start_char,
        end_char: chunk.start_char + chunk.content.length,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString(),
        file_name: fileName,
        file_type: fileType,
        file_url: fileUrl,
      },
    }));

    await chunksCollection.insertMany(chunkDocuments);

    return NextResponse.json({
      success: true,
      docId,
      chunks: chunks.length,
      characters: fullText.length,
      fileUrl,
      message: `Document uploaded to Cloudinary and processed: ${chunks.length} chunks stored with Gemini embeddings`,
    });
  } catch (error: any) {
    console.error("Pipeline error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
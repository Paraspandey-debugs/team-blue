import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { MongoClient, Db } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import { v2 as cloudinary } from 'cloudinary';
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";

// ==========================
// CONFIG & CONNECTION POOLING
// ==========================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// MongoDB Connection Pool
let mongoClient: MongoClient | null = null;
let dbConnection: Db | null = null;

// Pinecone Connection
let pineconeClient: Pinecone | null = null;

async function getDatabase(): Promise<Db> {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI!, {
      maxPoolSize: 10, // Connection pool size
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

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET!;

// ==========================
// UTILITY FUNCTIONS
// ==========================

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = { windowMs: 60000, maxRequests: 10 }; // 10 requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT.maxRequests) {
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

// ==========================
// INPUT VALIDATION
// ==========================
const uploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 50 * 1024 * 1024, // 50MB limit
    "File size must be less than 50MB"
  ).refine(
    (file) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp'
      ];
      const allowedExtensions = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
      return allowedTypes.includes(file.type) ||
             allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    },
    "Unsupported file type"
  ),
  metadata: z.string().optional(),
});

// ==========================
// TEXT EXTRACTION WITH RETRIES
// ==========================
async function extractTextFromBuffer(buffer: Buffer, mimeType: string, fileName: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // For PDFs, skip direct parsing and rely on OCR (more reliable)
      if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        console.log("PDF detected - skipping direct text extraction, will use OCR");
        return ""; // Will trigger OCR
      }

      if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }

      if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
        return buffer.toString("utf-8");
      }

      // For images and other files, return empty to trigger OCR
      return "";
    } catch (error) {
      console.warn(`Text extraction attempt ${attempt + 1} failed:`, error);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
    }
  }
  return "";
}

// ==========================
// OCR WITH GEMINI (Optimized)
// ==========================
async function ocrWithGemini(localPath: string, mimeType: string, retries = 2): Promise<string> {
  let uploadedFileName: string | null = null;

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Upload file to Gemini
        const uploadResult = await fileManager.uploadFile(localPath, {
          mimeType,
          displayName: path.basename(localPath),
        });
        uploadedFileName = uploadResult.file.name;

        // Wait for processing with timeout
        const maxWaitTime = 30000; // 30 seconds
        const startTime = Date.now();

        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === FileState.PROCESSING && (Date.now() - startTime) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          file = await fileManager.getFile(uploadResult.file.name);
        }

        if (file.state !== FileState.ACTIVE) {
          throw new Error(`File processing failed: ${file.state}`);
        }

        // Generate content with optimized model
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use pro model for better PDF processing
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

        return result.response.text();
      } catch (error) {
        console.warn(`OCR attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  } finally {
    // Always cleanup uploaded file
    if (uploadedFileName) {
      try {
        await fileManager.deleteFile(uploadedFileName);
      } catch (cleanupError) {
        console.warn("Failed to cleanup Gemini file:", cleanupError);
      }
    }
  }

  throw new Error("OCR failed after all retries");
}

// ==========================
// OPTIMIZED CHUNKING
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
  if (!text || text.trim().length === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let chunkId = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to end at sentence/paragraph boundary
    if (end < text.length) {
      const lookAhead = Math.min(100, text.length - end);
      const slice = text.slice(end - 50, end + lookAhead);

      const sentenceEnd = slice.match(/[.!?]\s/);
      const paraEnd = slice.indexOf("\n\n");

      if (sentenceEnd && sentenceEnd.index !== undefined && sentenceEnd.index < lookAhead) {
        end = end - 50 + sentenceEnd.index + 1;
      } else if (paraEnd !== -1 && paraEnd < lookAhead) {
        end = end - 50 + paraEnd;
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

    start = Math.max(end - overlap, start + 1);
    if (start >= text.length) break;
  }

  return chunks;
}

// ==========================
// BATCH EMBEDDING PROCESSING
// ==========================
async function generateEmbeddingsBatch(chunks: Chunk[], batchSize = 10): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map(chunk => embeddingModel.embedContent(chunk.content));

    try {
      const batchResults = await Promise.all(batchPromises);
      const batchEmbeddings = batchResults.map((result: any) => result.embedding.values);
      embeddings.push(...batchEmbeddings);
    } catch (error) {
      console.error(`Batch embedding failed for chunks ${i}-${i + batch.length}:`, error);
      // Retry individual chunks on batch failure
      for (const chunk of batch) {
        try {
          const result = await embeddingModel.embedContent(chunk.content);
          embeddings.push(result.embedding.values);
        } catch (individualError) {
          console.error(`Individual embedding failed for chunk:`, individualError);
          embeddings.push(new Array(768).fill(0)); // Fallback zero vector
        }
      }
    }
  }

  return embeddings;
}

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
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let tempFilePath: string | null = null;

  try {
    // Rate limiting check
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!checkRateLimit(user.userId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Parse and validate input
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const metadataStr = formData.get("metadata") as string;

    const validationResult = uploadSchema.safeParse({ file, metadata: metadataStr });
    if (!validationResult.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: validationResult.error.issues
      }, { status: 400 });
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};
    const { userId } = user;
    const fileName = file.name;
    const fileType = file.type || "application/octet-stream";
    const docId = uuidv4();

    console.log(`[${docId}] Starting document processing for ${fileName} (${file.size} bytes)`);

    // Memory-efficient file handling
    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 1: Upload to Cloudinary with retry
    let cloudinaryResult: any;
    try {
      cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            public_id: `documents/${docId}/${fileName}`,
            folder: 'clauseiq-documents',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
    } catch (error) {
      console.error(`[${docId}] Cloudinary upload failed:`, error);
      throw new Error("File upload failed");
    }

    const fileUrl = cloudinaryResult.secure_url;

    // Step 2: Extract text with fallback to OCR
    let fullText = await extractTextFromBuffer(buffer, fileType, fileName);

    if (!fullText || fullText.trim().length < 100) {
      tempFilePath = `/tmp/${docId}-${fileName}`;
      await fs.writeFile(tempFilePath, buffer);
      console.log(`[${docId}] Using OCR for ${fileName}`);

      fullText = await ocrWithGemini(tempFilePath, fileType);
    }

    if (!fullText?.trim()) {
      throw new Error("Failed to extract any text from document");
    }

    console.log(`[${docId}] Extracted ${fullText.length} characters`);

    // Step 3: Chunk text
    const chunks = chunkText(fullText, { ...metadata, source: fileName, file_url: fileUrl }, docId);
    if (chunks.length === 0) {
      throw new Error("No valid chunks generated from document");
    }

    console.log(`[${docId}] Generated ${chunks.length} chunks`);

    // Step 4: Generate embeddings in batches
    const embeddings = await generateEmbeddingsBatch(chunks, 5); // Smaller batches for reliability
    console.log(`[${docId}] Generated ${embeddings.length} embeddings`);

    // Step 5: Store in database and vector store
    const db = await getDatabase();

    // Ensure Pinecone index exists before using it
    await ensurePineconeIndex();

    const pinecone = getPineconeClient();
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

    // Normalize case name for namespace (use a default or extract from metadata)
    const caseName = metadata.caseName || metadata.case_name || "default-case";
    const namespace = caseName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

    // Store document metadata in MongoDB
    await db.collection("documents").insertOne({
      docId,
      fileName,
      fileType,
      fileUrl,
      uploadedBy: userId,
      uploadedAt: new Date(),
      totalChunks: chunks.length,
      totalCharacters: fullText.length,
      metadata,
      processingTimeMs: Date.now() - startTime,
      pineconeNamespace: namespace,
    });

    // Store chunks with embeddings in MongoDB
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

    await db.collection("chunks").insertMany(chunkDocuments);

    // Store vectors in Pinecone
    const pineconeVectors = chunks.map((chunk, i) => ({
      id: `${docId}-chunk-${i}`,
      values: embeddings[i],
      metadata: {
        content: chunk.content,
        docId: docId,
        chunkId: i,
        fileName: fileName,
        fileType: fileType,
        fileUrl: fileUrl,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        ...chunk.metadata,
      },
    }));

    // Upsert vectors to Pinecone in batches
    const batchSize = 100;
    for (let i = 0; i < pineconeVectors.length; i += batchSize) {
      const batch = pineconeVectors.slice(i, i + batchSize);
      await index.namespace(namespace).upsert(batch);
    }

    console.log(`[${docId}] Stored ${pineconeVectors.length} vectors in Pinecone namespace: ${namespace}`);

    const processingTime = Date.now() - startTime;
    console.log(`[${docId}] Processing completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      docId,
      chunks: chunks.length,
      characters: fullText.length,
      fileUrl,
      processingTimeMs: processingTime,
      message: `Document processed successfully: ${chunks.length} chunks stored`,
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[Processing Error] ${error.message}`, {
      processingTimeMs: processingTime,
      error: error.stack
    });

    return NextResponse.json({
      error: error.message || "Internal processing error",
      processingTimeMs: processingTime
    }, { status: 500 });
  } finally {
    // Always cleanup temporary files
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn("Failed to cleanup temp file:", cleanupError);
      }
    }
  }
}

// ==========================
// CLEANUP ON PROCESS EXIT
// ==========================
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});
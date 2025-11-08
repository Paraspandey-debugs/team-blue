import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function checkData() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found in environment variables');
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('clauseiq');

  console.log('=== DOCUMENTS COLLECTION ===');
  const docs = await db.collection('documents').find({}).limit(3).toArray();
  console.log('Documents found:', docs.length);
  if (docs.length > 0) {
    console.log('Sample document:', JSON.stringify(docs[0], null, 2));
  }

  console.log('\n=== CHUNKS COLLECTION ===');
  const chunks = await db.collection('chunks').find({}).limit(3).toArray();
  console.log('Chunks found:', chunks.length);
  if (chunks.length > 0) {
    console.log('Sample chunk:', JSON.stringify(chunks[0], null, 2));
  }

  await client.close();
}

checkData().catch(console.error);
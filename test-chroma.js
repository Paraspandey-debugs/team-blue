// Test script to check Pinecone data
// Run with: node test-chroma.js

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Create a test JWT token
const testUser = { userId: 'test-user', email: 'test@example.com' };
const token = jwt.sign(testUser, JWT_SECRET);

async function testPinecone() {
  console.log('🔍 Testing Pinecone Data Inspection...\n');

  try {
    // Test 1: List all namespaces
    console.log('📋 Getting all namespaces...');
    const listResponse = await fetch(`${BASE_URL}/api/inspect-chroma`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`HTTP ${listResponse.status}: ${listResponse.statusText}`);
    }

    const namespacesData = await listResponse.json();
    console.log('✅ Namespaces found:', namespacesData.namespaces?.length || 0);
    console.log('Index:', namespacesData.indexName);
    console.log('Total vectors:', namespacesData.totalVectors);

    if (namespacesData.namespaces && namespacesData.namespaces.length > 0) {
      console.log('\n📊 Namespaces Details:');
      namespacesData.namespaces.forEach((ns, index) => {
        console.log(`${index + 1}. ${ns.name}: ${ns.vectorCount} vectors`);
        if (ns.sampleVectors && ns.sampleVectors.length > 0) {
          console.log(`   Sample vector ID: ${ns.sampleVectors[0].id}`);
        }
      });

      // Test 2: Inspect first namespace in detail
      const firstNamespace = namespacesData.namespaces[0];
      if (firstNamespace.vectorCount > 0) {
        console.log(`\n🔎 Inspecting namespace: ${firstNamespace.name}`);

        const detailResponse = await fetch(`${BASE_URL}/api/inspect-chroma`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            namespace: firstNamespace.name,
            limit: 2
          })
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          console.log(`✅ Retrieved ${detailData.retrievedVectors} vectors`);
          console.log(`� Total vectors in namespace: ${detailData.totalVectors}`);

          if (detailData.vectors.length > 0) {
            console.log('\n📖 Sample vector:');
            console.log(`ID: ${detailData.vectors[0].id}`);
            console.log(`Score: ${detailData.vectors[0].score}`);
            console.log(`Metadata:`, JSON.stringify(detailData.vectors[0].metadata, null, 2));
          }
        } else {
          console.log('❌ Failed to get namespace details');
        }
      }
    } else {
      console.log('⚠️  No namespaces found in Pinecone');
      console.log('💡 Try uploading some documents first to create namespaces');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the dev server is running: npm run dev');
    console.log('2. Check your .env.local file has correct Pinecone credentials');
    console.log('3. Verify JWT_SECRET is set correctly');
  }
}

// Run the test
testPinecone();
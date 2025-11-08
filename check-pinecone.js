const { Pinecone } = require('@pinecone-database/pinecone');

async function checkPinecone() {
  try {
    const pinecone = new Pinecone({
      apiKey: 'pcsk_3czPFs_TsWUCbzKHwDMDBos95uw9XGP7XUTQNAv1o2XhkRC2FvNN2V936ZcCyLkxjTF8Vv',
    });

    console.log('Checking Pinecone connection...');

    const indexes = await pinecone.listIndexes();
    console.log('Existing indexes:', indexes.indexes?.map(idx => idx.name) || []);

    const indexName = 'clauseiq-documents';
    console.log('Looking for index:', indexName);

    const indexExists = indexes.indexes?.some(idx => idx.name === indexName);
    console.log('Index exists:', indexExists);

    if (!indexExists) {
      console.log('Creating index...');
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
      console.log('Index creation initiated');
    } else {
      console.log('Index already exists');
      const index = pinecone.index(indexName);
      const stats = await index.describeIndexStats();
      console.log('Index stats:', JSON.stringify(stats, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPinecone();
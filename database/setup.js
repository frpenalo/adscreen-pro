require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔄 Connecting to database...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected! Running schema...');
    
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );
    
    await client.query(schemaSQL);
    console.log('✅ Database schema created successfully!');
    
    client.release();
    await pool.end();
    
    console.log('🎉 Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

setupDatabase();

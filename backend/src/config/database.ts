import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
export const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

// Database utility functions
export const dbUtils = {
  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  },

  // Run database migrations
  async runMigrations(): Promise<void> {
    try {
      const client = await pool.connect();
      
      // Create migrations tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ Migrations table ready');
      client.release();
    } catch (error) {
      console.error('Migration setup failed:', error);
      throw error;
    }
  },

  // Clean up old sessions
  async cleanupOldSessions(): Promise<void> {
    try {
      const result = await pool.query(`
        UPDATE game_sessions 
        SET status = 'cancelled', finished_at = NOW()
        WHERE status = 'waiting' 
        AND created_at < NOW() - INTERVAL '1 hour'
      `);
      
      if (result.rowCount && result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} old game sessions`);
      }
    } catch (error) {
      console.error('Session cleanup failed:', error);
    }
  }
};

// Initialize connections
export const initializeDatabase = async () => {
  try {
    // Test PostgreSQL connection
    const pgConnected = await dbUtils.testConnection();
    if (pgConnected) {
      console.log('✅ PostgreSQL connected successfully');
      await dbUtils.runMigrations();
    } else {
      throw new Error('PostgreSQL connection failed');
    }

    // Connect to Redis
    redis.on('error', (err) => console.log('❌ Redis Client Error:', err));
    redis.on('connect', () => console.log('✅ Redis connected successfully'));
    redis.on('reconnecting', () => console.log('🔄 Redis reconnecting...'));
    
    await redis.connect();
    
    // Set up cleanup interval (every 30 minutes)
    setInterval(async () => {
      await dbUtils.cleanupOldSessions();
    }, 30 * 60 * 1000);
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    // For development, we can continue without database
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Running without database connection (development mode)');
      return false;
    }
    
    throw error;
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 Closing database connections...');
  await pool.end();
  await redis.quit();
  console.log('✅ Database connections closed');
});

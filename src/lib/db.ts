import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'bismillah123',
  database: process.env.DB_NAME || 'event_management',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection function
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Log system events function
export async function logSystemEvent(type: string, message: string, meta?: any) {
  try {
    await pool.execute(
      'INSERT INTO logs (type, message, meta, created_at) VALUES (?, ?, ?, NOW())',
      [type, message, meta ? JSON.stringify(meta) : null]
    );
    console.log(`📝 System log: [${type}] ${message}`);
  } catch (error) {
    console.error('Failed to log system event:', error);
    // Don't throw error to prevent breaking the main functionality
  }
}

// Export the pool as default and named export
export const db = pool;
export default pool;
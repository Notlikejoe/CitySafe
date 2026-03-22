import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import { log, err, ok } from './utils.js';

dotenv.config();

// Supabase Connection setup
const connectionString = process.env.DATABASE_URL;

let pool;

if (connectionString) {
    pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase connections sometimes from local
    });

    pool.on('error', (e) => {
        log('Unexpected error on idle client', e.message);
    });
}

/**
 * Executes a query with arguments.
 */
export const query = async (text, params) => {
    if (!pool) return err('DATABASE_URL is not configured.');
    try {
        const start = Date.now();
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // console.log('Executed query', { text, duration, rows: res.rowCount });
        return ok(res);
    } catch (e) {
        log('Database Error:', e.message);
        return err(e.message);
    }
};

/**
 * Helper to get a client from the pool for transactions.
 */
export const getClient = () => {
    if (!pool) return null;
    return pool.connect();
};

export default { query, getClient, pool };

import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

async function run() {
    console.log("Starting init...");
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("No DATABASE_URL found");
        process.exit(1);
    }
    
    console.log("Connecting to:", connectionString.substring(0, 30) + "...");
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const sql = fs.readFileSync('./init.sql', 'utf8');
        console.log("Read SQL file, length:", sql.length);
        const res = await pool.query(sql);
        console.log("✅ Query successful!");
    } catch (e) {
        console.error("❌ SQL Error:");
        console.error(e);
    } finally {
        await pool.end();
    }
}

run().catch(console.error);

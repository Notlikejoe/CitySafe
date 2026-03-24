import fs from 'fs';
import { query, pool } from './db.js';

async function init() {
    try {
        console.log("Reading init.sql...");
        const sql = fs.readFileSync('./init.sql', 'utf8');
        console.log("Executing schema creation...");
        const res = await query(sql);
        if (res.success) {
            console.log("✅ Database initialized successfully!");
        } else {
            console.error("❌ Failed to initialize database:", res.error);
        }
    } catch (e) {
        console.error("❌ Error running script:", e);
    } finally {
        if (pool) await pool.end();
    }
}

init();

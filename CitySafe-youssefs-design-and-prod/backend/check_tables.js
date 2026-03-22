import { query } from './db.js';
(async () => {
    try {
        const r = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('TABLES:', JSON.stringify(r.data.rows.map(row => row.table_name)));
    } catch (e) {
        console.error('ERROR:', e);
    }
    process.exit(0);
})();

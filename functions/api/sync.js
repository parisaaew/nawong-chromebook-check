/**
 * Cloudflare Pages Function - D1 Database Integration API
 * Handles real-time read and write operations to D1 Database (chromebook_db / env.DB)
 */

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const stateJson = JSON.stringify(body.state || {});
        const updatedAt = body.updatedAt || new Date().toISOString();

        // 1. Check if env.DB or env.chromebook_db binding is available
        const db = env.DB || env.chromebook_db || env.club_db;

        if (db) {
            // 2. Automatically create D1 Table if it does not exist yet
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS chromebook_records (
                    id TEXT PRIMARY KEY,
                    data_json TEXT,
                    updated_at TEXT
                );
            `).run();

            // 3. Insert or Replace state data into D1 Database
            await db.prepare(`
                INSERT INTO chromebook_records (id, data_json, updated_at)
                VALUES ('active_state', ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    data_json = excluded.data_json,
                    updated_at = excluded.updated_at;
            `).bind(stateJson, updatedAt).run();

            return new Response(JSON.stringify({
                success: true,
                message: 'Synced to D1 Database successfully',
                updatedAt: updatedAt
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                message: 'No D1 Database binding found (env.DB)'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

export async function onRequestGet(context) {
    const { env } = context;

    try {
        const db = env.DB || env.chromebook_db || env.club_db;

        if (db) {
            const row = await db.prepare(`
                SELECT data_json, updated_at FROM chromebook_records WHERE id = 'active_state'
            `).first();

            if (row && row.data_json) {
                return new Response(JSON.stringify({
                    success: true,
                    state: JSON.parse(row.data_json),
                    updatedAt: row.updated_at
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        return new Response(JSON.stringify({ success: false, message: 'No data in D1' }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

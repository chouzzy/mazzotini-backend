import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
const KEY = process.env.LEGAL_ONE_CONSUMER_KEY!;
const SECRET = process.env.LEGAL_ONE_CONSUMER_SECRET!;

async function main() {
    const tokenRes = await axios.get(`${process.env.LEGAL_ONE_API_BASE_URL}/oauth?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString('base64')}` }
    });
    const token = tokenRes.data.access_token;
    const h = { Authorization: `Bearer ${token}` };

    console.log('✅ Auth OK\n');

    const docId = process.argv[2] || '23905';
    const res = await axios.get(`${BASE}/documents/${docId}`, { headers: h, params: { '$expand': 'relationships' } });
    const d = res.data;
    console.log(`Documento ${docId}:`);
    console.log('  archive:', d.archive);
    console.log('  type:', d.type);
    console.log('  typeId:', d.typeId);
    console.log('  notes:', d.notes);
    console.log('  relationships:', JSON.stringify(d.relationships, null, 2));
}

main().catch(e => console.error(e.response?.data || e.message));

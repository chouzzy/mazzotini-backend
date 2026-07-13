import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
const KEY = process.env.LEGAL_ONE_CONSUMER_KEY!;
const SECRET = process.env.LEGAL_ONE_CONSUMER_SECRET!;

async function main() {
    const r = await axios.get(`${process.env.LEGAL_ONE_API_BASE_URL}/oauth?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString('base64')}` }
    });
    const h = { Authorization: `Bearer ${r.data.access_token}` };

    // Busca pelo folder exato
    const res = await axios.get(`${BASE}/services`, { headers: h, params: {
        '$filter': "folder eq 'Proc-0004376/99'",
        '$select': 'id,folder,status',
    }});
    console.log('Serviços encontrados:', JSON.stringify(res.data.value, null, 2));

    // Também lista os mais recentes para comparar
    const recent = await axios.get(`${BASE}/services`, { headers: h, params: {
        '$top': 5,
        '$select': 'id,folder,status',
        '$orderby': 'id desc',
    }});
    console.log('\nMais recentes:');
    recent.data.value.forEach((s: any) => console.log(`  ID: ${s.id}  Pasta: ${s.folder}`));
}
main().catch(e => console.error(e.response?.data || e.message));

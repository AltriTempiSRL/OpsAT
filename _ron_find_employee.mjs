// Busca un usuario/empleado en Odoo por nombre para obtener su Odoo ID (uso: crear en WWP)
import https from 'https';
import { URL } from 'url';

const ODOO_URL  = process.env.ODOO_URL  || '';
const ODOO_DB   = process.env.ODOO_DB   || '';
const ODOO_USER = process.env.ODOO_USER || '';
const ODOO_KEY  = process.env.ODOO_API_KEY || '';
const NAME = process.argv[2] || 'Heidy Josefina Nuñez Checo';

if (!ODOO_URL || !ODOO_DB || !ODOO_USER || !ODOO_KEY) {
  console.error('FALTAN_CREDENCIALES_ODOO');
  process.exit(1);
}

function odooRpc(params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'call', params });
    const u = new URL(ODOO_URL);
    const options = {
      hostname: u.hostname, port: u.port || 443, path: '/jsonrpc', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => {
        try { const j = JSON.parse(data); if (j.error) reject(new Error(j.error.data?.message || JSON.stringify(j.error))); else resolve(j.result); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function authenticate() {
  const uid = await odooRpc({ service: 'common', method: 'authenticate', args: [ODOO_DB, ODOO_USER, ODOO_KEY, {}] });
  if (!uid) throw new Error('uid no recibido');
  return uid;
}

async function odooCall(uid, model, method, args, kwargs = {}) {
  return odooRpc({ service: 'object', method: 'execute_kw', args: [ODOO_DB, uid, ODOO_KEY, model, method, args, kwargs] });
}

(async () => {
  const uid = await authenticate();

  const employees = await odooCall(uid, 'hr.employee', 'search_read',
    [[['name', 'ilike', NAME]]],
    { fields: ['id', 'name', 'work_email', 'user_id', 'department_id', 'job_id', 'active'], limit: 10 });

  const users = await odooCall(uid, 'res.users', 'search_read',
    [[['name', 'ilike', NAME]]],
    { fields: ['id', 'name', 'login', 'employee_id', 'active'], limit: 10 });

  const partners = await odooCall(uid, 'res.partner', 'search_read',
    [[['name', 'ilike', NAME]]],
    { fields: ['id', 'name', 'email', 'is_company'], limit: 10 });

  console.log(JSON.stringify({ employees, users, partners }, null, 2));
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

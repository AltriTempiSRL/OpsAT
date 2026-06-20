// Carga del estándar de empaque (materiales + reglas) diseñado por Pit.
// Reusable: local (WWP_JWT_SECRET firma token) o producción (WWP_EMAIL+WWP_PASS hacen login).
// Seguro para re-correr: no duplica materiales (match por nombre); reglas son upsert por categ_id.
import crypto from 'crypto';

const BASE = process.env.WWP_BASE || 'http://localhost:3099';

function jwtSign(payload, secret, expSec) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const p = b64({ ...payload, iat: now, exp: now + expSec });
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

async function getToken() {
  if (process.env.WWP_TOKEN) return process.env.WWP_TOKEN.trim();
  if (process.env.WWP_JWT_SECRET) {
    return jwtSign({ userId: 'admin_carga_empaque', role: 'admin', name: 'Carga Empaque' },
      process.env.WWP_JWT_SECRET.trim(), 3600);
  }
  if (process.env.WWP_EMAIL && process.env.WWP_PASS) {
    const r = await fetch(`${BASE}/api/wwp/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.WWP_EMAIL, password: process.env.WWP_PASS })
    });
    const j = await r.json();
    if (!j.ok) throw new Error('Login falló: ' + (j.error || r.status));
    console.log('Login OK como', j.user?.name, '(' + j.user?.role + ')');
    return j.accessToken;
  }
  throw new Error('Sin método de auth: define WWP_TOKEN, o WWP_JWT_SECRET, o WWP_EMAIL+WWP_PASS');
}

const MATERIALES = [
  { nombre: 'Cinta de embalaje',                  descripcion: 'Para sellar cajas y fijar el empaque durante el transporte.' },
  { nombre: 'Papel Foam',                         descripcion: 'Evita rayaduras y maltrato en superficies delicadas.' },
  { nombre: 'Stretch film',                       descripcion: 'Envuelve y sujeta la pieza; fija mantas y partes sueltas.' },
  { nombre: 'Manta de mudanza',                   descripcion: 'Acolchado grueso para muebles grandes; va sobre el film.' },
  { nombre: 'Plástico de burbuja',                descripcion: 'Acolchado para piezas frágiles; 2+ vueltas en lo delicado.' },
  { nombre: 'Cartón corrugado',                   descripcion: 'Forma una pared rígida alrededor de la pieza.' },
  { nombre: 'Caja de cartón doble pared',         descripcion: 'Caja resistente para productos medianos y pesados.' },
  { nombre: 'Esquinero / cantonera de cartón',    descripcion: 'Protege esquinas y aristas de golpes.' },
  { nombre: 'Etiqueta FRÁGIL / este lado arriba', descripcion: 'Señaliza manejo cuidadoso y orientación de la pieza.' },
  { nombre: 'Bolsa / funda plástica',             descripcion: 'Cubre contra polvo, agua y humedad.' },
];

const M = {
  cinta: 'Cinta de embalaje', foam: 'Papel Foam', film: 'Stretch film', manta: 'Manta de mudanza',
  burbuja: 'Plástico de burbuja', carton: 'Cartón corrugado', caja: 'Caja de cartón doble pared',
  esquinero: 'Esquinero / cantonera de cartón', etiqueta: 'Etiqueta FRÁGIL / este lado arriba',
  bolsa: 'Bolsa / funda plástica'
};

const REGLAS = [
  { categ_id: 57,  categ_nombre: 'Muebles / Sala / Sofas y Seccionales',                          sec: ['film', 'burbuja', 'manta', 'film', 'etiqueta'] },
  { categ_id: 63,  categ_nombre: 'Muebles / Sala / Sillones / Butacas y Reposapies',              sec: ['film', 'burbuja', 'manta', 'film', 'etiqueta'] },
  { categ_id: 85,  categ_nombre: 'Muebles / Comedor / Sillas',                                    sec: ['film', 'burbuja', 'caja', 'cinta'] },
  { categ_id: 64,  categ_nombre: 'Muebles / Sala / Mesas de Centro',                              sec: ['foam', 'burbuja', 'esquinero', 'carton', 'cinta', 'etiqueta'] },
  { categ_id: 98,  categ_nombre: 'Muebles / Decoracion / Cojines',                                sec: ['bolsa', 'caja', 'cinta'] },
  { categ_id: 82,  categ_nombre: 'Muebles / Iluminacion / Lamparas de Techo',                     sec: ['burbuja', 'caja', 'cinta', 'etiqueta'] },
  { categ_id: 93,  categ_nombre: 'Muebles / Decoracion / Libros',                                 sec: ['film', 'caja', 'cinta'] },
  { categ_id: 175, categ_nombre: 'Muebles / Alfombras / Rectangulares / 300 X 400 cm',           sec: ['film', 'bolsa', 'cinta', 'etiqueta'] },
  { categ_id: 92,  categ_nombre: 'Muebles / Decoracion / Floreros y Jarrones',                    sec: ['foam', 'burbuja', 'caja', 'cinta', 'etiqueta'] },
  { categ_id: 95,  categ_nombre: 'Muebles / Decoracion / Velas, Difusores y Fragancias del Hogar', sec: ['burbuja', 'bolsa', 'caja', 'cinta', 'etiqueta'] },
  { categ_id: 91,  categ_nombre: 'Muebles / Decoracion / Espejos',                                sec: ['foam', 'burbuja', 'esquinero', 'carton', 'cinta', 'etiqueta'] },
];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const DRY = process.env.DRY_RUN === '1';

async function main() {
  const token = await getToken();
  const H = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  const api = async (m, p, body) => {
    const r = await fetch(BASE + p, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    return { status: r.status, j };
  };

  console.log('BASE:', BASE, DRY ? '(DRY RUN)' : '');
  const { status: gs, j: gj } = await api('GET', '/api/empaque/materiales');
  if (gs !== 200) throw new Error('GET materiales status ' + gs + ' ' + JSON.stringify(gj));
  const existentes = gj.materiales || [];
  console.log('Materiales existentes en destino:', existentes.length);
  const byName = {}; existentes.forEach(m => { byName[norm(m.nombre)] = m.id; });

  console.log('\n--- Materiales ---');
  for (const mat of MATERIALES) {
    const key = norm(mat.nombre);
    if (byName[key]) { console.log('  = ya existe:', mat.nombre, '->', byName[key]); continue; }
    if (DRY) { console.log('  + (dry) crearía:', mat.nombre); byName[key] = 'dry_' + key; continue; }
    const { status, j } = await api('POST', '/api/empaque/materiales', mat);
    if (status !== 200 || !j.ok) throw new Error('POST material falló: ' + mat.nombre + ' -> ' + status + ' ' + JSON.stringify(j));
    byName[key] = j.material.id;
    console.log('  + creado:', mat.nombre, '->', j.material.id);
  }

  console.log('\n--- Reglas ---');
  for (const r of REGLAS) {
    const materiales = r.sec.map((short, i) => {
      const nombre = M[short]; const id = byName[norm(nombre)];
      if (!id) throw new Error('Material no resuelto: ' + short + ' (' + nombre + ')');
      return { materialId: id, orden: i + 1 };
    });
    if (DRY) { console.log('  ~ (dry) categ', r.categ_id, '->', r.sec.join(' > ')); continue; }
    const { status, j } = await api('POST', '/api/empaque/reglas', { categ_id: r.categ_id, categ_nombre: r.categ_nombre, materiales });
    if (status !== 200 || !j.ok) throw new Error('POST regla falló categ ' + r.categ_id + ' -> ' + status + ' ' + JSON.stringify(j));
    console.log('  ✓ categ', r.categ_id, '->', materiales.length, 'pasos');
  }

  if (DRY) { console.log('\nDRY RUN: no se escribió nada.'); return; }

  console.log('\n=== VERIFICACIÓN /resolve ===');
  const ids = REGLAS.map(r => r.categ_id).join(',');
  const { status: rs, j: rj } = await api('GET', '/api/empaque/resolve?categ_ids=' + ids);
  if (rs !== 200 || !rj.ok) throw new Error('resolve falló ' + rs);
  let ok = 0, bad = 0;
  for (const r of REGLAS) {
    const got = (rj.result[r.categ_id]?.materiales || []).map(m => m.nombre);
    const expected = r.sec.map(s => M[s]);
    const match = got.length === expected.length && got.every((g, i) => norm(g) === norm(expected[i]));
    if (match) { ok++; console.log('  ✓', r.categ_id, got.join(' > ')); }
    else { bad++; console.log('  ✗', r.categ_id, '\n      esperado:', expected.join(' > '), '\n      obtuvo:  ', got.join(' > ')); }
  }
  const { j: finalMat } = await api('GET', '/api/empaque/materiales');
  console.log(`\nRESULTADO: ${ok}/${REGLAS.length} reglas verificadas, ${bad} con discrepancia.`);
  console.log('Total materiales en sistema:', (finalMat.materiales || []).length);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

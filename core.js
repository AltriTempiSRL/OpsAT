// ═══════════════════════════════════════════════════════════════════════
// core.js — núcleo compartido del shell (Ola 1, plan docs/auditoria-arquitectura/08)
// Extraído de historial.html el 2026-07-22 SIN cambios de código:
//   (1/2) auth+red (authFetch/refresh, patch de fetch), RBAC (can/canSection),
//         sesión (doLogin/checkStoredSession), notificaciones + SSE/WS
//         [ex historial.html 8826–11242]
//   (2/2) UTILITIES: esc, autofill de buscadores, showErr, togglePw, fmtDate,
//         toast [ex historial.html 21001–21073]
// REGLAS:
//  - SIN 'use strict': el monolito corre en sloppy mode y los globals
//    implícitos (_token, _user, _tasks…) dependen de eso.
//  - Se carga con <script src> SÍNCRONO en la MISMA posición donde vivía el
//    código (mismo orden de ejecución). No mover el tag ni hacerlo defer/async.
//  - Al editar este archivo: re-estampar el ?v= del tag en historial.html
//    (hash md5-8 del contenido) — los estáticos ?v= se cachean immutable 1 año.
// ═══════════════════════════════════════════════════════════════════════

const WWP_SERVER_ORIGIN = location.protocol === 'file:' ? 'http://localhost:3000' : '';

// ════════════════════════════════════════════════════
//  ✅ C7: LOGGING HELPER — reemplaza catch(e) {} silencioso
// ════════════════════════════════════════════════════
function silentCatch(e, context) {
  // Loguea errores que antes se silenciaban
  console.warn('[' + context + '] Error handled silently:', e.message);
  // TODO: enviar a auditoría en Semana 2
}

// ════════════════════════════════════════════════════
//  ODOO LIVE API
// ════════════════════════════════════════════════════
var ODOO_LIVE=false;
var SHEETS_LIVE=false;
var _sinAdjNoAtt=null;  // lista actual de pickings sin adjunto
var _sinAdjByUser={};   // pickings agrupados por usuario {key → {odooId,name,pickings[]}}
var GS_CACHE={}; // datos vivos de Google Sheets
var SEARCH_MODE='orden'; // 'orden' | 'transferencia' | 'articulo'

var HISTORIAL_SERVER_ORIGIN = location.protocol === 'file:' ? 'http://localhost:3000' : '';
var _historialNativeFetch = window.fetch.bind(window);
window.fetch = function(input, opts) {
  if (typeof input === 'string' && input.charAt(0) === '/') {
    input = HISTORIAL_SERVER_ORIGIN + input;
  }
  return _historialNativeFetch(input, opts);
};


function wwpServerUrl(path) {
  return WWP_SERVER_ORIGIN + path;
}

/** Prepend server origin to server-relative media URLs (works for file:// and localhost) */
function mediaUrl(u) {
  if (!u) return u || '';
  if (u.charAt(0) === '/') return WWP_SERVER_ORIGIN + u;
  return u;
}



// ═══════════════════════════════════════════════════════════════════════
// RBAC — Permisos por módulo (única fuente de verdad en el frontend)
// ═══════════════════════════════════════════════════════════════════════

// Mapa de sectionPerms → clave interna can()
// validate_task ya NO está en el mapa — solo admin puede validar (hardcoded en can())
// 'users_tab'/'wwp.usuarios' retirado (UX-19): el tab Usuarios es admin-only
// hardcoded y ese permiso configurable nunca tuvo efecto.
const _PERM_SP_MAP = {
  'create_task':  'wwp.crear_tarea',
  'edit_task':    'wwp.editar_tarea',
  'delete_task':  'wwp.eliminar_tarea',
  'dashboard':    'wwp.dashboard',
};
// Permisos que siempre son por rol (sin granularidad por usuario)
const PERMISSIONS = {
  users_view:    ['admin','manager'],
  assign_task:   ['admin','manager'],
  update_status: ['admin','manager','assistant'],
  evidence:      ['admin','manager','assistant'],
};

/** Devuelve true si el usuario actual tiene el permiso de acción indicado */
function can(perm) {
  if (!_user) return false;
  if (_user.role === 'admin') return true;  // admin siempre puede todo
  // Validar tarea: solo admin (no se puede otorgar a otros roles)
  if (perm === 'validate_task') return false;
  // Permisos mapeados a sectionPerms
  if (_PERM_SP_MAP[perm]) return !!(_user.sectionPerms||{})[_PERM_SP_MAP[perm]];
  // Fallback a permisos por rol
  return !!(PERMISSIONS[perm]||[]).includes(_user.role);
}

// Secciones operativas habilitadas por defecto para manager. Una clave `false`
// explícita en sectionPerms siempre prevalece sobre este valor por defecto.
// UX-04 (plan 10): 'solicitudes-reposicion' entra al auto-grant — el flujo formal
// de reposición (con aprobación) estaba oculto para el Encargado que lo gestiona.
var _MANAGER_AUTO_GRANT_SECTIONS = ['sdv-bandeja', 'sdv-portal', 'estado-ordenes', 'inventario', 'sdv-reactivations', 'solicitudes-reposicion'];

/** Devuelve true si el usuario puede ver la sección del historial indicada */
function canSection(key) {
  if (!_user) return false;
  if (_user.role === 'admin') return true;
  // Manager: auto-grant para ops, pero sectionPerms puede overridear (false explícito lo bloquea)
  var sp = _user.sectionPerms || {};
  if (_user.role === 'manager' && _MANAGER_AUTO_GRANT_SECTIONS.includes(key)) {
    return Object.prototype.hasOwnProperty.call(sp, key) ? !!sp[key] : true;
  }
  // estado-ordenes: visible si tiene sdv-portal o sdv-bandeja
  if (key === 'estado-ordenes') {
    return Object.prototype.hasOwnProperty.call(sp, 'estado-ordenes') ? !!sp['estado-ordenes'] : (!!sp['sdv-portal'] || !!sp['sdv-bandeja']);
  }
  return !!sp[key];
}

function isAgentOwnerUser() {
  // D2: OpsAgent configurable — cualquier admin o manager tiene acceso.
  // Se eliminaron los emails hardcodeados; el acceso se rige por rol.
  if (!_user) return false;
  return _user.role === 'admin' || _user.role === 'manager';
}

/** Devuelve true si el usuario debe entrar al historial (admin o con sectionPerms asignados) */
function isHistorialUser(u) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  var sp = u.sectionPerms || {};
  return Object.keys(sp).some(function(k){ return !!sp[k]; });
}

// Secciones de CONTENIDO de Despachos (excluye el atajo 'wwp' y los permisos granulares wwp.*)
const _DESPACHOS_SECTIONS = ['buscar','reposicion','solicitudes-reposicion',
  'solicitudes','almacen-mapa','sin-adjuntos','dev-cdp','inventario','averias',
  'sdv-portal','sdv-bandeja'];
/** True si el usuario pertenece a Despachos (tiene al menos una sección de contenido).
 *  Se usa para decidir si el sidebar persistente (app-shell) acompaña a Workforce Labor:
 *  un usuario solo-WWP (sin secciones de Despachos) NO debe ver el marco lateral de Despachos. */
function isDespachosUser(u) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  var sp = u.sectionPerms || {};
  return _DESPACHOS_SECTIONS.some(function(s){ return !!sp[s]; });
}

/** True si el usuario opera en Workforce Labor (WWP). Mismo criterio que
 *  applyNavPerms/goToWWP: el módulo es por rol y ventas no opera ahí. */
function hasWwpAccess(u) {
  u = u || _user;
  return !!u && u.role !== 'ventas';
}

/** Oculta / muestra ítems de nav según sectionPerms del usuario */
function applyNavPerms() {
  var sections = [
    'estado-ordenes','buscar','reposicion','solicitudes-reposicion','solicitudes',
    'almacen-mapa','sin-adjuntos','dev-cdp','despacho-obsoleto',
    'inventario','averias','wwp',
    'sdv-portal','sdv-bandeja','sdv-reactivations'
  ];
  sections.forEach(function(s) {
    // "Workforce Labor" (wwp) es el módulo base donde aterrizan los usuarios operativos
    // (admin/manager/assistant); no depende de una clave de sección granular. Ventas no
    // opera en WWP, así que se excluye explícitamente aunque tenga sesión activa.
    var show = (s === 'wwp') ? (!!_user && _user.role !== 'ventas') : canSection(s);
    var nav = document.getElementById('nav-' + s);
    if (nav) nav.style.display = show ? '' : 'none';
    var mob = document.getElementById('mob-nav-' + s);
    if (mob) mob.style.display = show ? '' : 'none';
  });
  // Atajos del sidebar a tabs WWP (plan 10 Fase 2): Supervisión (admin+manager)
  // y Administración (solo admin). Son accesos de navegación — el guard real del
  // contenido sigue en guardTab + backend.
  var _isAdm = !!_user && _user.role === 'admin';
  var _isMgr = !!_user && _user.role === 'manager';
  var TAB_SHORTCUTS = {
    'nav-wwp-panel':      _isAdm || _isMgr,
    'nav-wwp-evidencias': _isAdm || _isMgr,
    'nav-wwp-impacto':    _isAdm,
    'nav-admin-usuarios': _isAdm,
    'nav-admin-politicas':_isAdm,
    'nav-admin-empaque':  _isAdm
  };
  Object.keys(TAB_SHORTCUTS).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = TAB_SHORTCUTS[id] ? '' : 'none';
  });
  // Ocultar cabeceras de grupo cuando todos sus ítems están ocultos
  var GROUPS = {
    'navg-equipo':      ['wwp'],
    'navg-vd':          ['estado-ordenes','sdv-portal','sdv-bandeja','sdv-reactivations','sin-adjuntos','despacho-obsoleto'],
    'navg-almacen':     ['buscar','inventario','averias','dev-cdp','reposicion','solicitudes-reposicion','solicitudes','almacen-mapa']
  };
  Object.keys(GROUPS).forEach(function(gid) {
    // Mismo criterio que arriba: 'wwp' (Equipo y Tareas) no aplica a ventas.
    var anyVisible = GROUPS[gid].some(function(s){ return s === 'wwp' ? (!!_user && _user.role !== 'ventas') : canSection(s); });
    var el = document.getElementById(gid);
    if (el) el.style.display = anyVisible ? '' : 'none';
  });
  var _grpSup = document.getElementById('navg-supervision');
  if (_grpSup) _grpSup.style.display = (_isAdm || _isMgr) ? '' : 'none';
  var _grpAdm = document.getElementById('navg-admin');
  if (_grpAdm) _grpAdm.style.display = _isAdm ? '' : 'none';
}
/** Redirige a tasks si intenta acceder a un módulo sin permiso */
function guardTab(tab) {
  if (tab === 'dashboard'  && !can('dashboard')) { switchTab('tasks'); return false; }
  if (tab === 'auditor') { switchTab('dashboard'); return false; }
  if (tab === 'users'      && _user?.role !== 'admin') { switchTab('tasks'); return false; }
  if (tab === 'politicas'  && _user?.role !== 'admin') { switchTab('tasks'); return false; }
  if (tab === 'impacto'    && _user?.role !== 'admin') { switchTab('tasks'); return false; }
  if (tab === 'empaque'    && _user?.role !== 'admin') { switchTab('tasks'); return false; } // UX-19: igualado al build (admin-only)
  if (tab === 'archivo'    && !(_user && (_user.role==='admin'||_user.role==='manager'))) { switchTab('tasks'); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// AVATAR HELPERS (icono con iniciales + color por nombre)
// ═══════════════════════════════════════════════════════════════════════
const AVATAR_COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777','#0f766e','#92400e','#374151'];
function initials(name) {
  return (name||'?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
}
function avatarColor(name) {
  const n = name||'?';
  return AVATAR_COLORS[[...n].reduce((s,c)=>s+c.charCodeAt(0),0) % AVATAR_COLORS.length];
}
// Resuelve la mejor referencia para traer la foto de Odoo de un avatar.
// Acepta un objeto usuario ({id, odooId, name}) o un string (nombre).
// Prioridad: userId WWP (au_/oe_) → endpoint /auth/users/:id/odoo-photo;
// si no hay id pero sí odooId → /odoo-photo/:odooId; si solo hay nombre,
// intenta mapearlo a un usuario conocido vía _authUsers (nombre→id/odooId).
// Devuelve {userId, odooId} o null si no hay forma de resolver una foto.
function _avatarRef(u) {
  if (!u) return null;
  if (typeof u === 'string') {
    const n = u.trim().toLowerCase();
    if (!n) return null;
    const m = (_authUsers||[]).find(x => (x.name||'').trim().toLowerCase() === n);
    if (m) return { userId: m.id || null, odooId: (m.odooId != null ? m.odooId : null) };
    return null;
  }
  const userId = u.id || null;
  let odooId = (u.odooId != null && u.odooId !== '') ? u.odooId : null;
  // assignedTo estilo oe_<odooId> sin id propio
  if (!userId && odooId == null && typeof u.assignedTo === 'string' && u.assignedTo.indexOf('oe_') === 0) {
    odooId = u.assignedTo.slice(3);
  }
  if (!userId && odooId == null) return null;
  return { userId, odooId };
}
function avatarHtml(u, size=36) {
  const name = typeof u === 'string' ? u : (u?.name||'?');
  const fs = Math.round(size*0.38);
  // Marcador para hidratar con la foto de Odoo tras el innerHTML (ver hydrateOdooAvatars).
  const ref = _avatarRef(u);
  let dataAttr = '';
  if (ref) {
    if (ref.userId)        dataAttr += ` data-oavatar-uid="${esc(String(ref.userId))}"`;
    else if (ref.odooId!=null) dataAttr += ` data-oavatar-oid="${esc(String(ref.odooId))}"`;
  }
  return `<div class="user-avatar"${dataAttr} style="width:${size}px;height:${size}px;font-size:${fs}px;background:${avatarColor(name)}">${initials(name)}</div>`;
}
function setHeaderAvatar(u) {
  const el = document.getElementById('user-avatar');
  if (!el) return;
  const name = u?.name||'?';
  el.style.background = avatarColor(name);
  el.textContent = initials(name);
  // Foto de Odoo en el header (fallback: las iniciales que acabamos de poner).
  const ref = _avatarRef(u);
  if (ref) applyOdooAvatarFor(el, ref);
}
// Update avatar preview in user modal when name changes
function updateAvatarPreview() {
  const name = document.getElementById('uf-name').value;
  const el = document.getElementById('uf-avatar-preview');
  if (!el) return;
  // Si el preview muestra la foto de Odoo, no la pisamos al teclear el nombre
  if (el.dataset.odooPhoto === '1') return;
  el.textContent = initials(name) || '?';
  el.style.background = name ? avatarColor(name) : 'var(--brand-light)';
}

// ── Fotos de empleado desde Odoo — sistema unificado ─────────────────────────
// El endpoint está protegido por JWT (header Authorization) → NO se puede usar
// <img src="/api/..."> directo: el navegador no manda el header en peticiones de
// imagen y daría 401. Solución: authFetch → blob → dataURL, e inyectar la <img>
// DENTRO del .user-avatar existente (conserva tamaño/borde/responsive del círculo,
// reusa la regla `.user-avatar img` y NO toca el dot de presencia, que es hermano).
// Caché de cliente: Map de clave (uid:/oid:) → Promise<dataURL|null>. Una sola
// petición por empleado para toda la sesión; los re-render reusan el dataURL (no se
// revoca, a diferencia de un objectURL) → una lista de 17 hace ≤17 requests la 1ª
// vez y 0 en los siguientes render. null cacheado = sin foto (no se reintenta).
var _odooPhotoCache = new Map();
function _odooPhotoKey(ref) {
  if (!ref) return null;
  if (ref.userId)        return 'uid:' + ref.userId;
  if (ref.odooId != null) return 'oid:' + ref.odooId;
  return null;
}
function _odooPhotoUrl(ref) {
  if (ref && ref.userId)        return '/api/wwp/auth/users/' + encodeURIComponent(ref.userId) + '/odoo-photo';
  if (ref && ref.odooId != null) return '/api/wwp/odoo-photo/' + encodeURIComponent(ref.odooId);
  return null;
}
// Devuelve (y cachea) una Promise<dataURL|null> para la foto del empleado.
function getOdooPhotoDataURL(ref) {
  const key = _odooPhotoKey(ref);
  if (!key || !_token) return Promise.resolve(null);
  if (_odooPhotoCache.has(key)) return _odooPhotoCache.get(key);
  const p = (async () => {
    try {
      const url = _odooPhotoUrl(ref);
      if (!url) return null;
      const r = await authFetch(url);
      if (!r.ok) return null;            // 404 (sin foto/odooId) o error → iniciales
      const blob = await r.blob();
      if (!blob || !blob.size) return null;
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result || null);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  })();
  _odooPhotoCache.set(key, p);
  // Si falló de forma transitoria (red), permitir reintento en el próximo render.
  p.then(v => { if (v == null) _odooPhotoCache.delete(key); }).catch(() => _odooPhotoCache.delete(key));
  return p;
}
// Inyecta la foto de Odoo DENTRO de un .user-avatar ya renderizado (con iniciales).
// Si no hay foto/ref o falla, deja intactas las iniciales. Idempotente: marca el
// elemento ya hidratado para no re-procesarlo en hidrataciones sucesivas.
async function applyOdooAvatarFor(avatarEl, ref) {
  if (!avatarEl || !ref || !_token) return;
  if (avatarEl.dataset.oavatarDone === '1') return;
  avatarEl.dataset.oavatarDone = '1';
  const dataUrl = await getOdooPhotoDataURL(ref);
  if (!dataUrl) { delete avatarEl.dataset.oavatarDone; return; }  // sin foto → iniciales (permite reintento)
  if (!avatarEl.isConnected) return;                              // el DOM ya cambió (re-render)
  const img = document.createElement('img');
  img.alt = '';
  img.src = dataUrl;
  avatarEl.textContent = '';
  avatarEl.appendChild(img);
}
// Recorre un contenedor recién pintado por innerHTML y sustituye las iniciales por
// la foto de Odoo en cada avatar marcado por avatarHtml() (data-oavatar-uid/-oid).
function hydrateOdooAvatars(root) {
  if (!root || !_token) return;
  const list = root.querySelectorAll('[data-oavatar-uid], [data-oavatar-oid]');
  list.forEach(el => {
    const uid = el.getAttribute('data-oavatar-uid');
    const oid = el.getAttribute('data-oavatar-oid');
    applyOdooAvatarFor(el, uid ? { userId: uid } : { odooId: oid });
  });
}

// ── Fotos de PRODUCTO desde Odoo — mismo patrón que los avatares ─────────────
// Las SDV guardan artículos SIN imagen (solo odoo_product_id; guardar el base64 en
// sdv-solicitudes.json inflaría el archivo crítico y el payload de lista). Los renders
// de articulosOdoo emiten su placeholder con data-oprodimg="<pid>" y hydrateProductImgs
// pide la foto on-demand a GET /api/wwp/product-photo/:pid. authFetch → blob → dataURL
// (JWT va en header: un <img src="/api/..."> directo daría 401). Caché de cliente:
// Map<pid, Promise<dataURL|null>>; null = sin foto → queda el placeholder (package).
var _prodImgCache = new Map();
function getProductImgDataURL(pid) {
  pid = String(pid == null ? '' : pid).trim();
  if (!pid || !_token) return Promise.resolve(null);
  if (_prodImgCache.has(pid)) return _prodImgCache.get(pid);
  const p = (async () => {
    try {
      const r = await authFetch('/api/wwp/product-photo/' + encodeURIComponent(pid));
      if (!r.ok) return null;            // 404 (sin imagen) o 502 (Odoo caído) → placeholder
      const blob = await r.blob();
      if (!blob || !blob.size) return null;
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result || null);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch (e) { return null; }
  })();
  _prodImgCache.set(pid, p);
  // Si falló (red/Odoo caído), permitir reintento en el próximo render.
  p.then(v => { if (v == null) _prodImgCache.delete(pid); }).catch(() => _prodImgCache.delete(pid));
  return p;
}
// Inyecta la foto del producto DENTRO del placeholder marcado (conserva el tamaño y
// border-radius del contenedor). Si no hay foto o falla, el placeholder queda intacto.
// Idempotente: marca el elemento hidratado para no re-procesarlo (igual que avatares).
async function applyProductImgFor(el, pid) {
  if (!el || !pid || !_token) return;
  if (el.dataset.oprodimgDone === '1') return;
  el.dataset.oprodimgDone = '1';
  const dataUrl = await getProductImgDataURL(pid);
  if (!dataUrl) { delete el.dataset.oprodimgDone; return; }  // sin foto → placeholder (permite reintento)
  if (!el.isConnected) return;                               // el DOM ya cambió (re-render)
  const img = document.createElement('img');
  img.alt = '';
  img.src = dataUrl;
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';
  el.textContent = '';
  el.appendChild(img);
}
// Recorre un contenedor recién pintado y resuelve todos los [data-oprodimg].
function hydrateProductImgs(root) {
  if (!root || !_token) return;
  root.querySelectorAll('[data-oprodimg]').forEach(function(el){
    applyProductImgFor(el, el.getAttribute('data-oprodimg'));
  });
}
// Compat: aplica la foto por userId WWP a un .user-avatar concreto (semáforo admin).
async function applyOdooAvatar(avatarEl, userId) {
  if (!avatarEl || !userId) return;
  await applyOdooAvatarFor(avatarEl, { userId });
}
// Aplica la foto de Odoo al círculo de preview del modal de usuario (no es un
// .user-avatar; usa innerHTML propio y la bandera odooPhoto para no pisarla al teclear).
async function applyOdooAvatarPreview(userId) {
  const el = document.getElementById('uf-avatar-preview');
  if (!el || !userId || !_token) return;
  const dataUrl = await getOdooPhotoDataURL({ userId });
  if (!dataUrl || !el.isConnected) return;
  el.style.background = 'transparent';
  el.dataset.odooPhoto = '1';
  el.innerHTML = '<img alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" src="' + dataUrl + '">';
}
// ── FUENTE ÚNICA de labels de tipo/estado de tarea (UX-15, plan 10) ──
// Glosario oficial: la tarea es femenino ("Asignada"), el estado en curso es
// "En curso" (antes convivían "En Progreso"/"En progreso"/"En Proceso"), y el
// tipo packaging es "Empaque" (antes también "Embalaje"). Los mapas locales del
// shell son referencias a estos — NO redeclarar copias.
const TYPE_LABELS = {dispatch_order:'Orden de Despacho',packaging:'Empaque',item_pickup:'Recogida de Artículos',truck_loading:'Carga en Camión',warehouse_move:'Movimiento de Almacén',general:'General',staffing:'Solicitud de Personal',free:'Tarea Libre'};
const TYPE_LABELS_SHORT = {dispatch_order:'Despacho',packaging:'Empaque',item_pickup:'Recogida',truck_loading:'Carga',warehouse_move:'Almacén',general:'General',staffing:'Personal',free:'Libre'};
const STATUS_LABELS = {pending:'Pendiente',assigned:'Asignada',in_progress:'En curso',completed:'Completada',validated:'Validada',cancelled:'Cancelada'};
const STATUS_CSS = {pending:'b-pending',assigned:'b-assigned',in_progress:'b-inprogress',completed:'b-completed',validated:'b-validated',cancelled:'b-cancelled'};
const ROLE_LABELS = {admin:'Admin',manager:'Encargado',assistant:'Auxiliar',ventas:'Ventas'};

function uiMotionReduced() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function uiPlayEnter(el, className) {
  if (!el || uiMotionReduced()) return;
  var motionClass = className || 'ui-view-enter';
  el.classList.remove('ui-view-enter', 'ui-screen-enter');
  void el.offsetWidth;
  el.classList.add(motionClass);
  if (el._uiMotionTimer) clearTimeout(el._uiMotionTimer);
  el._uiMotionTimer = setTimeout(function() {
    el.classList.remove(motionClass);
  }, 340);
}
function uiSetVisible(el, visible, displayValue, className) {
  if (!el) return;
  if (visible) {
    el.style.display = displayValue || '';
    uiPlayEnter(el, className);
  } else {
    el.style.display = 'none';
    el.classList.remove('ui-view-enter', 'ui-screen-enter');
  }
}


// ═══════════════════════════════════════════════════════════════════════
// ÍCONOS LUCIDE — hidratación acotada (perf Android 8 / gama baja)
// La copia local de lucide.min.js NO soporta acotar: createIcons() siempre
// escanea document completo (las opciones {nodes}/{el} se ignoran). Este
// helper replica su reemplazo (icons + createElement, ambos exportados)
// pero solo bajo `root`, y salta los <svg> ya convertidos.
// ═══════════════════════════════════════════════════════════════════════
function lucideHydrate(root) {
  var L = window.lucide;
  if (!L || !root) return;
  if (!L.icons || !L.createElement) { L.createIcons(); return; }  // build distinto: caer al escaneo completo
  var els = root.querySelectorAll('[data-lucide]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (el.tagName.toLowerCase() === 'svg') continue;
    var name = el.getAttribute('data-lucide');
    if (!name) continue;
    var key = name.replace(/(\w)(\w*)(_|-|\s*)/g, function(_, a, b) { return a.toUpperCase() + b.toLowerCase(); });
    var icon = L.icons[key];
    if (!icon) { console.warn('lucideHydrate: ícono no encontrado:', name); continue; }
    var attrs = {};
    for (var j = 0; j < el.attributes.length; j++) attrs[el.attributes[j].name] = el.attributes[j].value;
    var merged = Object.assign({}, icon[1], { 'data-lucide': name }, attrs);
    var cls = ['lucide', 'lucide-' + name].concat(attrs.class ? String(attrs.class).split(' ') : []);
    merged.class = cls.map(function(s) { return s.trim(); }).filter(Boolean)
      .filter(function(s, k, arr) { return arr.indexOf(s) === k; }).join(' ');
    var svg = L.createElement([icon[0], merged, icon[2]]);
    if (el.parentNode) el.parentNode.replaceChild(svg, el);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN MANAGEMENT (merged: 5 screens)
// ═══════════════════════════════════════════════════════════════════════
function showScreen(id) {
  ['screen-login','screen-forgot','screen-reset','screen-historial','screen-app'].forEach((s) => {
    var el = document.getElementById(s);
    if (!el) return;
    if (s === 'screen-app') {
      uiSetVisible(el, s === id, 'flex', 'ui-screen-enter');
      el.classList.toggle('active', s === id);
    } else if (s === 'screen-historial') {
      uiSetVisible(el, s === id, 'block', 'ui-screen-enter');
    } else {
      uiSetVisible(el, s === id, 'flex', 'ui-screen-enter');
    }
  });
  // Íconos: hidratar la pantalla la primera vez que se muestra (el boot ya no
  // convierte pantallas que el usuario no visita — perf en gama baja)
  var _shown = document.getElementById(id);
  if (_shown && !_shown._lucideHydrated) { _shown._lucideHydrated = true; lucideHydrate(_shown); }
  // App-shell: el sidebar lateral fijo acompaña a ambas pantallas para TODOS los roles.
  // applyNavPerms() ya filtra los ítems: cada usuario ve solo sus secciones (un auxiliar
  // solo verá "Workforce Labor"; un encargado, eso + sus secciones de Despachos).
  var _shell = (id === 'screen-historial') || (id === 'screen-app');
  document.body.classList.toggle('app-shell', !!_shell);
  if (_shell) {
    var _sb = document.querySelector('nav.sidebar');
    if (_sb && !_sb._lucideHydrated) { _sb._lucideHydrated = true; lucideHydrate(_sb); }
  }
}
function showLogin() { showScreen('screen-login'); }
function showForgot() { showScreen('screen-forgot'); document.getElementById('forgot-success').classList.remove('show'); document.getElementById('forgot-error').classList.remove('show'); }

// ═══════════════════════════════════════════════════════════════════════
// SESSION BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════
// v180 — push en frío: captura ?notif=<id> / ?task=<id> (los pone el SW al abrir la
// ventana desde un notificationclick sin app abierta) y limpia la URL para que los
// reloads del version-gate no re-naveguen. Antes SOLO se procesaba ?reset= y el clic
// de un push con la app cerrada aterrizaba en la pantalla inicial sin rutear.
function _consumeStartupNotifParams() {
  try {
    var params = new URLSearchParams(location.search);
    var nid = params.get('notif');
    var tid = params.get('task');
    if (!nid && !tid) return null;
    try { history.replaceState(null, '', location.pathname); } catch(e) {}
    return { notifId: nid || null, taskId: tid || null };
  } catch(e) { return null; }
}
function _routeStartupNotifParams(pending) {
  if (!pending || !_token) return;
  // Pequeño delay: deja asentar enterApp/setHistorialUser (nav, secciones) antes de rutear.
  setTimeout(function(){ try { routeNotifClick(pending); } catch(e) {} }, 600);
}

function checkStoredSession() {
  var params = new URLSearchParams(location.search);
  var rt = params.get('reset');
  if (rt) { _resetToken = rt; showScreen('screen-reset'); return; }
  var _pendingNotif = _consumeStartupNotifParams();
  var stored = localStorage.getItem('wwp_auth') || sessionStorage.getItem('wwp_auth');
  if (stored) {
    try {
      var s = JSON.parse(stored);
      _token = s.accessToken; _refreshToken = s.refreshToken; _user = s.user;
      var payload = JSON.parse(atob(_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (payload.exp * 1000 > Date.now()) {
        // Token válido: mostrar con permisos cacheados y refrescar en segundo plano
        // para que cambios de rol (ej. nuevas secciones) se apliquen sin re-login
        landAfterAuth();
        doRefresh().then(function(ok) {
          if (ok) {
            // Re-aplicar con permisos frescos del servidor
            if (isHistorialUser(_user)) { setHistorialUser(); }
            enterApp();
          }
          // Rutear DESPUÉS del re-aplicado: setHistorialUser navega a la primera
          // sección permitida y pisaría la navegación del router si fuera antes.
          _routeStartupNotifParams(_pendingNotif);
        });
        return;
      }
      doRefresh().then(function(ok) {
        if (ok) {
          landAfterAuth();
          _routeStartupNotifParams(_pendingNotif);
        } else { showScreen('screen-login'); }
      });
      return;
    } catch(e) {
      // ✅ C4: Logging en lugar de silencio
      console.error('Auth init failed — corrupt token or data:', e.message);
      _token = null; _refreshToken = null; _user = null;
      localStorage.removeItem('wwp_auth');
      sessionStorage.removeItem('wwp_auth');
    }
  }
  showScreen('screen-login');
}

async function doLogin() {
  const email = document.getElementById('f-email').value.trim();
  const password = document.getElementById('f-password').value;
  const remember = document.getElementById('f-remember').checked;
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('show');
  if (!email) { showErr(errEl,'Por favor escribe el correo'); return; }
  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    const r = await fetch('/api/wwp/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const d = await r.json();
    if (!d.ok) { showErr(errEl, d.error||'Error al iniciar sesión'); btn.disabled=false; btn.textContent='Entrar'; return; }
    _token = d.accessToken; _refreshToken = d.refreshToken; _user = d.user;
    saveSession(remember);
    landAfterAuth();
    // Nivel 1 (jul-21): entró con la contraseña semilla → pedir cambio.
    // forcePwChange (env del server) = modal bloqueante; si no, aviso con acceso directo.
    if (d.mustChangePassword) setTimeout(function(){ showSeedPwModal(!!d.forcePwChange, password); }, 600);
  } catch(e) { showErr(errEl,'Error de conexión con el servidor: '+(e && e.message ? e.message : e)); btn.disabled=false; btn.textContent='Entrar'; }
}

// ── Cambio de contraseña semilla (Nivel 1, jul-21) ────────────────────────────
// Reutiliza el PATCH self-service existente (/api/wwp/auth/users/:id con
// currentPassword+password: re-verifica en servidor, rate-limit, cierra
// las demás sesiones y deja auditoría).
function showSeedPwModal(blocking, currentPw) {
  if (document.getElementById('seedpw-overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'seedpw-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99990;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div style="background:var(--bg-1,#fff);color:var(--text-1,#111);border-radius:14px;max-width:400px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
      '<div style="font-size:16px;font-weight:800;margin-bottom:6px">🔐 Cambia tu contraseña</div>' +
      '<div style="font-size:13px;color:var(--text-2,#555);margin-bottom:14px">Estás usando la contraseña inicial del sistema. Por seguridad, define una personal (mínimo 6 caracteres).</div>' +
      '<input type="password" id="seedpw-new" placeholder="Nueva contraseña" autocomplete="new-password" style="width:100%;padding:10px;border:1px solid var(--border,#ccc);border-radius:8px;margin-bottom:8px;font-size:14px">' +
      '<input type="password" id="seedpw-new2" placeholder="Repite la nueva contraseña" autocomplete="new-password" style="width:100%;padding:10px;border:1px solid var(--border,#ccc);border-radius:8px;margin-bottom:8px;font-size:14px">' +
      '<div id="seedpw-err" style="color:var(--red-text,#b91c1c);font-size:12px;min-height:16px;margin-bottom:8px"></div>' +
      '<button id="seedpw-save" style="width:100%;padding:11px;border:0;border-radius:8px;background:var(--accent,#2563eb);color:#fff;font-weight:700;font-size:14px;cursor:pointer">Guardar contraseña nueva</button>' +
      (blocking ? '' : '<button id="seedpw-later" style="width:100%;padding:9px;border:0;border-radius:8px;background:transparent;color:var(--text-3,#777);font-size:12px;cursor:pointer;margin-top:6px">Más tarde</button>') +
    '</div>';
  document.body.appendChild(ov);
  var err = document.getElementById('seedpw-err');
  document.getElementById('seedpw-save').onclick = async function() {
    var p1 = document.getElementById('seedpw-new').value;
    var p2 = document.getElementById('seedpw-new2').value;
    if (!p1 || p1.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }
    if (p1 !== p2) { err.textContent = 'Las contraseñas no coinciden.'; return; }
    if (p1 === currentPw) { err.textContent = 'Debe ser diferente a la actual.'; return; }
    this.disabled = true; this.textContent = 'Guardando…';
    try {
      var r = await authFetch('/api/wwp/auth/users/' + _user.id, {
        method: 'PATCH', body: JSON.stringify({ currentPassword: currentPw, password: p1 })
      });
      var d = await r.json();
      if (!d.ok) { err.textContent = d.error || 'No se pudo cambiar.'; this.disabled = false; this.textContent = 'Guardar contraseña nueva'; return; }
      ov.remove();
      toast('🔐 Contraseña actualizada. Úsala en tu próximo ingreso.', 5000);
    } catch (e) { err.textContent = 'Error de conexión.'; this.disabled = false; this.textContent = 'Guardar contraseña nueva'; }
  };
  var later = document.getElementById('seedpw-later');
  if (later) later.onclick = function() { ov.remove(); toast('Recuerda cambiar tu contraseña en Mi Perfil.', 4000); };
}

async function doRefresh() {
  try {
    const r = await fetch('/api/wwp/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:_refreshToken})});
    const d = await r.json();
    if (!d.ok) return false;
    _token = d.accessToken; _user = d.user;
    saveSession(!!localStorage.getItem('wwp_auth'));
    return true;
  } catch { return false; }
}

async function doLogout() {
  closeProfileMenu();
  try { await authFetch('/api/wwp/auth/logout',{method:'POST',body:JSON.stringify({refreshToken:_refreshToken})}); } catch {}
  _token=null; _refreshToken=null; _user=null; _wwpEntered=false;
  localStorage.removeItem('wwp_auth'); sessionStorage.removeItem('wwp_auth');
  // Close SSE connection and reset notifications
  if (_sseSource) { _sseSource.close(); _sseSource = null; }
  if (_wwpSocketRetry) { clearTimeout(_wwpSocketRetry); _wwpSocketRetry = null; }
  if (_wwpSocket) { try { _wwpSocket.close(); } catch(e) { silentCatch(e, 'closeWwpSocket'); } _wwpSocket = null; }
  _notifications = [];
  closeNotifPanel();
  showScreen('screen-login');
}

function saveSession(persist) {
  const data = JSON.stringify({accessToken:_token,refreshToken:_refreshToken,user:_user});
  if (persist) { localStorage.setItem('wwp_auth',data); sessionStorage.removeItem('wwp_auth'); }
  else { sessionStorage.setItem('wwp_auth',data); localStorage.removeItem('wwp_auth'); }
}

async function authFetch(url, opts={}, timeoutMs) {
  opts.headers = {...(opts.headers||{}), 'Authorization':'Bearer '+_token, 'Content-Type':'application/json'};
  let r = await fetchWithTimeout(url, opts, timeoutMs);
  if (r.status===401) {
    const ok = await doRefresh();
    if (!ok) { doLogout(); throw new Error('Sesión expirada'); }
    opts.headers['Authorization'] = 'Bearer '+_token;
    r = await fetchWithTimeout(url, opts, timeoutMs);
  }
  return r;
}

// Como authFetch, pero reintenta ante fallas de RED puras (conexión caída a
// mitad de subida, típico en wifi/datos débiles de almacén) — nunca reintenta
// si la petición ya llegó al servidor y este respondió con error.
// onRetry(attempt, totalRetries) se llama antes de cada reintento, útil para
// avisar en la UI que sigue intentando en vez de fallar de una vez.
async function authFetchRetry(url, opts={}, retries, onRetry){
  retries = retries===undefined ? 3 : retries;
  var backoff = [1500, 3000, 6000, 6000];
  for(var attempt=0; ; attempt++){
    try{
      var r = await authFetch(url, opts);
      // Nuestra API siempre responde JSON. Si no lo es, algo fuera de la app
      // contestó (ej. el borde de Railway durante el intercambio de un deploy,
      // que devuelve un "Not Found" en texto plano) — tratarlo como falla
      // transitoria y reintentar, en vez de explotar en el .json() del caller.
      var ct = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
      if(ct.indexOf('json')===-1){
        throw Object.assign(new Error('Respuesta inesperada del servidor (status '+r.status+', no es JSON)'), {_nonJson:true});
      }
      return r;
    }catch(e){
      var isRetryable = (e instanceof TypeError) || e._nonJson;
      if(!isRetryable || attempt>=retries) throw e;
      if(onRetry) try{ onRetry(attempt+1, retries); }catch(_e){}
      await new Promise(function(res){ setTimeout(res, backoff[attempt]||6000); });
    }
  }
}
function _friendlyFetchError(e){
  if(e instanceof TypeError) return 'Sin conexión estable. Intenta de nuevo cuando tengas señal.';
  if(e && e._nonJson) return 'El servidor no respondió correctamente (puede ser un despliegue en curso). Intenta de nuevo en unos segundos.';
  return 'Error: '+e.message;
}

function fetchWithTimeout(url, opts, timeoutMs) {
  if (!timeoutMs || typeof AbortController === 'undefined') return fetch(url, opts);
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
  const merged = {...(opts||{}), signal: ctrl.signal};
  return fetch(url, merged).finally(function(){ clearTimeout(timer); });
}

function xhrJson(url, token, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = timeoutMs || 15000;
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function() {
      var data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; }
      catch(e) { reject(new Error('Respuesta inválida del servidor')); return; }
      resolve({status:xhr.status, ok:xhr.status >= 200 && xhr.status < 300, data:data});
    };
    xhr.onerror = function() { reject(new Error('Error de red al cargar tareas')); };
    xhr.ontimeout = function() { reject(new Error('Tiempo agotado cargando tareas')); };
    xhr.send();
  });
}

async function authGetJson(url, timeoutMs) {
  var r = await xhrJson(url, _token, timeoutMs);
  if (r.status === 401) {
    var ok = await doRefresh();
    if (!ok) { doLogout(); throw new Error('Sesión expirada'); }
    r = await xhrJson(url, _token, timeoutMs);
  }
  if (!r.ok) throw new Error((r.data && r.data.error) || ('Error del servidor: ' + r.status));
  return r.data;
}

async function doForgot() {
  const email = document.getElementById('f-forgot-email').value.trim();
  const errEl = document.getElementById('forgot-error');
  const succEl = document.getElementById('forgot-success');
  errEl.classList.remove('show'); succEl.classList.remove('show');
  if (!email) { showErr(errEl,'Por favor ingresa tu correo'); return; }
  try {
    await fetch('/api/wwp/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
    document.getElementById('forgot-form').style.display='none';
    succEl.textContent='Si el correo existe, recibirás instrucciones de recuperación.';
    succEl.classList.add('show');
  } catch { showErr(errEl,'Error de conexión'); }
}

async function doReset() {
  const pw = document.getElementById('f-new-pw').value;
  const confirm = document.getElementById('f-confirm-pw').value;
  const errEl = document.getElementById('reset-error');
  errEl.classList.remove('show');
  if (pw.length<6) { showErr(errEl,'La contraseña debe tener al menos 6 caracteres'); return; }
  if (pw!==confirm) { showErr(errEl,'Las contraseñas no coinciden'); return; }
  try {
    const r = await fetch('/api/wwp/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:_resetToken,password:pw})});
    const d = await r.json();
    if (!d.ok) { showErr(errEl,d.error); return; }
    toast('Contraseña actualizada. Inicia sesión.');
    history.replaceState({},'',location.pathname);
    showScreen('screen-login');
  } catch { showErr(errEl,'Error de conexión'); }
}

async function doChangePassword() {
  const current = document.getElementById('pm-current').value;
  const pw = document.getElementById('pm-new').value;
  const confirm = document.getElementById('pm-confirm').value;
  const errEl = document.getElementById('pw-modal-error');
  errEl.classList.remove('show');
  if (!current) { showErr(errEl,'Ingresa tu contraseña actual'); return; }
  if (pw.length<6) { showErr(errEl,'La nueva contraseña debe tener al menos 6 caracteres'); return; }
  if (pw!==confirm) { showErr(errEl,'Las contraseñas no coinciden'); return; }
  try {
    const r = await authFetch('/api/wwp/auth/users/'+_user.id,{method:'PATCH',body:JSON.stringify({currentPassword:current,password:pw})});
    const d = await r.json();
    if (!d.ok) { showErr(errEl,d.error); return; }
    closePasswordModal();
    toast('Contraseña actualizada correctamente');
  } catch(e) { showErr(errEl,'Error: '+e.message); }
}

// ═══════════════════════════════════════════════════════════════════════
// PRESENCIA
// ═══════════════════════════════════════════════════════════════════════
// ─── Configuración de estados de presencia ────────────────────────────────
const PRESENCE_CONFIG = {
  active:  { label:'Disponible',    icon:'', dot:'#059669' },
  lunch:   { label:'En Almuerzo',   icon:'', dot:'#d97706' },
  offline: { label:'Fuera de Línea',icon:'', dot:'#9ca3af' },
};

// ─── Timer de almuerzo ─────────────────────────────────────────────────────
var _lunchTimer = null;
function startLunchTimer() {
  stopLunchTimer();
  // El timer corre internamente para detectar exceso, pero NO se muestra en el header
  // El servidor gestiona el auto-cierre y notifica cuando termina
  const allowed = (_user.lunchTimeAllowed || 60) * 60 * 1000; // ms
  function tick() {
    const elapsed = Date.now() - new Date(_user.presenceAt).getTime();
    if (elapsed > allowed && elapsed - allowed < 2000) {
      toast('Tiempo de almuerzo excedido');
    }
  }
  tick();
  _lunchTimer = setInterval(tick, 1000);
}
function stopLunchTimer() {
  if (_lunchTimer) { clearInterval(_lunchTimer); _lunchTimer = null; }
}

// ─── Renderizar botón de presencia ────────────────────────────────────────
function renderPresenceBtn() {
  const btn = document.getElementById('presence-btn');
  const dot = document.getElementById('presence-dot');
  const lbl = document.getElementById('presence-label');
  if (!btn) return;
  if (_user.role === 'admin') { btn.style.display = 'none'; return; }
  const status = _user.presenceStatus || 'active';
  const cfg = PRESENCE_CONFIG[status] || PRESENCE_CONFIG.active;
  btn.style.display = '';
  btn.className = `presence-btn ${status}`;
  dot.className  = `presence-dot ${status}`;
  lbl.textContent = cfg.label;
  // Marcar opción seleccionada en el menú
  document.querySelectorAll('.presence-option').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('onclick')===`setPresence('${status}')`);
  });
  // Timer
  if (status === 'lunch') { startLunchTimer(); }
  else { stopLunchTimer(); }
}

// ─── Abrir/cerrar menú de presencia ──────────────────────────────────────
function openPresenceMenu(e) {
  e.stopPropagation();
  document.getElementById('presence-menu').classList.toggle('open');
}
document.addEventListener('click', () => {
  const m = document.getElementById('presence-menu');
  if (m) m.classList.remove('open');
});

// ─── Cambiar presencia ────────────────────────────────────────────────────
async function setPresence(status) {
  document.getElementById('presence-menu').classList.remove('open');
  if ((_user.presenceStatus || 'active') === status) return; // sin cambio
  const btn = document.getElementById('presence-btn');
  if (btn) btn.style.opacity = '0.5';
  try {
    const r = await authFetch('/api/wwp/auth/presence', {
      method: 'PATCH', body: JSON.stringify({status})
    });
    const d = await r.json();
    if (d.ok) {
      _user.presenceStatus = d.presenceStatus;
      _user.presenceAt     = d.presenceAt;
      if (d.lunchTimeAllowed) _user.lunchTimeAllowed = d.lunchTimeAllowed;
      const idx = (_authUsers||[]).findIndex(u => u.id === _user.id);
      if (idx >= 0) {
        _authUsers[idx].presenceStatus = d.presenceStatus;
        _authUsers[idx].presenceAt     = d.presenceAt;
      }
      renderPresenceBtn();
    } else { toast((d.error||'Error al cambiar estado')); }
  } catch(e) { toast('Error al cambiar estado'); }
  finally { const b = document.getElementById('presence-btn'); if (b) b.style.opacity = ''; }
}

// Mantener compatibilidad con código viejo (si hubiera referencias)
function togglePresence() { openPresenceMenu({stopPropagation:()=>{}}); }

function applyPresenceChange(userId, presenceStatus, presenceAt, lunchTimeAllowed) {
  // Actualizar _authUsers
  const idx = (_authUsers||[]).findIndex(u => u.id === userId);
  if (idx >= 0) {
    _authUsers[idx].presenceStatus  = presenceStatus;
    _authUsers[idx].presenceAt      = presenceAt;
    if (lunchTimeAllowed) _authUsers[idx].lunchTimeAllowed = lunchTimeAllowed;
  }
  // Si es el propio usuario → actualizar estado y timer
  if (userId === _user.id) {
    _user.presenceStatus = presenceStatus;
    _user.presenceAt     = presenceAt;
    if (lunchTimeAllowed) _user.lunchTimeAllowed = lunchTimeAllowed;
    renderPresenceBtn();
  }
  // Si Users tab está activa, actualizar la fila en vivo
  if (_currentTab === 'users') updateUserPresenceInList(userId, presenceStatus);
}

function updateUserPresenceInList(userId, presenceStatus) {
  const pill = document.querySelector(`[data-presence-user="${userId}"]`);
  if (!pill) return;
  const cfg = PRESENCE_CONFIG[presenceStatus] || PRESENCE_CONFIG.active;
  pill.className = `user-presence-pill ${presenceStatus}`;
  pill.textContent = cfg.icon + ' ' + cfg.label;
  // Actualizar también el dot del avatar
  const dot = document.querySelector(`.avatar-presence[data-presence-dot="${userId}"]`);
  if (dot) dot.className = `avatar-presence ${presenceStatus}`;
}

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICACIONES
// ═══════════════════════════════════════════════════════════════════════
var _notifPanelOpen = false;
var _audioCtx = null;
var _notifSoundEnabled = localStorage.getItem('wwp_notif_sound') !== 'off';
// v181 — el usuario ya no elige tono (el sonido lo decide la urgencia, familia
// "Atrio"); elige VOLUMEN: Bajo .6 · Normal 1 · Alto 1.5. Migración limpia:
// se elimina la clave del tono viejo para no dejar basura en localStorage.
var _notifSoundVol = parseFloat(localStorage.getItem('wwp_notif_vol') || '1');
if ([0.6, 1, 1.5].indexOf(_notifSoundVol) === -1) _notifSoundVol = 1;
try { localStorage.removeItem('wwp_notif_tone'); } catch(e) {}
var _lastUnread        = null; // null = primera carga, no suena
var _notifFilterCat    = 'all'; // filtro de categoría — por sesión, cada apertura arranca en Todas
var _notifUnreadOnly   = localStorage.getItem('wwp_notif_unread_only') === '1';
var _notifSettingsOpen = false;
var _notifPrefs        = null;  // {tareas:'all'|'panel'|'off', ...} — cargado del servidor
try { _notifPrefs = JSON.parse(localStorage.getItem('wwp_notif_prefs') || 'null'); } catch(e) {}
var _notifPrefsSaveTimer = null;
var _NOTIF_PREF_ROWS = [
  { id:'tareas',       label:'Tareas' },
  { id:'sdv',          label:'Solicitudes SDV' },
  { id:'operacion',    label:'Operación' },
  { id:'chat',         label:'Chat' },
  { id:'coordinacion', label:'Coordinación' }, // v180: piso 'panel' — el server no la deja en off total
  { id:'sistema',      label:'Sistema' }
];
var _NOTIF_PREF_OPTS = [
  { id:'all',   label:'Todo' },
  { id:'panel', label:'Solo panel' },
  { id:'off',   label:'Apagar' }
];

// Desbloquear AudioContext en el primer gesto del usuario
(function() {
  function _unlockAudio() {
    if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
    document.removeEventListener('pointerdown', _unlockAudio);
    document.removeEventListener('keydown', _unlockAudio);
  }
  document.addEventListener('pointerdown', _unlockAudio, {once: true});
  document.addEventListener('keydown', _unlockAudio, {once: true});
})();

// v181 — el sonido lo decide la URGENCIA estampada por el servidor, no el tipo
// (el mapa por-tipo _NOTIF_TONE_MAP se retiró: pisaba la elección del usuario y
// no formaba un lenguaje). Chat y coordinación llevan el percusivo "toc-toc":
// te habla un humano, no el sistema.
function _notifSoundOf(n) {
  var cat = notifCategory(n);
  if (cat === 'chat' || cat === 'coordinacion') return 'chat';
  var u = notifUrgency(n);
  return (u === 'critical' || u === 'alert' || u === 'success') ? u : 'info';
}
// Vibración diferenciada por sonido (Android): crítico insiste, humano toca suave.
var _NOTIF_VIBRATE = { critical:[200,80,200,80,200], alert:[120,60,120], chat:[60,40,60], success:[80], info:[80] };

// ═══ ESPEJO de NOTIF_META en proxy.js (~4453) — mantener en sincronía (igual que APP_BUILD) ═══
// El servidor estampa category/urgency en cada notif nueva; este espejo deriva
// los campos para notificaciones históricas persistidas antes del cambio.
var _NOTIF_META = {
  // tareas
  task_assigned:{cat:'tareas',urg:'info'}, subtask_assigned:{cat:'tareas',urg:'info'},
  status_changed:{cat:'tareas',urg:'info'}, task_status:{cat:'tareas',urg:'info'},
  task_updated:{cat:'tareas',urg:'info'}, ready_to_validate:{cat:'tareas',urg:'info'},
  task_overdue:{cat:'tareas',urg:'critical'}, task_rejected:{cat:'tareas',urg:'critical'},
  task_completed:{cat:'tareas',urg:'success'}, task_validated:{cat:'tareas',urg:'success'},
  task_cancelled:{cat:'tareas',urg:'alert'},
  // sdv
  sdv_new_pending:{cat:'sdv',urg:'info'}, sdv_task_created:{cat:'sdv',urg:'info'},
  sdv_cancelada:{cat:'sdv',urg:'alert'}, sdv_origen_cancelada:{cat:'sdv',urg:'alert'},
  sdv_additional_new:{cat:'sdv',urg:'info'}, sdv_additional_linked:{cat:'sdv',urg:'info'},
  sdv_additional_manager:{cat:'sdv',urg:'info'},
  reactivacion_pendiente:{cat:'sdv',urg:'alert'}, reactivacion_procesada:{cat:'sdv',urg:'success'},
  dev_en_ruta:{cat:'sdv',urg:'info'},
  // canal vendedora (v180) — urgencia = la del tipo que reusaban antes
  sdv_seller_aprobada:{cat:'sdv',urg:'info'}, sdv_seller_rechazada:{cat:'sdv',urg:'critical'},
  sdv_seller_en_ruta:{cat:'sdv',urg:'info'}, sdv_seller_despachada:{cat:'sdv',urg:'success'},
  sdv_seller_parcial:{cat:'sdv',urg:'success'},
  // v181: pausa sube info→alert — una pausa de SU pedido es la señal más accionable
  // del ciclo para la vendedora (precursor de cancelación; a menudo ella destraba)
  sdv_seller_pausa:{cat:'sdv',urg:'alert'},
  sdv_seller_cancelada:{cat:'sdv',urg:'alert'}, sdv_seller_reactivada:{cat:'sdv',urg:'info'},
  sdv_seller_reprogramada:{cat:'sdv',urg:'alert'},
  // operacion
  pick_incomplete:{cat:'operacion',urg:'critical'}, packing_blocked:{cat:'operacion',urg:'critical'},
  damage_detected:{cat:'operacion',urg:'critical'}, cancel_blocked:{cat:'operacion',urg:'critical'},
  evidence_incomplete:{cat:'operacion',urg:'alert'}, missing_evidence:{cat:'operacion',urg:'alert'},
  stock_changed:{cat:'operacion',urg:'alert'},
  inventario_negativo:{cat:'operacion',urg:'critical'},
  reposicion_nueva:{cat:'operacion',urg:'info'}, reposicion_aprobada:{cat:'operacion',urg:'success'},
  reposicion_rechazada:{cat:'operacion',urg:'alert'},
  geo_evidencia_lejos:{cat:'operacion',urg:'alert'}, geo_sin_senal:{cat:'operacion',urg:'alert'},
  // chat
  comment_new:{cat:'chat',urg:'info'}, task_chat:{cat:'chat',urg:'info'},
  // tareas (v180): re-examen LMS
  curso_retake:{cat:'tareas',urg:'info'},
  // sistema
  system_sync_error:{cat:'sistema',urg:'critical'}, agent_routine:{cat:'sistema',urg:'info'},
  lunch_ended:{cat:'sistema',urg:'info'}, user_notification:{cat:'sistema',urg:'info'}
};

var _NOTIF_CATS = [
  { id:'all',          label:'Todas'        },
  { id:'tareas',       label:'Tareas'       },
  { id:'sdv',          label:'SDV'          },
  { id:'operacion',    label:'Operación'    },
  { id:'chat',         label:'Chat'         },
  { id:'coordinacion', label:'Coordinación' }, // v180: groundwork — tipos llegan en v182
  { id:'sistema',      label:'Sistema'      }
];

function _notifCategoryFallback(type) {
  type = type || '';
  if (/^sdv_|reactivacion|dev_en/.test(type)) return 'sdv';
  if (/pick|pack|damage|stock|evidence|reposicion|cancel_blocked/.test(type)) return 'operacion';
  if (/chat|comment/.test(type)) return 'chat';
  if (/^task_|assigned|status|overdue|validated|completed/.test(type)) return 'tareas';
  return 'sistema';
}

// Categoría/urgencia de una notif: usa el campo estampado por el servidor;
// deriva del espejo para notifs históricas sin campo.
function notifCategory(n) {
  if (n && n.category) return n.category;
  var m = n && _NOTIF_META[n.type];
  if (m) return m.cat;
  return _notifCategoryFallback(n && n.type);
}
function notifUrgency(n) {
  if (n && n.urgency) return n.urgency;
  var m = n && _NOTIF_META[n.type];
  if (m) return m.urg;
  return 'info';
}

// Ícono + color por tipo — constante de módulo (antes se recreaba en cada render)
var _NOTIF_ICONS = {
  // Tareas WWP
  task_assigned    : { icon:'clipboard-list', cls:'ni-info',    bg:'--blue-bg',   color:'--blue-text'   },
  subtask_assigned : { icon:'paperclip',      cls:'ni-info',    bg:'--blue-bg',   color:'--blue-text'   },
  status_changed   : { icon:'refresh-cw',     cls:'ni-info',    bg:'--sky-bg',    color:'--sky-text'    },
  task_status      : { icon:'refresh-cw',     cls:'ni-info',    bg:'--sky-bg',    color:'--sky-text'    },
  task_updated     : { icon:'refresh-cw',     cls:'ni-info',    bg:'--sky-bg',    color:'--sky-text'    },
  ready_to_validate: { icon:'clipboard-check',cls:'ni-info',    bg:'--blue-bg',   color:'--blue-text'   },
  task_overdue     : { icon:'alert-triangle', cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  task_completed   : { icon:'check-circle',   cls:'ni-success', bg:'--green-bg',  color:'--green-text'  },
  task_validated   : { icon:'award',          cls:'ni-success', bg:'--green-bg',  color:'--green-text'  },
  task_rejected    : { icon:'x-circle',       cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  task_cancelled   : { icon:'slash',          cls:'ni-alert',   bg:'--amber-bg',  color:'--amber-text'  },
  // Chat
  comment_new      : { icon:'message-square', cls:'ni-chat',    bg:'--purple-bg', color:'--purple-text' },
  task_chat        : { icon:'message-square', cls:'ni-chat',    bg:'--purple-bg', color:'--purple-text' },
  // SDV
  sdv_new_pending  : { icon:'inbox',          cls:'ni-info',    bg:'--blue-bg',   color:'--blue-text'   },
  sdv_task_created : { icon:'clipboard-list', cls:'ni-info',    bg:'--blue-bg',   color:'--blue-text'   },
  sdv_cancelada    : { icon:'x-circle',       cls:'ni-alert',   bg:'--amber-bg',  color:'--amber-text'  },
  sdv_origen_cancelada   : { icon:'x-circle',    cls:'ni-alert', bg:'--amber-bg', color:'--amber-text'  },
  sdv_additional_new     : { icon:'inbox',       cls:'ni-info',  bg:'--blue-bg',  color:'--blue-text'   },
  sdv_additional_linked  : { icon:'link',        cls:'ni-info',  bg:'--blue-bg',  color:'--blue-text'   },
  sdv_additional_manager : { icon:'inbox',       cls:'ni-info',  bg:'--blue-bg',  color:'--blue-text'   },
  reactivacion_pendiente : { icon:'rotate-ccw',  cls:'ni-alert', bg:'--amber-bg', color:'--amber-text'  },
  reactivacion_procesada : { icon:'check-circle',cls:'ni-success',bg:'--green-bg',color:'--green-text'  },
  dev_en_ruta      : { icon:'truck',          cls:'ni-info',    bg:'--sky-bg',    color:'--sky-text'    },
  // Canal vendedora (v180)
  sdv_seller_aprobada    : { icon:'check-circle', cls:'ni-info',    bg:'--blue-bg',  color:'--blue-text'  },
  sdv_seller_rechazada   : { icon:'x-circle',     cls:'ni-critical',bg:'--red-bg',   color:'--red-text'   },
  sdv_seller_en_ruta     : { icon:'truck',        cls:'ni-info',    bg:'--sky-bg',   color:'--sky-text'   },
  sdv_seller_despachada  : { icon:'package',      cls:'ni-success', bg:'--green-bg', color:'--green-text' },
  sdv_seller_parcial     : { icon:'package',      cls:'ni-success', bg:'--green-bg', color:'--green-text' },
  sdv_seller_pausa       : { icon:'pause-circle', cls:'ni-info',    bg:'--amber-bg', color:'--amber-text' },
  sdv_seller_cancelada   : { icon:'slash',        cls:'ni-alert',   bg:'--amber-bg', color:'--amber-text' },
  sdv_seller_reactivada  : { icon:'rotate-ccw',   cls:'ni-info',    bg:'--sky-bg',   color:'--sky-text'   },
  sdv_seller_reprogramada: { icon:'calendar-clock',cls:'ni-alert',  bg:'--amber-bg', color:'--amber-text' },
  curso_retake           : { icon:'graduation-cap',cls:'ni-info',   bg:'--blue-bg',  color:'--blue-text'  },
  // Operación (picking/empaque/stock/reposición)
  pick_incomplete  : { icon:'alert-triangle', cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  packing_blocked  : { icon:'shield-alert',   cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  damage_detected  : { icon:'alert-circle',   cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  cancel_blocked   : { icon:'x-circle',       cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  evidence_incomplete:{ icon:'camera',        cls:'ni-alert',   bg:'--amber-bg',  color:'--amber-text'  },
  missing_evidence : { icon:'camera',         cls:'ni-alert',   bg:'--amber-bg',  color:'--amber-text'  },
  stock_changed    : { icon:'package',        cls:'ni-alert',   bg:'--orange-bg', color:'--orange-text' },
  inventario_negativo : { icon:'package-x',   cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  reposicion_nueva : { icon:'package-plus',   cls:'ni-info',    bg:'--sky-bg',    color:'--sky-text'    },
  reposicion_aprobada:{ icon:'check-circle',  cls:'ni-success', bg:'--green-bg',  color:'--green-text'  },
  reposicion_rechazada:{ icon:'x-circle',     cls:'ni-alert',   bg:'--amber-bg',  color:'--amber-text'  },
  // Sistema
  system_sync_error: { icon:'alert-octagon',  cls:'ni-critical',bg:'--red-bg',    color:'--red-text'    },
  agent_routine    : { icon:'cpu',            cls:'ni-info',    bg:'--purple-bg', color:'--purple-text' },
  lunch_ended      : { icon:'utensils',       cls:'ni-info',    bg:'--surface-3', color:'--text-3'      },
  user_notification: { icon:'bell',           cls:'ni-info',    bg:'--sky-bg',    color:'--sky-text'    }
};
var _NOTIF_ICON_DEFAULT = { icon:'bell', cls:'ni-info', bg:'--sky-bg', color:'--sky-text' };

// ═══ v181 — Familia sonora "Atrio" (Web Audio, sin archivos) ═══════════════
// Campana cálida: triángulo + armónico seno de octava, afinada en Re mayor
// pentatónico (colisiones entre avisos seguidos suenan musicales), banda
// 600–1800 Hz (audible en almacén sin estridencia en oficina), ataque 8–12 ms
// (4 ms percusivo), decaimiento exponencial a 0.001. Significado direccional:
// sube = va bien · baja = atención · pulsa = urgente · percute = te hablan ·
// gota = info. Aprobada por Gabriel sobre el mockup 2026-07-10.
function _sndNote(o) {
  var ctx = _audioCtx;
  var now = ctx.currentTime;
  var osc = ctx.createOscillator();
  var g = ctx.createGain();
  osc.connect(g); g.connect(ctx.destination);
  osc.type = o.type || 'triangle';
  osc.frequency.setValueAtTime(o.f, now + o.t);
  if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, now + o.t + (o.glide || o.dur * 0.6));
  var atk = (o.atk != null) ? o.atk : 0.010;
  var v = Math.min(o.vol * _notifSoundVol, 0.32); // techo duro: nunca ensordecer
  g.gain.setValueAtTime(0.0001, now + o.t);
  g.gain.linearRampToValueAtTime(v, now + o.t + atk);
  g.gain.exponentialRampToValueAtTime(0.001, now + o.t + o.dur);
  osc.start(now + o.t);
  osc.stop(now + o.t + o.dur + 0.02);
}
var _NOTIF_SOUNDS = {
  info: function(){ // Gota — 1 nota suave (La5): lo informativo apenas se anuncia
    _sndNote({f:880,    type:'triangle', t:0,    dur:0.38, vol:0.14});
    _sndNote({f:1760,   type:'sine',     t:0,    dur:0.30, vol:0.045});
  },
  success: function(){ // Resuelto — quinta ascendente Re5→La5: cierre positivo
    _sndNote({f:587.33, type:'triangle', t:0,    dur:0.40, vol:0.15});
    _sndNote({f:880,    type:'triangle', t:0.16, dur:0.50, vol:0.16});
    _sndNote({f:1760,   type:'sine',     t:0.16, dur:0.40, vol:0.04});
  },
  alert: function(){ // Atención — cuarta descendente Si5→Fa#5: "algo necesita de ti"
    _sndNote({f:987.77, type:'triangle', t:0,    dur:0.38, vol:0.19});
    _sndNote({f:1975.5, type:'sine',     t:0,    dur:0.25, vol:0.05});
    _sndNote({f:739.99, type:'triangle', t:0.22, dur:0.45, vol:0.17});
    _sndNote({f:1479.98,type:'sine',     t:0.22, dur:0.30, vol:0.045});
  },
  critical: function(){ // Urgente — 3 pulsos del acorde tenso La5+Re6 (+refuerzo Re5)
    [0, 0.19, 0.38].forEach(function(p){
      _sndNote({f:880,     type:'triangle', t:p, dur:0.16, vol:0.22});
      _sndNote({f:1174.66, type:'triangle', t:p, dur:0.16, vol:0.16});
      _sndNote({f:587.33,  type:'sine',     t:p, dur:0.16, vol:0.06});
    });
  },
  chat: function(){ // Toc-toc — 2 golpes percusivos con bend: inconfundiblemente humano
    _sndNote({f:640, type:'sine', t:0,    dur:0.13, vol:0.20, fEnd:560, glide:0.07, atk:0.004});
    _sndNote({f:720, type:'sine', t:0.15, dur:0.13, vol:0.18, fEnd:630, glide:0.07, atk:0.004});
  }
};
function _playSound(key) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    (_NOTIF_SOUNDS[key] || _NOTIF_SOUNDS.info)();
  } catch(e) {}
}

var _notifRepeatTimer = null;

function withinNotifHours() {
  try {
    var stored = localStorage.getItem('wwp_notif_hours');
    if (!stored) return true; // sin horario = a cualquier hora
    var h = JSON.parse(stored);
    if (!h || !h.from || !h.to) return true;
    var now = new Date();
    var cur = now.getHours() * 60 + now.getMinutes();
    var fp = h.from.split(':').map(Number); var tp = h.to.split(':').map(Number);
    var from = fp[0] * 60 + fp[1]; var to = tp[0] * 60 + tp[1];
    if (from === to) return true;
    return from < to ? (cur >= from && cur < to) : (cur >= from || cur < to); // cruza medianoche
  } catch(e) { return true; }
}

function _notifSndHoursChange() {
  var f = document.getElementById('notif-snd-from');
  var t = document.getElementById('notif-snd-to');
  if (!f || !t) return;
  if (f.value && t.value) {
    localStorage.setItem('wwp_notif_hours', JSON.stringify({ from: f.value, to: t.value }));
  } else {
    localStorage.removeItem('wwp_notif_hours');
  }
}

// v181 — repetición por urgencia: critical re-suena cada 30s hasta 3 veces
// mientras ESA notif siga sin leer/atender; alert repite 1 vez; el resto no.
// Un solo timer re-anclado a la última notif sonada (barato en Android).
var _notifRepeatInfo = null; // { id, key, left }
function maybeChime(notif) {
  var unread = _notifications.filter(function(n){ return !n.readAt; }).length;
  if (_notifSoundEnabled && !_notifPanelOpen && withinNotifHours() && (_lastUnread === null || unread > _lastUnread)) {
    var key = _notifSoundOf(notif);
    _playSound(key);
    if (navigator.vibrate && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      navigator.vibrate(_NOTIF_VIBRATE[key] || _NOTIF_VIBRATE.info);
    }
    _notifShowToast(notif);
    _notifFlashScreen(notif);
    var urg = notifUrgency(notif);
    var reps = urg === 'critical' ? 3 : urg === 'alert' ? 1 : 0;
    if (_notifRepeatTimer) { clearTimeout(_notifRepeatTimer); _notifRepeatTimer = null; }
    _notifRepeatInfo = null;
    if (reps > 0 && notif && notif.id) {
      _notifRepeatInfo = { id: notif.id, key: key, left: reps };
      _notifRepeatTimer = setTimeout(_notifRepeatTick, 30000);
    }
  }
  _lastUnread = unread;
}
function _notifRepeatTick() {
  _notifRepeatTimer = null;
  var info = _notifRepeatInfo;
  if (!info || !_notifSoundEnabled || !withinNotifHours()) { _notifRepeatInfo = null; return; }
  var n = _notifications.find(function(x){ return x.id === info.id; });
  if (!n || n.readAt || n.clickedAt) { _notifRepeatInfo = null; return; }
  _playSound(info.key);
  if (navigator.vibrate) navigator.vibrate(_NOTIF_VIBRATE[info.key] || _NOTIF_VIBRATE.info);
  info.left--;
  if (info.left > 0) _notifRepeatTimer = setTimeout(_notifRepeatTick, 30000);
  else _notifRepeatInfo = null;
}

function _notifRingBell() {
  var btn = document.getElementById('notif-btn');
  var badge = document.getElementById('notif-badge');
  if (btn) {
    btn.classList.remove('has-new');
    void btn.offsetWidth; // reflow para reiniciar animación
    btn.classList.add('has-new');
    setTimeout(function(){ btn.classList.remove('has-new'); }, 700);
  }
  if (badge) {
    badge.classList.remove('pop');
    void badge.offsetWidth;
    badge.classList.add('pop');
    setTimeout(function(){ badge.classList.remove('pop'); }, 350);
  }
}

function _notifToastType(notif) {
  if (!notif) return 't-info';
  var t = notif.type || '';
  if (t === 'task_overdue' || t === 'task_rejected') return 't-alert';
  if (t === 'comment_new') return 't-chat';
  if (t === 'task_assigned' || t === 'subtask_assigned') return 't-task';
  return 't-info';
}

// Toasts apilables: máx 3 visibles; el resto se acumula en un pill "+N más".
// TTL por urgencia — las críticas no se auto-ocultan (requieren dismiss o click).
var _NOTIF_TOAST_TTL = { critical: 0, alert: 10000, success: 6000, info: 6000 };
var _notifToastQueued = 0;

function _notifToastContainer() {
  var c = document.getElementById('notif-toast-stack');
  if (!c) {
    c = document.createElement('div');
    c.id = 'notif-toast-stack';
    c.className = 'notif-toast-stack';
    c.setAttribute('role', 'status');
    c.setAttribute('aria-live', 'polite');
    document.body.appendChild(c);
  }
  return c;
}

function _notifUpdateMorePill() {
  var c = _notifToastContainer();
  var pill = document.getElementById('notif-toast-more');
  if (_notifToastQueued <= 0) { if (pill && pill.parentNode) pill.parentNode.removeChild(pill); return; }
  if (!pill) {
    pill = document.createElement('button');
    pill.id = 'notif-toast-more';
    pill.className = 'notif-toast-more';
    pill.onclick = function() {
      _notifToastQueued = 0;
      var stack = document.getElementById('notif-toast-stack');
      if (stack) stack.querySelectorAll('.notif-toast-wrap').forEach(function(w){ if (w.parentNode) w.parentNode.removeChild(w); });
      _notifUpdateMorePill();
      if (!_notifPanelOpen) toggleNotifPanel();
    };
    c.appendChild(pill);
  }
  pill.textContent = '+' + _notifToastQueued + ' más — ver todas';
}

function _notifDismissToast(wrap) {
  if (!wrap || !wrap.parentNode) return;
  if (wrap.classList.contains('leaving')) return;
  wrap.classList.add('leaving');
  setTimeout(function() {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (_notifToastQueued > 0) { _notifToastQueued--; _notifUpdateMorePill(); }
  }, 220);
}

function _notifShowToast(notif) {
  var c = _notifToastContainer();
  var visible = c.querySelectorAll('.notif-toast-wrap:not(.leaving)').length;
  if (visible >= 3) { _notifToastQueued++; _notifUpdateMorePill(); return; }
  var urg = notifUrgency(notif);
  var wrap = document.createElement('div');
  wrap.className = 'notif-toast-wrap nt-' + urg;
  if (urg === 'critical') wrap.setAttribute('role', 'alert');
  var title = (notif && (notif.title || '')) || 'Nueva notificación';
  var msg   = (notif && (notif.message || notif.body || '')) || '';
  wrap.innerHTML =
    '<div class="notif-toast-body">' +
      '<div class="notif-toast-title">' + escHtml(title) + '</div>' +
      (msg ? '<div class="notif-toast-msg">' + escHtml(msg) + '</div>' : '') +
    '</div>' +
    '<button class="notif-toast-x" aria-label="Cerrar">\xd7</button>';
  wrap.addEventListener('click', function(e) {
    if (e.target.classList.contains('notif-toast-x')) { _notifDismissToast(wrap); return; }
    if (notif) openNotification(notif);
    _notifDismissToast(wrap);
  });
  // El pill "+N más" siempre queda al final del stack
  var pill = document.getElementById('notif-toast-more');
  if (pill) c.insertBefore(wrap, pill); else c.appendChild(wrap);
  var ttl = (_NOTIF_TOAST_TTL[urg] != null) ? _NOTIF_TOAST_TTL[urg] : 6000;
  if (ttl) setTimeout(function(){ _notifDismissToast(wrap); }, ttl);
}

function _notifFlashScreen(notif) {
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  var existing = document.getElementById('notif-flash-active');
  if (existing) existing.parentNode.removeChild(existing);
  var el = document.createElement('div');
  el.id = 'notif-flash-active';
  el.className = 'notif-flash-overlay ' + _notifToastType(notif);
  document.body.appendChild(el);
  setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 1200);
}

function _notifUpdateTitle() {
  var unread = _notifications.filter(function(n){ return !n.readAt; }).length;
  document.title = unread > 0 ? '(' + unread + ') Ops AT' : 'Ops AT';
}

// Capacidad de push del dispositivo/navegador actual:
//   'granted-auto'  → permiso concedido: (re)suscribir en silencio
//   'needs-gesture' → soportado pero requiere click del usuario (Safari lo exige; en Chrome evita el quiet-prompt)
//   'needs-install' → iPhone/iPad en navegador: solo funciona instalada como PWA (A2HS)
//   'blocked'       → permiso denegado en el navegador
//   'unsupported'   → sin APIs de push
function getPushCapability() {
  var hasPush = typeof Notification !== 'undefined' &&
                ('serviceWorker' in navigator) && ('PushManager' in window);
  if (!hasPush) return (_isIosDevice() && !_iosPwa) ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'granted') return 'granted-auto';
  if (Notification.permission === 'denied')  return 'blocked';
  return 'needs-gesture';
}

function _notifShowBrowserBanner() {
  var row = document.getElementById('notif-push-row');
  var installRow = document.getElementById('notif-install-row');
  if (!row) return;
  _notifLoadPushStatus();
  var cap = getPushCapability();
  if (installRow) installRow.style.display = (cap === 'needs-install') ? 'flex' : 'none';
  switch (cap) {
    case 'needs-install':
    case 'unsupported':
      row.style.display = 'none';
      return;
    case 'blocked':
      row.style.display = 'flex';
      row.innerHTML = '<i data-lucide="bell-off" style="width:10px;height:10px;stroke:currentColor;display:inline-block;flex-shrink:0"></i>'
        + '<span>Notificaciones bloqueadas — actívalas en los ajustes del sitio de tu navegador'
        + (_iosPwa ? ' (en iPhone: Ajustes → Notificaciones → Ops AT)' : '') + '</span>';
      if (window.lucide) lucide.createIcons();
      return;
    case 'needs-gesture':
      row.style.display = 'flex';
      return;
    case 'granted-auto':
      // Mostrar el botón solo si falta la suscripción en este dispositivo
      navigator.serviceWorker.ready.then(function(reg) {
        return reg.pushManager.getSubscription();
      }).then(function(sub) {
        row.style.display = sub ? 'none' : 'flex';
      }).catch(function() { row.style.display = 'none'; });
      return;
  }
}

function _urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(base64);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Suscripción push real (asume permiso ya concedido). Devuelve promesa.
function _notifEnsureFreshServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.getRegistration('/').then(function(reg) {
    if (!reg) return navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    return reg.update().catch(function(){ return reg; }).then(function(){ return reg; });
  }).then(function(reg) {
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    return navigator.serviceWorker.ready;
  });
}

function _notifDoSubscribe() {
  var oldEndpoint = null;
  return _notifEnsureFreshServiceWorker().then(function(reg) {
    return authFetch('/api/wwp/push/vapid-public-key').then(function(r){ return r.json(); })
      .then(function(data) {
        if (!data.key) throw new Error('VAPID key no disponible en el servidor');
        // Limpiar suscripción vieja (puede tener una VAPID key anterior tras reinstalar)
        return reg.pushManager.getSubscription().then(function(existing) {
          if (existing) {
            oldEndpoint = existing.endpoint || null;
            return existing.unsubscribe().catch(function(){}).then(function(){ return data.key; });
          }
          return data.key;
        });
      })
      .then(function(key) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: _urlBase64ToUint8Array(key)
        });
      })
      .then(function(sub) {
        return authFetch('/api/wwp/push/subscribe', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: oldEndpoint })
        }).then(function(r){ if (!r.ok) throw new Error('El servidor rechazó la suscripción ('+r.status+')'); return r; });
      });
  });
}

// Auto-activación al entrar a la app: SOLO si el permiso ya fue concedido,
// (re)suscribe en silencio. Nunca pide permiso sin gesto del usuario —
// Safari lo ignora y en Chrome degrada al quiet-prompt / bloqueo permanente.
// El prompt vive en el botón "Activar" del panel y en el welcome (gestos reales).
function _notifAutoEnablePush() {
  if (getPushCapability() !== 'granted-auto') return;
  navigator.serviceWorker.ready.then(function(reg){
    return reg.pushManager.getSubscription();
  }).then(function(sub){
    if (sub) return; // ya suscrito en este dispositivo
    _notifDoSubscribe().then(function(){
      _notifShowBrowserBanner();
    }).catch(function(err){});
  }).catch(function(){});
}

function _notifRequestPush() {
  if (typeof Notification === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Tu navegador no soporta notificaciones push.'); return;
  }
  Notification.requestPermission().then(function(perm) {
    _notifShowBrowserBanner();
    if (perm !== 'granted') return;
    var btn = document.querySelector('#notif-push-row button');
    if (btn) { btn.disabled = true; btn.textContent = 'Activando…'; }
    _notifDoSubscribe().then(function() {
      var row = document.getElementById('notif-push-row');
      if (row) { row.innerHTML = '<span style="color:var(--green-text)">✓ Notificaciones push activas</span>'; }
    }).catch(function(err) {
      var row = document.getElementById('notif-push-row');
      if (row) {
        row.innerHTML = '<span style="color:var(--red-text);font-size:10px">⚠ ' + (err.message || 'No se pudo activar') + '</span> <button onclick="_notifRequestPush()" style="font-size:10px;font-weight:700;color:var(--brand-light);background:none;border:none;cursor:pointer;padding:0">Reintentar</button>';
        if (window.lucide) lucide.createIcons();
      } else if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
    });
  });
}

function _notifPushTest() {
  var st = document.getElementById('notif-push-devices');
  var btn = document.querySelector('#notif-push-status button');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  if (st) st.innerHTML = '<span style="color:var(--text-3)">Preparando este dispositivo…</span>';
  Promise.resolve().then(function(){
    if (getPushCapability() === 'needs-install') throw new Error('En iPhone/iPad instala la app (Compartir → Añadir a pantalla de inicio) para poder recibir push.');
    if (typeof Notification === 'undefined') throw new Error('Este navegador no soporta notificaciones.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador no soporta Web Push.');
    if (Notification.permission === 'denied') throw new Error('Las notificaciones están bloqueadas en el navegador.');
    if (Notification.permission === 'default') return Notification.requestPermission().then(function(perm){
      if (perm !== 'granted') throw new Error('Permiso no concedido.');
    });
  }).then(function(){
    if (st) st.innerHTML = '<span style="color:var(--text-3)">Renovando suscripción push de este dispositivo…</span>';
    return _notifDoSubscribe();
  }).then(function(){
    if (st) st.innerHTML = '<span style="color:var(--text-3)">Enviando prueba…</span>';
    return authFetch('/api/wwp/push/test', { method:'POST' });
  }).then(function(r){ return r.json(); }).then(function(d){
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar prueba a este dispositivo'; }
    if (!st) return;
    if (!d.ok) { st.innerHTML = '<span style="color:var(--red-text)">'+esc(d.error||'No se pudo enviar')+'</span>'; return; }
    if (d.total === 0) { st.innerHTML = '<span style="color:var(--amber-text)">No hay dispositivos suscritos. Intenta activar de nuevo.</span>'; return; }
    var ok = d.sent, total = d.total;
    var detail = (d.results||[]).map(function(x){
      return x.ok ? '✓ '+(x.service||'Web Push') : '✕ '+(x.service||'Web Push')+(x.status?(' ('+x.status+')'):'')+(x.error?(' · '+esc(x.error).slice(0,60)):'');
    }).join(' · ');
    st.innerHTML = '<span style="color:'+(ok>0?'var(--green-text)':'var(--red-text)')+'">'+ok+'/'+total+' enviadas — '+detail+'</span>';
    _notifLoadPushStatus();
  }).catch(function(e){
    if (btn) { btn.disabled = false; btn.textContent = 'Reintentar prueba'; }
    if (st) st.innerHTML = '<span style="color:var(--red-text)">Error: '+(e.message||'falló')+'</span>';
  });
}

function _notifLoadPushStatus() {
  var st = document.getElementById('notif-push-devices');
  if (!st) return;
  authFetch('/api/wwp/push/status').then(function(r){ return r.json(); }).then(function(d){
    if (!d.count) { st.textContent = 'Sin dispositivos suscritos.'; return; }
    st.textContent = d.count + ' dispositivo(s): ' + d.devices.map(function(x){ return x.service; }).join(', ');
  }).catch(function(){});
}

function _notifFireBrowser(notif) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!document.hidden) return; // solo cuando el tab está en segundo plano
  var urgency = notifUrgency(notif);
  var title = notif.title || 'Ops AT';
  // v180: target tipado en el data — el notificationclick del SW rutea por esto.
  var tgt = _notifTargetOf(notif);
  var url = (tgt.kind !== 'none' && tgt.id)
    ? '/historial.html?notif=' + encodeURIComponent(notif.id)
    : '/historial.html';
  var opts = {
    body: notif.message || '',
    icon: '/icon-192.png',
    badge: '/badge-' + urgency + '.svg',
    tag: notif.relatedTaskId || notif.id,
    renotify: true,
    requireInteraction: urgency === 'critical',
    data: {
      taskId: notif.relatedTaskId || null, // compat: sw.js viejo lo lee en notificationclick
      notifId: notif.id,
      target: tgt,
      url: url,
      urgency: urgency
    }
  };
  // Camino principal: vía Service Worker — obligatorio en Chrome Android,
  // donde `new Notification()` lanza "Illegal constructor".
  var viaSw = ('serviceWorker' in navigator)
    ? navigator.serviceWorker.getRegistration('/').then(function(reg) {
        if (reg && reg.active) return reg.showNotification(title, opts);
        throw new Error('no-sw');
      })
    : Promise.reject(new Error('no-sw'));
  viaSw.catch(function() {
    // Fallback desktop sin SW activo; el try/catch absorbe el constructor ilegal
    try {
      var n = new Notification(title, opts);
      n.onclick = function() { window.focus(); openNotification(notif); n.close(); };
    } catch(e) {}
  });
}

function _notifUpdateSoundUI() {
  var toggle = document.getElementById('notif-snd-toggle');
  var icon   = document.getElementById('notif-snd-icon');
  var label  = document.getElementById('notif-snd-label');
  var hoursRow = document.getElementById('notif-snd-hours');
  if (!toggle) return;
  toggle.classList.toggle('on', _notifSoundEnabled);
  if (icon) { icon.setAttribute('data-lucide', _notifSoundEnabled ? 'bell-ring' : 'bell-off'); if (window.lucide) lucide.createIcons(); }
  if (label) label.textContent = _notifSoundEnabled ? 'Sonido activado' : 'Sonido';
  // v181: marcar el segmento de volumen activo (reemplaza al selector de tonos)
  var segs = document.querySelectorAll('#notif-vol-segs .notif-pref-seg');
  for (var si = 0; si < segs.length; si++) {
    var sv = parseFloat(segs[si].getAttribute('data-vol'));
    segs[si].classList.toggle('active', Math.abs(sv - _notifSoundVol) < 0.01);
  }
  // Mostrar rango horario solo cuando el sonido está activo
  if (hoursRow) {
    hoursRow.style.display = _notifSoundEnabled ? 'flex' : 'none';
    try {
      var h = JSON.parse(localStorage.getItem('wwp_notif_hours') || 'null');
      var f = document.getElementById('notif-snd-from');
      var t = document.getElementById('notif-snd-to');
      if (f) f.value = (h && h.from) ? h.from : '';
      if (t) t.value = (h && h.to)   ? h.to   : '';
    } catch(e) {}
  }
  _notifShowBrowserBanner();
}

function _notifToggleSound() {
  _notifSoundEnabled = !_notifSoundEnabled;
  localStorage.setItem('wwp_notif_sound', _notifSoundEnabled ? 'on' : 'off');
  _notifUpdateSoundUI();
  if (_notifSoundEnabled) _playSound('info');
}

// v181: selector de volumen Bajo/Normal/Alto (con feedback inmediato del nivel)
function _notifSetVol(btn) {
  var v = parseFloat(btn.getAttribute('data-vol'));
  if ([0.6, 1, 1.5].indexOf(v) === -1) v = 1;
  _notifSoundVol = v;
  try { localStorage.setItem('wwp_notif_vol', String(v)); } catch(e) {}
  _notifUpdateSoundUI();
  _playSound('info');
}

// "Probar" reproduce el lenguaje completo: gota → resuelto → atención → toc-toc → urgente
function _notifTestTone() {
  var order = ['info', 'success', 'alert', 'chat', 'critical'];
  order.forEach(function(k, i) {
    setTimeout(function(){ _playSound(k); }, i * 1100);
  });
}

function connectSSE() {
  if (_sseSource) { _sseSource.close(); _sseSource = null; }
  if (!_token) return;
  const url = wwpServerUrl('/api/wwp/notifications/stream?token=' + encodeURIComponent(_token));
  const es = new EventSource(url);
  _sseSource = es;

  // Cada (re)conexión implica que pudimos perder eventos mientras estuvo caída
  es.onopen = function() { refreshNotifications(); };

  es.onmessage = function(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'notification' && data.notif) {
        _handleIncomingNotif(data.notif);
      }
      // Cambio de presencia en tiempo real
      if (data.event === 'presence_changed' && data.userId) {
        applyPresenceChange(data.userId, data.presenceStatus, data.presenceAt, data.lunchTimeAllowed);
        // Si el almuerzo fue cerrado automáticamente por el servidor
        if (data.lunchEnded) {
          if (data.userId === _user.id) {
            // Al propio usuario: toast + sonido
            toast('Tu tiempo de almuerzo terminó. Ya estás marcado como Disponible.');
          } else {
            // A encargados/admins: toast informativo
            const firstName = (data.name||'').split(' ')[0];
            toast(`Almuerzo de ${firstName} ha finalizado`);
          }
        }
      }
      // Chat en tiempo real: si el drawer está abierto en esa tarea, actualizar mensajes
      if (data.event === 'chat_message' && data.taskId && data.message) {
        if (_drawerTask && _drawerTask.id === data.taskId) {
          const el = document.getElementById('dr-chat-messages');
          if (el) loadChatMessages(data.taskId);
        }
      }
    } catch(err) {}
  };

  es.onerror = function() {
    // Auto-reconnect after 10s if still logged in
    if (_token) {
      setTimeout(function() { if (_token) connectSSE(); }, 10000);
    }
  };
}

function connectWwpRealtime() {
  if (_wwpSocket) {
    try { _wwpSocket.close(); } catch(e) { silentCatch(e, 'disconnectWwpSocket'); }
    _wwpSocket = null;
  }
  if (_wwpSocketRetry) { clearTimeout(_wwpSocketRetry); _wwpSocketRetry = null; }
  if (!_token) return;
  // F2.1 (API-01): el WS exige un ticket efímero de un solo uso emitido por
  // POST autenticado — nunca JWT en query ni conexiones anónimas.
  authFetch('/api/wwp/realtime/ticket', { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d || !d.ok || !d.ticket) throw new Error('sin ticket WS');
      _wwpOpenSocket(d.ticket);
    })
    .catch(function() {
      if (_token) _wwpSocketRetry = setTimeout(connectWwpRealtime, 2500);
    });
}

function _wwpOpenSocket(ticket) {
  const proto = WWP_SERVER_ORIGIN
    ? WWP_SERVER_ORIGIN.replace(/^http/, 'ws')
    : (location.protocol === 'https:' ? 'wss://' + location.host : 'ws://' + location.host);
  const ws = new WebSocket(proto + '/ws/wwp?client=wwp&ticket=' + encodeURIComponent(ticket));
  _wwpSocket = ws;

  ws.onopen = function() { refreshNotifications(); };

  ws.onmessage = function(e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.scope !== 'wwp' || (msg.version && msg.version <= _wwpLastVersion)) return;
      if (msg.version) _wwpLastVersion = msg.version;

      if (msg.event === 'hello' || msg.event === 'tasks:changed') {
        if (Array.isArray(msg.tasks)) {
          // Legado: servidor antiguo envió tasks en el payload — usar directamente
          _tasks = msg.tasks;
          if (!_drawerTask) renderTasks();
          if (_drawerTask) {
            const fresh = _tasks.find(t => t.id === _drawerTask.id);
            if (fresh) {
              _drawerTask = fresh;
              if (!_isTypingInDrawer()) renderDrawer(fresh);   // no reconstruir mientras el usuario escribe
              const chatBox = document.getElementById('dr-chat-messages');
              if (chatBox && msg.action === 'message_created') loadChatMessages(fresh.id);
            } else {
              closeDrawer();
            }
          }
          if (_currentTab === 'dashboard' && can('dashboard')) loadDashboard();
        } else {
          // Nuevo protocolo: re-fetchear via REST (RBAC correcto por usuario)
          authFetch(wwpTasksUrl()).then(r => r.json()).then(function(fresh) {
            if (!Array.isArray(fresh)) return;
            _tasks = fresh;
            if (!_drawerTask) renderTasks();
            if (_drawerTask) {
              const t = _tasks.find(t => t.id === _drawerTask.id);
              if (t) {
                _drawerTask = t;
                if (!_isTypingInDrawer()) renderDrawer(t);   // no reconstruir mientras el usuario escribe
                const chatBox = document.getElementById('dr-chat-messages');
                if (chatBox && msg.action === 'message_created') loadChatMessages(t.id);
              } else {
                closeDrawer();
              }
            }
            if (_currentTab === 'dashboard' && can('dashboard')) loadDashboard();
          }).catch(function(){});
        }
      }

      if (msg.event === 'notification' && msg.notif && msg.userId === (_user && _user.id)) {
        _handleIncomingNotif(msg.notif);
      }
    } catch(err) {}
  };

  ws.onclose = function() {
    if (_wwpSocket === ws) _wwpSocket = null;
    if (_token) _wwpSocketRetry = setTimeout(connectWwpRealtime, 2500);
  };
  ws.onerror = function() { try { ws.close(); } catch(e) { silentCatch(e, 'wsErrorClose'); } };
}

// ── Mobile PWA foreground refresh + polling fallback ────────────────────────
// iOS/Android matan el WS silenciosamente en background y visibilitychange
// es inconsistente en modo standalone. Triple capa: evento + bfcache + poll.
(function() {
  var _lastVisibilityFetch = 0;

  function _applyFreshTasks(fresh) {
    if (!Array.isArray(fresh)) return;
    _tasks = fresh;
    if (!_drawerTask) renderTasks();
    if (_drawerTask) {
      var t = _tasks.find(function(x) { return x.id === _drawerTask.id; });
      if (t) { _drawerTask = t; if (!_isTypingInDrawer()) renderDrawer(t); }  // no reconstruir mientras escribe
      else closeDrawer();
    }
    if (_currentTab === 'dashboard' && can('dashboard')) loadDashboard();
  }

  function _doFetch() {
    if (!_token || document.hidden) return;
    _checkVersion();
    authFetch(wwpTasksUrl()).then(function(r) { return r.json(); })
      .then(_applyFreshTasks).catch(function(){});
  }

  // Auto-update SIN Service Worker: si el servidor reporta otro build, recargar.
  // Esto rompe el deadlock de SW en iOS — el JS corriendo se actualiza solo.
  function _checkVersion() {
    if (_versionReloading) return;
    fetch('/api/app-version', { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.build && d.build !== APP_BUILD) {
          // ANTI-LOOP: recargar UNA sola vez por build del server. Si tras recargar el
          // desajuste persiste (server y HTML fuera de sync — no se arregla recargando),
          // NO ciclar: sin este guard, el tab recargaba cada 2 s indefinidamente
          // (visto en local 2026-07-03 con proceso viejo + HTML nuevo en disco).
          var gateKey = 'wwp_vgate_' + d.build;
          try {
            if (sessionStorage.getItem(gateKey)) {
              console.warn('[version-gate] build server (' + d.build + ') ≠ cliente (' + APP_BUILD + ') tras recargar — no se reintenta para evitar loop.');
              return;
            }
            sessionStorage.setItem(gateKey, '1');
          } catch (e) {}
          _versionReloading = true;
          // Limpiar caches del SW para garantizar HTML fresco, luego recargar duro
          if (window.caches && caches.keys) {
            caches.keys().then(function(keys) {
              return Promise.all(keys.map(function(k){ return caches.delete(k); }));
            }).catch(function(){}).then(function(){ location.reload(); });
          } else {
            location.reload();
          }
        }
      }).catch(function(){});
  }

  // Capa 1: visibilitychange (funciona en Android y parcialmente en iOS)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden || !_token) return;
    var now = Date.now();
    if (now - _lastVisibilityFetch < 3000) return;
    _lastVisibilityFetch = now;
    _doFetch();
    refreshNotifications();
    // El EventSource no siempre revive solo tras una suspensión larga (readyState 2 = CLOSED)
    if (!_sseSource || _sseSource.readyState === 2) connectSSE();
  });

  // Capa 2: bfcache iOS Safari (restauración de página congelada)
  window.addEventListener('pageshow', function(e) {
    if (!e.persisted || !_token) return;
    if (_wwpSocket && _wwpSocket.readyState >= 2) {
      _wwpSocket = null;
      connectWwpRealtime();
    }
    _doFetch();
    refreshNotifications();
    if (!_sseSource || _sseSource.readyState === 2) connectSSE();
  });

  // Capa 3: polling cada 60s — red de seguridad cuando WS y eventos fallan
  // Solo hace fetch si el tab es visible y hay sesión activa (no genera carga extra)
  setInterval(_doFetch, 60000);

  // Chequeo de versión inmediato al cargar (sin esperar al primer poll) +
  // cada 60s aunque no haya sesión — garantiza que un dispositivo viejo migre solo.
  setTimeout(_checkVersion, 2000);
  setInterval(_checkVersion, 60000);
})();

async function loadNotificationsFromServer() {
  _lastNotifRefresh = Date.now(); // suprime el refresh del onopen inicial del SSE (debounce)
  try {
    const r = await authFetch('/api/wwp/notifications');
    if (!r.ok) return;
    const d = await r.json();
    if (d.ok) {
      _notifications = d.notifications || [];
      renderNotifications();
    }
  } catch(e) {}
}

// Catch-up: recarga la lista al volver de background / reconectar SSE-WS.
// Sin esto, las notifs emitidas con el dispositivo suspendido (Safari/Android
// matan SSE y WS en background) no aparecían hasta recargar la página.
var _lastNotifRefresh = 0;
function refreshNotifications() {
  if (!_token) return;
  var now = Date.now();
  if (now - _lastNotifRefresh < 5000) return; // debounce entre triggers (visibility+onopen suelen coincidir)
  _lastNotifRefresh = now;
  loadNotificationsFromServer().then(function() {
    // maybeChime tiene su propio guard (unread > _lastUnread): suena UNA vez
    // solo si el catch-up trajo notifs nuevas sin leer.
    var newest = _notifications.find(function(n){ return !n.readAt; });
    if (newest) { maybeChime(newest); _notifRingBell(); }
  });
}

// Inserta o actualiza una notif por id. Devuelve 'new' | 'updated' | 'dup'.
// 'dup' preserva el dedup entre canales: SSE y WS entregan el mismo objeto
// (mismo count+createdAt) y el segundo canal cae aquí sin re-render.
function _notifUpsert(notif) {
  var idx = _notifications.findIndex(function(n){ return n.id === notif.id; });
  if (idx === -1) { _notifications.unshift(notif); return 'new'; }
  var cur = _notifications[idx];
  if ((notif.count||1) === (cur.count||1) && notif.createdAt === cur.createdAt) return 'dup';
  _notifications.splice(idx, 1);
  _notifications.unshift(notif);
  return 'updated';
}

// Maneja una notif entrante (SSE o WS). Respeta el nivel de entrega estampado
// por el servidor (deliver): 'panel' = sin sonido/toast/OS-notif.
function _handleIncomingNotif(notif) {
  var r = _notifUpsert(notif);
  if (r === 'dup') return;
  renderNotifications();
  _notifRingBell();
  if (r === 'new' && notif.deliver !== 'panel') {
    maybeChime(notif);       // sonido + toast + flash
    _notifFireBrowser(notif);
  }
  // 'updated' (fold ×N): sin sonido ni toast — el pendiente ya se avisó
}

function _notifDayLabel(iso) {
  if (!iso) return '';
  var d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoy';
  var ayer = new Date(now.getTime() - 86400000);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  try { return d.toLocaleDateString('es-DO', { weekday:'short', day:'numeric', month:'short' }); }
  catch(e) { return d.toLocaleDateString(); }
}

// ═══ v181 — Centro de acción: dos niveles + destino visible + CTA inline ═══

// Accionable = pide algo del usuario y sigue pendiente. El server puede
// estamparlo (actionRequired); estos tipos lo son por naturaleza. Leída o ya
// clicada → deja de exigir y baja al nivel cronológico.
var _NOTIF_ACTIONABLE_TYPES = new Set([
  'task_chat', 'comment_new', 'ready_to_validate', 'evidence_incomplete',
  'missing_evidence', 'reactivacion_pendiente', 'sdv_new_pending',
  'reposicion_nueva', 'curso_retake'
]);
function _notifNeedsAction(n) {
  if (!n || n.readAt || n.clickedAt) return false;
  if (n.actionRequired) return true;
  if (notifCategory(n) === 'coordinacion') return true;
  if (notifUrgency(n) === 'critical') return true;
  return _NOTIF_ACTIONABLE_TYPES.has(n.type);
}

// Clase del rail de urgencia: chat/coordinación por CATEGORÍA (te habla un
// humano), el resto por urgencia. Info no lleva rail (menos ruido).
function _notifRailClass(n) {
  var cat = notifCategory(n);
  if (cat === 'chat') return 'u-chat';
  if (cat === 'coordinacion') return 'u-coord';
  var u = notifUrgency(n);
  return (u === 'critical' || u === 'alert' || u === 'success') ? ('u-' + u) : '';
}

// Etiqueta legible del DESTINO del clic (meta-fila "→ Tarea #0171").
// kind=none → null (sin meta de destino: el clic no navega).
var _NOTIF_SECCION_LBL = { 'inventario': 'Inventario', 'inventario-salud': 'Inventario' };
function _notifDestOf(n) {
  var t = _notifTargetOf(n);
  if (t.kind === 'none' || !t.id) return null;
  var txt = (n.title || '') + ' ' + (n.message || '');
  if (t.kind === 'task') {
    var task = (_tasks || []).find(function(x){ return x.id === t.id; });
    var seq = task ? seqLabel(task) : '';
    if (!seq) { var m = txt.match(/#\d{3,4}(?:·\d+)?/); if (m) seq = m[0]; }
    var esChat = t.ctx === 'chat' || n.type === 'task_chat' || n.type === 'comment_new';
    return ((esChat ? 'Chat de tarea ' : 'Tarea ') + seq).trim();
  }
  if (t.kind === 'sdv') {
    var f = txt.match(/\bSD-\d{4}-\d{4}\b/);
    return f ? ('SDV ' + f[0]) : 'Solicitud SDV';
  }
  if (t.kind === 'reposicion') return 'Reposiciones';
  if (t.kind === 'curso') return 'Curso';
  if (t.kind === 'seccion') return _NOTIF_SECCION_LBL[t.id] || 'Sección';
  return null;
}

// CTA de navegación por tipo (máx 2: [primaria, ghost]). v181: todas navegan
// vía el router (target+rol). v182: si el server estampa n.actions[], ganan
// ellas — el render ya las pinta sin tocar la estructura.
var _NOTIF_CTA = {
  task_chat:              [{ label:'Responder',          icon:'message-square' }],
  comment_new:            [{ label:'Responder',          icon:'message-square' }],
  task_overdue:           [{ label:'Ver tarea',          icon:'clipboard-list' }],
  task_rejected:          [{ label:'Ver y corregir',     icon:'clipboard-list' }],
  ready_to_validate:      [{ label:'Ir a validar',       icon:'clipboard-check' }],
  evidence_incomplete:    [{ label:'Subir evidencia',    icon:'camera' }],
  missing_evidence:       [{ label:'Subir evidencia',    icon:'camera' }],
  sdv_new_pending:        [{ label:'Revisar en bandeja', icon:'inbox' }],
  reactivacion_pendiente: [{ label:'Revisar solicitud',  icon:'rotate-ccw' }],
  sdv_seller_rechazada:   [{ label:'Corregir ahora',     icon:'pencil' }],
  reposicion_nueva:       [{ label:'Revisar solicitud',  icon:'package-plus' }],
  curso_retake:           [{ label:'Ir al curso',        icon:'graduation-cap' }]
};
function _notifCtasOf(n) {
  if (n && Array.isArray(n.actions) && n.actions.length) return n.actions.slice(0, 2); // v182
  var t = _notifTargetOf(n);
  if (t.kind === 'none' || !t.id) return [];
  return (_NOTIF_CTA[n.type] || []).slice(0, 2);
}

// Marcar leída UNA (check al hover; visible en touch) sin navegar.
function notifMarkReadBtn(ev, el) {
  ev.stopPropagation();
  var host = el.closest('.notif-item');
  if (host && host.dataset.notifId) markRead(host.dataset.notifId);
}

// CTA inline: en v181 todas navegan (el router resuelve destino por target+rol
// y ancla al chat cuando aplica). v182: bifurcar aquí si la action trae una op.
function notifCtaClick(ev, el) {
  ev.stopPropagation();
  var host = el.closest('.notif-item');
  if (!host) return;
  var notif = _notifications.find(function(n){ return n.id === host.dataset.notifId; });
  if (notif) routeNotification(notif);
}

function _notifItemHtml(n, inActionGroup) {
  const def = _NOTIF_ICONS[n.type] || _NOTIF_ICON_DEFAULT;
  const time = n.createdAt ? timeSince(n.createdAt) : '';
  const unread = !n.readAt;
  const rail = _notifRailClass(n);
  const itemCls = 'notif-item' + (rail ? ' ' + rail : '') + (unread ? ' unread' : '');
  const countBadge = (n.count > 1) ? ' <span class="notif-count">×' + n.count + '</span>' : '';
  // Ícono coloreado: usa CSS vars del proyecto
  const iconStyle = `style="--ni-bg:var(${def.bg});--ni-color:var(${def.color})"`;
  const iconWrap = `<div class="notif-icon-wrap" ${iconStyle}><i data-lucide="${def.icon}"></i></div>`;
  // Meta: categoría + destino del clic
  const catDef = _NOTIF_CATS.find(c => c.id === notifCategory(n));
  const dest = _notifDestOf(n);
  const metaHtml = `<div class="notif-meta">${catDef ? esc(catDef.label) : ''}${dest ? ' · <span class="notif-dest"><i data-lucide="corner-down-right"></i>' + esc(dest) + '</span>' : ''}</div>`;
  // Acciones inline: solo en el grupo "Requiere tu acción"
  let actsHtml = '';
  if (inActionGroup) {
    const ctas = _notifCtasOf(n);
    if (ctas.length) {
      actsHtml = '<div class="notif-acts">' + ctas.map((a, i) =>
        `<button class="notif-act-btn ${i === 0 ? 'notif-act-pri' : 'notif-act-gh'}" data-cta="${i}" onclick="notifCtaClick(event,this)">${a.icon ? '<i data-lucide="' + a.icon + '"></i>' : ''}${esc(a.label || '')}</button>`
      ).join('') + '</div>';
    }
  }
  const rightHtml = unread
    ? `<div class="notif-right"><span class="notif-dot"></span><button class="notif-mkread" title="Marcar como leída" aria-label="Marcar como leída" onclick="notifMarkReadBtn(event,this)"><i data-lucide="check"></i></button></div>`
    : '<div class="notif-right"></div>';
  return `<div class="${itemCls}" data-notif-id="${esc(n.id)}" onclick="openNotificationById(this)">
    ${iconWrap}
    <div class="notif-content">
      <div class="notif-row1"><div class="notif-title">${esc(n.title||n.type)}${countBadge}</div><span class="notif-time">${time}</span></div>
      <div class="notif-msg">${esc(n.message||'')}</div>
      ${metaHtml}
      ${actsHtml}
    </div>
    ${rightHtml}
  </div>`;
}

function _notifEmptyHtml() {
  if (_notifUnreadOnly) return '<div class="notif-empty">Nada sin leer — todo al día ✓</div>';
  if (_notifFilterCat !== 'all') {
    var cat = _NOTIF_CATS.find(function(c){ return c.id === _notifFilterCat; });
    return '<div class="notif-empty">Sin notificaciones de ' + (cat ? cat.label.toLowerCase() : _notifFilterCat) + '</div>';
  }
  return '<div class="notif-empty">Sin notificaciones</div>';
}

function _renderNotifChips(counts) {
  var bar = document.getElementById('notif-chips');
  if (!bar) return;
  var html = '<button class="notif-chip notif-chip-unread' + (_notifUnreadOnly ? ' active' : '') + '"' +
    ' onclick="toggleNotifUnreadOnly()" aria-pressed="' + (_notifUnreadOnly ? 'true' : 'false') + '">Sin leer' +
    (counts.all > 0 ? ' <span class="notif-chip-n">' + (counts.all > 99 ? '99+' : counts.all) + '</span>' : '') +
    '</button><span class="notif-chip-sep" aria-hidden="true"></span>';
  html += _NOTIF_CATS.map(function(c) {
    var n = c.id === 'all' ? 0 : (counts[c.id] || 0); // "Todas" no repite el total (ya está en Sin leer)
    return '<button class="notif-chip' + (_notifFilterCat === c.id ? ' active' : '') + '"' +
      ' onclick="setNotifFilter(\'' + c.id + '\')" aria-pressed="' + (_notifFilterCat === c.id ? 'true' : 'false') + '">' +
      c.label + (n > 0 ? ' <span class="notif-chip-n">' + (n > 99 ? '99+' : n) + '</span>' : '') +
      '</button>';
  }).join('');
  bar.innerHTML = html;
}

function setNotifFilter(cat) {
  _notifFilterCat = cat;
  renderNotifications();
}

function toggleNotifUnreadOnly() {
  _notifUnreadOnly = !_notifUnreadOnly;
  try { localStorage.setItem('wwp_notif_unread_only', _notifUnreadOnly ? '1' : '0'); } catch(e) {}
  renderNotifications();
}

function toggleNotifSettings() {
  _notifSettingsOpen = !_notifSettingsOpen;
  var panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('settings-open', _notifSettingsOpen);
  var gear = document.getElementById('notif-gear');
  if (gear) gear.classList.toggle('active', _notifSettingsOpen);
  if (_notifSettingsOpen) { _notifUpdateSoundUI(); _notifShowBrowserBanner(); _notifLoadPushStatus(); _renderNotifPrefs(); }
}

function _notifPrefLevel(cat) {
  return (_notifPrefs && _notifPrefs[cat]) || 'all';
}

function _renderNotifPrefs() {
  var group = document.getElementById('notif-prefs-group');
  var rows  = document.getElementById('notif-prefs-rows');
  if (!group || !rows) return;
  group.style.display = 'flex';
  rows.innerHTML = _NOTIF_PREF_ROWS.map(function(r) {
    var cur = _notifPrefLevel(r.id);
    var segs = _NOTIF_PREF_OPTS.map(function(o) {
      return '<button class="notif-pref-seg' + (cur === o.id ? ' active' : '') + '"' +
        ' onclick="setNotifPref(\'' + r.id + '\',\'' + o.id + '\')"' +
        ' aria-pressed="' + (cur === o.id ? 'true' : 'false') + '">' + o.label + '</button>';
    }).join('');
    return '<div class="notif-pref-row"><span class="notif-pref-label">' + r.label + '</span>' +
      '<div class="notif-pref-segs">' + segs + '</div></div>';
  }).join('');
}

function setNotifPref(cat, level) {
  if (!_notifPrefs) _notifPrefs = {};
  _notifPrefs[cat] = level;
  try { localStorage.setItem('wwp_notif_prefs', JSON.stringify(_notifPrefs)); } catch(e) {}
  _renderNotifPrefs();
  // PUT con debounce — evita una llamada por cada toque rápido
  if (_notifPrefsSaveTimer) clearTimeout(_notifPrefsSaveTimer);
  _notifPrefsSaveTimer = setTimeout(function() {
    _notifPrefsSaveTimer = null;
    var body = {}; body[cat] = level;
    authFetch('/api/wwp/notif-prefs', { method:'PUT', body: JSON.stringify({ prefs: _notifPrefs }) })
      .then(function(r){ return r.json(); })
      .then(function(d){ if (d && d.ok && d.prefs) { _notifPrefs = d.prefs; try { localStorage.setItem('wwp_notif_prefs', JSON.stringify(_notifPrefs)); } catch(e) {} } })
      .catch(function(){});
  }, 800);
}

function loadNotifPrefsFromServer() {
  if (!_token) return;
  authFetch('/api/wwp/notif-prefs').then(function(r){ return r.json(); }).then(function(d){
    if (d && d.ok && d.prefs) {
      _notifPrefs = d.prefs;
      try { localStorage.setItem('wwp_notif_prefs', JSON.stringify(_notifPrefs)); } catch(e) {}
      if (_notifSettingsOpen) _renderNotifPrefs();
    }
  }).catch(function(){});
}

function renderNotifications() {
  updateNotifBadge();
  const list = document.getElementById('notif-list');
  if (!list) return;
  // Contadores de no-leídas por categoría — una sola pasada
  var counts = { all:0, tareas:0, sdv:0, operacion:0, chat:0, coordinacion:0, sistema:0 };
  _notifications.forEach(function(n) {
    if (!n.readAt) {
      counts.all++;
      var c = notifCategory(n);
      if (counts[c] != null) counts[c]++;
    }
  });
  _renderNotifChips(counts);
  // Filtrar ANTES del corte de 50 para que el filtro vea todo el historial
  var items = _notifications;
  if (_notifFilterCat !== 'all') items = items.filter(function(n){ return notifCategory(n) === _notifFilterCat; });
  if (_notifUnreadOnly) items = items.filter(function(n){ return !n.readAt; });
  items = items.slice(0, 50);
  if (!items.length) { list.innerHTML = _notifEmptyHtml(); return; }
  // v181: dos niveles — "Requiere tu acción" fijo arriba, "Para tu información" cronológico
  var accion = [], info = [];
  for (var i = 0; i < items.length; i++) {
    (_notifNeedsAction(items[i]) ? accion : info).push(items[i]);
  }
  var html = '';
  if (accion.length) {
    html += '<div class="notif-group-hdr g-accion"><i data-lucide="alert-circle"></i>Requiere tu acción<span class="notif-group-n">' + accion.length + '</span></div>';
    for (var a = 0; a < accion.length; a++) html += _notifItemHtml(accion[a], true);
  }
  if (info.length) {
    if (accion.length) html += '<div class="notif-group-hdr g-info"><i data-lucide="inbox"></i>Para tu información</div>';
    var lastDay = '';
    for (var j = 0; j < info.length; j++) {
      var day = _notifDayLabel(info[j].createdAt);
      if (day && day !== lastDay) { html += '<div class="notif-day-sep">' + day + '</div>'; lastDay = day; }
      html += _notifItemHtml(info[j], false);
    }
  }
  list.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const unread = _notifications.filter(n => !n.readAt).length;
  if (unread > 0) {
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
  const btn = document.getElementById('notif-btn');
  if (btn) btn.setAttribute('aria-label', unread > 0 ? ('Notificaciones, ' + unread + ' sin leer') : 'Notificaciones');
  // App icon badge (PWA instalada)
  if ('setAppBadge' in navigator) {
    if (unread > 0) navigator.setAppBadge(unread).catch(function(){});
    else            navigator.clearAppBadge().catch(function(){});
  }
  _notifUpdateTitle();
}

function toggleNotifPanel() {
  _notifPanelOpen = !_notifPanelOpen;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('open', _notifPanelOpen);
  const btn = document.getElementById('notif-btn');
  if (btn) btn.setAttribute('aria-expanded', _notifPanelOpen ? 'true' : 'false');
  if (_notifPanelOpen) {
    // En móvil el disparador vive dentro del drawer del sidebar: cerrarlo al abrir el panel
    if (typeof toggleSidebar === 'function') toggleSidebar(false);
    // Siempre abrir en la lista (no en ajustes) y refrescar tiempos relativos/chips
    if (_notifSettingsOpen) {
      _notifSettingsOpen = false;
      if (panel) panel.classList.remove('settings-open');
      var gear = document.getElementById('notif-gear');
      if (gear) gear.classList.remove('active');
    }
    renderNotifications();
    _notifUpdateSoundUI();
    _lastUnread = _notifications.filter(function(n){ return !n.readAt; }).length;
  }
}

function closeNotifPanel() {
  _notifPanelOpen = false;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('open');
}

async function markRead(id) {
  // Optimistic update
  const n = _notifications.find(n => n.id === id);
  if (n && !n.readAt) {
    n.readAt = new Date().toISOString();
    renderNotifications();
  }
  try { await authFetch('/api/wwp/notifications/'+id+'/read', {method:'PATCH'}); }
  catch(e) {}
}

async function markAllRead() {
  _notifications.forEach(n => { if (!n.readAt) n.readAt = new Date().toISOString(); });
  renderNotifications();
  try { await authFetch('/api/wwp/notifications/read-all', {method:'PATCH'}); }
  catch(e) { silentCatch(e, 'markAllNotificationsRead'); }
}

async function clearReadNotifs() {
  // Limpia leídas + huérfanas. v180 FIX: huérfana = SOLO kind=task cuya tarea ya no
  // existe. Antes purgaba toda notif cuyo relatedTaskId no fuera tarea WWP — incluidas
  // notifs SDV/reposición SIN leer (sus ids nunca están en _tasks). El resto de kinds
  // jamás se purga por esta vía (espejo del fix en DELETE /notifications/orphans).
  const taskIds = new Set((_tasks||[]).map(t => t.id));
  const isOrphan = n => { const t = _notifTargetOf(n); return t.kind === 'task' && t.id && !taskIds.has(t.id); };
  _notifications = _notifications.filter(n => !n.readAt && !isOrphan(n));
  renderNotifications();
  try { await authFetch('/api/wwp/notifications/read', {method:'DELETE'}); } catch(e) {}
  try { await authFetch('/api/wwp/notifications/orphans', {method:'DELETE'}); } catch(e) {}
}

// ═══ v180 — Router ÚNICO de notificaciones por target {kind,id,ctx} + rol ═══
// Lo usan los TRES puntos de entrada: (a) clic en el panel/toast, (b) NOTIFICATION_CLICK
// del SW con la app abierta, (c) arranque en frío (?notif=/?task= en checkStoredSession).

// Target de una notif: usa el estampado por el servidor; retro-deriva para notifs
// históricas (espejo de notifDeriveTarget en proxy.js): wt_ → task, sdv_ → sdv, resto → none.
function _notifTargetOf(n) {
  if (n && n.target && n.target.kind) return n.target;
  var rid = n && n.relatedTaskId;
  if (!rid) return { kind:'none', id:null };
  if (/^wt_/.test(rid))  return { kind:'task', id:rid };
  if (/^sdv_/.test(rid)) return { kind:'sdv',  id:rid };
  return { kind:'none', id:null };
}

// Instrumentación v180: estampa clickedAt en el servidor (fire-and-forget).
function _notifMarkClicked(notifId) {
  if (!notifId) return;
  try {
    authFetch('/api/wwp/notifications/' + encodeURIComponent(notifId) + '/clicked', { method:'POST' })
      .catch(function(){});
  } catch(e) {}
}

// Navega al objeto que la notificación señala, degradando por rol.
// kind=none → sin navegación y SIN toast de error (ya quedó leída).
async function routeNotifTarget(target, notif) {
  var kind = (target && target.kind) || 'none';
  var id   = (target && target.id) || null;
  if (kind === 'none' || !id) return;
  var isVentas = _user && _user.role === 'ventas';

  if (kind === 'task') {
    // Refetch para validar existencia (la tarea pudo purgarse) — openDrawer con id
    // inexistente retorna en silencio, así que el aviso claro va aquí.
    try { const r = await authFetch('/api/wwp/tasks'); const fresh = await r.json(); if (Array.isArray(fresh)) _tasks = fresh; } catch(e) {}
    var t = (_tasks||[]).find(function(x){ return x.id === id; });
    if (isVentas) {
      // Ventas nunca aterriza en el drawer de ops: resolver la tarea → su SDV vinculada.
      if (t && t.sdvId) { navTo('sdv-portal'); sdvVerDetalle(t.sdvId, 'mis'); }
      else toast(t ? 'Esta notificación es de una tarea interna de Operaciones' : 'La tarea de esta notificación ya no está disponible');
      return;
    }
    if (!t) { toast('La tarea de esta notificación ya no existe'); return; }
    await openDrawer(id);
    // Tipos de chat (o ctx:'chat'): anclar al hilo del drawer.
    var esChat = (target && target.ctx === 'chat') ||
      (notif && (notif.type === 'task_chat' || notif.type === 'comment_new'));
    if (esChat) {
      setTimeout(function(){
        var sec = document.querySelector('#wwp-drawer .chat-section');
        if (sec) { try { sec.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e) { sec.scrollIntoView(); } }
      }, 350);
    }
    return;
  }

  if (kind === 'sdv') {
    if (isVentas) { navTo('sdv-portal'); sdvVerDetalle(id, 'mis'); }
    else {
      var enBandeja = canSection('sdv-bandeja');
      if (enBandeja) navTo('sdv-bandeja');
      // sdvVerDetalle es autosuficiente (modal + fetch propio); ctx define las acciones.
      sdvVerDetalle(id, enBandeja ? 'bandeja' : 'mis');
    }
    return;
  }

  if (kind === 'reposicion') {
    if (!canSection('solicitudes-reposicion')) { toast('Sin acceso a la sección de reposiciones'); return; }
    navTo('solicitudes-reposicion');
    try { await repCargarLista(); } catch(e) {}
    try { repAbrirDetalle(id); } catch(e) {}
    return;
  }

  if (kind === 'curso') {
    if (isVentas) { toast('Los cursos de formación viven en Workforce Labor'); return; }
    goToWWP();
    switchTab('formacion');
    try { trOpenCourse(id); } catch(e) {}
    return;
  }

  if (kind === 'seccion') {
    navTo(id); // navTo aplica canSection y avisa "Sin acceso a esta sección"
    return;
  }
}

// Entrada canónica desde el panel/toasts: marca leída + clickedAt y rutea.
async function routeNotification(notif) {
  if (!notif) return;
  closeNotifPanel();
  if (!notif.readAt) markRead(notif.id);
  _notifMarkClicked(notif.id);
  await routeNotifTarget(_notifTargetOf(notif), notif);
}

// Entrada desde SW (app abierta) y arranque en frío: puede traer target directo,
// notifId (a resolver contra la lista) o solo taskId legacy.
async function routeNotifClick(info) {
  info = info || {};
  var notif = null;
  if (info.notifId) {
    notif = _notifications.find(function(n){ return n.id === info.notifId; }) || null;
    if (!notif) {
      try {
        var r = await authFetch('/api/wwp/notifications?limit=200');
        var d = await r.json();
        if (d && d.ok) {
          notif = (d.notifications||[]).find(function(n){ return n.id === info.notifId; }) || null;
          if (!_notifications.length && (d.notifications||[]).length) { _notifications = d.notifications; renderNotifications(); }
        }
      } catch(e) {}
    }
  }
  var target = (info.target && info.target.kind) ? info.target
             : notif ? _notifTargetOf(notif)
             : info.taskId ? _notifTargetOf({ relatedTaskId: info.taskId })
             : null;
  if (notif && !notif.readAt) markRead(notif.id);
  if (info.notifId) _notifMarkClicked(info.notifId);
  if (!target) return;
  await routeNotifTarget(target, notif);
}

async function openNotificationById(el) {
  const id = el.dataset.notifId;
  const notif = _notifications.find(n => n.id === id);
  if (!notif) return;
  await routeNotification(notif);
}
// Mantener compatibilidad si algún lugar aún llama openNotification con objeto
// (toasts apilables y el fallback desktop de _notifFireBrowser).
async function openNotification(notif) {
  await routeNotification(notif);
}

// Close notification panel when clicking outside
document.addEventListener('click', function(e) {
  if (!_notifPanelOpen) return;
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('notif-btn');
  if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    closeNotifPanel();
  }
});

function timeSince(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff/1000);
  if (s < 60) return 'Ahora';
  const m = Math.floor(s/60);
  if (m < 60) return m+'m';
  const h = Math.floor(m/60);
  if (h < 24) return h+'h';
  const d = Math.floor(h/24);
  return d+'d';
}


// ═══ (2/2) UTILITIES — ex historial.html 21001–21073 ═══
// ═══════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── Autofill de buscadores (historial por dispositivo) ─────────────────────
// El navegador solo autocompleta campos de un <form> que se ENVÍA; nuestros buscadores
// filtran por JS sin enviar nada, así que autocomplete="on" no recordaría nada. En su
// lugar: cada buscador conocido guarda lo que escribes (en localStorage) y lo ofrece como
// sugerencias vía un <datalist> propio. Delegación por id → cubre también los buscadores
// que nacen dentro de modales/tarjetas (se enganchan al primer focus). Se guarda al dar
// Enter o al salir del campo (change/blur). Máx 10 por buscador, mín 2 caracteres.
var _AUTOFILL_IDS = new Set(['order-input','rs-search-input','do-list-search','do-lines-search',
  'sdv-ref-input','sdv-art-input','sdv-esp-sdv-input','sdv-esp-orden-input','sdv-espedit-orden-input',
  'sdv-mis-search','sdv-bandeja-search','eo-search','eo-f-ord','users-map-search','us-search',
  'task-search','emp-tree-search','arch-search','emp-picker-search']);
var _AUTOFILL_KEY = 'wwp_search_history_v1';
function _afLoad(){ try { return JSON.parse(localStorage.getItem(_AUTOFILL_KEY)) || {}; } catch(e) { return {}; } }
function _afSave(h){ try { localStorage.setItem(_AUTOFILL_KEY, JSON.stringify(h)); } catch(e) {} }
function _afRenderList(inp){
  var dl = document.getElementById('af-dl-'+inp.id);
  if (!dl) return;
  var arr = (_afLoad()[inp.id]) || [];
  dl.innerHTML = arr.map(function(v){ return '<option value="'+esc(v)+'"></option>'; }).join('');
}
function _afEnsure(inp){
  if (!inp || inp.tagName !== 'INPUT' || inp.dataset.afReady) return;
  var dlId = 'af-dl-'+inp.id;
  if (!document.getElementById(dlId)) {
    var dl = document.createElement('datalist'); dl.id = dlId; document.body.appendChild(dl);
  }
  inp.setAttribute('list', dlId);
  // autocomplete="off" suprime el dropdown del datalist en algunos navegadores → permitirlo
  if (String(inp.getAttribute('autocomplete')||'').toLowerCase() === 'off') inp.setAttribute('autocomplete','on');
  inp.dataset.afReady = '1';
  _afRenderList(inp);
}
function _afRemember(inp){
  var v = (inp.value||'').trim();
  if (v.length < 2) return;
  var h = _afLoad(); var arr = (h[inp.id]) || [];
  arr = [v].concat(arr.filter(function(x){ return x !== v; })).slice(0, 10);
  h[inp.id] = arr; _afSave(h);
  _afRenderList(inp);
}
document.addEventListener('focusin', function(e){
  var t = e.target;
  if (t && t.id && _AUTOFILL_IDS.has(t.id)) _afEnsure(t);
});
document.addEventListener('keydown', function(e){
  var t = e.target;
  if (e.key === 'Enter' && t && t.id && _AUTOFILL_IDS.has(t.id)) _afRemember(t);
});
document.addEventListener('change', function(e){
  var t = e.target;
  if (t && t.id && _AUTOFILL_IDS.has(t.id)) _afRemember(t);
}, true);

function showErr(el, msg){ el.textContent=msg; el.classList.add('show'); }
function togglePw(id, btn){ const el=document.getElementById(id); const isHidden=el.type==='password'; el.type=isHidden?'text':'password'; btn.innerHTML='<i data-lucide="'+(isHidden?'eye-off':'eye')+'"></i>'; if(window.lucide) lucide.createIcons(); }
function fmtDate(iso){ try{ return new Date(iso).toLocaleString('es-DO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch{return iso||'';} }
let _toastTimer;
function toast(msg, opt){
  // opt: número → duración ms (comportamiento previo); string error|success|info → tipo visual (port da267a4)
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.remove('toast-error','toast-success','toast-info');
  const duration = (typeof opt==='number') ? opt : 3000;
  if (typeof opt==='string' && ['error','success','info'].includes(opt)) t.classList.add('toast-'+opt);
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.remove('show'), duration);
}

// ═══════════════════════════════════════════════════════════════════════
// FOCUS-TRAP GLOBAL para modales (UX-29, plan 10)
// Mantiene Tab dentro del modal visible con aria-modal y devuelve el foco al
// disparador al cerrarse. Sin registro por modal: observa el DOM al vuelo.
// ═══════════════════════════════════════════════════════════════════════
var _ftLastTrigger = null;
document.addEventListener('mousedown', function(e){
  // Recordar el último control activado fuera de un modal (candidato a recibir
  // el foco de vuelta cuando el modal que abra se cierre).
  if (!e.target.closest('[aria-modal="true"]')) _ftLastTrigger = e.target.closest('button,a,[tabindex]');
}, true);
function _ftVisibleModal(){
  var mods = document.querySelectorAll('[aria-modal="true"]');
  for (var i = mods.length - 1; i >= 0; i--) {
    var m = mods[i];
    if (m.offsetParent !== null || m.getClientRects().length) return m;
  }
  return null;
}
document.addEventListener('keydown', function(e){
  if (e.key !== 'Tab') return;
  var modal = _ftVisibleModal();
  if (!modal) return;
  var f = modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
  var vis = [];
  for (var i = 0; i < f.length; i++) { if (f[i].offsetParent !== null) vis.push(f[i]); }
  if (!vis.length) return;
  var first = vis[0], last = vis[vis.length - 1];
  if (!modal.contains(document.activeElement)) { first.focus(); e.preventDefault(); return; }
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
});
// Retorno de foco: cuando el modal visible desaparece, devolver el foco al disparador.
(function(){
  var _ftHadModal = false;
  var mo = new MutationObserver(function(){
    var has = !!_ftVisibleModal();
    if (_ftHadModal && !has && _ftLastTrigger && _ftLastTrigger.isConnected) {
      try { _ftLastTrigger.focus(); } catch(e) {}
    }
    _ftHadModal = has;
  });
  if (document.body) mo.observe(document.body, {attributes:true, subtree:true, attributeFilter:['style','class','hidden']});
  else document.addEventListener('DOMContentLoaded', function(){ mo.observe(document.body, {attributes:true, subtree:true, attributeFilter:['style','class','hidden']}); });
})();

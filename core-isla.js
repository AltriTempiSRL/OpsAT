// ═══════════════════════════════════════════════════════════════════════
// core-isla.js — núcleo compartido de las ISLAS (Ola 3, plan 08).
// No confundir con core.js (núcleo del SHELL historial.html: auth completa,
// notificaciones, SSE/WS). Esto es el mínimo que toda isla necesita:
//   esc · islaFetch/_authHeaders (Bearer desde wwp_auth EN CADA request,
//   hereda los refresh del shell) · islaUser() · tema (theme.css + wwp_theme
//   + cambio en vivo vía evento storage) · toast (mismo look del shell) ·
//   helpers del contrato postMessage con el shell (ready/route/vista).
// REGLAS:
//  - Las islas comparten origen con el shell: la sesión se lee del storage
//    (patrón almacen-mapa), NUNCA viaja por URL.
//  - Al editar este archivo: re-estampar su ?v= (hash md5-8) en TODAS las
//    islas que lo cargan (grep 'core-isla.js?v=' *.html).
// ═══════════════════════════════════════════════════════════════════════

var _EMBEBIDA = (function(){ try { return window.parent !== window; } catch(e) { return true; } })();

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function fmtDate(iso){ try{ return new Date(iso).toLocaleString('es-DO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){return iso||'';} }

// ── Sesión compartida del origen ─────────────────────────────────────────
function _wwpAuth(){
  try { return JSON.parse(sessionStorage.getItem('wwp_auth') || localStorage.getItem('wwp_auth') || '{}'); }
  catch(e) { return {}; }
}
function _authHeaders(){
  var a = _wwpAuth();
  return a.accessToken ? { 'Authorization': 'Bearer ' + a.accessToken } : {};
}
function islaUser(){ return _wwpAuth().user || null; }
function islaFetch(url, opts){
  opts = opts || {};
  var h = Object.assign({}, opts.headers || {}, _authHeaders());
  return fetch(url, Object.assign({}, opts, { headers: h }));
}

// ── Tema ─────────────────────────────────────────────────────────────────
function _applyTheme(){
  var t = 'light';
  try { t = localStorage.getItem('wwp_theme') || 'light'; } catch(e) {}
  document.documentElement.setAttribute('data-theme', t);
}
_applyTheme();
window.addEventListener('storage', function(ev){ if (ev.key === 'wwp_theme') _applyTheme(); });

// ── Toast (mismo look del shell: historial.html ~3298) ───────────────────
(function(){
  var st = document.createElement('style');
  st.textContent = '.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);background:#1e293b;color:white;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;z-index:999;transition:transform .3s;max-width:calc(100vw - 32px);white-space:normal;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.3);border-left:4px solid transparent}'
    + '.toast.show{transform:translateX(-50%) translateY(0)}'
    + '.toast.toast-error{border-left-color:#ef4444}'
    + '.toast.toast-success{border-left-color:#22c55e}'
    + '.toast.toast-info{border-left-color:#3b82f6}';
  document.head.appendChild(st);
})();
var _toastTimer;
function toast(msg, opt){
  var t = document.getElementById('toast');
  if (!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.remove('toast-error','toast-success','toast-info');
  var duration = (typeof opt==='number') ? opt : 3000;
  if (typeof opt==='string' && ['error','success','info'].indexOf(opt)>=0) t.classList.add('toast-'+opt);
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.classList.remove('show'); }, duration);
}

// ── Contrato postMessage con el shell (canal = prefijo, p.ej. 'dbv') ─────
// isla → shell {type:'<canal>-ready'}          al cargar (islaAnunciarReady)
// shell → isla {type:'<canal>-view', view}     subruta a mostrar (islaOnVista)
// isla → shell {type:'<canal>-route', view}    lo mostrado; el shell escribe el
//                                              path real y filtra ecos.
function islaAnunciarReady(canal){
  if (_EMBEBIDA) { try { window.parent.postMessage({ type: canal + '-ready' }, location.origin); } catch(e) {} }
}
function islaReportarRuta(canal, valor){
  if (_EMBEBIDA) { try { window.parent.postMessage({ type: canal + '-route', view: String(valor) }, location.origin); } catch(e) {} }
}
function islaOnVista(canal, cb){
  window.addEventListener('message', function(ev){
    if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
    if (ev.data.type === canal + '-view' && typeof ev.data.view === 'string') cb(ev.data.view);
  });
}
// isla → shell {type:'<canal>-badge', count} — badge del nav/tab en el shell
// (p.ej. #formacion-badge con cursos pendientes). Igual que hoy: el badge se
// actualiza cuando el módulo carga sus datos.
function islaBadge(canal, count){
  if (_EMBEBIDA) { try { window.parent.postMessage({ type: canal + '-badge', count: count|0 }, location.origin); } catch(e) {} }
}
// isla → shell {type:'isla-tarea', payload} — la isla PIDE crear una tarea y el
// shell EJECUTA su wizard (goToWWP + openTaskWizard(payload)). El wizard de
// tareas vive en el shell; las islas nunca lo duplican.
function islaPedirTarea(payload){
  if (_EMBEBIDA) { try { window.parent.postMessage({ type: 'isla-tarea', payload: payload }, location.origin); } catch(e) {} }
  else { alert('Crear tarea requiere la app completa (abre esta página desde el menú).'); }
}

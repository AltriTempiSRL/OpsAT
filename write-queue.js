'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// write-queue.js — Sección crítica por clave (hallazgos B1/B2, auditoría 07)
//
// Serializa ciclos read-modify-write concurrentes sobre la misma colección:
//   await queueWrite('wwp-tasks', async () => { /* load → mutar → save */ });
//
// Node es monohilo: un bloque load→mutar→save SIN await ya es atómico. La
// ventana de lost-update la abren los `await` intermedios (Odoo, R2, disco):
// ahí otra petición puede mutar/reordenar la colección viva y dejar índices
// (`tasks[idx]`) apuntando a otra fila. Todo mutador CON await intermedio y
// todo mutador DESTRUCTIVO (splice / filter reasignado) debe pasar por acá.
//
// Contrato (cubierto por tests/_test_b1b3_colas.mjs):
//  - misma clave: serializa en orden de llegada; claves distintas: paralelas.
//  - el error del writeFn SE PROPAGA al caller (puede responder 500)…
//  - …pero la cadena sobrevive: el siguiente write de la clave corre igual.
//  - el valor de retorno del writeFn llega al caller.
// ═══════════════════════════════════════════════════════════════════════════
const _writeQueues = new Map();

function queueWrite(key, writeFn) {
  const prev = _writeQueues.get(key) || Promise.resolve();
  const next = prev.then(writeFn);
  // La cadena continúa aunque este write falle; el rechazo lo ve SOLO el caller.
  _writeQueues.set(key, next.catch(() => {}));
  return next;
}

module.exports = { queueWrite, _writeQueues };

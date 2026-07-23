'use strict';
// Registro de islas (plan 08). Al crear una isla nueva: agregarla aquí — los
// guards de coherencia de hash (core-isla.js / theme.css) la recogen solos.
const ISLAS = [
  { archivo: '/formacion.html', iframe: '#formacion-iframe', ruta: '/wwp/formacion' },
  { archivo: '/politicas.html', iframe: '#politicas-iframe', ruta: '/wwp/politicas' },
  { archivo: '/impacto.html', iframe: '#impacto-iframe', ruta: '/wwp/impacto' },
  { archivo: '/dev-cdp.html', iframe: '#devcdp-iframe', ruta: '/dev-cdp' },
];

module.exports = { ISLAS };

// Tema Astryx con la identidad de OpsAT.
// Se hace por el sistema de temas (defineTheme), NO sobrescribiendo --color-* en
// :root — regla dura del sistema.
//
// Valores tomados de theme.css (fuente de verdad de la marca):
//   acento #1b3b6f · lienzo cálido #f4f3f1 · sidebar navy #0f1c2e
//   tipografía Inter · radio base 6px
// Los pares [claro, oscuro] cubren el modo noche.
//
// NOMBRES DE TOKEN verificados contra `astryx docs tokens`. En la primera versión
// inventé `--color-background-page` y `--color-text-tertiary`: NO existen, así que
// aquellos overrides no hacían absolutamente nada (fallo silencioso).

import {defineTheme} from '@astryxdesign/core/theme';

export const temaOpsAT = defineTheme({
  name: 'opsat',

  // API de familia de acento: genera --color-accent, --color-on-accent,
  // --color-accent-muted, etc. con contraste garantizado. La guía de migración
  // avisa: escribir --color-accent a mano deja --color-on-accent en su blanco
  // por defecto, sin garantía de contraste contra el acento nuevo.
  color: {accent: '#1b3b6f', neutralStyle: 'warm'},

  typography: {
    scale: {base: 14, ratio: 1.2},
    body: {family: 'Inter', fallbacks: 'system-ui,-apple-system,sans-serif'},
    heading: {family: 'Inter', fallbacks: 'system-ui,-apple-system,sans-serif'},
  },

  // 6px = --radius de OpsAT (escala inner/element/container se deriva de aquí)
  radius: {base: 6, multiplier: 1},

  // Solo lo que la escala no puede derivar: lienzo, superficies y el acento exacto.
  //
  // Sobre el acento: la API de familia derivó #2B5DAB de la semilla — bastante más
  // claro que el navy de OpsAT. El sistema prioriza contraste; aquí la marca manda,
  // así que se fija el valor exacto. La guía de migración advierte que escribir
  // --color-accent a mano deja --color-on-accent en su blanco por defecto: por eso
  // se fija TAMBIÉN el par, con contraste verificado (blanco sobre #1b3b6f y
  // navy sobre el azul claro del modo noche).
  tokens: {
    '--color-accent':             ['#1b3b6f', '#5ba3ff'],
    '--color-on-accent':          ['#ffffff', '#0f1c2e'],
    '--color-background-body':    ['#f4f3f1', '#14171e'],
    '--color-background-surface': ['#ffffff', '#1b1f27'],
    '--color-background-card':    ['#ffffff', '#1b1f27'],
    '--color-border':             ['#d6d4cf', '#2e333d'],
    '--color-text-primary':       ['#1c2430', '#e8eaed'],
    '--color-text-secondary':     ['#45556a', '#9aa5b4'],
  },

  components: {
    // El sidebar navy con texto claro es el rasgo más reconocible de OpsAT.
    // Astryx lo pinta claro por defecto: su SideNav sigue el tema de la página
    // y no tiene prop `mode`, así que la desviación se hace aquí.
    // OJO: la clave es 'side-nav' con guion (`astryx component SideNav`,
    // sección Theming); 'sidenav' no aplica.
    'side-nav': {
      base: {
        backgroundColor: '#0f1c2e',
        color: '#e8eaed',
        borderRightColor: 'rgba(255,255,255,.10)',
        // Los hijos no heredan color: leen los tokens de texto/icono. Redefinirlos
        // CON ALCANCE al sidebar los invierte de una vez, sin parchear elemento a
        // elemento. No se toca :root.
        '--color-text-primary':   '#ffffff',
        '--color-text-secondary': 'rgba(255,255,255,.72)',
        '--color-text-disabled':  'rgba(255,255,255,.45)',
        '--color-icon-primary':   'rgba(255,255,255,.85)',
        '--color-icon-secondary': 'rgba(255,255,255,.65)',
        '--color-overlay-hover':  'rgba(255,255,255,.08)',
        '--color-overlay-pressed':'rgba(255,255,255,.14)',
      },
    },
    'side-nav-heading': {base: {color: '#ffffff'}},
    'side-nav-item':    {base: {color: 'rgba(255,255,255,.82)'},
                         selected: {backgroundColor: 'rgba(255,255,255,.12)', color: '#ffffff'}},
    // El cuadro del logo va gris como el avatar "AT" del shell actual: con el
    // acento navy se fundía contra el sidebar y el logo desaparecía.
    navicon: {base: {backgroundColor: '#696969', color: '#ffffff'}},
  },
});

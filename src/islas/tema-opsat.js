// Tema Astryx con la identidad de OpsAT.
// Se hace por el sistema de temas (defineTheme), NO sobrescribiendo --color-* en
// :root — esa es una regla dura de Astryx (bloque ASTRYX de CLAUDE.md).
//
// Los valores salen de theme.css (la fuente de verdad de la marca):
//   fondo cálido #f4f3f1 · acento #1b3b6f · sidebar navy #0f1c2e
//   tipografía Inter · radio base 6px
// Los pares [claro, oscuro] cubren el modo noche que la app ya soporta.

import {defineTheme} from '@astryxdesign/core/theme';

export const temaOpsAT = defineTheme({
  name: 'opsat',

  // El generador deriva fondos, textos y bordes a partir del acento de marca.
  color: {accent: '#1b3b6f', neutralStyle: 'warm'},

  typography: {
    scale: {base: 14, ratio: 1.2},
    body: {family: 'Inter', fallbacks: 'system-ui,-apple-system,sans-serif'},
    heading: {family: 'Inter', fallbacks: 'system-ui,-apple-system,sans-serif'},
  },

  // radius 6px = --radius de OpsAT
  radius: {base: 6, multiplier: 1},

  // Overrides explícitos: ganan sobre lo generado por las escalas.
  tokens: {
    '--color-accent': ['#1b3b6f', '#5ba3ff'],
    // Lienzo cálido de OpsAT, no el gris neutro por defecto
    '--color-background-page': ['#f4f3f1', '#14171e'],
    '--color-background-surface': ['#ffffff', '#1b1f27'],
    '--color-border': ['#d6d4cf', '#2e333d'],
    '--color-text-primary': ['#1c2430', '#e8eaed'],
    '--color-text-secondary': ['#45556a', '#9aa5b4'],
  },

  components: {
    // El sidebar navy con texto claro es el rasgo más reconocible de OpsAT;
    // Astryx lo pinta claro por defecto. OJO: la clave es 'side-nav' con guion
    // (la da `astryx component SideNav`, sección Theming) — 'sidenav' no aplica.
    'side-nav': {
      base: {
        backgroundColor: '#0f1c2e',
        color: '#e8eaed',
        borderRightColor: 'rgba(255,255,255,.10)',
        // Los hijos (heading, items, iconos) no heredan: usan los tokens de
        // texto. Redefinirlos CON ALCANCE al sidebar los invierte de una vez,
        // en vez de parchear cada elemento. No se toca :root (regla de Astryx).
        '--color-text-primary': '#ffffff',
        '--color-text-secondary': 'rgba(255,255,255,.72)',
        '--color-text-tertiary': 'rgba(255,255,255,.50)',
        '--color-icon-primary': 'rgba(255,255,255,.85)',
        '--color-icon-secondary': 'rgba(255,255,255,.65)',
      },
    },
    'side-nav-heading': {
      base: {color: '#ffffff'},
    },
    // El cuadro del logo va gris (#696969) como el avatar "AT" del shell actual.
    // Con el acento navy se fundía contra el sidebar y el logo desaparecía.
    navicon: {
      base: {backgroundColor: '#696969', color: '#ffffff'},
    },
    'side-nav-section': {
      // Rótulos de grupo: mayúsculas tenues, como en el shell actual
      base: {color: 'rgba(255,255,255,.45)'},
    },
    'side-nav-item': {
      base: {color: 'rgba(255,255,255,.82)'},
      'selected': {
        backgroundColor: 'rgba(255,255,255,.12)',
        color: '#ffffff',
      },
    },
  },
});

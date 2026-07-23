// Entry para vendorizar React como GLOBAL (lo exige el bundle UMD de Astryx).
// Se compila local con `npm run build:vendor`; el resultado (vendor/react-globals.js)
// se COMMITEA — producción sigue sirviendo estáticos, sin build en el deploy.
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
window.React = React;
window.ReactDOM = ReactDOMClient;

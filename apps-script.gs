/**
 * ══════════════════════════════════════════════════════════════
 *  ALTRI TEMPI — Solicitud de Despacho → Google Sheets
 *  Google Apps Script Web App
 * ══════════════════════════════════════════════════════════════
 *
 *  INSTRUCCIONES DE INSTALACIÓN (hacer una sola vez):
 *
 *  1. Abre tu Google Sheets (el que alimenta el dashboard)
 *  2. Click en Extensiones → Apps Script
 *  3. Borra todo el código existente y pega TODO este archivo
 *  4. Haz click en Guardar (💾)
 *  5. Haz click en Implementar → Nueva implementación
 *  6. Tipo: Aplicación web
 *     - Descripción: "Solicitud de Despacho Form"
 *     - Ejecutar como: Yo (tu cuenta de Google)
 *     - Quién tiene acceso: Cualquiera
 *  7. Haz click en Implementar → Autoriza el acceso
 *  8. Copia la URL de la implementación (termina en /exec)
 *  9. Abre form-despacho.html y reemplaza:
 *        const APPS_SCRIPT_URL = 'REEMPLAZAR_CON_TU_URL_DE_APPS_SCRIPT';
 *     por:
 *        const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TU_ID/exec';
 *
 * ══════════════════════════════════════════════════════════════
 */

// ── CONFIGURACIÓN ─────────────────────────────────────────────
// Nombre de la hoja donde están los datos (pestaña del Google Sheets)
// Si no sabes el nombre exacto, deja null y usará la primera hoja
var SHEET_NAME = 'Despachos'; // Hoja "Despachos" en "Controles de Operciones 1.2-demo"

// Estatus inicial para solicitudes nuevas
var ESTATUS_NUEVO = 'Pendiente Confirmacion';
// ─────────────────────────────────────────────────────────────


/**
 * Maneja las peticiones POST desde el formulario HTML.
 */
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];

    if (!sheet) {
      throw new Error('No se encontró la hoja "' + SHEET_NAME + '". Verifica el nombre en apps-script.gs');
    }

    // Parsear los datos del formulario
    var data = JSON.parse(e.postData.contents);

    // Obtener encabezados de la fila 1 para mapear columnas dinámicamente
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return String(h).trim();
    });

    // Mapeo: nombre de columna en el Sheet → valor del formulario
    var fieldMap = {
      'No. Orden':          data.noOrden          || '',
      'Tipo de Movimiento': data.tipoSolicitud     || '',
      'Nombre Cliente':     data.nombreCliente     || '',
      'Ciudades':           data.ciudadEntrega      || '',
      'Lugar de Entrega':   data.direccionEntrega   || '',
      'Fecha Solicitada':   formatDate(data.fechaEntrega),
      'VENDEDOR':           data.vendedor           || '',
      'Estatus':            ESTATUS_NUEVO,
      'Comentario':         buildComentario(data),
    };

    // Construir la fila en el orden exacto de los encabezados
    var newRow = headers.map(function(h) {
      return fieldMap.hasOwnProperty(h) ? fieldMap[h] : '';
    });

    // Si algún header clave no existe, agregar de todas formas al final
    // (esto protege si la hoja tiene nombres de columnas ligeramente diferentes)
    sheet.appendRow(newRow);

    return jsonResponse({ status: 'ok', message: 'Solicitud registrada correctamente' });

  } catch (err) {
    Logger.log('Error en doPost: ' + err.toString());
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}


/**
 * Responde a GET (útil para verificar que el script está activo).
 */
function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'Apps Script Solicitud de Despacho activo ✓' });
}


// ── Helpers ───────────────────────────────────────────────────

/**
 * Formatea la fecha de YYYY-MM-DD al formato legible
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + String(d.getDate()).padStart(2,'0') + ', ' + d.getFullYear();
  } catch(e) {
    return dateStr;
  }
}

/**
 * Construye el campo Comentario combinando observación + datos de quien recibe
 */
function buildComentario(data) {
  var parts = [];
  if (data.observacion && data.observacion.trim())
    parts.push(data.observacion.trim());
  if (data.nombreRecibe && data.nombreRecibe.trim())
    parts.push('Recibe: ' + data.nombreRecibe.trim());
  if (data.contactoRecibe && data.contactoRecibe.trim())
    parts.push('Tel: ' + data.contactoRecibe.trim());
  if (data.costoIncluido)
    parts.push('Transporte incluido: ' + data.costoIncluido);
  return parts.join(' | ');
}

/**
 * Retorna una respuesta JSON con headers CORS
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

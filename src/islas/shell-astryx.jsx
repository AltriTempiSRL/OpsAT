// Shell de OpsAT en Astryx — multi-pantalla, con routing y datos reales.
// Vive en /v2, EN PARALELO al shell actual: no toca historial.html.
//
// REGLAS DE ASTRYX (bloque ASTRYX de CLAUDE.md) que respeta este archivo:
//  - Sin <div> ni HTML crudo para layout: AppShell/Layout/Stack/Card.
//  - Sin style={{}} ni hex/px crudos: props de componente y tokens var(--*).
//  - Datos densos = filas (Table), NUNCA items de lista envueltos en Card.
//  - StatusDot para estado; Badge solo para conteos y estados enumerados.
//
// TRAMPAS ya pagadas (la API es estricta y falla en silencio o en blanco):
//  - StatusDot: `label` es SOLO aria-label; variantes success|warning|error|accent|neutral.
//  - Banner: exige `status`, NO `variant`. Sin ella, pantalla en blanco.
//  - Heading exige `level`; Button exige `label`.
//
// Compila con `npm run build:islas` (estampa ?v= en el HTML).

import {useEffect, useState, useCallback, Component} from 'react';
import {Theme} from '@astryxdesign/core/Theme';
import {temaOpsAT} from './tema-opsat.js';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Layout, LayoutContent, LayoutHeader, LayoutPanel} from '@astryxdesign/core/Layout';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {VStack, HStack} from '@astryxdesign/core/Stack';
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Table, proportional, pixel} from '@astryxdesign/core/Table';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Banner} from '@astryxdesign/core/Banner';
import {Toolbar} from '@astryxdesign/core/Toolbar';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Divider} from '@astryxdesign/core/Divider';
import {
  ClipboardDocumentListIcon, TruckIcon, InboxIcon, ArrowPathIcon,
  PaperClipIcon, ArchiveBoxIcon, MagnifyingGlassIcon, CubeIcon,
  ExclamationTriangleIcon, ArrowsRightLeftIcon, BuildingStorefrontIcon,
  MapIcon, ChartBarIcon, PhotoIcon, Cog6ToothIcon, UserCircleIcon,
  AcademicCapIcon, WrenchScrewdriverIcon, ShieldCheckIcon, ChevronRightIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

// ════════ Vocabulario compartido con core.js (una sola fuente de verdad) ════
const ESTADO_TAREA = {
  pending:     {label: 'Pendiente',  dot: 'neutral'},
  assigned:    {label: 'Asignada',   dot: 'accent'},
  in_progress: {label: 'En curso',   dot: 'warning'},
  completed:   {label: 'Completada', dot: 'success'},
  validated:   {label: 'Validada',   dot: 'success'},
  cancelled:   {label: 'Cancelada',  dot: 'neutral'},
};
const TIPO_TAREA = {
  packaging: 'Empaque', dispatch_order: 'Orden de Despacho',
  item_pickup: 'Recogida de Artículos', truck_loading: 'Carga en Camión',
  warehouse_move: 'Movimiento de Almacén', staffing: 'Solicitud de Personal',
  general: 'General', free: 'Tarea Libre',
};
const PRIORIDAD = {high: 'Alta', medium: 'Media', low: 'Baja'};
const ESTADO_SDV = {
  pendiente_revision: {label: 'Pendiente revisión', dot: 'warning'},
  en_proceso:         {label: 'En proceso',         dot: 'accent'},
  despachada:         {label: 'Despachada',         dot: 'success'},
  rechazada:          {label: 'Rechazada',          dot: 'error'},
  cancelada:          {label: 'Cancelada',          dot: 'neutral'},
};
const ESTADO_AVERIA = {
  Recibido:   {dot: 'accent'},  'En Taller': {dot: 'warning'},
  Reparado:   {dot: 'success'}, Descartado:  {dot: 'neutral'},
};
const ROL = {admin: 'Admin', manager: 'Encargado', assistant: 'Auxiliar', ventas: 'Ventas'};

// ════════ Datos ════════
function authHeaders() {
  try {
    const a = JSON.parse(sessionStorage.getItem('wwp_auth') || localStorage.getItem('wwp_auth') || '{}');
    return a.accessToken ? {Authorization: 'Bearer ' + a.accessToken} : {};
  } catch { return {}; }
}

/** Hook genérico de carga: expone {cargando, error, datos, recargar}. */
function useApi(url, extraer) {
  const [s, setS] = useState({cargando: true, error: null, datos: []});
  const cargar = useCallback(async () => {
    setS(v => ({...v, cargando: true, error: null}));
    try {
      const r = await fetch(url, {headers: authHeaders()});
      if (r.status === 401) throw new Error('Sesión expirada — inicia sesión de nuevo.');
      if (r.status === 403) throw new Error('Tu rol no tiene acceso a esta información.');
      if (!r.ok) throw new Error('El servidor respondió ' + r.status + '.');
      const j = await r.json();
      setS({cargando: false, error: null, datos: extraer(j) || []});
    } catch (e) { setS({cargando: false, error: e.message, datos: []}); }
  }, [url]);
  useEffect(() => { cargar(); }, [cargar]);
  return {...s, recargar: cargar};
}

// ════════ Piezas reutilizables ════════
function Estado({mapa, valor}) {
  const e = mapa[valor] || {label: valor || 'Desconocido', dot: 'neutral'};
  const label = e.label || valor;
  // El label de StatusDot es solo accesible: el texto visible va aparte.
  return (
    <HStack gap={2} vAlign="center">
      <StatusDot variant={e.dot} label={label} />
      <Text size="sm">{label}</Text>
    </HStack>
  );
}

/** Tira compacta de cifras en el header. Antes eran Cards: la guía de layout
 *  del sistema lo prohíbe para herramientas de trabajo ("rows only, zero cards"
 *  — envolver todo en Card se lee como prototipo, no como producto). */
function Cifras({items, cargando}) {
  return (
    <HStack gap={4} vAlign="center" wrap>
      {items.map(k => (
        <HStack key={k.etiqueta} gap={1.5} vAlign="baseline">
          <Text weight="bold">{cargando ? '—' : String(k.valor)}</Text>
          <Text color="secondary" size="sm">{k.etiqueta}</Text>
        </HStack>
      ))}
    </HStack>
  );
}

/** Estructura de herramienta de trabajo, según `astryx docs layout`:
 *  frame primero (header / contenido edge-to-edge / inspector), filas densas y
 *  CERO cards. Seleccionar una fila abre el inspector lateral — el patrón
 *  maestro-detalle que la guía llama "la columna vertebral de las herramientas".
 *  `detalle(fila)` devuelve los campos a mostrar en el inspector. */
function Pantalla({titulo, subtitulo, acciones, kpis, api, columnas, vacio, buscarEn, filtros, detalle}) {
  const {cargando, error, datos, recargar} = api;
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState({});
  const [filaSel, setFilaSel] = useState(null);

  const texto = busqueda.trim().toLowerCase();
  const visibles = datos.filter(fila => {
    if (texto && buscarEn && buscarEn.length) {
      if (!buscarEn.some(c => String(fila[c] ?? '').toLowerCase().includes(texto))) return false;
    }
    return (filtros || []).every(f => {
      const v = seleccion[f.campo];
      return !v || String(fila[f.campo] ?? '') === v;
    });
  });

  const hayFiltro = !!texto || Object.values(seleccion).some(Boolean);
  const limpiar = () => { setBusqueda(''); setSeleccion({}); };
  const sel = filaSel && visibles.find(f => (f.id ?? f) === filaSel) || null;

  // Columnas + una de selección: la fila entera abre el inspector.
  const cols = [...columnas, {
    key: '__sel', header: '', width: pixel(44),
    renderCell: r => (
      <Button label="Ver detalle" isIconOnly icon={<Icon icon={ChevronRightIcon} size="sm" />} size="sm"
              variant="ghost" clickAction={() => setFilaSel(r.id ?? r)} />
    ),
  }];

  return (
    <Layout
      height="fill"
      hasDivider
      header={
        <LayoutHeader hasDivider>
          <HStack gap={3} vAlign="center" hAlign="space-between" wrap>
            <VStack gap={0.5}>
              <Heading level={3}>{titulo}</Heading>
              {subtitulo && <Text color="secondary" size="sm">{subtitulo}</Text>}
            </VStack>
            <HStack gap={4} vAlign="center" wrap>
              {kpis && !error && <Cifras items={kpis(datos)} cargando={cargando} />}
              <HStack gap={2}>
                <Button label="Actualizar" variant="ghost" clickAction={recargar} />
                {acciones}
              </HStack>
            </HStack>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={0}>
          <VStack gap={0}>
            {(buscarEn || filtros) && !error && (
              <Toolbar
                label={'Filtros de ' + titulo}
                size="sm"
                dividers={['bottom']}
                startContent={
                  <>
                    {buscarEn && buscarEn.length > 0 && (
                      <TextInput label="Buscar" isLabelHidden placeholder="Buscar…"
                                 value={busqueda} onChange={setBusqueda}
                                 startIcon={MagnifyingGlassIcon} />
                    )}
                    {(filtros || []).map(f => (
                      <Selector key={f.campo} label={f.label} isLabelHidden placeholder={f.label}
                                hasClear value={seleccion[f.campo] || null}
                                onChange={v => setSeleccion(x => ({...x, [f.campo]: v}))}
                                options={f.opciones.map(o => ({value: o.valor, label: o.etiqueta}))} />
                    ))}
                    {hayFiltro && <Button label="Limpiar" variant="ghost" size="sm" clickAction={limpiar} />}
                  </>
                }
                endContent={
                  <Text color="secondary" size="sm">
                    {visibles.length === datos.length
                      ? `${datos.length} registro${datos.length === 1 ? '' : 's'}`
                      : `${visibles.length} de ${datos.length}`}
                  </Text>
                }
              />
            )}

            {error && (
              <Banner status="error" container="section"
                      title={'No se pudo cargar ' + titulo.toLowerCase()}
                      description={error}
                      endContent={<Button label="Reintentar" variant="secondary" clickAction={recargar} />} />
            )}

            {cargando && (
              <EmptyState icon={<Spinner />} title="Cargando…" isCompact />
            )}

            {!cargando && !error && datos.length === 0 && (
              <EmptyState title={vacio || 'No hay nada que mostrar.'}
                          description="Cuando existan registros aparecerán aquí." />
            )}

            {!cargando && !error && datos.length > 0 && visibles.length === 0 && (
              <EmptyState title="Ningún registro coincide"
                          description="Prueba con otra búsqueda o quita los filtros."
                          actions={<Button label="Limpiar filtros" variant="secondary" clickAction={limpiar} />} />
            )}

            {!cargando && !error && visibles.length > 0 && (
              <Table data={visibles} columns={cols} idKey="id" density="compact"
                     dividers="rows" hasHover textOverflow="truncate" />
            )}
          </VStack>
        </LayoutContent>
      }
      end={
        <LayoutPanel width={380} hasDivider isScrollable label="Detalle"
                     resizable={{minSizePx: 320, maxSizePx: 520, autoSaveId: 'v2-inspector'}}>
          {sel && detalle ? (
            <VStack gap={3} padding={4}>
              <HStack hAlign="space-between" vAlign="center">
                <Heading level={4}>Detalle</Heading>
                <Button label="Cerrar" isIconOnly icon={<Icon icon={XMarkIcon} size="sm" />} size="sm"
                        variant="ghost" clickAction={() => setFilaSel(null)} />
              </HStack>
              <MetadataList>
                {detalle(sel).map(d => (
                  <MetadataListItem key={d.etiqueta} label={d.etiqueta}>
                    {typeof d.valor === 'string' || typeof d.valor === 'number'
                      ? <Text size="sm">{String(d.valor || '—')}</Text>
                      : (d.valor || <Text size="sm">—</Text>)}
                  </MetadataListItem>
                ))}
              </MetadataList>
            </VStack>
          ) : (
            <EmptyState isCompact title="Nada seleccionado"
                        description="Elige una fila para ver su detalle aquí." />
          )}
        </LayoutPanel>
      }
    />
  );
}

// ════════ Pantalla embebida (patrón strangler-fig) ═══════════════════════
// Las pantallas con flujos complejos (formularios con Odoo, mapa 3D, escaneo)
// se sirven DENTRO del shell Astryx embebiendo la implementación actual. La app
// queda completa y usable hoy; cada una se reconstruye nativa cuando toque.
function Embebida({titulo, subtitulo, src, alto = 'calc(100dvh - 240px)'}) {
  return (
    <VStack gap={3}>
      <VStack gap={1}>
        <Heading level={2}>{titulo}</Heading>
        {subtitulo && <Text color="secondary">{subtitulo}</Text>}
      </VStack>
      {/* Honestidad al revisar: se ve distinto porque AÚN no es nativa. */}
      <Banner
        status="info"
        title="Interfaz anterior"
        description="Esta pantalla funciona, pero todavía usa el diseño previo. Falta reconstruirla con el sistema nuevo."
        isDismissable
      />
      <Card padding={0} width="100%">
        <iframe
          src={src}
          title={titulo}
          style={{width: '100%', height: alto, border: 'none', display: 'block',
                  borderRadius: 'var(--radius-container)'}}
        />
      </Card>
    </VStack>
  );
}

// ════════ Pantallas de datos ═════════════════════════════════════════════
function PanelTareas() {
  const api = useApi('/api/wwp/tasks?all=1', j => Array.isArray(j) ? j : (j.tasks || []));
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <Pantalla
      titulo="Tareas"
      subtitulo="Trabajo del equipo, en vivo desde la API de OpsAT."
      acciones={<Button label="+ Nueva Tarea" variant="primary" />}
      api={api}
      vacio="No hay tareas que mostrar."
      buscarEn={['title', 'client', 'odooRef']}
      filtros={[
        {label: 'Estado', campo: 'status', opciones: Object.entries(ESTADO_TAREA).map(([v, e]) => ({valor: v, etiqueta: e.label}))},
        {label: 'Tipo', campo: 'type', opciones: Object.entries(TIPO_TAREA).map(([v, l]) => ({valor: v, etiqueta: l}))},
        {label: 'Prioridad', campo: 'priority', opciones: Object.entries(PRIORIDAD).map(([v, l]) => ({valor: v, etiqueta: l}))},
      ]}
      detalle={t => [
        {etiqueta: 'Tarea', valor: t.title},
        {etiqueta: 'Tipo', valor: TIPO_TAREA[t.type] || t.type},
        {etiqueta: 'Estado', valor: <Estado mapa={ESTADO_TAREA} valor={t.status} />},
        {etiqueta: 'Prioridad', valor: t.priority ? <Badge label={PRIORIDAD[t.priority] || t.priority} /> : null},
        {etiqueta: 'Cliente', valor: t.client},
        {etiqueta: 'Orden Odoo', valor: t.odooRef},
        {etiqueta: 'Encargado', valor: t.managerName},
        {etiqueta: 'Vence', valor: (t.dueDate || '').slice(0, 10)},
        {etiqueta: 'Creada', valor: (t.createdAt || '').slice(0, 16).replace('T', ' ')},
      ]}
      kpis={d => [
        {etiqueta: 'Pendientes',  valor: d.filter(t => t.status === 'pending').length},
        {etiqueta: 'En curso',    valor: d.filter(t => t.status === 'in_progress').length},
        {etiqueta: 'Vencidas',    valor: d.filter(t => t.dueDate && t.dueDate < hoy && !['completed','validated'].includes(t.status)).length},
        {etiqueta: 'Completadas', valor: d.filter(t => ['completed','validated'].includes(t.status)).length},
      ]}
      columnas={[
        {key: 'title', header: 'Tarea', width: proportional(2)},
        {key: 'type', header: 'Tipo', width: proportional(1),
         renderCell: r => <Text size="sm">{TIPO_TAREA[r.type] || r.type || '—'}</Text>},
        {key: 'status', header: 'Estado', width: pixel(160),
         renderCell: r => <Estado mapa={ESTADO_TAREA} valor={r.status} />},
        {key: 'priority', header: 'Prioridad', width: pixel(110),
         renderCell: r => r.priority ? <Badge label={PRIORIDAD[r.priority] || r.priority} /> : <Text color="secondary">—</Text>},
        {key: 'client', header: 'Cliente', width: proportional(1),
         renderCell: r => <Text size="sm">{r.client || '—'}</Text>},
      ]}
    />
  );
}

function PanelEstadoOrdenes() {
  const api = useApi('/api/sdv', j => j.solicitudes || []);
  return (
    <Pantalla
      titulo="Estado de Órdenes"
      subtitulo="Avance de las órdenes de venta hacia la entrega."
      api={api}
      vacio="Sin órdenes en este período."
      buscarEn={['folio', 'clienteNombre', 'salesperson']}
      filtros={[{label: 'Estado', campo: 'estado', opciones: Object.entries(ESTADO_SDV).map(([v, e]) => ({valor: v, etiqueta: e.label}))}]}
      kpis={d => [
        {etiqueta: 'Activas',     valor: d.filter(s => !['despachada','cancelada','rechazada'].includes(s.estado)).length},
        {etiqueta: 'En proceso',  valor: d.filter(s => s.estado === 'en_proceso').length},
        {etiqueta: 'Despachadas', valor: d.filter(s => s.estado === 'despachada').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'folio', header: 'Orden', width: pixel(140)},
        {key: 'clienteNombre', header: 'Cliente', width: proportional(2),
         renderCell: r => <Text size="sm">{r.clienteNombre || r.cliente || '—'}</Text>},
        {key: 'salesperson', header: 'Vendedora', width: proportional(1),
         renderCell: r => <Text size="sm">{r.salesperson || r.vendedor || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(180),
         renderCell: r => <Estado mapa={ESTADO_SDV} valor={r.estado} />},
        {key: 'fechaDeseada', header: 'Promesa', width: pixel(130),
         renderCell: r => <Text size="sm">{(r.fechaDeseada || '').slice(0, 10) || '—'}</Text>},
      ]}
    />
  );
}

function PanelSDV() {
  const api = useApi('/api/sdv', j => j.solicitudes || []);
  return (
    <Pantalla
      titulo="Bandeja SDV"
      subtitulo="Solicitudes de despacho recibidas de Ventas."
      api={api}
      vacio="Sin solicitudes en este período."
      buscarEn={['folio', 'clienteNombre']}
      filtros={[{label: 'Estado', campo: 'estado', opciones: Object.entries(ESTADO_SDV).map(([v, e]) => ({valor: v, etiqueta: e.label}))}]}
      kpis={d => [
        {etiqueta: 'Pendientes',  valor: d.filter(s => s.estado === 'pendiente_revision').length},
        {etiqueta: 'En proceso',  valor: d.filter(s => s.estado === 'en_proceso').length},
        {etiqueta: 'Despachadas', valor: d.filter(s => s.estado === 'despachada').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'folio', header: 'Folio', width: pixel(140)},
        {key: 'clienteNombre', header: 'Cliente', width: proportional(2),
         renderCell: r => <Text size="sm">{r.clienteNombre || r.cliente || '—'}</Text>},
        {key: 'tipoSolicitud', header: 'Tipo', width: proportional(1),
         renderCell: r => <Text size="sm">{r.tipoSolicitud || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(180),
         renderCell: r => <Estado mapa={ESTADO_SDV} valor={r.estado} />},
      ]}
    />
  );
}

function PanelReactivaciones() {
  const api = useApi('/api/sdv/reactivation', j => j.reactivaciones || []);
  return (
    <Pantalla
      titulo="Reactivaciones SDV"
      subtitulo="Solicitudes canceladas que piden volver a la operación."
      api={api}
      vacio="No hay reactivaciones pendientes."
      kpis={d => [
        {etiqueta: 'Pendientes', valor: d.filter(r => r.estado === 'pendiente').length},
        {etiqueta: 'Aprobadas',  valor: d.filter(r => r.estado === 'aprobada').length},
        {etiqueta: 'Total',      valor: d.length},
      ]}
      columnas={[
        {key: 'sdvFolio', header: 'Folio SDV', width: pixel(150),
         renderCell: r => <Text size="sm">{r.sdvFolio || r.folio || '—'}</Text>},
        {key: 'motivo', header: 'Motivo', width: proportional(2),
         renderCell: r => <Text size="sm">{r.motivo || r.razon || '—'}</Text>},
        {key: 'solicitadoPor', header: 'Solicitado por', width: proportional(1),
         renderCell: r => <Text size="sm">{r.solicitadoPor || r.creadoNombre || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(150),
         renderCell: r => <Estado mapa={{pendiente:{label:'Pendiente',dot:'warning'}, aprobada:{label:'Aprobada',dot:'success'}, rechazada:{label:'Rechazada',dot:'error'}}} valor={r.estado} />},
      ]}
    />
  );
}

function PanelConduces() {
  const api = useApi('/api/despacho-obsoleto', j => j.despachos || []);
  return (
    <Pantalla
      titulo="Conduces Outlet"
      subtitulo="Conduces de salida de mercancía en Obsoleto y Nave 2."
      acciones={<Button label="+ Nuevo conduce" variant="primary" />}
      api={api}
      vacio="No hay conduces registrados."
      kpis={d => [
        {etiqueta: 'Borradores', valor: d.filter(c => c.estado === 'borrador').length},
        {etiqueta: 'Entregados', valor: d.filter(c => c.estado === 'entregado').length},
        {etiqueta: 'Anulados',   valor: d.filter(c => c.estado === 'anulado').length},
        {etiqueta: 'Total',      valor: d.length},
      ]}
      columnas={[
        {key: 'folio', header: 'Conduce', width: pixel(130)},
        {key: 'receptorNombre', header: 'Recibe', width: proportional(2),
         renderCell: r => <Text size="sm">{r.receptorNombre || r.receptor || '—'}</Text>},
        {key: 'empresa', header: 'Empresa', width: proportional(1),
         renderCell: r => <Text size="sm">{r.empresa || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(150),
         renderCell: r => <Estado mapa={{borrador:{label:'Borrador',dot:'neutral'}, entregado:{label:'Entregado',dot:'success'}, anulado:{label:'Anulado',dot:'error'}}} valor={r.estado} />},
      ]}
    />
  );
}

function PanelAverias() {
  const api = useApi('/api/averias', j => j.averias || []);
  return (
    <Pantalla
      titulo="Averías"
      subtitulo="Artículos dañados y su estado en taller."
      acciones={<Button label="+ Registrar avería" variant="primary" />}
      api={api}
      vacio="No hay averías registradas."
      buscarEn={['ref', 'name', 'comentario']}
      filtros={[{label: 'Estado', campo: 'status', opciones: Object.keys(ESTADO_AVERIA).map(v => ({valor: v, etiqueta: v}))}]}
      detalle={a => [
        {etiqueta: 'Artículo', valor: a.name},
        {etiqueta: 'Referencia', valor: a.ref},
        {etiqueta: 'Código de barras', valor: a.barcode},
        {etiqueta: 'Cantidad', valor: a.qty},
        {etiqueta: 'Estado', valor: <Estado mapa={ESTADO_AVERIA} valor={a.status} />},
        {etiqueta: 'Ubicación', valor: a.location},
        {etiqueta: 'Comentario', valor: a.comentario},
        {etiqueta: 'Registrada', valor: (a.createdAt || '').slice(0, 16).replace('T', ' ')},
      ]}
      kpis={d => [
        {etiqueta: 'Recibidos', valor: d.filter(a => a.status === 'Recibido').length},
        {etiqueta: 'En taller', valor: d.filter(a => a.status === 'En Taller').length},
        {etiqueta: 'Reparados', valor: d.filter(a => a.status === 'Reparado').length},
        {etiqueta: 'Total',     valor: d.length},
      ]}
      columnas={[
        {key: 'ref', header: 'Referencia', width: pixel(140)},
        {key: 'name', header: 'Artículo', width: proportional(2),
         renderCell: r => <Text size="sm">{r.name || '—'}</Text>},
        {key: 'qty', header: 'Cant.', width: pixel(80),
         renderCell: r => <Text size="sm">{r.qty ?? '—'}</Text>},
        {key: 'status', header: 'Estado', width: pixel(160),
         renderCell: r => <Estado mapa={ESTADO_AVERIA} valor={r.status} />},
        {key: 'comentario', header: 'Comentario', width: proportional(2),
         renderCell: r => <Text size="sm">{r.comentario || '—'}</Text>},
      ]}
    />
  );
}

function PanelReposicion() {
  const api = useApi('/api/reposicion', j => j.reposiciones || []);
  return (
    <Pantalla
      titulo="Reposición Showroom"
      subtitulo="Solicitudes de reposición de artículos al showroom."
      acciones={<Button label="+ Nueva solicitud" variant="primary" />}
      api={api}
      vacio="No hay solicitudes de reposición."
      kpis={d => [
        {etiqueta: 'Pendientes',  valor: d.filter(r => r.estado === 'pendiente_aprobacion').length},
        {etiqueta: 'Aprobadas',   valor: d.filter(r => r.estado === 'aprobada').length},
        {etiqueta: 'Completadas', valor: d.filter(r => r.estado === 'completada').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'ref', header: 'Referencia', width: pixel(140),
         renderCell: r => <Text size="sm">{r.ref || r.referencia || '—'}</Text>},
        {key: 'nombre', header: 'Artículo', width: proportional(2),
         renderCell: r => <Text size="sm">{r.nombre || '—'}</Text>},
        {key: 'cantidad', header: 'Cant.', width: pixel(80),
         renderCell: r => <Text size="sm">{r.cantidad ?? '—'}</Text>},
        {key: 'urgencia', header: 'Urgencia', width: pixel(110),
         renderCell: r => r.urgencia ? <Badge label={r.urgencia} /> : <Text color="secondary">—</Text>},
        {key: 'estado', header: 'Estado', width: pixel(180),
         renderCell: r => <Estado mapa={{borrador:{label:'Borrador',dot:'neutral'}, pendiente_aprobacion:{label:'Pendiente',dot:'warning'}, aprobada:{label:'Aprobada',dot:'accent'}, en_proceso:{label:'En proceso',dot:'accent'}, completada:{label:'Completada',dot:'success'}, rechazada:{label:'Rechazada',dot:'error'}}} valor={r.estado} />},
      ]}
    />
  );
}

function PanelSolicitudesShowroom() {
  const api = useApi('/api/solicitudes-showroom', j => j.solicitudes || []);
  return (
    <Pantalla
      titulo="Solicitudes Showroom"
      subtitulo="Artículos pedidos para reponer en el showroom."
      api={api}
      vacio="Sin solicitudes activas."
      kpis={d => [
        {etiqueta: 'Activas',     valor: d.filter(s => s.status === 'activo').length},
        {etiqueta: 'Completadas', valor: d.filter(s => s.status === 'completado').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'name', header: 'Artículo', width: proportional(2),
         renderCell: r => <Text size="sm">{r.name || r.nombre || '—'}</Text>},
        {key: 'barcode', header: 'Cód. barras', width: pixel(150),
         renderCell: r => <Text size="sm">{r.barcode || '—'}</Text>},
        {key: 'solicitadoPor', header: 'Solicitado por', width: proportional(1),
         renderCell: r => <Text size="sm">{r.solicitadoPor || r.usuario || '—'}</Text>},
        {key: 'status', header: 'Estado', width: pixel(150),
         renderCell: r => <Estado mapa={{activo:{label:'Activa',dot:'accent'}, completado:{label:'Completada',dot:'success'}, cancelado:{label:'Cancelada',dot:'neutral'}}} valor={r.status} />},
      ]}
    />
  );
}

function PanelFlota() {
  const api = useApi('/api/wwp/vehicles', j => j.vehicles || []);
  return (
    <Pantalla
      titulo="Inspección de vehículo"
      subtitulo="Flota registrada y su configuración de inspección diaria."
      acciones={<Button label="Nueva inspección" variant="primary" />}
      api={api}
      vacio="No hay vehículos registrados."
      buscarEn={['name', 'placa']}
      kpis={d => [
        {etiqueta: 'Vehículos', valor: d.length},
        {etiqueta: 'Medidor detallado', valor: d.filter(v => v.fuelType === 'detallado').length},
        {etiqueta: 'Medidor estándar',  valor: d.filter(v => v.fuelType !== 'detallado').length},
      ]}
      columnas={[
        {key: 'name', header: 'Vehículo', width: proportional(2)},
        {key: 'placa', header: 'Placa', width: pixel(140),
         renderCell: r => <Text size="sm">{r.placa || '—'}</Text>},
        {key: 'fuelType', header: 'Medidor', width: pixel(160),
         renderCell: r => <Badge label={r.fuelType === 'detallado' ? 'Detallado' : 'Estándar'} />},
      ]}
    />
  );
}

function PanelFormacion() {
  const api = useApi('/api/wwp/training/courses', j => j.courses || []);
  return (
    <Pantalla
      titulo="Formación"
      subtitulo="Cursos y certificaciones del equipo."
      acciones={<Button label="+ Nuevo curso" variant="primary" />}
      api={api}
      vacio="No hay cursos publicados."
      buscarEn={['title', 'id']}
      kpis={d => [
        {etiqueta: 'Cursos',    valor: d.length},
        {etiqueta: 'Activos',   valor: d.filter(c => c.active !== false).length},
        {etiqueta: 'Con gate',  valor: d.filter(c => c.enforceGate).length},
      ]}
      columnas={[
        {key: 'title', header: 'Curso', width: proportional(2),
         renderCell: r => <Text size="sm">{r.title || r.nombre || r.id || '—'}</Text>},
        {key: 'passingScore', header: 'Nota mínima', width: pixel(130),
         renderCell: r => <Text size="sm">{r.passingScore != null ? r.passingScore + '%' : '—'}</Text>},
        {key: 'validityDays', header: 'Vigencia', width: pixel(120),
         renderCell: r => <Text size="sm">{r.validityDays ? r.validityDays + ' días' : '—'}</Text>},
        {key: 'enforceGate', header: 'Bloquea tareas', width: pixel(150),
         renderCell: r => r.enforceGate ? <Badge label="Sí" /> : <Text color="secondary">No</Text>},
        {key: 'active', header: 'Estado', width: pixel(140),
         renderCell: r => <Estado mapa={{true:{label:'Activo',dot:'success'}, false:{label:'Inactivo',dot:'neutral'}}} valor={String(r.active !== false)} />},
      ]}
    />
  );
}

function PanelEquipo() {
  const api = useApi('/api/wwp/metrics/equipo', j => j.usuarios || []);
  return (
    <Pantalla
      titulo="Panel del Equipo"
      subtitulo="Adopción y actividad por persona en los últimos 14 días."
      api={api}
      vacio="Sin datos de actividad en el período."
      buscarEn={['name']}
      filtros={[
        {label: 'Rol', campo: 'role', opciones: Object.entries(ROL).map(([v, l]) => ({valor: v, etiqueta: l}))},
        {label: 'Adopción', campo: 'semaforo', opciones: [{valor:'activo',etiqueta:'Activo'},{valor:'tibio',etiqueta:'Tibio'},{valor:'inactivo',etiqueta:'Inactivo'},{valor:'nunca',etiqueta:'Nunca entró'}]},
      ]}
      detalle={u => [
        {etiqueta: 'Persona', valor: u.name},
        {etiqueta: 'Rol', valor: <Badge label={ROL[u.role] || u.role} />},
        {etiqueta: 'Adopción', valor: u.semaforo},
        {etiqueta: 'Trayectoria', valor: u.trayectoria},
        {etiqueta: 'Nivel', valor: u.nivel},
        {etiqueta: 'Localidad', valor: u.categoria},
      ]}
      kpis={d => [
        {etiqueta: 'Activos',   valor: d.filter(u => u.semaforo === 'activo').length},
        {etiqueta: 'Tibios',    valor: d.filter(u => u.semaforo === 'tibio').length},
        {etiqueta: 'Inactivos', valor: d.filter(u => u.semaforo === 'inactivo').length},
        {etiqueta: 'Personas',  valor: d.length},
      ]}
      columnas={[
        {key: 'name', header: 'Persona', width: proportional(2)},
        {key: 'role', header: 'Rol', width: pixel(130),
         renderCell: r => <Badge label={ROL[r.role] || r.role || '—'} />},
        {key: 'semaforo', header: 'Adopción', width: pixel(160),
         renderCell: r => <Estado mapa={{activo:{label:'Activo',dot:'success'}, tibio:{label:'Tibio',dot:'warning'}, inactivo:{label:'Inactivo',dot:'error'}, nunca:{label:'Nunca entró',dot:'neutral'}}} valor={r.semaforo} />},
        {key: 'nivel', header: 'Nivel', width: pixel(100),
         renderCell: r => <Text size="sm">{r.nivel ?? '—'}</Text>},
      ]}
    />
  );
}

function PanelPoliticas() {
  const api = useApi('/api/politicas', j => Array.isArray(j) ? j : (j.politicas || []));
  return (
    <Pantalla
      titulo="Reglas de Cumplimiento"
      subtitulo="Políticas medidas sobre la operación del equipo."
      acciones={<Button label="+ Nueva política" variant="primary" />}
      api={api}
      vacio="No hay políticas definidas."
      kpis={d => [
        {etiqueta: 'Políticas', valor: d.length},
        {etiqueta: 'Activas',   valor: d.filter(p => p.activa !== false).length},
        {etiqueta: 'Pausadas',  valor: d.filter(p => p.activa === false).length},
      ]}
      columnas={[
        {key: 'nombre', header: 'Política', width: proportional(2)},
        {key: 'tipo', header: 'Tipo', width: proportional(1),
         renderCell: r => <Text size="sm">{({lunch_duration:'Duración de almuerzo', arrival_time:'Hora de llegada', task_completion:'Completitud de tareas', vehicle_inspection:'Inspección vehicular'})[r.tipo] || r.tipo || '—'}</Text>},
        {key: 'descripcion', header: 'Descripción', width: proportional(2),
         renderCell: r => <Text size="sm">{r.descripcion || '—'}</Text>},
        {key: 'activa', header: 'Estado', width: pixel(140),
         renderCell: r => <Estado mapa={{true:{label:'Activa',dot:'success'}, false:{label:'Pausada',dot:'neutral'}}} valor={String(r.activa !== false)} />},
      ]}
    />
  );
}

function PanelUsuarios() {
  const api = useApi('/api/wwp/auth/users', j => Array.isArray(j) ? j : (j.users || []));
  return (
    <Pantalla
      titulo="Usuarios y ajustes"
      subtitulo="Cuentas del sistema, roles y accesos."
      acciones={<Button label="+ Nuevo usuario" variant="primary" />}
      api={api}
      vacio="No hay usuarios."
      buscarEn={['name', 'email']}
      filtros={[{label: 'Rol', campo: 'role', opciones: Object.entries(ROL).map(([v, l]) => ({valor: v, etiqueta: l}))}]}
      detalle={u => [
        {etiqueta: 'Nombre', valor: u.name},
        {etiqueta: 'Correo', valor: u.email},
        {etiqueta: 'Rol', valor: <Badge label={ROL[u.role] || u.role} />},
        {etiqueta: 'Estado', valor: <Estado mapa={{true:{label:'Activo',dot:'success'}, false:{label:'Inactivo',dot:'neutral'}}} valor={String(u.active !== false)} />},
        {etiqueta: 'ID Odoo', valor: u.odooId},
        {etiqueta: 'Último acceso', valor: (u.lastLogin || '').slice(0, 16).replace('T', ' ')},
        {etiqueta: 'Categoría', valor: u.categoria},
      ]}
      kpis={d => [
        {etiqueta: 'Total',      valor: d.length},
        {etiqueta: 'Admins',     valor: d.filter(u => u.role === 'admin').length},
        {etiqueta: 'Encargados', valor: d.filter(u => u.role === 'manager').length},
        {etiqueta: 'Auxiliares', valor: d.filter(u => u.role === 'assistant').length},
      ]}
      columnas={[
        {key: 'name', header: 'Nombre', width: proportional(2)},
        {key: 'email', header: 'Correo', width: proportional(2),
         renderCell: r => <Text size="sm">{r.email || '—'}</Text>},
        {key: 'role', header: 'Rol', width: pixel(130),
         renderCell: r => <Badge label={ROL[r.role] || r.role || '—'} />},
        {key: 'active', header: 'Estado', width: pixel(140),
         renderCell: r => <Estado mapa={{true:{label:'Activo',dot:'success'}, false:{label:'Inactivo',dot:'neutral'}}} valor={String(r.active !== false)} />},
      ]}
    />
  );
}

function PanelEvidencias() {
  const api = useApi('/api/wwp/photo-archive', j => Array.isArray(j) ? j : (j.items || j.fotos || []));
  return (
    <Pantalla
      titulo="Evidencias"
      subtitulo="Archivo fotográfico de la operación, por orden y tarea."
      api={api}
      vacio="No hay evidencias registradas."
      kpis={d => [{etiqueta: 'Registros', valor: d.length}]}
      columnas={[
        {key: 'odooRef', header: 'Orden', width: pixel(150),
         renderCell: r => <Text size="sm">{r.odooRef || r.ref || '—'}</Text>},
        {key: 'title', header: 'Tarea', width: proportional(2),
         renderCell: r => <Text size="sm">{r.title || '—'}</Text>},
        {key: 'count', header: 'Fotos', width: pixel(100),
         renderCell: r => <Text size="sm">{r.count ?? (r.fotos ? r.fotos.length : '—')}</Text>},
      ]}
    />
  );
}

// ── Pantallas embebidas (implementación actual dentro del shell nuevo) ──────
const PanelSdvPortal   = () => <Embebida titulo="Solicitud de Despacho" subtitulo="Formulario de Ventas con búsqueda en Odoo." src="/sdv-portal" />;
const PanelBuscador    = () => <Embebida titulo="Buscador" subtitulo="Orden, transferencia o artículo en Odoo." src="/buscar" />;
const PanelInventario  = () => <Embebida titulo="Inventario" subtitulo="Salud de inventario: fiabilidad, tránsitos y cuadre." src="/inventario" />;
const PanelSinComp     = () => <Embebida titulo="Despachos sin Comprobante" subtitulo="Transferencias sin evidencia documental." src="/sin-adjuntos" />;
const PanelDevCdp      = () => <Embebida titulo="Devoluciones a CDP" subtitulo="Devoluciones de tiendas recibidas en el almacén CDP." src="/dev-cdp.html" />;
const PanelMapa        = () => <Embebida titulo="Mapa del Almacén" subtitulo="Vista 3D de ubicaciones y racks." src="/almacen-mapa.html" alto="calc(100dvh - 170px)" />;
const PanelEmpaque     = () => <Embebida titulo="Materiales de Empaque" subtitulo="Catálogo y reglas por familia de artículos." src="/empaque.html" />;

// ════════ Navegación: los 5 dominios del plan UX (doc 10) ════════════════
const DOMINIOS = [
  {titulo: 'Operación del equipo', items: [
    {label: 'Tareas', icon: ClipboardDocumentListIcon, ruta: '/v2/tareas', panel: PanelTareas},
    {label: 'Inspección de vehículo', icon: WrenchScrewdriverIcon, ruta: '/v2/inspeccion', panel: PanelFlota},
    {label: 'Formación', icon: AcademicCapIcon, ruta: '/v2/formacion', panel: PanelFormacion},
  ]},
  {titulo: 'Ventas → Despacho', items: [
    {label: 'Estado de Órdenes', icon: ClipboardDocumentListIcon, ruta: '/v2/estado-ordenes', panel: PanelEstadoOrdenes},
    {label: 'Solicitud de Despacho', icon: TruckIcon, ruta: '/v2/sdv-portal', panel: PanelSdvPortal},
    {label: 'Bandeja SDV', icon: InboxIcon, ruta: '/v2/sdv-bandeja', panel: PanelSDV},
    {label: 'Reactivaciones SDV', icon: ArrowPathIcon, ruta: '/v2/sdv-reactivations', panel: PanelReactivaciones},
    {label: 'Despachos sin Comprobante', icon: PaperClipIcon, ruta: '/v2/sin-adjuntos', panel: PanelSinComp},
    {label: 'Conduces Outlet', icon: ArchiveBoxIcon, ruta: '/v2/conduces', panel: PanelConduces},
  ]},
  {titulo: 'Almacén', items: [
    {label: 'Buscador', icon: MagnifyingGlassIcon, ruta: '/v2/buscar', panel: PanelBuscador},
    {label: 'Inventario', icon: CubeIcon, ruta: '/v2/inventario', panel: PanelInventario},
    {label: 'Averías', icon: ExclamationTriangleIcon, ruta: '/v2/averias', panel: PanelAverias},
    {label: 'Devoluciones a CDP', icon: ArrowsRightLeftIcon, ruta: '/v2/dev-cdp', panel: PanelDevCdp},
    {label: 'Reposición Showroom', icon: BuildingStorefrontIcon, ruta: '/v2/reposicion', panel: PanelReposicion},
    {label: 'Solicitudes Showroom', icon: BuildingStorefrontIcon, ruta: '/v2/solicitudes-showroom', panel: PanelSolicitudesShowroom},
    {label: 'Mapa del Almacén', icon: MapIcon, ruta: '/v2/almacen-mapa', panel: PanelMapa},
  ]},
  {titulo: 'Supervisión', items: [
    {label: 'Panel del Equipo', icon: ChartBarIcon, ruta: '/v2/supervision', panel: PanelEquipo},
    {label: 'Evidencias', icon: PhotoIcon, ruta: '/v2/evidencias', panel: PanelEvidencias},
  ]},
  {titulo: 'Configuración', items: [
    {label: 'Usuarios y ajustes', icon: Cog6ToothIcon, ruta: '/v2/configuracion', panel: PanelUsuarios},
    {label: 'Reglas de Cumplimiento', icon: ShieldCheckIcon, ruta: '/v2/reglas', panel: PanelPoliticas},
    {label: 'Materiales de Empaque', icon: CubeIcon, ruta: '/v2/empaque', panel: PanelEmpaque},
  ]},
];
const TODOS = DOMINIOS.flatMap(d => d.items);

/** Routing con paths reales (pushState/popstate), igual que el shell actual (v227). */
function useRuta() {
  const [ruta, setRuta] = useState(() => location.pathname);
  useEffect(() => {
    const onPop = () => setRuta(location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const ir = useCallback(r => {
    if (r === location.pathname) return;
    history.pushState({}, '', r);
    setRuta(r);
  }, []);
  return [ruta, ir];
}

class LimiteDeError extends Component {
  constructor(p) { super(p); this.state = {fallo: null}; }
  static getDerivedStateFromError(e) { return {fallo: e}; }
  componentDidUpdate(prev) { if (prev.clave !== this.props.clave && this.state.fallo) this.setState({fallo: null}); }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <Banner
        status="error"
        title="Esta sección no se pudo mostrar"
        description={String((this.state.fallo && this.state.fallo.message) || this.state.fallo)}
        endContent={<Button label="Recargar" variant="secondary" clickAction={() => location.reload()} />}
      />
    );
  }
}

export default function ShellOpsAT() {
  const [ruta, ir] = useRuta();
  const actual = TODOS.find(i => i.ruta === ruta) || TODOS[0];
  const Panel = actual.panel;

  // <Theme> aplica la identidad de OpsAT (tema-opsat.js). mode="system" respeta
  // la preferencia del sistema, igual que el modo noche del shell actual.
  return (
    <Theme theme={temaOpsAT} mode="system">
    <AppShell
      contentPadding={0}
      sideNav={
        <SideNav
          collapsible
          resizable={{defaultWidth: 264, minWidth: 220, maxWidth: 380}}
          header={
            <SideNavHeading heading="Ops AT"
              icon={<NavIcon icon={<Icon icon={CubeIcon} size="sm" />} />}
              headingHref="/v2" />
          }
          footer={
            <SideNavSection title="Cuenta" isHeaderHidden>
              <SideNavItem label="Volver al shell actual" icon={UserCircleIcon}
                           href="/historial.html" />
            </SideNavSection>
          }>
          {DOMINIOS.map(d => (
            <SideNavSection key={d.titulo} title={d.titulo}>
              {d.items.map(i => (
                <SideNavItem
                  key={i.ruta}
                  label={i.label}
                  icon={i.icon}
                  href={i.ruta}
                  isSelected={i.ruta === actual.ruta}
                  onClick={ev => { ev.preventDefault(); ir(i.ruta); }}
                />
              ))}
            </SideNavSection>
          ))}
        </SideNav>
      }>
      {/* Cada pantalla trae su propio Layout (header / contenido / inspector),
          según la guía frame-first. El shell no lo envuelve: anidarlos rompe
          el alto y vuelve a meter padding donde debe ir edge-to-edge. */}
      <LimiteDeError clave={actual.ruta}>
        <Panel />
      </LimiteDeError>
    </AppShell>
    </Theme>
  );
}

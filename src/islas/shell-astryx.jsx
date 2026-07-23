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
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
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
import {
  ClipboardDocumentListIcon, TruckIcon, InboxIcon, ArrowPathIcon,
  PaperClipIcon, ArchiveBoxIcon, MagnifyingGlassIcon, CubeIcon,
  ExclamationTriangleIcon, ArrowsRightLeftIcon, BuildingStorefrontIcon,
  MapIcon, ChartBarIcon, PhotoIcon, Cog6ToothIcon, UserCircleIcon,
  AcademicCapIcon, WrenchScrewdriverIcon,
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

function Kpis({items, cargando}) {
  return (
    <HStack gap={3} wrap>
      {items.map(k => (
        <Card key={k.etiqueta} padding={4} minWidth={150}>
          <VStack gap={1}>
            <Text color="secondary" size="sm">{k.etiqueta}</Text>
            <Heading level={3}>{cargando ? '—' : String(k.valor)}</Heading>
          </VStack>
        </Card>
      ))}
    </HStack>
  );
}

/** Encabezado + estados de carga/error/vacío + tabla. Evita repetir en cada pantalla. */
function Pantalla({titulo, subtitulo, acciones, kpis, api, columnas, vacio}) {
  const {cargando, error, datos, recargar} = api;
  return (
    <VStack gap={4}>
      <HStack hAlign="space-between" vAlign="center" wrap gap={2}>
        <VStack gap={1}>
          <Heading level={2}>{titulo}</Heading>
          {subtitulo && <Text color="secondary">{subtitulo}</Text>}
        </VStack>
        <HStack gap={2}>
          <Button label="Actualizar" variant="secondary" clickAction={recargar} />
          {acciones}
        </HStack>
      </HStack>

      {kpis && <Kpis items={kpis(datos)} cargando={cargando} />}

      {error && (
        <Banner
          status="error"
          title={'No se pudo cargar ' + titulo.toLowerCase()}
          description={error}
          endContent={<Button label="Reintentar" variant="secondary" clickAction={recargar} />}
        />
      )}

      {cargando && (
        <HStack gap={2} vAlign="center"><Spinner /><Text color="secondary">Cargando…</Text></HStack>
      )}

      {!cargando && !error && datos.length === 0 && (
        <Card padding={6}>
          <VStack gap={2} hAlign="center">
            <Text color="secondary">{vacio || 'No hay nada que mostrar.'}</Text>
          </VStack>
        </Card>
      )}

      {!cargando && !error && datos.length > 0 && (
        <Table data={datos} columns={columnas} idKey="id" density="balanced"
               dividers="rows" hasHover textOverflow="truncate" />
      )}
    </VStack>
  );
}

// ════════ Pantallas ════════
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

function PanelSDV() {
  const api = useApi('/api/sdv', j => j.solicitudes || []);
  return (
    <Pantalla
      titulo="Bandeja SDV"
      subtitulo="Solicitudes de despacho recibidas de Ventas."
      api={api}
      vacio="Sin solicitudes en este período."
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

function PanelAverias() {
  const api = useApi('/api/averias', j => j.averias || []);
  return (
    <Pantalla
      titulo="Averías"
      subtitulo="Artículos dañados y su estado en taller."
      acciones={<Button label="+ Registrar avería" variant="primary" />}
      api={api}
      vacio="No hay averías registradas."
      kpis={d => [
        {etiqueta: 'Recibidos',  valor: d.filter(a => a.status === 'Recibido').length},
        {etiqueta: 'En taller',  valor: d.filter(a => a.status === 'En Taller').length},
        {etiqueta: 'Reparados',  valor: d.filter(a => a.status === 'Reparado').length},
        {etiqueta: 'Total',      valor: d.length},
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

function PanelUsuarios() {
  const api = useApi('/api/wwp/auth/users', j => Array.isArray(j) ? j : (j.users || []));
  return (
    <Pantalla
      titulo="Usuarios y ajustes"
      subtitulo="Cuentas del sistema, roles y accesos."
      acciones={<Button label="+ Nuevo usuario" variant="primary" />}
      api={api}
      vacio="No hay usuarios."
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
         renderCell: r => (
           <HStack gap={2} vAlign="center">
             <StatusDot variant={r.active === false ? 'neutral' : 'success'}
                        label={r.active === false ? 'Inactivo' : 'Activo'} />
             <Text size="sm">{r.active === false ? 'Inactivo' : 'Activo'}</Text>
           </HStack>
         )},
      ]}
    />
  );
}

function PantallaPendiente({nombre}) {
  return (
    <VStack gap={3}>
      <Heading level={2}>{nombre}</Heading>
      <Banner
        status="info"
        title="Pantalla aún no migrada"
        description={'«' + nombre + '» todavía vive en el shell actual. Esta versión (/v2) se está migrando pantalla por pantalla.'}
        endContent={<Button label="Abrir en el shell actual" variant="secondary"
                            clickAction={() => { location.href = '/historial.html'; }} />}
      />
    </VStack>
  );
}

// ════════ Navegación y routing ════════
const DOMINIOS = [
  {titulo: 'Operación del equipo', items: [
    {label: 'Tareas', icon: ClipboardDocumentListIcon, ruta: '/v2/tareas', panel: PanelTareas},
    {label: 'Inspección de vehículo', icon: WrenchScrewdriverIcon, ruta: '/v2/inspeccion'},
    {label: 'Formación', icon: AcademicCapIcon, ruta: '/v2/formacion'},
  ]},
  {titulo: 'Ventas → Despacho', items: [
    {label: 'Estado de Órdenes', icon: ClipboardDocumentListIcon, ruta: '/v2/estado-ordenes'},
    {label: 'Solicitud de Despacho', icon: TruckIcon, ruta: '/v2/sdv-portal'},
    {label: 'Bandeja SDV', icon: InboxIcon, ruta: '/v2/sdv-bandeja', panel: PanelSDV},
    {label: 'Reactivaciones SDV', icon: ArrowPathIcon, ruta: '/v2/sdv-reactivations'},
    {label: 'Despachos sin Comprobante', icon: PaperClipIcon, ruta: '/v2/sin-adjuntos'},
    {label: 'Conduces Outlet', icon: ArchiveBoxIcon, ruta: '/v2/conduces'},
  ]},
  {titulo: 'Almacén', items: [
    {label: 'Buscador', icon: MagnifyingGlassIcon, ruta: '/v2/buscar'},
    {label: 'Inventario', icon: CubeIcon, ruta: '/v2/inventario'},
    {label: 'Averías', icon: ExclamationTriangleIcon, ruta: '/v2/averias', panel: PanelAverias},
    {label: 'Devoluciones a CDP', icon: ArrowsRightLeftIcon, ruta: '/v2/dev-cdp'},
    {label: 'Reposición Showroom', icon: BuildingStorefrontIcon, ruta: '/v2/reposicion'},
    {label: 'Mapa del Almacén', icon: MapIcon, ruta: '/v2/almacen-mapa'},
  ]},
  {titulo: 'Supervisión', items: [
    {label: 'Panel del Equipo', icon: ChartBarIcon, ruta: '/v2/supervision'},
    {label: 'Evidencias', icon: PhotoIcon, ruta: '/v2/evidencias'},
  ]},
  {titulo: 'Configuración', items: [
    {label: 'Usuarios y ajustes', icon: Cog6ToothIcon, ruta: '/v2/configuracion', panel: PanelUsuarios},
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
      <Layout
        height="fill"
        content={
          <LayoutContent padding={6}>
            <LimiteDeError clave={actual.ruta}>
              {Panel ? <Panel /> : <PantallaPendiente nombre={actual.label} />}
            </LimiteDeError>
          </LayoutContent>
        }
      />
    </AppShell>
    </Theme>
  );
}

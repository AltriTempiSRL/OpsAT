// Shell de OpsAT en Astryx, CONECTADO A DATOS REALES (/api/wwp/tasks).
// Convive en paralelo con el shell actual: se sirve en /v2 y no toca historial.html.
//
// REGLAS DE ASTRYX que respeta este archivo (bloque ASTRYX de CLAUDE.md):
//  - Sin <div> ni HTML crudo para layout: AppShell/Layout/Stack/Card.
//  - Sin style={{}} ni hex/px crudos: props de componente y tokens var(--*).
//  - Datos densos = filas (Table), NUNCA items de lista envueltos en Card.
//  - StatusDot para estado; Badge solo para conteos y estados enumerados.
//
// Compila con `npm run build:islas` → vendor/islas/shell-astryx.js

import {useEffect, useState, useCallback, Component} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
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

// ─── Navegación real de OpsAT, por dominio (plan UX doc 10) ────────────────
const DOMINIOS = [
  {titulo: 'Operación del equipo', items: [
    {label: 'Tareas', icon: ClipboardDocumentListIcon, ruta: '/tareas'},
    {label: 'Inspección de vehículo', icon: WrenchScrewdriverIcon, ruta: '/inspeccion'},
    {label: 'Formación', icon: AcademicCapIcon, ruta: '/formacion'},
  ]},
  {titulo: 'Ventas → Despacho', items: [
    {label: 'Estado de Órdenes', icon: ClipboardDocumentListIcon, ruta: '/estado-ordenes'},
    {label: 'Solicitud de Despacho', icon: TruckIcon, ruta: '/sdv-portal'},
    {label: 'Bandeja SDV', icon: InboxIcon, ruta: '/sdv-bandeja'},
    {label: 'Reactivaciones SDV', icon: ArrowPathIcon, ruta: '/sdv-reactivations'},
    {label: 'Despachos sin Comprobante', icon: PaperClipIcon, ruta: '/sin-adjuntos'},
    {label: 'Conduces Outlet', icon: ArchiveBoxIcon, ruta: '/despacho-obsoleto'},
  ]},
  {titulo: 'Almacén', items: [
    {label: 'Buscador', icon: MagnifyingGlassIcon, ruta: '/buscar'},
    {label: 'Inventario', icon: CubeIcon, ruta: '/inventario'},
    {label: 'Averías', icon: ExclamationTriangleIcon, ruta: '/averias'},
    {label: 'Devoluciones a CDP', icon: ArrowsRightLeftIcon, ruta: '/dev-cdp'},
    {label: 'Reposición Showroom', icon: BuildingStorefrontIcon, ruta: '/reposicion'},
    {label: 'Mapa del Almacén', icon: MapIcon, ruta: '/almacen-mapa'},
  ]},
  {titulo: 'Supervisión', items: [
    {label: 'Panel del Equipo', icon: ChartBarIcon, ruta: '/supervision'},
    {label: 'Evidencias', icon: PhotoIcon, ruta: '/supervision/evidencias'},
  ]},
  {titulo: 'Configuración', items: [
    {label: 'Usuarios y ajustes', icon: Cog6ToothIcon, ruta: '/configuracion'},
  ]},
];

// ─── Vocabulario compartido con el shell actual (core.js STATUS_LABELS) ────
// Variantes válidas de StatusDot: success | warning | error | accent | neutral
const ESTADO = {
  pending:     {label: 'Pendiente',  dot: 'neutral'},
  assigned:    {label: 'Asignada',   dot: 'accent'},
  in_progress: {label: 'En curso',   dot: 'warning'},
  completed:   {label: 'Completada', dot: 'success'},
  validated:   {label: 'Validada',   dot: 'success'},
  cancelled:   {label: 'Cancelada',  dot: 'neutral'},
};
const TIPO = {
  packaging: 'Empaque', dispatch_order: 'Orden de Despacho',
  item_pickup: 'Recogida de Artículos', truck_loading: 'Carga en Camión',
  warehouse_move: 'Movimiento de Almacén', staffing: 'Solicitud de Personal',
  general: 'General', free: 'Tarea Libre',
};
const PRIORIDAD = {high: 'Alta', medium: 'Media', low: 'Baja'};

// Bearer desde la sesión existente — mismo patrón que core-isla.js
function authHeaders() {
  try {
    const a = JSON.parse(sessionStorage.getItem('wwp_auth') || localStorage.getItem('wwp_auth') || '{}');
    return a.accessToken ? {Authorization: 'Bearer ' + a.accessToken} : {};
  } catch { return {}; }
}

function useTareas() {
  const [estado, setEstado] = useState({cargando: true, error: null, tareas: []});
  const cargar = useCallback(async () => {
    setEstado(e => ({...e, cargando: true, error: null}));
    try {
      const r = await fetch('/api/wwp/tasks?all=1', {headers: authHeaders()});
      if (r.status === 401) throw new Error('Sesión expirada — inicia sesión de nuevo.');
      if (!r.ok) throw new Error('El servidor respondió ' + r.status + '.');
      const j = await r.json();
      setEstado({cargando: false, error: null, tareas: Array.isArray(j) ? j : (j.tasks || [])});
    } catch (e) {
      setEstado({cargando: false, error: e.message, tareas: []});
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return {...estado, recargar: cargar};
}

function PanelTareas() {
  const {cargando, error, tareas, recargar} = useTareas();

  const hoy = new Date().toISOString().slice(0, 10);
  const kpis = [
    {etiqueta: 'Pendientes',  valor: tareas.filter(t => t.status === 'pending').length},
    {etiqueta: 'En curso',    valor: tareas.filter(t => t.status === 'in_progress').length},
    {etiqueta: 'Vencidas',    valor: tareas.filter(t => t.dueDate && t.dueDate < hoy && t.status !== 'completed' && t.status !== 'validated').length},
    {etiqueta: 'Completadas', valor: tareas.filter(t => t.status === 'completed' || t.status === 'validated').length},
  ];

  const columnas = [
    {key: 'title', header: 'Tarea', width: proportional(2)},
    {key: 'type', header: 'Tipo', width: proportional(1),
     renderCell: row => <Text size="sm">{TIPO[row.type] || row.type || '—'}</Text>},
    {key: 'status', header: 'Estado', width: pixel(150),
     renderCell: row => {
       const e = ESTADO[row.status] || {label: row.status || 'Desconocido', dot: 'neutral'};
       // El label de StatusDot es solo accesible (aria-label): el texto visible
       // se acompaña aparte, si no la columna queda como un punto sin significado.
       return (
         <HStack gap={2} vAlign="center">
           <StatusDot variant={e.dot} label={e.label} />
           <Text size="sm">{e.label}</Text>
         </HStack>
       );
     }},
    {key: 'priority', header: 'Prioridad', width: pixel(120),
     renderCell: row => row.priority
       ? <Badge label={PRIORIDAD[row.priority] || row.priority} />
       : <Text color="secondary">—</Text>},
    {key: 'client', header: 'Cliente', width: proportional(1),
     renderCell: row => <Text size="sm">{row.client || '—'}</Text>},
  ];

  return (
    <VStack gap={4}>
      <HStack hAlign="space-between" vAlign="center" wrap gap={2}>
        <VStack gap={1}>
          <Heading level={2}>Tareas</Heading>
          <Text color="secondary">Datos en vivo desde la API de OpsAT.</Text>
        </VStack>
        <HStack gap={2}>
          <Button label="Actualizar" variant="secondary" clickAction={recargar} />
          <Button label="+ Nueva Tarea" variant="primary" />
        </HStack>
      </HStack>

      <HStack gap={3} wrap>
        {kpis.map(k => (
          <Card key={k.etiqueta} padding={4} minWidth={150}>
            <VStack gap={1}>
              <Text color="secondary" size="sm">{k.etiqueta}</Text>
              <Heading level={3}>{cargando ? '—' : String(k.valor)}</Heading>
            </VStack>
          </Card>
        ))}
      </HStack>

      {/* Banner exige `status` (no `variant`); omitir una prop obligatoria
          revienta el árbol de React — de ahí el ErrorBoundary de abajo. */}
      {error && (
        <Banner
          status="error"
          title="No se pudieron cargar las tareas"
          description={error}
          endContent={<Button label="Reintentar" variant="secondary" clickAction={recargar} />}
        />
      )}

      {cargando && (
        <HStack gap={2} vAlign="center"><Spinner /><Text color="secondary">Cargando tareas…</Text></HStack>
      )}

      {!cargando && !error && tareas.length === 0 && (
        <Card padding={6}>
          <VStack gap={2} hAlign="center">
            <Text color="secondary">No hay tareas que mostrar.</Text>
            <Button label="+ Nueva Tarea" variant="secondary" />
          </VStack>
        </Card>
      )}

      {/* Datos densos = filas a borde completo, sin envolver en Card */}
      {!cargando && !error && tareas.length > 0 && (
        <Table
          data={tareas}
          columns={columnas}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
          textOverflow="truncate"
        />
      )}
    </VStack>
  );
}

// Una prop obligatoria olvidada tumba TODO el árbol de React y deja la pantalla
// en blanco. En una app de producción eso no es aceptable: el boundary acota el
// daño al panel y deja al usuario una salida.
class LimiteDeError extends Component {
  constructor(p) { super(p); this.state = {fallo: null}; }
  static getDerivedStateFromError(e) { return {fallo: e}; }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <Banner
        status="error"
        title="Esta sección no se pudo mostrar"
        description={String(this.state.fallo && this.state.fallo.message || this.state.fallo)}
        endContent={<Button label="Recargar" variant="secondary" clickAction={() => location.reload()} />}
      />
    );
  }
}

export default function ShellOpsAT() {
  return (
    <AppShell
      contentPadding={0}
      sideNav={
        <SideNav
          collapsible
          resizable={{defaultWidth: 264, minWidth: 220, maxWidth: 380}}
          header={
            <SideNavHeading
              heading="Ops AT"
              icon={<NavIcon icon={<Icon icon={CubeIcon} size="sm" />} />}
              headingHref="/v2"
            />
          }
          footer={
            <SideNavSection title="Cuenta" isHeaderHidden>
              <SideNavItem label="Mi cuenta" icon={UserCircleIcon} href="#" />
            </SideNavSection>
          }>
          {DOMINIOS.map(d => (
            <SideNavSection key={d.titulo} title={d.titulo}>
              {d.items.map(i => (
                <SideNavItem key={i.label} label={i.label} icon={i.icon} href={i.ruta} />
              ))}
            </SideNavSection>
          ))}
        </SideNav>
      }>
      <Layout
        height="fill"
        content={
          <LayoutContent padding={6}>
            <LimiteDeError><PanelTareas /></LimiteDeError>
          </LayoutContent>
        }
      />
    </AppShell>
  );
}

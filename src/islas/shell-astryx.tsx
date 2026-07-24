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

// CSS del sistema, empaquetado por esbuild con sus capas de cascada.
// El orden de capas se declara PRIMERO (base.css) — regla de `docs migration`.
import './base.css';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './opsat.css';

import {useEffect, useState, useCallback, Component} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {opsatTheme} from './opsat';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Layout, LayoutContent, LayoutHeader, LayoutPanel} from '@astryxdesign/core/Layout';
import {ResizeHandle, useResizable} from '@astryxdesign/core/Resizable';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {SideNav, SideNavHeading, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {VStack, HStack, StackItem} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Table, proportional, pixel, type TableColumn} from '@astryxdesign/core/Table';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Timestamp} from '@astryxdesign/core/Timestamp';
import {Token} from '@astryxdesign/core/Token';
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


// ════════ Tipos ════════
/** Fila genérica de la API: las entidades de OpsAT no comparten forma. */
type Fila = Record<string, any>;

interface EstadoMeta { label?: string; dot: 'success' | 'warning' | 'error' | 'accent' | 'neutral' }
type MapaEstado = Record<string, EstadoMeta>;

interface Cifra { etiqueta: string; valor: number | string }

interface OpcionFiltro { valor: string; etiqueta: string }
interface DefFiltro { label: string; campo: string; opciones: OpcionFiltro[] }

interface CampoDetalle { etiqueta: string; valor: React.ReactNode }

interface EstadoApi {
  cargando: boolean;
  error: string | null;
  errorStatus: number | null;
  datos: Fila[];
  recargar: () => void;
}

interface PropsPantalla {
  titulo: string;
  subtitulo?: string;
  acciones?: React.ReactNode;
  kpis?: (d: Fila[]) => Cifra[];
  api: EstadoApi;
  columnas: TableColumn<Fila>[];
  vacio?: string;
  buscarEn?: string[];
  filtros?: DefFiltro[];
  detalle?: (fila: Fila) => CampoDetalle[];
}

interface ItemNav { label: string; icon: any; ruta: string; panel: React.ComponentType }
interface Dominio { titulo: string; items: ItemNav[] }
type SeleccionFila = string | number | Fila | null;
interface SesionOpsAT {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    role?: string;
    sectionPerms?: Record<string, boolean>;
  };
}
type EstadoSesion = 'comprobando' | 'activa' | 'inactiva';

// ════════ Vocabulario compartido con core.js (una sola fuente de verdad) ════
const ESTADO_TAREA: MapaEstado = {
  pending:     {label: 'Pendiente',  dot: 'neutral'},
  assigned:    {label: 'Asignada',   dot: 'accent'},
  in_progress: {label: 'En curso',   dot: 'warning'},
  completed:   {label: 'Completada', dot: 'success'},
  validated:   {label: 'Validada',   dot: 'success'},
  cancelled:   {label: 'Cancelada',  dot: 'neutral'},
};
const TIPO_TAREA: Record<string, string> = {
  packaging: 'Empaque', dispatch_order: 'Orden de Despacho',
  item_pickup: 'Recogida de Artículos', truck_loading: 'Carga en Camión',
  warehouse_move: 'Movimiento de Almacén', staffing: 'Solicitud de Personal',
  general: 'General', free: 'Tarea Libre',
};
const PRIORIDAD: Record<string, string> = {high: 'Alta', medium: 'Media', low: 'Baja'};
// Variante semántica: solo "Alta" (rojo) roba la atención; el resto se apaga.
const PRIO_VAR: Record<string, 'error' | 'warning' | 'neutral'> = {high: 'error', medium: 'warning', low: 'neutral'};
const ESTADO_SDV: MapaEstado = {
  pendiente_revision: {label: 'Pendiente revisión', dot: 'warning'},
  en_proceso:         {label: 'En proceso',         dot: 'accent'},
  despachada:         {label: 'Despachada',         dot: 'success'},
  rechazada:          {label: 'Rechazada',          dot: 'error'},
  cancelada:          {label: 'Cancelada',          dot: 'neutral'},
};
const ESTADO_AVERIA: MapaEstado = {
  Recibido:   {dot: 'accent'},  'En Taller': {dot: 'warning'},
  Reparado:   {dot: 'success'}, Descartado:  {dot: 'neutral'},
};
const ROL: Record<string, string> = {admin: 'Admin', manager: 'Encargado', assistant: 'Auxiliar', ventas: 'Ventas'};
// Rol es categoría que se escanea → Token con color estable por rol (no Badge gris).
const ROL_COLOR: Record<string, 'purple' | 'blue' | 'teal' | 'gray'> = {admin: 'purple', manager: 'blue', assistant: 'teal', ventas: 'gray'};

// ════════ Datos ════════
function leerSesion(): SesionOpsAT {
  try {
    const guardada = localStorage.getItem('wwp_auth') || sessionStorage.getItem('wwp_auth');
    if (!guardada) return {};
    const sesion = JSON.parse(guardada);
    return sesion && typeof sesion === 'object' ? sesion : {};
  } catch {
    return {};
  }
}

function tokenVigente(token?: string): boolean {
  if (!token) return false;
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return false;
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function guardarSesion(sesion: SesionOpsAT): boolean {
  try {
    const datos = JSON.stringify(sesion);
    if (localStorage.getItem('wwp_auth')) {
      localStorage.setItem('wwp_auth', datos);
      sessionStorage.removeItem('wwp_auth');
    } else {
      sessionStorage.setItem('wwp_auth', datos);
      localStorage.removeItem('wwp_auth');
    }
    return true;
  } catch {
    return false;
  }
}

let renovacionEnCurso: Promise<boolean> | null = null;

async function refrescarSesion(): Promise<boolean> {
  if (renovacionEnCurso) return renovacionEnCurso;
  const sesion = leerSesion();
  if (!sesion.refreshToken) return false;

  renovacionEnCurso = (async () => {
    try {
      const respuesta = await fetch('/api/wwp/auth/refresh', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({refreshToken: sesion.refreshToken}),
      });
      if (!respuesta.ok) return false;
      const datos = await respuesta.json() as {
        ok?: boolean;
        accessToken?: string;
        user?: unknown;
      };
      if (!datos.ok || !datos.accessToken) return false;
      return guardarSesion({
        ...sesion,
        accessToken: datos.accessToken,
        user: datos.user ?? sesion.user,
      });
    } catch {
      return false;
    }
  })();

  try {
    return await renovacionEnCurso;
  } finally {
    renovacionEnCurso = null;
  }
}

function useEstadoSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>(() => {
    const sesion = leerSesion();
    if (tokenVigente(sesion.accessToken)) return 'activa';
    return sesion.refreshToken ? 'comprobando' : 'inactiva';
  });

  useEffect(() => {
    if (estado !== 'comprobando') return;
    let montado = true;
    refrescarSesion().then(ok => {
      if (montado) setEstado(ok ? 'activa' : 'inactiva');
    });
    return () => {
      montado = false;
    };
  }, [estado]);

  return estado;
}

function authHeaders(): Record<string, string> {
  const sesion = leerSesion();
  return sesion.accessToken ? {Authorization: 'Bearer ' + sesion.accessToken} : {};
}

function irAlInicioDeSesion() {
  location.assign('/historial.html');
}

function abrirNuevaTarea() {
  // El wizard todavía vive en el shell operativo actual. El deep-link conserva
  // la misma sesión/origen y permite que el botón Astryx sea funcional mientras
  // ese flujo de escritura se migra con sus validaciones y RBAC completos.
  location.assign('/wwp/tasks?action=new-task');
}

function puedeCrearTarea(): boolean {
  const usuario = leerSesion().user;
  return usuario?.role === 'admin' ||
    usuario?.sectionPerms?.['wwp.crear_tarea'] === true;
}

/** Hook genérico de carga: expone {cargando, error, datos, recargar}. */
function useApi(url: string, extraer: (j: any) => Fila[]) {
  const [s, setS] = useState<{
    cargando: boolean;
    error: string | null;
    errorStatus: number | null;
    datos: Fila[];
  }>({cargando: true, error: null, errorStatus: null, datos: []});
  const cargar = useCallback(async () => {
    setS(v => ({...v, cargando: true, error: null, errorStatus: null}));
    try {
      const solicitar = () => fetch(url, {headers: authHeaders()});
      let r = await solicitar();
      if (r.status === 401 && await refrescarSesion()) {
        r = await solicitar();
      }
      if (!r.ok) {
        const mensaje = r.status === 401
          ? 'La sesión venció o no es válida.'
          : r.status === 403
            ? 'Tu rol no tiene acceso a esta información.'
            : 'El servidor respondió ' + r.status + '.';
        const fallo = new Error(mensaje) as Error & {status: number};
        fallo.status = r.status;
        throw fallo;
      }
      const j = await r.json();
      setS({cargando: false, error: null, errorStatus: null, datos: extraer(j) || []});
    } catch (e) {
      const fallo = e as Error & {status?: number};
      setS({
        cargando: false,
        error: fallo.message,
        errorStatus: fallo.status ?? null,
        datos: [],
      });
    }
  }, [url]);
  useEffect(() => { cargar(); }, [cargar]);
  return {...s, recargar: cargar};
}

// ════════ Piezas reutilizables ════════
function Estado({mapa, valor}: {mapa: MapaEstado; valor: string}) {
  const e = mapa[valor] || {label: valor || 'Desconocido', dot: 'neutral'};
  const label = e.label || valor;
  // El label de StatusDot es solo accesible: el texto visible va aparte.
  // El valor va en `body` (14px), no `sm`: es contenido primario de la fila.
  return (
    <HStack gap={2} vAlign="center">
      <StatusDot variant={e.dot} label={label} />
      <Text>{label}</Text>
    </HStack>
  );
}

/** Franja de cifras (KPIs) — su propia región, NO en el header. Cada cifra es un
 *  callout vertical: número grande (`display-3`, 29px) sobre etiqueta pequeña.
 *  El tamaño crea la jerarquía, no el peso (regla de `docs typography`:
 *  "data callouts" van con display types). Filas, no cards. */
function Cifras({
  items,
  cargando,
  esCompacta = false,
}: {
  items: Cifra[];
  cargando: boolean;
  esCompacta?: boolean;
}) {
  const tile = (k: Cifra) => (
    <VStack key={k.etiqueta} gap={0.5}>
      <Text type="display-3" hasTabularNumbers>{cargando ? '—' : String(k.valor)}</Text>
      <Text type="supporting">{k.etiqueta}</Text>
    </VStack>
  );

  // Móvil: 2 columnas. Escritorio: en línea con divisor vertical entre cifras.
  return esCompacta ? (
    <VStack gap={0} paddingInline={4} paddingBlock={3} width="100%">
      <Grid columns={2} gap={4} width="100%">
        {items.map(tile)}
      </Grid>
    </VStack>
  ) : (
    <HStack gap={6} paddingInline={4} paddingBlock={3} vAlign="center" wrap="wrap">
      {items.map((k, i) => (
        <HStack key={k.etiqueta} gap={6} vAlign="center">
          {i > 0 && <Divider orientation="vertical" />}
          {tile(k)}
        </HStack>
      ))}
    </HStack>
  );
}

function CamposDeDetalle({
  fila,
  detalle,
}: {
  fila: Fila;
  detalle: (fila: Fila) => CampoDetalle[];
}) {
  // label arriba: da ancho completo a valores largos (comentario, título) en el
  // inspector de 380px, sin estrangularlos. El valor va en `body`, no `sm`.
  return (
    <MetadataList label={{position: 'top'}}>
      {detalle(fila).map(campo => {
        const sinValor = campo.valor == null || campo.valor === '';
        return (
          <MetadataListItem key={campo.etiqueta} label={campo.etiqueta}>
            {typeof campo.valor === 'string' || typeof campo.valor === 'number'
              ? <Text>{sinValor ? '—' : String(campo.valor)}</Text>
              : (campo.valor || <Text color="secondary">—</Text>)}
          </MetadataListItem>
        );
      })}
    </MetadataList>
  );
}

/** Estructura de herramienta de trabajo, según `astryx docs layout`:
 *  frame primero (header / contenido edge-to-edge / inspector), filas densas y
 *  CERO cards. Seleccionar una fila abre el inspector lateral — el patrón
 *  maestro-detalle que la guía llama "la columna vertebral de las herramientas".
 *  `detalle(fila)` devuelve los campos a mostrar en el inspector. */
function Pantalla({titulo, subtitulo, acciones, kpis, api, columnas, vacio, buscarEn, filtros, detalle}: PropsPantalla) {
  const {cargando, error, errorStatus, datos, recargar} = api;
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<Record<string, string | null>>({});
  const [filaSel, setFilaSel] = useState<SeleccionFila>(null);
  const inspector = useResizable({defaultSize: 380, minSizePx: 320, maxSizePx: 520, autoSaveId: 'v2-inspector'});
  // Mantener el mismo umbral `lg` del AppShell: cuando la navegación pasa al
  // drawer, el header y los filtros también deben apilarse.
  const esCompacta = useMediaQuery('(max-width: 1023px)');
  // Con sidebar + inspector se necesitan 1280px para que la tabla no se asfixie.
  // Debajo de ese ancho, el detalle se abre como Dialog.
  const anchoSuficiente = useMediaQuery('(min-width: 1280px)');

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
  const accesoBloqueado = errorStatus === 401 || errorStatus === 403;
  const sel = filaSel == null
    ? null
    : visibles.find(f => (f.id ?? f) === filaSel) || null;

  const cols: TableColumn<Fila>[] = detalle
    ? [...columnas, {
        key: '__sel',
        header: '',
        width: pixel(44),
        renderCell: (r: Fila) => (
          <Button
            label="Ver detalle"
            isIconOnly
            icon={<Icon icon={ChevronRightIcon} size="sm" />}
            size="sm"
            variant="ghost"
            clickAction={() => setFilaSel(r.id ?? r)}
          />
        ),
      }]
    : columnas;

  return (
    <>
    <Layout
      height="fill"
      header={
        <LayoutHeader hasDivider>
          {/* El header NO lleva KPIs: título grande (nivel 1) + subtítulo apilados,
              y las acciones a la derecha. Los KPIs viven en su franja propia
              dentro del contenido (abajo) — así el header respira. */}
          {esCompacta ? (
            <VStack gap={3} width="100%">
              <VStack gap={0.5}>
                <Heading level={1}>{titulo}</Heading>
                {subtitulo && <Text type="supporting" maxLines={2}>{subtitulo}</Text>}
              </VStack>
              {!accesoBloqueado && (
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Button label="Actualizar" variant="ghost" clickAction={recargar} />
                  {acciones}
                </HStack>
              )}
            </VStack>
          ) : (
            <HStack gap={3} vAlign="center">
              <StackItem size="fill">
                <VStack gap={0.5}>
                  <Heading level={1}>{titulo}</Heading>
                  {subtitulo && <Text type="supporting" maxLines={1}>{subtitulo}</Text>}
                </VStack>
              </StackItem>
              {!accesoBloqueado && (
                <Button label="Actualizar" variant="ghost" clickAction={recargar} />
              )}
              {!accesoBloqueado && acciones}
            </HStack>
          )}
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={0}>
          <VStack gap={0}>
            {/* Franja de KPIs: primera región, edge-to-edge, con su propio aire.
                Sacada del header (plan 11 P1) para que las cifras tengan presencia. */}
            {kpis && !error && !cargando && datos.length > 0 && (
              <>
                <Cifras items={kpis(datos)} cargando={cargando} esCompacta={esCompacta} />
                <Divider />
              </>
            )}
            {(buscarEn || filtros) && !error && (
              esCompacta ? (
                <VStack gap={2} padding={3} width="100%">
                  {buscarEn && buscarEn.length > 0 && (
                    <TextInput
                      label="Buscar"
                      isLabelHidden
                      placeholder="Buscar…"
                      value={busqueda}
                      onChange={setBusqueda}
                      startIcon={MagnifyingGlassIcon}
                      size="sm"
                    />
                  )}
                  <HStack gap={1} wrap="wrap" width="100%">
                    {(filtros || []).map(f => (
                      <Selector
                        key={f.campo}
                        label={f.label}
                        isLabelHidden
                        placeholder={f.label}
                        hasClear
                        value={seleccion[f.campo] || null}
                        onChange={v => setSeleccion(x => ({...x, [f.campo]: v}))}
                        options={f.opciones.map(o => ({value: o.valor, label: o.etiqueta}))}
                        size="sm"
                      />
                    ))}
                  </HStack>
                  <HStack gap={2} hAlign="between" vAlign="center" width="100%">
                    <Text type="supporting">
                      {visibles.length === datos.length
                        ? `${datos.length} registro${datos.length === 1 ? '' : 's'}`
                        : `${visibles.length} de ${datos.length}`}
                    </Text>
                    {hayFiltro && (
                      <Button label="Limpiar" variant="ghost" size="sm" clickAction={limpiar} />
                    )}
                  </HStack>
                </VStack>
              ) : (
                <Toolbar
                  label={'Filtros de ' + titulo}
                  size="sm"
                  dividers={['bottom']}
                  startContent={
                    <>
                      {buscarEn && buscarEn.length > 0 && (
                        <TextInput label="Buscar" isLabelHidden placeholder="Buscar…"
                                   value={busqueda} onChange={setBusqueda}
                                   startIcon={MagnifyingGlassIcon} hasClear />
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
                    <Text type="supporting">
                      {visibles.length === datos.length
                        ? `${datos.length} registro${datos.length === 1 ? '' : 's'}`
                        : `${visibles.length} de ${datos.length}`}
                    </Text>
                  }
                />
              )
            )}

            {error && errorStatus === 401 && (
              <EmptyState
                title="Tu sesión terminó"
                description="Vuelve a iniciar sesión para cargar la información de Ops AT."
                actions={
                  <Button
                    label="Ir al inicio de sesión"
                    variant="primary"
                    clickAction={irAlInicioDeSesion}
                  />
                }
              />
            )}

            {error && errorStatus !== 401 && (
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
      end={anchoSuficiente && sel && detalle ? (
        <>
        <ResizeHandle
          direction="horizontal"
          isReversed
          hasDivider
          label="Redimensionar detalle"
          resizable={inspector.props}
        />
        <LayoutPanel
          resizable={inspector.props}
          isScrollable
          role="complementary"
          label="Detalle"
          padding={4}>
          <VStack gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={2}>Detalle</Heading>
              <Button label="Cerrar" isIconOnly icon={<Icon icon={XMarkIcon} size="sm" />} size="sm"
                      variant="ghost" clickAction={() => setFilaSel(null)} />
            </HStack>
            <CamposDeDetalle fila={sel} detalle={detalle} />
          </VStack>
        </LayoutPanel>
        </>
      ) : null}
    />
    {detalle && (
      <Dialog
        isOpen={!anchoSuficiente && sel != null}
        purpose="info"
        width={480}
        maxHeight="80vh"
        aria-label={'Detalle de ' + titulo}
        onOpenChange={abierto => {
          if (!abierto) setFilaSel(null);
        }}>
        <Layout
          header={
            <DialogHeader
              title={'Detalle · ' + titulo}
              hasDivider
              onOpenChange={abierto => {
                if (!abierto) setFilaSel(null);
              }}
            />
          }
          content={
            <LayoutContent padding={4}>
              {sel && <CamposDeDetalle fila={sel} detalle={detalle} />}
            </LayoutContent>
          }
        />
      </Dialog>
    )}
    </>
  );
}

// ════════ Pantalla embebida (patrón strangler-fig) ═══════════════════════
// Las pantallas con flujos complejos (formularios con Odoo, mapa 3D, escaneo)
// se sirven DENTRO del shell Astryx embebiendo la implementación actual. La app
// queda completa y usable hoy; cada una se reconstruye nativa cuando toque.
function Embebida({titulo, subtitulo, src}: {titulo: string; subtitulo?: string; src: string}) {
  return (
    <Layout
      height="fill"
      header={
        <LayoutHeader hasDivider>
          <VStack gap={1}>
            <Heading level={3}>{titulo}</Heading>
            {subtitulo && <Text type="supporting">{subtitulo}</Text>}
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={4} isScrollable={false}>
          <VStack gap={3} height="100%">
            {/* Honestidad al revisar: se ve distinto porque AÚN no es nativa. */}
            <Banner
              status="info"
              title="Interfaz anterior"
              description="Esta pantalla funciona, pero todavía usa el diseño previo. Falta reconstruirla con el sistema nuevo."
              isDismissable
            />
            <StackItem size="fill">
              <Card padding={0} width="100%" height="100%">
                <iframe src={src} title={titulo} className="opsat-embebida" />
              </Card>
            </StackItem>
          </VStack>
        </LayoutContent>
      }
    />
  );
}

// ════════ Pantallas de datos ═════════════════════════════════════════════
function PanelTareas() {
  const api = useApi('/api/wwp/tasks?all=1', j => Array.isArray(j) ? j : (j.tasks || []));
  const hoy = new Date().toISOString().slice(0, 10);
  const puedeCrear = puedeCrearTarea();
  return (
    <Pantalla
      titulo="Tareas"
      subtitulo="Trabajo del equipo, en vivo desde la API de OpsAT."
      acciones={puedeCrear
        ? <Button label="+ Nueva Tarea" variant="primary" clickAction={abrirNuevaTarea} />
        : undefined}
      api={api}
      vacio="No hay tareas que mostrar."
      buscarEn={['title', 'client', 'odooRef']}
      filtros={[
        {label: 'Estado', campo: 'status', opciones: Object.entries(ESTADO_TAREA).map(([v, e]: [string, EstadoMeta]) => ({valor: v, etiqueta: e.label ?? v}))},
        {label: 'Tipo', campo: 'type', opciones: Object.entries(TIPO_TAREA).map(([v, l]: [string, string]) => ({valor: v, etiqueta: l}))},
        {label: 'Prioridad', campo: 'priority', opciones: Object.entries(PRIORIDAD).map(([v, l]: [string, string]) => ({valor: v, etiqueta: l}))},
      ]}
      detalle={(t: Fila) => [
        {etiqueta: 'Tarea', valor: t.title},
        {etiqueta: 'Tipo', valor: TIPO_TAREA[t.type] || t.type},
        {etiqueta: 'Estado', valor: <Estado mapa={ESTADO_TAREA} valor={t.status} />},
        {etiqueta: 'Prioridad', valor: t.priority ? <Badge variant={PRIO_VAR[t.priority] ?? 'neutral'} label={PRIORIDAD[t.priority] || t.priority} /> : null},
        {etiqueta: 'Cliente', valor: t.client},
        {etiqueta: 'Orden Odoo', valor: t.odooRef},
        {etiqueta: 'Encargado', valor: t.managerName},
        {etiqueta: 'Vence', valor: t.dueDate ? <Timestamp value={t.dueDate} format="date" hasTooltip /> : null},
        {etiqueta: 'Creada', valor: t.createdAt ? <Timestamp value={t.createdAt} format="date_time" hasTooltip /> : null},
      ]}
      kpis={(d: Fila[]) => [
        {etiqueta: 'Pendientes',  valor: d.filter(t => t.status === 'pending').length},
        {etiqueta: 'En curso',    valor: d.filter(t => t.status === 'in_progress').length},
        {etiqueta: 'Vencidas',    valor: d.filter(t => t.dueDate && t.dueDate < hoy && !['completed','validated'].includes(t.status)).length},
        {etiqueta: 'Completadas', valor: d.filter(t => ['completed','validated'].includes(t.status)).length},
      ]}
      columnas={[
        {key: 'title', header: 'Tarea', width: proportional(2)},
        {key: 'type', header: 'Tipo', width: proportional(1),
         renderCell: (r: Fila) => <Text>{TIPO_TAREA[r.type] || r.type || '—'}</Text>},
        {key: 'status', header: 'Estado', width: pixel(160),
         renderCell: (r: Fila) => <Estado mapa={ESTADO_TAREA} valor={r.status} />},
        {key: 'priority', header: 'Prioridad', width: pixel(110),
         renderCell: (r: Fila) => r.priority ? <Badge variant={PRIO_VAR[r.priority] ?? 'neutral'} label={PRIORIDAD[r.priority] || r.priority} /> : <Text color="secondary">—</Text>},
        {key: 'client', header: 'Cliente', width: proportional(1),
         renderCell: (r: Fila) => <Text>{r.client || '—'}</Text>},
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
      filtros={[{label: 'Estado', campo: 'estado', opciones: Object.entries(ESTADO_SDV).map(([v, e]: [string, EstadoMeta]) => ({valor: v, etiqueta: e.label ?? v}))}]}
      kpis={(d: Fila[]) => [
        {etiqueta: 'Activas',     valor: d.filter(s => !['despachada','cancelada','rechazada'].includes(s.estado)).length},
        {etiqueta: 'En proceso',  valor: d.filter(s => s.estado === 'en_proceso').length},
        {etiqueta: 'Despachadas', valor: d.filter(s => s.estado === 'despachada').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'folio', header: 'Orden', width: pixel(140)},
        {key: 'clienteNombre', header: 'Cliente', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.clienteNombre || r.cliente || '—'}</Text>},
        {key: 'salesperson', header: 'Vendedora', width: proportional(1),
         renderCell: (r: Fila) => <Text>{r.salesperson || r.vendedor || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(180),
         renderCell: (r: Fila) => <Estado mapa={ESTADO_SDV} valor={r.estado} />},
        {key: 'fechaDeseada', header: 'Promesa', width: pixel(130),
         renderCell: (r: Fila) => <Text>{(r.fechaDeseada || '').slice(0, 10) || '—'}</Text>},
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
      filtros={[{label: 'Estado', campo: 'estado', opciones: Object.entries(ESTADO_SDV).map(([v, e]: [string, EstadoMeta]) => ({valor: v, etiqueta: e.label ?? v}))}]}
      kpis={(d: Fila[]) => [
        {etiqueta: 'Pendientes',  valor: d.filter(s => s.estado === 'pendiente_revision').length},
        {etiqueta: 'En proceso',  valor: d.filter(s => s.estado === 'en_proceso').length},
        {etiqueta: 'Despachadas', valor: d.filter(s => s.estado === 'despachada').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'folio', header: 'Folio', width: pixel(140)},
        {key: 'clienteNombre', header: 'Cliente', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.clienteNombre || r.cliente || '—'}</Text>},
        {key: 'tipoSolicitud', header: 'Tipo', width: proportional(1),
         renderCell: (r: Fila) => <Text>{r.tipoSolicitud || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(180),
         renderCell: (r: Fila) => <Estado mapa={ESTADO_SDV} valor={r.estado} />},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Pendientes', valor: d.filter(r => r.estado === 'pendiente').length},
        {etiqueta: 'Aprobadas',  valor: d.filter(r => r.estado === 'aprobada').length},
        {etiqueta: 'Total',      valor: d.length},
      ]}
      columnas={[
        {key: 'sdvFolio', header: 'Folio SDV', width: pixel(150),
         renderCell: (r: Fila) => <Text>{r.sdvFolio || r.folio || '—'}</Text>},
        {key: 'motivo', header: 'Motivo', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.motivo || r.razon || '—'}</Text>},
        {key: 'solicitadoPor', header: 'Solicitado por', width: proportional(1),
         renderCell: (r: Fila) => <Text>{r.solicitadoPor || r.creadoNombre || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(150),
         renderCell: (r: Fila) => <Estado mapa={{pendiente:{label:'Pendiente',dot:'warning'}, aprobada:{label:'Aprobada',dot:'success'}, rechazada:{label:'Rechazada',dot:'error'}}} valor={r.estado} />},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Borradores', valor: d.filter(c => c.estado === 'borrador').length},
        {etiqueta: 'Entregados', valor: d.filter(c => c.estado === 'entregado').length},
        {etiqueta: 'Anulados',   valor: d.filter(c => c.estado === 'anulado').length},
        {etiqueta: 'Total',      valor: d.length},
      ]}
      columnas={[
        {key: 'folio', header: 'Conduce', width: pixel(130)},
        {key: 'receptorNombre', header: 'Recibe', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.receptorNombre || r.receptor || '—'}</Text>},
        {key: 'empresa', header: 'Empresa', width: proportional(1),
         renderCell: (r: Fila) => <Text>{r.empresa || '—'}</Text>},
        {key: 'estado', header: 'Estado', width: pixel(150),
         renderCell: (r: Fila) => <Estado mapa={{borrador:{label:'Borrador',dot:'neutral'}, entregado:{label:'Entregado',dot:'success'}, anulado:{label:'Anulado',dot:'error'}}} valor={r.estado} />},
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
      filtros={[{label: 'Estado', campo: 'status', opciones: Object.keys(ESTADO_AVERIA).map((v: string) => ({valor: v, etiqueta: v}))}]}
      detalle={(a: Fila) => [
        {etiqueta: 'Artículo', valor: a.name},
        {etiqueta: 'Referencia', valor: a.ref},
        {etiqueta: 'Código de barras', valor: a.barcode},
        {etiqueta: 'Cantidad', valor: a.qty},
        {etiqueta: 'Estado', valor: <Estado mapa={ESTADO_AVERIA} valor={a.status} />},
        {etiqueta: 'Ubicación', valor: a.location},
        {etiqueta: 'Comentario', valor: a.comentario},
        {etiqueta: 'Registrada', valor: a.createdAt ? <Timestamp value={a.createdAt} format="date_time" hasTooltip /> : null},
      ]}
      kpis={(d: Fila[]) => [
        {etiqueta: 'Recibidos', valor: d.filter(a => a.status === 'Recibido').length},
        {etiqueta: 'En taller', valor: d.filter(a => a.status === 'En Taller').length},
        {etiqueta: 'Reparados', valor: d.filter(a => a.status === 'Reparado').length},
        {etiqueta: 'Total',     valor: d.length},
      ]}
      columnas={[
        {key: 'ref', header: 'Referencia', width: pixel(140)},
        {key: 'name', header: 'Artículo', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.name || '—'}</Text>},
        {key: 'qty', header: 'Cant.', width: pixel(80), align: 'end',
         renderCell: (r: Fila) => <Text hasTabularNumbers>{r.qty ?? '—'}</Text>},
        {key: 'status', header: 'Estado', width: pixel(160),
         renderCell: (r: Fila) => <Estado mapa={ESTADO_AVERIA} valor={r.status} />},
        {key: 'comentario', header: 'Comentario', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.comentario || '—'}</Text>},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Pendientes',  valor: d.filter(r => r.estado === 'pendiente_aprobacion').length},
        {etiqueta: 'Aprobadas',   valor: d.filter(r => r.estado === 'aprobada').length},
        {etiqueta: 'Completadas', valor: d.filter(r => r.estado === 'completada').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'ref', header: 'Referencia', width: pixel(140),
         renderCell: (r: Fila) => <Text>{r.ref || r.referencia || '—'}</Text>},
        {key: 'nombre', header: 'Artículo', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.nombre || '—'}</Text>},
        {key: 'cantidad', header: 'Cant.', width: pixel(80), align: 'end',
         renderCell: (r: Fila) => <Text hasTabularNumbers>{r.cantidad ?? '—'}</Text>},
        {key: 'urgencia', header: 'Urgencia', width: pixel(110),
         renderCell: (r: Fila) => r.urgencia ? <Badge label={r.urgencia} /> : <Text color="secondary">—</Text>},
        {key: 'estado', header: 'Estado', width: pixel(180),
         renderCell: (r: Fila) => <Estado mapa={{borrador:{label:'Borrador',dot:'neutral'}, pendiente_aprobacion:{label:'Pendiente',dot:'warning'}, aprobada:{label:'Aprobada',dot:'accent'}, en_proceso:{label:'En proceso',dot:'accent'}, completada:{label:'Completada',dot:'success'}, rechazada:{label:'Rechazada',dot:'error'}}} valor={r.estado} />},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Activas',     valor: d.filter(s => s.status === 'activo').length},
        {etiqueta: 'Completadas', valor: d.filter(s => s.status === 'completado').length},
        {etiqueta: 'Total',       valor: d.length},
      ]}
      columnas={[
        {key: 'name', header: 'Artículo', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.name || r.nombre || '—'}</Text>},
        {key: 'barcode', header: 'Cód. barras', width: pixel(150),
         renderCell: (r: Fila) => <Text>{r.barcode || '—'}</Text>},
        {key: 'solicitadoPor', header: 'Solicitado por', width: proportional(1),
         renderCell: (r: Fila) => <Text>{r.solicitadoPor || r.usuario || '—'}</Text>},
        {key: 'status', header: 'Estado', width: pixel(150),
         renderCell: (r: Fila) => <Estado mapa={{activo:{label:'Activa',dot:'accent'}, completado:{label:'Completada',dot:'success'}, cancelado:{label:'Cancelada',dot:'neutral'}}} valor={r.status} />},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Vehículos', valor: d.length},
        {etiqueta: 'Medidor detallado', valor: d.filter(v => v.fuelType === 'detallado').length},
        {etiqueta: 'Medidor estándar',  valor: d.filter(v => v.fuelType !== 'detallado').length},
      ]}
      columnas={[
        {key: 'name', header: 'Vehículo', width: proportional(2)},
        {key: 'placa', header: 'Placa', width: pixel(140),
         renderCell: (r: Fila) => <Text>{r.placa || '—'}</Text>},
        {key: 'fuelType', header: 'Medidor', width: pixel(160),
         renderCell: (r: Fila) => <Text>{r.fuelType === 'detallado' ? 'Detallado' : 'Estándar'}</Text>},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Cursos',    valor: d.length},
        {etiqueta: 'Activos',   valor: d.filter(c => c.active !== false).length},
        {etiqueta: 'Con gate',  valor: d.filter(c => c.enforceGate).length},
      ]}
      columnas={[
        {key: 'title', header: 'Curso', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.title || r.nombre || r.id || '—'}</Text>},
        {key: 'passingScore', header: 'Nota mínima', width: pixel(130), align: 'end',
         renderCell: (r: Fila) => <Text hasTabularNumbers>{r.passingScore != null ? r.passingScore + '%' : '—'}</Text>},
        {key: 'validityDays', header: 'Vigencia', width: pixel(120),
         renderCell: (r: Fila) => <Text>{r.validityDays ? r.validityDays + ' días' : '—'}</Text>},
        {key: 'enforceGate', header: 'Bloquea tareas', width: pixel(150),
         renderCell: (r: Fila) => <Text color={r.enforceGate ? 'primary' : 'secondary'}>{r.enforceGate ? 'Sí' : 'No'}</Text>},
        {key: 'active', header: 'Estado', width: pixel(140),
         renderCell: (r: Fila) => <Estado mapa={{true:{label:'Activo',dot:'success'}, false:{label:'Inactivo',dot:'neutral'}}} valor={String(r.active !== false)} />},
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
        {label: 'Rol', campo: 'role', opciones: Object.entries(ROL).map(([v, l]: [string, string]) => ({valor: v, etiqueta: l}))},
        {label: 'Adopción', campo: 'semaforo', opciones: [{valor:'activo',etiqueta:'Activo'},{valor:'tibio',etiqueta:'Tibio'},{valor:'inactivo',etiqueta:'Inactivo'},{valor:'nunca',etiqueta:'Nunca entró'}]},
      ]}
      detalle={(u: Fila) => [
        {etiqueta: 'Persona', valor: u.name},
        {etiqueta: 'Rol', valor: <Token color={ROL_COLOR[u.role] ?? 'gray'} size="sm" label={ROL[u.role] || u.role} />},
        {etiqueta: 'Adopción', valor: u.semaforo},
        {etiqueta: 'Trayectoria', valor: u.trayectoria},
        {etiqueta: 'Nivel', valor: u.nivel},
        {etiqueta: 'Localidad', valor: u.categoria},
      ]}
      kpis={(d: Fila[]) => [
        {etiqueta: 'Activos',   valor: d.filter(u => u.semaforo === 'activo').length},
        {etiqueta: 'Tibios',    valor: d.filter(u => u.semaforo === 'tibio').length},
        {etiqueta: 'Inactivos', valor: d.filter(u => u.semaforo === 'inactivo').length},
        {etiqueta: 'Personas',  valor: d.length},
      ]}
      columnas={[
        {key: 'name', header: 'Persona', width: proportional(2),
         renderCell: (r: Fila) => <HStack gap={2} vAlign="center"><Avatar size="sm" name={r.name} /><Text>{r.name}</Text></HStack>},
        {key: 'role', header: 'Rol', width: pixel(130),
         renderCell: (r: Fila) => <Token color={ROL_COLOR[r.role] ?? 'gray'} size="sm" label={ROL[r.role] || r.role || '—'} />},
        {key: 'semaforo', header: 'Adopción', width: pixel(160),
         renderCell: (r: Fila) => <Estado mapa={{activo:{label:'Activo',dot:'success'}, tibio:{label:'Tibio',dot:'warning'}, inactivo:{label:'Inactivo',dot:'error'}, nunca:{label:'Nunca entró',dot:'neutral'}}} valor={r.semaforo} />},
        {key: 'nivel', header: 'Nivel', width: pixel(100), align: 'end',
         renderCell: (r: Fila) => <Text hasTabularNumbers>{r.nivel ?? '—'}</Text>},
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
      kpis={(d: Fila[]) => [
        {etiqueta: 'Políticas', valor: d.length},
        {etiqueta: 'Activas',   valor: d.filter(p => p.activa !== false).length},
        {etiqueta: 'Pausadas',  valor: d.filter(p => p.activa === false).length},
      ]}
      columnas={[
        {key: 'nombre', header: 'Política', width: proportional(2)},
        {key: 'tipo', header: 'Tipo', width: proportional(1),
         renderCell: (r: Fila) => <Text>{(({lunch_duration:'Duración de almuerzo', arrival_time:'Hora de llegada', task_completion:'Completitud de tareas', vehicle_inspection:'Inspección vehicular'} as Record<string,string>)[r.tipo]) || r.tipo || '—'}</Text>},
        {key: 'descripcion', header: 'Descripción', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.descripcion || '—'}</Text>},
        {key: 'activa', header: 'Estado', width: pixel(140),
         renderCell: (r: Fila) => <Estado mapa={{true:{label:'Activa',dot:'success'}, false:{label:'Pausada',dot:'neutral'}}} valor={String(r.activa !== false)} />},
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
      filtros={[{label: 'Rol', campo: 'role', opciones: Object.entries(ROL).map(([v, l]: [string, string]) => ({valor: v, etiqueta: l}))}]}
      detalle={(u: Fila) => [
        {etiqueta: 'Nombre', valor: u.name},
        {etiqueta: 'Correo', valor: u.email},
        {etiqueta: 'Rol', valor: <Token color={ROL_COLOR[u.role] ?? 'gray'} size="sm" label={ROL[u.role] || u.role} />},
        {etiqueta: 'Estado', valor: <Estado mapa={{true:{label:'Activo',dot:'success'}, false:{label:'Inactivo',dot:'neutral'}}} valor={String(u.active !== false)} />},
        {etiqueta: 'ID Odoo', valor: u.odooId},
        {etiqueta: 'Último acceso', valor: u.lastLogin ? <Timestamp value={u.lastLogin} format="auto" hasTooltip /> : null},
        {etiqueta: 'Categoría', valor: u.categoria},
      ]}
      kpis={(d: Fila[]) => [
        {etiqueta: 'Total',      valor: d.length},
        {etiqueta: 'Admins',     valor: d.filter(u => u.role === 'admin').length},
        {etiqueta: 'Encargados', valor: d.filter(u => u.role === 'manager').length},
        {etiqueta: 'Auxiliares', valor: d.filter(u => u.role === 'assistant').length},
      ]}
      columnas={[
        {key: 'name', header: 'Nombre', width: proportional(2),
         renderCell: (r: Fila) => <HStack gap={2} vAlign="center"><Avatar size="sm" name={r.name} /><Text>{r.name}</Text></HStack>},
        {key: 'email', header: 'Correo', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.email || '—'}</Text>},
        {key: 'role', header: 'Rol', width: pixel(130),
         renderCell: (r: Fila) => <Token color={ROL_COLOR[r.role] ?? 'gray'} size="sm" label={ROL[r.role] || r.role || '—'} />},
        {key: 'active', header: 'Estado', width: pixel(140),
         renderCell: (r: Fila) => <Estado mapa={{true:{label:'Activo',dot:'success'}, false:{label:'Inactivo',dot:'neutral'}}} valor={String(r.active !== false)} />},
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
      kpis={(d: Fila[]) => [{etiqueta: 'Registros', valor: d.length}]}
      columnas={[
        {key: 'odooRef', header: 'Orden', width: pixel(150),
         renderCell: (r: Fila) => <Text>{r.odooRef || r.ref || '—'}</Text>},
        {key: 'title', header: 'Tarea', width: proportional(2),
         renderCell: (r: Fila) => <Text>{r.title || '—'}</Text>},
        {key: 'count', header: 'Fotos', width: pixel(100), align: 'end',
         renderCell: (r: Fila) => <Text hasTabularNumbers>{r.count ?? (r.fotos ? r.fotos.length : '—')}</Text>},
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
const PanelMapa        = () => <Embebida titulo="Mapa del Almacén" subtitulo="Vista 3D de ubicaciones y racks." src="/almacen-mapa.html" />;
const PanelEmpaque     = () => <Embebida titulo="Materiales de Empaque" subtitulo="Catálogo y reglas por familia de artículos." src="/empaque.html" />;

// ════════ Navegación: los 5 dominios del plan UX (doc 10) ════════════════
const DOMINIOS: Dominio[] = [
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

// El componente de enlace necesita navegar, pero LinkProvider lo instancia fuera
// del árbol del router. Un puntero de módulo es lo más simple y evita montar un
// contexto extra solo para esto.
let _irA: ((r: string) => void) | null = null;

/** Enlace de toda la app (LinkProvider): intercepta la navegación interna y deja
 *  pasar el resto — cmd/ctrl-clic, botón central y enlaces externos siguen
 *  abriendo en pestaña nueva como espera el usuario. */
function EnlaceApp({href, children, ...resto}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const interno = typeof href === 'string' && href.startsWith('/v2');
  return (
    <a
      href={href}
      {...resto}
      onClick={ev => {
        if (resto.onClick) resto.onClick(ev);
        if (!interno || ev.defaultPrevented) return;
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
        ev.preventDefault();
        if (_irA) _irA(href);
      }}>
      {children}
    </a>
  );
}

/** Routing con paths reales (pushState/popstate), igual que el shell actual (v227). */
function useRuta() {
  const [ruta, setRuta] = useState<string>(() => location.pathname);
  useEffect(() => {
    const onPop = () => setRuta(location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const ir = useCallback((r: string) => {
    if (r === location.pathname) return;
    history.pushState({}, '', r);
    setRuta(r);
  }, []);
  return [ruta, ir] as const;
}

interface PropsLimite { clave: string; children: React.ReactNode }
interface EstadoLimite { fallo: Error | null }
class LimiteDeError extends Component<PropsLimite, EstadoLimite> {
  constructor(p: PropsLimite) { super(p); this.state = {fallo: null}; }
  static getDerivedStateFromError(e: Error): EstadoLimite { return {fallo: e}; }
  componentDidUpdate(prev: PropsLimite) { if (prev.clave !== this.props.clave && this.state.fallo) this.setState({fallo: null}); }
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
  _irA = ir;   // lo consume EnlaceApp a través de LinkProvider
  const actual = TODOS.find(i => i.ruta === ruta) || TODOS[0];
  const Panel = actual.panel;
  const estadoSesion = useEstadoSesion();
  let modoTema: 'light' | 'dark' = 'light';
  try {
    modoTema = localStorage.getItem('wwp_theme') === 'dark' ? 'dark' : 'light';
  } catch {
    // localStorage puede estar bloqueado por políticas del navegador.
  }

  if (estadoSesion === 'comprobando') {
    return (
      <Theme theme={opsatTheme} mode={modoTema}>
        <AppShell contentPadding={4}>
          <EmptyState
            icon={<Spinner />}
            title="Restaurando sesión…"
            description="Estamos renovando el acceso seguro a Ops AT."
          />
        </AppShell>
      </Theme>
    );
  }

  if (estadoSesion === 'inactiva') {
    return (
      <Theme theme={opsatTheme} mode={modoTema}>
        <AppShell contentPadding={4}>
          <EmptyState
            title="Inicia sesión para abrir Ops AT"
            description="La interfaz nueva usa la misma sesión segura que la aplicación actual."
            actions={
              <Button
                label="Ir al inicio de sesión"
                variant="primary"
                clickAction={irAlInicioDeSesion}
              />
            }
          />
        </AppShell>
      </Theme>
    );
  }

  return (
    <Theme theme={opsatTheme} mode={modoTema}>
    <LinkProvider component={EnlaceApp}>
    <AppShell
      contentPadding={0}
      mobileNav={{breakpoint: 'lg'}}
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
    </LinkProvider>
    </Theme>
  );
}

// Auto-montaje: el bundle es un módulo ESM autocontenido (React y Astryx van
// dentro). Ya no hay globales window.React / window.Astryx que orquestar.
const raiz = document.getElementById('root');
if (raiz) createRoot(raiz).render(<ShellOpsAT />);

// Shell de OpsAT reconstruido con Astryx (design system de Meta).
// Reemplaza el sidebar artesanal por AppShell + SideNav del sistema.
//
// REGLAS DE ASTRYX que respeta este archivo (ver CLAUDE.md, bloque ASTRYX):
//  - Sin <div> ni HTML crudo para layout: todo va con AppShell/Layout/Stack/Card.
//  - Sin style={{}} ni hex/px crudos: props de componente y tokens var(--*).
//  - Datos densos = filas (Table/List), NUNCA items de lista envueltos en Card.
//  - StatusDot para estado; Badge solo para conteos y estados enumerados.
//
// Se compila con `npm run build:islas` → vendor/islas/shell-astryx.js
// React y Astryx NO se empaquetan aquí: llegan como globales vendorizados.

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
import {
  ClipboardDocumentListIcon,
  TruckIcon,
  InboxIcon,
  ArrowPathIcon,
  PaperClipIcon,
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
  MapIcon,
  ChartBarIcon,
  PhotoIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

// La navegación real de OpsAT, por dominio de negocio (plan UX doc 10).
const DOMINIOS = [
  {
    titulo: 'Operación del equipo',
    items: [
      {label: 'Tareas', icon: ClipboardDocumentListIcon, ruta: '/tareas'},
      {label: 'Inspección de vehículo', icon: WrenchScrewdriverIcon, ruta: '/inspeccion'},
      {label: 'Formación', icon: AcademicCapIcon, ruta: '/formacion'},
    ],
  },
  {
    titulo: 'Ventas → Despacho',
    items: [
      {label: 'Estado de Órdenes', icon: ClipboardDocumentListIcon, ruta: '/estado-ordenes'},
      {label: 'Solicitud de Despacho', icon: TruckIcon, ruta: '/sdv-portal'},
      {label: 'Bandeja SDV', icon: InboxIcon, ruta: '/sdv-bandeja'},
      {label: 'Reactivaciones SDV', icon: ArrowPathIcon, ruta: '/sdv-reactivations'},
      {label: 'Despachos sin Comprobante', icon: PaperClipIcon, ruta: '/sin-adjuntos'},
      {label: 'Conduces Outlet', icon: ArchiveBoxIcon, ruta: '/despacho-obsoleto'},
    ],
  },
  {
    titulo: 'Almacén',
    items: [
      {label: 'Buscador', icon: MagnifyingGlassIcon, ruta: '/buscar'},
      {label: 'Inventario', icon: CubeIcon, ruta: '/inventario'},
      {label: 'Averías', icon: ExclamationTriangleIcon, ruta: '/averias'},
      {label: 'Devoluciones a CDP', icon: ArrowsRightLeftIcon, ruta: '/dev-cdp'},
      {label: 'Reposición Showroom', icon: BuildingStorefrontIcon, ruta: '/reposicion'},
      {label: 'Mapa del Almacén', icon: MapIcon, ruta: '/almacen-mapa'},
    ],
  },
  {
    titulo: 'Supervisión',
    items: [
      {label: 'Panel del Equipo', icon: ChartBarIcon, ruta: '/supervision'},
      {label: 'Evidencias', icon: PhotoIcon, ruta: '/supervision/evidencias'},
    ],
  },
  {
    titulo: 'Configuración',
    items: [{label: 'Usuarios y ajustes', icon: Cog6ToothIcon, ruta: '/configuracion'}],
  },
];

// KPIs de ejemplo — en la integración real vienen de /api/wwp/tasks.
const KPIS = [
  {etiqueta: 'Pendientes', valor: '12'},
  {etiqueta: 'En curso', valor: '5'},
  {etiqueta: 'Vencidas', valor: '2'},
  {etiqueta: 'Completadas', valor: '31'},
];

function PanelDemo() {
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>Tareas</Heading>
        <Text color="secondary">
          Shell de OpsAT reconstruido con AppShell y SideNav de Astryx.
        </Text>
      </VStack>

      <HStack gap={3} wrap>
        {KPIS.map(k => (
          <Card key={k.etiqueta} padding={4} minWidth={150}>
            <VStack gap={1}>
              <Text color="secondary" size="sm">{k.etiqueta}</Text>
              <Heading level={3}>{k.valor}</Heading>
            </VStack>
          </Card>
        ))}
      </HStack>

      <HStack gap={2} wrap>
        <Button label="+ Nueva Tarea" variant="primary" />
        <Button label="Resumen del equipo" variant="secondary" />
        <Button label="Filtros" variant="ghost" />
      </HStack>

      <Card padding={4}>
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Heading level={4}>Estado del sistema de diseño</Heading>
            <Badge label="Astryx" />
          </HStack>
          <Text>
            Esta pantalla usa únicamente componentes de Astryx: sin div de layout,
            sin estilos en línea y sin valores hex o px escritos a mano.
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
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
              headingHref="/historial.html"
            />
          }
          footer={
            <SideNavSection title="Cuenta" isHeaderHidden>
              <SideNavItem label="Mi cuenta" icon={UserCircleIcon} href="#" />
            </SideNavSection>
          }>
          {DOMINIOS.map(dominio => (
            <SideNavSection key={dominio.titulo} title={dominio.titulo}>
              {dominio.items.map(item => (
                <SideNavItem
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  href={item.ruta}
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
            <PanelDemo />
          </LayoutContent>
        }
      />
    </AppShell>
  );
}

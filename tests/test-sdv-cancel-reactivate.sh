#!/bin/bash

# Test script para endpoints de cancelación y reactivación SDV
# Ejecutar: bash test-sdv-cancel-reactivate.sh

BASE_URL="http://localhost:3000"

# 1. Login como vendedor para obtener JWT
echo "=== 1. LOGIN ==="
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"vendor@altritempi.com.do","password":"123456"}')
echo "$LOGIN_RESP" | jq .
JWT=$(echo "$LOGIN_RESP" | jq -r '.token // empty')
if [ -z "$JWT" ]; then
  echo "Login failed!"
  exit 1
fi
echo "JWT: $JWT"
echo ""

# 2. Crear una SDV de prueba
echo "=== 2. CREAR SDV DE PRUEBA ==="
SDV_RESP=$(curl -s -X POST "$BASE_URL/api/sdv" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tipoSolicitud": "despacho",
    "odooOrderRef": "TEST-001",
    "clienteNombre": "Cliente Test",
    "direccionEntrega": "Calle Test 123",
    "ciudadEntrega": "Santo Domingo",
    "receptorNombre": "Receptor",
    "receptorContacto": "809-555-0123",
    "observaciones": "Test de cancelación"
  }')
echo "$SDV_RESP" | jq .
SDV_ID=$(echo "$SDV_RESP" | jq -r '.solicitud.id // empty')
if [ -z "$SDV_ID" ]; then
  echo "SDV creation failed!"
  exit 1
fi
echo "SDV_ID: $SDV_ID"
echo ""

# 3. Cancelar SDV (estado pendiente_revision, debe permitir)
echo "=== 3. CANCELAR SDV (sin bloqueo) ==="
CANCEL_RESP=$(curl -s -X PATCH "$BASE_URL/api/sdv/$SDV_ID?action=cancel" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "motivo": "Cliente cambió idea",
    "urgencia": "normal"
  }')
echo "$CANCEL_RESP" | jq .
echo ""

# 4. Solicitar reactivación
echo "=== 4. SOLICITAR REACTIVACIÓN ==="
REAC_RESP=$(curl -s -X POST "$BASE_URL/api/sdv/$SDV_ID/reactivation" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "new_delivery_date": "2026-06-25T10:00:00Z",
    "motivo_reactivacion": "Cliente confirmó nueva fecha"
  }')
echo "$REAC_RESP" | jq .
REAC_ID=$(echo "$REAC_RESP" | jq -r '.reactivacion_id // empty')
if [ -z "$REAC_ID" ]; then
  echo "Reactivation request failed!"
  exit 1
fi
echo "REAC_ID: $REAC_ID"
echo ""

# 5. LOGIN como Ops/Manager para procesar
echo "=== 5. LOGIN COMO OPS/MANAGER ==="
OPS_RESP=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"gsanchez@altritempi.com.do","password":"123456"}')
echo "$OPS_RESP" | jq .
OPS_JWT=$(echo "$OPS_RESP" | jq -r '.token // empty')
if [ -z "$OPS_JWT" ]; then
  echo "OPS login might have failed, but continuing..."
fi
echo "OPS_JWT: $OPS_JWT"
echo ""

# 6. Ver bandeja de reactivaciones pendientes
echo "=== 6. VER REACTIVACIONES PENDIENTES (Bandeja Ops) ==="
BANDEJA_RESP=$(curl -s -X GET "$BASE_URL/api/sdv/reactivation?estado=pendiente" \
  -H "Authorization: Bearer $OPS_JWT")
echo "$BANDEJA_RESP" | jq .
echo ""

# 7. Procesar reactivación (como Ops)
echo "=== 7. PROCESAR REACTIVACIÓN (Ops) ==="
PROCESS_RESP=$(curl -s -X PATCH "$BASE_URL/api/sdv/reactivation/$REAC_ID?action=process" \
  -H "Authorization: Bearer $OPS_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "cuando_procesar": "2026-06-24T17:00:00Z",
    "notas_ops": "Incluida en ruta vespertina"
  }')
echo "$PROCESS_RESP" | jq .
echo ""

# 8. Ver KPIs de cancelaciones
echo "=== 8. VER KPIs DE CANCELACIONES ==="
KPI_RESP=$(curl -s -X GET "$BASE_URL/api/sdv/kpis/cancelaciones" \
  -H "Authorization: Bearer $OPS_JWT")
echo "$KPI_RESP" | jq .
echo ""

echo "=== TEST COMPLETE ==="

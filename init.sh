#!/usr/bin/env bash
# init.sh — Verificación e inicialización del entorno
#
# Este script lo ejecuta el agente al COMENZAR una sesión y antes de
# declarar cualquier tarea como `done`. Si falla, la sesión no debe avanzar.

set -u
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$1"; }

EXIT_CODE=0

echo "── 1. Verificando entorno básico ──────────────────────"

# Verificar que las herramientas esenciales estén disponibles
for cmd in node pnpm git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "$cmd no está instalado"
    EXIT_CODE=1
  else
    ok "$cmd disponible -> $($cmd --version | head -n 1)"
  fi
done

echo ""
echo "── 2. Verificando archivos base del arnés ──────────────"

for f in AGENTS.md CHECKPOINTS.md progress/current.md progress/history.md; do
  if [ ! -f "$f" ]; then
    fail "Falta archivo base del arnés: $f"
    EXIT_CODE=1
  else
    ok "Existe $f"
  fi
done

echo ""
echo "── 3. Instalando dependencias si es necesario ──────────"

if [ -f "package.json" ]; then
  if [ ! -d "node_modules" ]; then
    warn "node_modules no existe. Instalando dependencias..."
    pnpm install
  else
    ok "node_modules detectado"
  fi
else
  warn "package.json no detectado en la raíz"
fi

echo ""
echo "── 4. Ejecutando verificación de tipos y linter ────────"

if grep -q "typecheck" package.json 2>/dev/null; then
  if pnpm typecheck; then
    ok "Typecheck completado sin errores"
  else
    fail "Errores de tipos detectados"
    EXIT_CODE=1
  fi
else
  warn "No se detectó script 'typecheck' en package.json"
fi

echo ""
echo "── 5. Ejecutando suite de pruebas ─────────────────────"

if grep -q "\"test\"" package.json 2>/dev/null; then
  if pnpm test run; then
    ok "Todos los tests pasan con éxito"
  else
    fail "Hay tests rotos en la suite"
    EXIT_CODE=1
  fi
else
  warn "No se detectó script 'test' en package.json"
fi

echo ""
echo "── 6. Resumen de salud del repositorio ──────────────────"

if [ $EXIT_CODE -eq 0 ]; then
  ok "Entorno listo y saludable. Podés empezar a trabajar."
else
  fail "Entorno NO saludable. Resuelve los errores antes de continuar."
fi

exit $EXIT_CODE

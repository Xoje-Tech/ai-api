#!/usr/bin/env bash
# init.sh — Verificación automática de salud (Node + pnpm)
set -u
echo "── Verificando Entorno ──"
if ! command -v node >/dev/null 2>&1; then echo "[FAIL] node no disponible"; exit 1; fi
if ! command -v pnpm >/dev/null 2>&1; then echo "[FAIL] pnpm no disponible"; exit 1; fi
echo "[OK] node -> $(node --version)"
echo "[OK] pnpm -> $(pnpm --version)"

echo ""
echo "── Instalando dependencias ──"
pnpm install

echo ""
echo "── Ejecutando linter y typecheck ──"
if pnpm run | grep -q "typecheck"; then
  pnpm run typecheck || { echo "[FAIL] Falló el typecheck"; exit 1; }
fi
if pnpm run | grep -q "lint"; then
  pnpm run lint || { echo "[FAIL] Falló el linter"; exit 1; }
fi

echo ""
echo "── Ejecutando tests ──"
if pnpm run | grep -q "test"; then
  pnpm run test || { echo "[FAIL] Hay tests rotos"; exit 1; }
else
  echo "[WARN] No se detectó script de test en package.json"
fi

echo ""
echo "[OK] Entorno listo y verificado de forma exitosa."

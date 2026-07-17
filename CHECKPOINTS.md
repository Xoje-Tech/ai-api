# CHECKPOINTS — Evaluación del estado final de la sesión

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) debe validar
> para certificar que el repositorio está en estado correcto antes de cerrar la sesión.

## C1 — El arnés está completo y operativo
- [ ] Existen los 3 archivos base del arnés en la raíz: `AGENTS.md`, `init.sh` y `CHECKPOINTS.md`.
- [ ] Existe la carpeta de progreso `/progress/` con los archivos `current.md` y `history.md`.
- [ ] `./init.sh` se ejecuta sin errores y finaliza con exit code 0.

## C2 — El estado de Git y la bitácora son coherentes
- [ ] Como máximo hay una feature con estado `in_progress` en `feature_list.json` (si existe).
- [ ] Toda feature con estado `done` tiene tests asociados que pasan.
- [ ] `progress/current.md` describe correctamente la sesión activa y no contiene basura.
- [ ] Los subagentes técnicos han escrito sus reportes (`progress/impl_*.md` o `progress/review_*.md`) en disco y devuelto solo la referencia de una línea.

## C3 — El código respeta la arquitectura y las convenciones
- [ ] La estructura de archivos respeta las capas de `project-doctrine` (ej. Hexagonal / Screaming).
- [ ] No se han introducido dependencias externas no declaradas o no permitidas.
- [ ] No hay sentencias de debug como `print()` o `console.log()` huérfanos, ni TODOs sin contexto.

## C4 — La verificación es real y automatizada
- [ ] Cada nuevo módulo o cambio significativo tiene un test unitario o de integración asociado.
- [ ] Los tests se ejecutan herméticamente (usan directorios temporales, DBs de prueba separadas, etc.).
- [ ] El test runner reporta un éxito del 100% en la suite de pruebas.

## C5 — La sesión se cerró correctamente (Lifecycle)
- [ ] No quedan archivos temporales (`*.tmp`, logs locales, carpetas caché no ignoradas) fuera de `.gitignore`.
- [ ] Se ha añadido una entrada compacta al final de `progress/history.md` resumiendo esta sesión.
- [ ] `progress/current.md` se ha vaciado dejando únicamente la plantilla limpia para la próxima sesión.
